import React, { useState, useEffect } from 'react';
import { FIRMWARE_METADATA, SPEED_PRESETS, KERS_OPTIONS, generateReferenceFirmwareBuffer } from '../data/firmwareData';
import { applySpeedPatch, generatePythonScript, calculateSHA256 } from '../utils/patcher';
import { PatchResult } from '../types';
import { Download, Upload, ShieldCheck, AlertCircle, CheckCircle, Copy, Code, Cpu, RefreshCw, ZapOff, Gauge, Wind } from 'lucide-react';

export const SpeedPatcher: React.FC = () => {
  const [firmwareBuffer, setFirmwareBuffer] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState<string>(FIRMWARE_METADATA.fileName);
  const [isUsingReference, setIsUsingReference] = useState<boolean>(true);
  const [selectedSpeed, setSelectedSpeed] = useState<number>(35);
  const [hexImm, setHexImm] = useState<string>('23');
  const [disableKers, setDisableKers] = useState<boolean>(true);
  const [kersSelection, setKersSelection] = useState<string>('disabled'); // 'disabled' | 'weak' | 'stock'
  const [patchResult, setPatchResult] = useState<PatchResult | null>(null);
  const [pythonScript, setPythonScript] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [shaOriginal, setShaOriginal] = useState<string>('');

  // Initialize with reference firmware
  useEffect(() => {
    const ref = generateReferenceFirmwareBuffer();
    setFirmwareBuffer(ref);
    calculateSHA256(ref).then(setShaOriginal);
  }, []);

  // Update hexImm when preset selected
  const handlePresetSelect = (speedVal: number, hex: string) => {
    setSelectedSpeed(speedVal);
    setHexImm(hex);
  };

  // Custom hex input handler
  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 2).toUpperCase();
    setHexImm(clean);
    const intVal = parseInt(clean, 16);
    if (!isNaN(intVal)) {
      setSelectedSpeed(intVal);
    }
  };

  // Handle KERS mode selection
  const handleKersSelect = (modeId: string) => {
    setKersSelection(modeId);
    setDisableKers(modeId === 'disabled');
  };

  // Run patch execution
  const handleExecutePatch = async () => {
    if (!firmwareBuffer) return;
    const kersImmVal = kersSelection === 'disabled' ? '00' : kersSelection === 'weak' ? '01' : 'STOCK';
    const result = await applySpeedPatch(firmwareBuffer, {
      speedHexImm: hexImm,
      disableKers: kersSelection === 'disabled',
      kersHexImm: kersImmVal
    });
    setPatchResult(result);
    setPythonScript(generatePythonScript(hexImm, selectedSpeed, kersSelection === 'disabled'));
  };

  // Load custom file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsUsingReference(false);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      if (evt.target?.result instanceof ArrayBuffer) {
        const buf = new Uint8Array(evt.target.result);
        setFirmwareBuffer(buf);
        const hash = await calculateSHA256(buf);
        setShaOriginal(hash);
        setPatchResult(null);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Download patched binary
  const handleDownloadPatchedBin = () => {
    if (!patchResult?.patchedBuffer) return;
    const blob = new Blob([patchResult.patchedBuffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const kersSuffix = kersSelection === 'disabled' ? '_noKers' : '';
    a.href = url;
    a.download = `mcu_xiaomi.scooter.5plus_patched_${hexImm}${kersSuffix}.bin`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Download Python script
  const handleDownloadScript = () => {
    const script = pythonScript || generatePythonScript(hexImm, selectedSpeed, kersSelection === 'disabled');
    const blob = new Blob([script], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mi5plus.py';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyScript = () => {
    const script = pythonScript || generatePythonScript(hexImm, selectedSpeed, kersSelection === 'disabled');
    navigator.clipboard.writeText(script);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  return (
    <div className="space-y-6" id="patcher-workspace">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-700/60 rounded">
                Verified Firmware Patcher
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Speed: 0x5C76 | KERS: 0x5C9E
              </span>
            </div>
            <h2 className="text-lg font-bold text-white mt-1">
              Xiaomi 5 Plus Speed & Рекуперация (KERS) Patcher
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl">
              Точечная модификация прошивки: настройка лимита скорости (Thumb <code className="font-mono text-cyan-300">MOVS r0, #imm8</code>) и <strong>полное отключение рекуперации (KERS = 0A / Накат)</strong> при сбросе газа. Тормозная ручка сохраняет полную силу торможения.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-execute-patch"
              onClick={handleExecutePatch}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium text-xs shadow-md shadow-blue-600/30 transition-all flex items-center gap-2"
            >
              <Cpu className="w-4 h-4" />
              <span>Собрать и проверить патч</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: File & Presets */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: File Loader, Speed & KERS Settings */}
        <div className="lg:col-span-5 space-y-4">
          {/* File Loader */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center justify-between">
              <span>Firmware Image Binary</span>
              {isUsingReference ? (
                <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded">
                  Built-in Reference Binary
                </span>
              ) : (
                <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
                  User Loaded File
                </span>
              )}
            </h3>

            <div className="space-y-3">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono space-y-1.5">
                <div className="flex justify-between text-slate-400">
                  <span>File Name:</span>
                  <span className="text-slate-200">{fileName}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Size:</span>
                  <span className="text-slate-200">
                    {firmwareBuffer?.length.toLocaleString()} bytes (Expected: {FIRMWARE_METADATA.fileSize})
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>MCU Base:</span>
                  <span className="text-slate-200">0x08000000</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>SHA256 (Orig):</span>
                  <span className="text-slate-300 text-[10px] truncate max-w-[200px]" title={shaOriginal}>
                    {shaOriginal ? `${shaOriginal.substring(0, 16)}...` : 'Computing...'}
                  </span>
                </div>
              </div>

              {/* Upload custom binary button */}
              <label className="cursor-pointer block">
                <input
                  type="file"
                  id="file-upload-input"
                  accept=".bin"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="w-full py-2.5 px-3 border border-dashed border-slate-700 hover:border-slate-500 rounded-lg text-center text-xs text-slate-400 hover:text-slate-200 bg-slate-950/40 transition-all flex items-center justify-center gap-2">
                  <Upload className="w-4 h-4 text-slate-400" />
                  <span>Загрузить свой файл mcu_xiaomi.scooter.5plus.bin</span>
                </div>
              </label>

              {/* Reset to reference binary button */}
              {!isUsingReference && (
                <button
                  id="btn-reset-reference"
                  onClick={() => {
                    const ref = generateReferenceFirmwareBuffer();
                    setFirmwareBuffer(ref);
                    setFileName(FIRMWARE_METADATA.fileName);
                    setIsUsingReference(true);
                    calculateSHA256(ref).then(setShaOriginal);
                    setPatchResult(null);
                  }}
                  className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Сбросить на эталонный буфер 5 Plus</span>
                </button>
              )}
            </div>
          </div>

          {/* KERS (Рекуперация) Options Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5" id="kers-config-section">
            <div className="flex items-center gap-2 mb-3">
              <Wind className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">
                Рекуперация при сбросе газа (KERS / Накат)
              </h3>
            </div>
            
            <p className="text-[11px] text-slate-400 mb-3">
              Управляет сопротивлением двигателя при отпущенном курке акселератора. При отключении самокат свободно катится по инерции (накат).
            </p>

            <div className="space-y-2">
              {KERS_OPTIONS.map((opt) => {
                const isSelected = kersSelection === opt.id;
                return (
                  <button
                    key={opt.id}
                    id={`btn-kers-${opt.id}`}
                    onClick={() => handleKersSelect(opt.id)}
                    className={`w-full p-3 rounded-lg text-left transition-all border flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-500 text-white shadow-sm'
                        : 'bg-slate-950 border-slate-800/80 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold flex items-center gap-1.5">
                        {opt.id === 'disabled' && <ZapOff className="w-3.5 h-3.5 text-cyan-400" />}
                        {opt.label}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-900 rounded text-cyan-300 border border-slate-800">
                        {opt.opcode}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      {opt.description}
                    </p>
                    <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                      Thumb: <span className="text-emerald-400 font-bold">{opt.asm}</span> @ Offset 0x5C9E
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 p-2.5 bg-slate-950/80 border border-slate-800/80 rounded-lg text-[11px] text-slate-400 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Безопасность:</strong> Торможение ручкой (электронный тормоз при нажатии рычага) работает штатно.
              </span>
            </div>
          </div>

          {/* Speed Preset Selector */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Gauge className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-white">Ограничение скорости (Speed Hook)</h3>
            </div>

            <div className="space-y-2">
              {SPEED_PRESETS.map((preset) => {
                const isSelected = hexImm === preset.hexImm;
                return (
                  <button
                    key={preset.value}
                    id={`btn-preset-${preset.value}`}
                    onClick={() => handlePresetSelect(preset.value, preset.hexImm)}
                    className={`w-full p-3 rounded-lg text-left transition-all border flex items-center justify-between ${
                      isSelected
                        ? 'bg-blue-600/10 border-blue-500 text-white shadow-sm'
                        : 'bg-slate-950 border-slate-800/80 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold">{preset.label}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        Thumb Opcode: <span className="text-emerald-400 font-bold">{preset.hexImm} 20</span> (MOVS r0, #0x{preset.hexImm})
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold px-2 py-1 bg-slate-900 rounded text-cyan-400 border border-slate-800">
                      0x{preset.hexImm}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Custom Hex Value */}
            <div className="mt-4 pt-4 border-t border-slate-800">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Пользовательский Hex Imm8 (Скорость):
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-400">0x</span>
                <input
                  type="text"
                  id="input-custom-hex"
                  value={hexImm}
                  maxLength={2}
                  onChange={handleHexChange}
                  className="w-20 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-blue-500 text-center font-bold"
                  placeholder="23"
                />
                <span className="text-xs text-slate-400 font-mono">
                  &rarr; Opcode: <code className="text-emerald-400 font-bold">{hexImm || '??'} 20</code> (~{selectedSpeed} км/ч)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Patch Results, Dual Hex Inspector & Python Script */}
        <div className="lg:col-span-7 space-y-4">
          {/* Patch Status Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Результаты проверки и сборки патча</h3>

            {patchResult ? (
              <div className="space-y-4">
                <div
                  className={`p-4 rounded-lg border flex items-start gap-3 ${
                    patchResult.success
                      ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-200'
                      : 'bg-rose-950/40 border-rose-700/60 text-rose-200'
                  }`}
                >
                  {patchResult.success ? (
                    <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider">
                      {patchResult.success ? 'Патч успешно собран и проверен' : 'Ошибка верификации'}
                    </h4>
                    <p className="text-xs mt-1 leading-relaxed">{patchResult.message}</p>
                  </div>
                </div>

                {patchResult.success && (
                  <div className="space-y-3">
                    {/* Speed Hook Visual */}
                    <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs">
                      <div className="text-slate-400 text-[11px] font-semibold mb-2 flex items-center justify-between">
                        <span>1. Ограничитель скорости (Speed Limit @ 0x5C76):</span>
                        <span className="text-emerald-400">Пропатчено</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 bg-slate-900/80 rounded border border-slate-800">
                          <span className="text-slate-500 block text-[10px]">Оригинал (0x5C76):</span>
                          <span className="text-rose-400 font-bold">{patchResult.originalBytes}</span>
                          <span className="text-slate-500 block text-[10px]">LDRB r0, [r7, #9]</span>
                        </div>
                        <div className="p-2 bg-slate-900/80 rounded border border-slate-800">
                          <span className="text-slate-500 block text-[10px]">Патч:</span>
                          <span className="text-emerald-400 font-bold">{patchResult.patchedBytes}</span>
                          <span className="text-slate-500 block text-[10px]">MOVS r0, #0x{hexImm}</span>
                        </div>
                      </div>
                    </div>

                    {/* KERS Hook Visual */}
                    {patchResult.kersPatchApplied && (
                      <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs">
                        <div className="text-slate-400 text-[11px] font-semibold mb-2 flex items-center justify-between">
                          <span>2. Рекуперация (KERS / Накат @ 0x5C9E):</span>
                          <span className="text-cyan-400">Отключена (0A)</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2 bg-slate-900/80 rounded border border-slate-800">
                            <span className="text-slate-500 block text-[10px]">Оригинал (0x5C9E):</span>
                            <span className="text-rose-400 font-bold">{patchResult.kersOriginalBytes}</span>
                            <span className="text-slate-500 block text-[10px]">LDRB r0, [r7, #11]</span>
                          </div>
                          <div className="p-2 bg-slate-900/80 rounded border border-slate-800">
                            <span className="text-slate-500 block text-[10px]">Патч (Накат):</span>
                            <span className="text-cyan-400 font-bold">{patchResult.kersPatchedBytes}</span>
                            <span className="text-slate-500 block text-[10px]">MOVS r0, #0 (0A Regen)</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {patchResult.success && (
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      id="btn-download-patched-bin"
                      onClick={handleDownloadPatchedBin}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition-all flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Скачать пропатченный .bin</span>
                    </button>
                    <button
                      id="btn-download-python-script"
                      onClick={handleDownloadScript}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 border border-slate-700"
                    >
                      <Code className="w-4 h-4 text-cyan-400" />
                      <span>Скачать mi5plus.py</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-xs">
                <ShieldCheck className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p>Нажмите <strong className="text-slate-200">"Собрать и проверить патч"</strong> для проверки сигнатуры и применения настроек скорости и отключения рекуперации.</p>
              </div>
            )}
          </div>

          {/* Standalone Python Script Viewer */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">CLI Скрипт прошивки: mi5plus.py</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  id="btn-copy-python-code"
                  onClick={handleCopyScript}
                  className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copySuccess ? 'Скопировано!' : 'Копировать код'}</span>
                </button>
              </div>
            </div>

            <pre className="bg-slate-950 p-4 rounded-lg font-mono text-[11px] text-slate-300 border border-slate-800 overflow-x-auto max-h-72">
              {pythonScript || generatePythonScript(hexImm, selectedSpeed, kersSelection === 'disabled')}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

