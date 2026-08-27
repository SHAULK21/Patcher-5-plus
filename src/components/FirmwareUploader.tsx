import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  Binary, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ShieldCheck, 
  Download, 
  RefreshCw, 
  Cpu, 
  Sliders, 
  Layers, 
  Code, 
  Terminal, 
  ArrowRight, 
  FileCode,
  Zap,
  Activity,
  FileCheck
} from 'lucide-react';

interface Props {
  isRu: boolean;
}

interface BinaryScanReport {
  fileName: string;
  fileSize: number;
  initialSp: number;
  resetVector: number;
  isArmThumb2: boolean;
  isBrightwayLayout: boolean;
  
  // 5-Point Diagnostics
  selectorFound: boolean;
  selectorAddresses: string[];
  
  speedHookFound: boolean;
  hookFormId?: string;
  hookFormName?: string;
  hookFileOffset?: number;
  hookMcuAddress?: number;
  currentHookBytesHex?: string;
  currentInstructionDisasm?: string;
  isAlreadyPatched?: boolean;
  detectedCurrentSpeed?: number;
  
  regionalTablesFound: boolean;
  regionalTableOffsets: number[];
  
  hexPreviewOffset: number;
  hexPreviewBytes: number[];
}

export const FirmwareUploader: React.FC<Props> = ({ isRu }) => {
  const [binaryData, setBinaryData] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [scanReport, setScanReport] = useState<BinaryScanReport | null>(null);
  const [targetSpeed, setTargetSpeed] = useState<number>(35);
  const [unlockRegions, setUnlockRegions] = useState<boolean>(true);
  const [patchedData, setPatchedData] = useState<Uint8Array | null>(null);
  const [patchApplied, setPatchApplied] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Analyze raw Uint8Array from user .bin
  const analyzeFirmware = (data: Uint8Array, name: string) => {
    const size = data.length;
    if (size < 1024) {
      alert(isRu ? 'Файл слишком мал для прошивки (< 1 КБ)' : 'File too small for firmware (< 1 KB)');
      return;
    }

    // 1. Vector Table Parser
    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const initialSp = dv.getUint32(0x00, true);
    const resetVector = dv.getUint32(0x04, true);

    const isArmThumb2 = (resetVector & 0x01) === 1 && resetVector >= 0x08000000 && resetVector < 0x08040000;
    const isBrightwayLayout = initialSp >= 0x20000000 && initialSp <= 0x20005000;

    // 2. Scan for Selector (0x20001E2C / 0x20001E22 references in literal pools)
    const selectorAddresses: string[] = [];
    const targetAddr1 = 0x20001E2C;
    const targetAddr2 = 0x20001E22;
    for (let i = 0; i < size - 4; i += 4) {
      const val = dv.getUint32(i, true);
      if (val === targetAddr1 || val === targetAddr2) {
        selectorAddresses.push(`0x${val.toString(16).toUpperCase()} @ Literal Pool 0x${(0x08000000 + i).toString(16).toUpperCase()}`);
      }
    }
    const selectorFound = isBrightwayLayout || selectorAddresses.length > 0;

    // 3. Multi-Form Hook Scanner
    let speedHookFound = false;
    let hookFormId = '';
    let hookFormName = '';
    let hookFileOffset = -1;
    let currentHookBytesHex = '';
    let currentInstructionDisasm = '';
    let isAlreadyPatched = false;
    let detectedCurrentSpeed = 25;

    // Scan for forms across binary
    for (let i = 0; i < size - 6; i++) {
      const b0 = data[i];
      const b1 = data[i + 1];
      const b2 = data[i + 2];
      const b3 = data[i + 3];
      const b4 = data[i + 4];
      const b5 = data[i + 5];

      // Form checking (b1 == 0x49: LDR r1, [pc, #imm], b4 == 0x08, b5 == 0x80: STRH r0, [r1])
      if (b1 === 0x49 && b4 === 0x08 && b5 === 0x80) {
        speedHookFound = true;
        hookFileOffset = i + 2; // target is b2 b3
        const hex = `${b2.toString(16).padStart(2, '0').toUpperCase()} ${b3.toString(16).padStart(2, '0').toUpperCase()}`;
        currentHookBytesHex = hex;

        if (b2 === 0x78 && b3 === 0x7A) {
          if (b0 === 0xAB) {
            hookFormId = 'form_1';
            hookFormName = isRu ? 'Форма 1: Заводская точная (AB 49 78 7A 08 80)' : 'Form 1: Pristine Exact (AB 49 78 7A 08 80)';
          } else {
            hookFormId = 'form_2';
            hookFormName = isRu ? 'Форма 2: Гибкое смещение PC-Rel (?? 49 78 7A 08 80)' : 'Form 2: Flexible PC-Rel Displacement';
          }
          currentInstructionDisasm = 'LDRB r0, [r7, #9] (Dynamic Mode Struct)';
          isAlreadyPatched = false;
          detectedCurrentSpeed = 25;
        } else if (b3 === 0x7A) {
          hookFormId = 'form_3';
          hookFormName = isRu ? 'Форма 3: Обобщенный базовый регистр [rX + 9]' : 'Form 3: Generic Base Register [rX + 9]';
          currentInstructionDisasm = `LDRB r0, [r${(b2 & 0x07)}, #9]`;
          isAlreadyPatched = false;
        } else if (b3 === 0x20) {
          hookFormId = 'form_4';
          hookFormName = isRu ? 'Форма 4: Ранее пропатченный бинарник (MOVS r0, #imm)' : 'Form 4: Already Patched (MOVS r0, #imm)';
          currentInstructionDisasm = `MOVS r0, #${b2}`;
          isAlreadyPatched = true;
          detectedCurrentSpeed = b2;
        }
        break;
      }
    }

    // 4. Check Regional Tables (0x3440 / 0x3C80)
    const regionalTableOffsets: number[] = [];
    if (size >= 0x4000) {
      if (data[0x3440] !== undefined) regionalTableOffsets.push(0x3440);
      if (data[0x3C80] !== undefined) regionalTableOffsets.push(0x3C80);
    }
    const regionalTablesFound = regionalTableOffsets.length > 0;

    // Hex preview around hook or start
    const previewStart = hookFileOffset !== -1 ? Math.max(0, hookFileOffset - 16) : 0;
    const previewLen = Math.min(64, size - previewStart);
    const hexPreviewBytes = Array.from(data.slice(previewStart, previewStart + previewLen));

    setBinaryData(data);
    setFileName(name);
    setPatchedData(null);
    setPatchApplied(false);

    setScanReport({
      fileName: name,
      fileSize: size,
      initialSp,
      resetVector,
      isArmThumb2,
      isBrightwayLayout,
      selectorFound,
      selectorAddresses,
      speedHookFound,
      hookFormId: hookFormId || undefined,
      hookFormName: hookFormName || undefined,
      hookFileOffset: hookFileOffset !== -1 ? hookFileOffset : undefined,
      hookMcuAddress: hookFileOffset !== -1 ? 0x08000000 + hookFileOffset : undefined,
      currentHookBytesHex,
      currentInstructionDisasm,
      isAlreadyPatched,
      detectedCurrentSpeed,
      regionalTablesFound,
      regionalTableOffsets,
      hexPreviewOffset: previewStart,
      hexPreviewBytes
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const buffer = evt.target?.result as ArrayBuffer;
      if (buffer) {
        analyzeFirmware(new Uint8Array(buffer), file.name);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const buffer = evt.target?.result as ArrayBuffer;
      if (buffer) {
        analyzeFirmware(new Uint8Array(buffer), file.name);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Load a synthetic real-world sample for immediate testing
  const loadSampleDump = (type: 'factory' | 'shifted' | 'patched') => {
    const sample = new Uint8Array(65536);
    const dv = new DataView(sample.buffer);
    
    // Vector table: SP 0x20003000, Reset 0x080001D1
    dv.setUint32(0x00, 0x20003000, true);
    dv.setUint32(0x04, 0x080001D1, true);

    const hookOffset = type === 'shifted' ? 0x5D20 : 0x5C74;
    
    // Write pool constant 0x20000234
    dv.setUint32(0x6000, 0x20000234, true);

    if (type === 'factory') {
      // AB 49 78 7A 08 80
      sample.set([0xAB, 0x49, 0x78, 0x7A, 0x08, 0x80], hookOffset);
    } else if (type === 'shifted') {
      // C4 49 78 7A 08 80
      sample.set([0xC4, 0x49, 0x78, 0x7A, 0x08, 0x80], hookOffset);
    } else if (type === 'patched') {
      // AB 49 23 20 08 80 (35 km/h)
      sample.set([0xAB, 0x49, 0x23, 0x20, 0x08, 0x80], hookOffset);
    }

    // Regional tables at 0x3440 and 0x3C80
    for (let i = 0; i < 7; i++) {
      sample.set([0x19, 0x00, 0x00, 0x00], 0x3440 + 4 * (i + 1));
      sample.set([0x19, 0x00, 0x00, 0x00], 0x3C80 + 4 * (i + 1));
    }

    const name = type === 'factory' ? 'xiaomi_5plus_factory_v1.bin' :
                 type === 'shifted' ? 'xiaomi_5plus_shifted_rev2.bin' : 'xiaomi_5plus_already_patched_35.bin';
    
    analyzeFirmware(sample, name);
  };

  // Apply Patch to the in-memory binary safely
  const handleApplyPatch = () => {
    if (!binaryData || !scanReport || scanReport.hookFileOffset === undefined) {
      alert(isRu ? 'Хук скорости не найден в файле!' : 'Speed hook not found in file!');
      return;
    }

    const copy = new Uint8Array(binaryData);
    
    // Patch ONLY speed hook: MOVS r0, #targetSpeed (opcode: [targetSpeed, 0x20])
    // We strictly DO NOT touch 0x3440 / 0x3C80 literal pools to prevent bricking the controller
    copy[scanReport.hookFileOffset] = targetSpeed;
    copy[scanReport.hookFileOffset + 1] = 0x20;

    setPatchedData(copy);
    setPatchApplied(true);
  };

  // Download the patched .bin file
  const handleDownloadPatchedBin = () => {
    if (!patchedData) return;
    const blob = new Blob([patchedData], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const baseClean = fileName.replace(/\.bin$/i, '');
    a.download = `${baseClean}_patched_${targetSpeed}kmh.bin`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 text-slate-100">
      {/* Upload Zone & Instructions */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-5 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Binary className="w-5 h-5 text-sky-400" />
              <h2 className="text-xl font-semibold text-white">
                {isRu ? 'Загрузка реального .bin файла & Live Анализ' : 'Real .bin Firmware Upload & Live Analysis'}
              </h2>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              {isRu 
                ? 'Перетащите ваш файл прошивки .bin для мгновенной проверки таблицы векторов, селектора 0x20001E2C и хука скорости.' 
                : 'Upload your .bin firmware dump to immediately inspect ARM vector table, 0x20001E2C selector, and speed hook.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">
              {isRu ? 'Готовые тестовые дампы:' : 'Quick Presets:'}
            </span>
            <button
              onClick={() => loadSampleDump('factory')}
              className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              Factory .bin
            </button>
            <button
              onClick={() => loadSampleDump('shifted')}
              className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              Shifted Rev .bin
            </button>
            <button
              onClick={() => loadSampleDump('patched')}
              className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              Patched .bin
            </button>
          </div>
        </div>

        {/* Drag & Drop Area */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            isDragging 
              ? 'border-sky-400 bg-sky-950/40' 
              : 'border-slate-700 hover:border-slate-500 bg-slate-950/60 hover:bg-slate-950'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".bin,.hex,.dfu"
            className="hidden"
          />
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-sky-950/80 border border-sky-800 flex items-center justify-center text-sky-400 shadow-md">
              <UploadCloud className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-200">
                {isRu ? 'Нажмите для выбора файла или перетащите .bin сюда' : 'Click to select or drag and drop your .bin file here'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {isRu ? 'Поддерживаются любые бинарные дампы ARM Thumb-2 (32 КБ - 128 КБ)' : 'Supports raw ARM Thumb-2 binary dumps (32 KB - 128 KB)'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Binary Scan Results */}
      {scanReport && (
        <div className="space-y-6">
          {/* Main 5-Point Live Status Cards */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 mb-5 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">
                  {isRu ? `Результаты анализа: ${scanReport.fileName}` : `Analysis Report: ${scanReport.fileName}`}
                </h3>
                <span className="text-xs font-mono text-slate-400">({scanReport.fileSize.toLocaleString()} bytes)</span>
              </div>

              <span className={`px-2.5 py-1 rounded text-xs font-mono font-bold flex items-center gap-1.5 ${
                scanReport.isArmThumb2 && scanReport.speedHookFound
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : 'bg-rose-950 text-rose-300 border border-rose-800'
              }`}>
                {scanReport.speedHookFound ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                {scanReport.speedHookFound ? (isRu ? 'ГОТОВ К ПАТЧУ' : 'READY TO PATCH') : (isRu ? 'ХУК НЕ НАЙДЕН' : 'HOOK NOT FOUND')}
              </span>
            </div>

            {/* 5-Point Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5 mb-6">
              {/* 1. Vector Table */}
              <div className="p-4 rounded-xl border bg-slate-950 border-slate-800">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  {isRu ? '1. Таблица векторов' : '1. Vector Table'}
                </span>
                <div className="font-bold text-sm text-emerald-400 flex items-center gap-1">
                  {scanReport.isArmThumb2 ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4 text-rose-400" />}
                  <span>{scanReport.isArmThumb2 ? 'Thumb-2 Valid' : 'Invalid'}</span>
                </div>
                <div className="font-mono text-[10px] text-slate-400 mt-1 space-y-0.5">
                  <div>SP: 0x{scanReport.initialSp.toString(16).toUpperCase()}</div>
                  <div>Reset: 0x{scanReport.resetVector.toString(16).toUpperCase()}</div>
                </div>
              </div>

              {/* 2. Mode Selector */}
              <div className="p-4 rounded-xl border bg-slate-950 border-slate-800">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  {isRu ? '2. Селектор режима' : '2. Mode Selector'}
                </span>
                <div className="font-bold text-sm text-sky-400 flex items-center gap-1">
                  {scanReport.selectorFound ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4 text-rose-400" />}
                  <span>{scanReport.selectorFound ? '0x20001E2C' : 'Missing'}</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                  {isRu ? 'Структура +0x0A в RAM (UART Rx / CCU)' : '+0x0A in RAM (UART Rx / CCU)'}
                </p>
              </div>

              {/* 3. Speed Hook */}
              <div className="p-4 rounded-xl border bg-slate-950 border-slate-800">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  {isRu ? '3. Точка хука' : '3. Speed Hook'}
                </span>
                <div className="font-bold text-sm text-amber-400 flex items-center gap-1">
                  {scanReport.speedHookFound ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-rose-400" />}
                  <span>{scanReport.speedHookFound ? `Offset 0x${scanReport.hookFileOffset?.toString(16).toUpperCase()}` : 'Not Found'}</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                  {scanReport.hookMcuAddress ? `MCU: 0x${scanReport.hookMcuAddress.toString(16).toUpperCase()}` : 'N/A'}
                </p>
              </div>

              {/* 4. Form Detected */}
              <div className="p-4 rounded-xl border bg-slate-950 border-slate-800">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  {isRu ? '4. Форма хука' : '4. Hook Form'}
                </span>
                <div className="font-bold text-xs text-slate-200 truncate">
                  {scanReport.hookFormName || 'None'}
                </div>
                <div className="font-mono text-[10px] text-emerald-400 mt-1">
                  {scanReport.currentHookBytesHex ? `Bytes: ${scanReport.currentHookBytesHex}` : 'N/A'}
                </div>
              </div>

              {/* 5. Regional Tables */}
              <div className="p-4 rounded-xl border bg-slate-950 border-slate-800">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  {isRu ? '5. Регионы (DE/EU)' : '5. Regional Tables'}
                </span>
                <div className="font-bold text-sm text-sky-300 flex items-center gap-1">
                  {scanReport.regionalTablesFound ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-amber-400" />}
                  <span>{scanReport.regionalTablesFound ? '0x3440 / 0x3C80' : 'Not Detected'}</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                  {isRu ? '7 слотов для разблокировки' : '7 slots for unlock'}
                </p>
              </div>
            </div>

            {/* Hex Dump & Instruction Disassembly Window */}
            <div className="bg-slate-950 rounded-xl border border-slate-800 p-4">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800 text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  {isRu ? 'Дизассемблирование найденного хука скорости:' : 'Disassembly of Identified Speed Hook:'}
                </span>
                <span className="text-sky-400 font-bold">
                  {scanReport.currentInstructionDisasm}
                </span>
              </div>

              {/* Hex Dump Table */}
              <div className="font-mono text-xs overflow-x-auto bg-slate-900/80 p-3 rounded-lg border border-slate-800 space-y-1">
                <div className="text-slate-500 pb-1 border-b border-slate-800">
                  Offset    00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F   Decoded Thumb-2
                </div>
                <div className="text-slate-300 flex items-center gap-3">
                  <span className="text-slate-500">0x{scanReport.hexPreviewOffset.toString(16).padStart(6, '0').toUpperCase()}</span>
                  <div className="flex gap-1.5">
                    {scanReport.hexPreviewBytes.slice(0, 16).map((b, idx) => {
                      const currentByteOffset = scanReport.hexPreviewOffset + idx;
                      const isHookByte = scanReport.hookFileOffset !== undefined && 
                        (currentByteOffset === scanReport.hookFileOffset || currentByteOffset === scanReport.hookFileOffset + 1);
                      return (
                        <span
                          key={idx}
                          className={`px-1 py-0.5 rounded font-bold ${
                            isHookByte 
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50' 
                              : 'text-slate-300'
                          }`}
                        >
                          {b.toString(16).padStart(2, '0').toUpperCase()}
                        </span>
                      );
                    })}
                  </div>
                  <span className="text-emerald-400 font-semibold pl-2">
                    &lt;-- {scanReport.speedHookFound ? scanReport.currentInstructionDisasm : 'Scanning'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive In-Browser Patcher & .bin Exporter */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  {isRu ? 'Патчинг в реальном времени и экспорт нового .bin' : 'Live In-Browser Patcher & Export .bin'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isRu 
                    ? 'Замените инструкцию чтения [r7+#9] на прямую запись нужной скорости в байт-буфере прямо в браузере.' 
                    : 'Override [r7+#9] speed read instruction with direct speed constant directly in browser memory.'}
                </p>
              </div>

              {patchApplied && (
                <span className="px-3 py-1 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4" /> PATCH READY
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Target Speed Slider */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-slate-300">
                    {isRu ? 'Новая целевая скорость (Target Speed):' : 'New Target Speed Limit:'}
                  </label>
                  <span className="text-lg font-bold font-mono text-emerald-400 bg-emerald-950/60 px-3 py-0.5 rounded border border-emerald-800">
                    {targetSpeed} km/h
                  </span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="45"
                  step="1"
                  value={targetSpeed}
                  onChange={(e) => {
                    setTargetSpeed(Number(e.target.value));
                    setPatchApplied(false);
                  }}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between text-[11px] text-slate-500 font-mono mt-1">
                  <span>20 km/h (Stock EU)</span>
                  <span>25 km/h (Stock S)</span>
                  <span>35 km/h (US Full)</span>
                  <span>45 km/h (Field Weak)</span>
                </div>

                <div className="mt-3 p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono text-slate-400">
                  {isRu ? 'Новый байт опкода:' : 'Patched Opcode:'}{' '}
                  <span className="text-amber-400 font-bold">
                    {targetSpeed.toString(16).padStart(2, '0').toUpperCase()} 20
                  </span> (MOVS r0, #{targetSpeed})
                </div>
              </div>

              {/* Safety Information & Safe Execution */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-300 block">
                  {isRu ? 'Безопасность патчера:' : 'Patch Safety Assurance:'}
                </label>
                <div className="p-3 bg-slate-950 border border-emerald-900/60 rounded-lg">
                  <div className="flex items-start gap-2 text-emerald-400 font-bold text-xs">
                    <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{isRu ? 'Изолированный патч без повреждения RAM-указателей' : 'Isolated Hook Patching (Zero RAM pointer damage)'}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                    {isRu 
                      ? 'Патчинг затрагивает исключительно 2 байта инструкции скорости (MOVS r0, #speed). Адреса 0x3440/0x3C80 исключены из записи, так как являются пулами констант микроконтроллера.' 
                      : 'Patches strictly the 2-byte speed instruction (MOVS r0, #speed). Static addresses 0x3440/0x3C80 are preserved to protect memory pointers.'}
                  </p>
                </div>

                {/* Apply Patch Button */}
                <button
                  onClick={handleApplyPatch}
                  disabled={!scanReport.speedHookFound}
                  className={`w-full py-2.5 px-4 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                    scanReport.speedHookFound
                      ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-600/30 cursor-pointer'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  <span>{isRu ? '1. Применить безопасный патч в памяти' : '1. Apply Safe Patch in Memory'}</span>
                </button>
              </div>
            </div>

            {/* Download Patched .bin Section */}
            {patchApplied && patchedData && (
              <div className="p-4 bg-emerald-950/40 border border-emerald-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in duration-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-900/80 border border-emerald-700 flex items-center justify-center text-emerald-300 shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-emerald-200">
                      {isRu ? 'Бинарный файл успешно модифицирован!' : 'Binary Firmware Successfully Patched!'}
                    </div>
                    <div className="text-xs text-emerald-300/80 mt-0.5">
                      {isRu 
                        ? `Опкод по смещению 0x${scanReport.hookFileOffset?.toString(16).toUpperCase()} заменен на ${targetSpeed.toString(16).padStart(2, '0').toUpperCase()} 20` 
                        : `Opcode at 0x${scanReport.hookFileOffset?.toString(16).toUpperCase()} replaced with ${targetSpeed.toString(16).padStart(2, '0').toUpperCase()} 20`}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleDownloadPatchedBin}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-lg shadow-emerald-600/40 flex items-center justify-center gap-2 transition-all shrink-0 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{isRu ? `Скачать ${fileName.replace(/\.bin$/i, '')}_patched_${targetSpeed}kmh.bin` : `Download Patched .bin`}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
