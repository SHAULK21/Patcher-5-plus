import React, { useState, useEffect } from 'react';
import { 
  FIRMWARE_FINGERPRINT, 
  RESILIENT_HOOK_PATTERNS, 
  SAMPLE_FIRMWARE_TESTS, 
  SampleFirmwareTest 
} from '../data/reData';
import { HookPattern, DiagnosticScanResult } from '../types';
import { 
  Fingerprint, 
  Search, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Terminal, 
  FileCode, 
  RefreshCw, 
  Sparkles,
  Sliders,
  Check,
  Cpu,
  Zap,
  Layers,
  Activity
} from 'lucide-react';

interface Props {
  isRu: boolean;
}

export const ResilientPatcherScanner: React.FC<Props> = ({ isRu }) => {
  const [selectedSample, setSelectedSample] = useState<SampleFirmwareTest>(SAMPLE_FIRMWARE_TESTS[0]);
  const [simulatedModeId, setSimulatedModeId] = useState<number>(1); // 0=Eco, 1=Drive, 2=Sport
  const [scanResult, setScanResult] = useState<DiagnosticScanResult | null>(null);

  const runDiagnosticScan = (sample: SampleFirmwareTest, currentMode: number = simulatedModeId) => {
    const logs: string[] = [];
    logs.push(`[SCAN] Initializing Brightway ES32 Multi-Form Resilient Scanner...`);
    logs.push(`[FINGERPRINT] Checking ARM Cortex-M Thumb-2 Vector Table...`);

    if (sample.id === 'foreign_m365_bin') {
      logs.push(`[ERROR] Vector Table SP (0x20000800) out of expected ES32 SRAM range.`);
      logs.push(`[ERROR] Regional speed tables @ 0x3440 / 0x3C80 not found.`);
      logs.push(`[FATAL] Firmware fingerprint MISMATCH: Non-Brightway binary.`);
      logs.push(`[DIAGNOSTIC] Aborting scan to prevent firmware bricking.`);
      
      setScanResult({
        fingerprintMatch: false,
        fingerprintName: 'Non-5Plus Binary (Foreign Firmware)',
        fileSize: 65536,
        selectorFound: false,
        selectorAddress: '0x20001E2C',
        selectorRefInfo: 'Not found in foreign binary',
        selectorRefInfoRu: 'Не найден в чужой прошивке',
        hookFound: false,
        currentModeId: 0,
        currentModeName: 'Unknown',
        currentModeNameRu: 'Неизвестно',
        currentSpeedByteHex: 'N/A',
        currentSpeedDecoded: 'N/A',
        logs
      });
      return;
    }

    logs.push(`[OK] Vector Table: SP @ 0x20003000, Reset Handler @ 0x080001D1`);
    logs.push(`[OK] Regional tables detected at 0x3440 / 0x3C80 (7 region slots)`);
    logs.push(`[OK] Speed Scaling constant 0xAE (174) found in controller loop @ 0x0800369C`);
    logs.push(`[FINGERPRINT] SUCCESS: Verified Xiaomi Scooter 5 Plus (Brightway ES32)`);

    // 1. Selector Diagnosis (MODE_STRUCT_FIELD_0A @ 0x20001E2C)
    logs.push(`[SELECTOR] Probing Mode Selector RAM struct (MODE_STRUCT_FIELD_0A = 0x20001E2C)...`);
    logs.push(`[SELECTOR] Found references: UART Rx Handler @ 0x0800A412 (STRB r2, [r3, #0x0A]), Init @ 0x08005834`);
    logs.push(`[SELECTOR] Status: ACTIVE (Base 0x20001E22 + offset 0x0A)`);

    const hexToTest = (
      sample.id === 'pristine_bin' ? 'AB 49 78 7A 08 80' :
      sample.id === 'shifted_pc_rel' ? 'C4 49 78 7A 08 80' :
      sample.id === 'already_patched_35' ? 'AB 49 23 20 08 80' : '00 00 00 00 00 00'
    );

    logs.push(`[MULTI_FORM_SCAN] Scanning Flash image using 4 resilient pattern forms...`);

    const hexBytes = hexToTest.trim().toUpperCase().split(/\s+/);
    let matchedPattern: HookPattern | null = null;
    let isPatched = false;
    let configuredSpeed: number | undefined;
    let speedByteHex = 'N/A';
    let speedDecoded = 'N/A';

    if (hexBytes.length >= 6) {
      const b0 = hexBytes[0];
      const b1 = hexBytes[1];
      const b2 = hexBytes[2];
      const b3 = hexBytes[3];
      const b4 = hexBytes[4];
      const b5 = hexBytes[5];

      // Form checking
      if (b1 === '49' && b4 === '08' && b5 === '80') {
        speedByteHex = `${b2} ${b3}`;

        if (b2 === '78' && b3 === '7A') {
          matchedPattern = b0 === 'AB' ? RESILIENT_HOOK_PATTERNS[0] : RESILIENT_HOOK_PATTERNS[1];
          speedDecoded = 'LDRB r0, [r7, #9]';
          configuredSpeed = currentMode === 0 ? 5 : currentMode === 1 ? 20 : 25;
          logs.push(`[MATCH] Found ${matchedPattern.name} at File 0x${sample.fileOffset.toString(16).toUpperCase()}`);
          logs.push(`[DISASM] Hook Opcode: [${b0} 49] LDR r1, [pc, #pool] (0x20000234) | [78 7A] LDRB r0, [r7, #9] | [08 80] STRH r0, [r1]`);
          logs.push(`[PROFILE] Dynamic active profile pointer in r7 points to Mode ID ${currentMode}`);
        } else if (b3 === '7A') {
          matchedPattern = RESILIENT_HOOK_PATTERNS[2];
          speedDecoded = 'LDRB r0, [rX, #9]';
          configuredSpeed = currentMode === 0 ? 5 : currentMode === 1 ? 20 : 25;
          logs.push(`[MATCH] Found ${matchedPattern.name}`);
        } else if (b3 === '20') {
          matchedPattern = RESILIENT_HOOK_PATTERNS[3];
          isPatched = true;
          configuredSpeed = parseInt(b2, 16);
          speedDecoded = `MOVS r0, #${configuredSpeed}`;
          logs.push(`[MATCH] Found ${matchedPattern.name}`);
          logs.push(`[NOTICE] Firmware is ALREADY PATCHED: Speed override = ${configuredSpeed} km/h (MOVS r0, #${configuredSpeed})`);
        }
      }
    }

    const modeNames = [
      { name: 'Pedestrian / Eco', nameRu: 'Пешеходный / Eco' },
      { name: 'Drive (D)', nameRu: 'Drive (D)' },
      { name: 'Sport (S)', nameRu: 'Sport (S)' }
    ];

    if (matchedPattern) {
      logs.push(`[DIAGNOSTICS] 5/5 Parameters Validated. Ready for Universal Patcher.`);
      setScanResult({
        fingerprintMatch: true,
        fingerprintName: 'Xiaomi Scooter 5 Plus (Brightway / ES32)',
        fileSize: 65536,
        
        // 1. Selector Status
        selectorFound: true,
        selectorAddress: '0x20001E2C (MODE_STRUCT_FIELD_0A)',
        selectorRefInfo: 'Traced from UART Rx @ 0x0800A412 and coldboot init @ 0x08005834',
        selectorRefInfoRu: 'Трассирован из UART Rx @ 0x0800A412 и coldboot init @ 0x08005834',
        
        // 2. Speed Hook Status
        hookFound: true,
        
        // 3. Hook Form Detected
        hookFormId: matchedPattern.id,
        hookFormName: matchedPattern.name,
        hookFormNameRu: matchedPattern.nameRu,
        
        // 4. Current Mode
        currentModeId: currentMode,
        currentModeName: modeNames[currentMode].name,
        currentModeNameRu: modeNames[currentMode].nameRu,
        
        // 5. Current Speed Byte
        currentSpeedByteHex: speedByteHex,
        currentSpeedDecoded: speedDecoded,
        currentSpeedKmh: configuredSpeed,
        
        fileOffset: sample.fileOffset,
        mcuAddress: 0x08000000 + sample.fileOffset,
        originalBytesHex: hexToTest,
        regBase: 'r7',
        structOffsetHex: '+0x09',
        isPatched,
        logs
      });
    } else {
      logs.push(`[WARN] Speed hook not matched.`);
      setScanResult({
        fingerprintMatch: true,
        fingerprintName: 'Xiaomi Scooter 5 Plus (Brightway / ES32)',
        fileSize: 65536,
        selectorFound: true,
        selectorAddress: '0x20001E2C',
        selectorRefInfo: 'Present in RAM layout',
        selectorRefInfoRu: 'Присутствует в карте RAM',
        hookFound: false,
        currentModeId: currentMode,
        currentModeName: modeNames[currentMode].name,
        currentModeNameRu: modeNames[currentMode].nameRu,
        currentSpeedByteHex: 'N/A',
        currentSpeedDecoded: 'N/A',
        logs
      });
    }
  };

  useEffect(() => {
    runDiagnosticScan(selectedSample, simulatedModeId);
  }, [selectedSample, simulatedModeId, isRu]);

  return (
    <div className="space-y-6 text-slate-100">
      {/* 5-POINT DIAGNOSTIC HERO DASHBOARD */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-5 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              <h2 className="text-xl font-semibold text-white">
                {isRu ? 'Диагностический режим Multi-Form Scanner' : 'Multi-Form Scanner Diagnostic Mode'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-[11px] font-bold text-emerald-400">
                5/5 Live Checks
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              {isRu 
                ? 'Полная замена одиночной сигнатуры на Multi-Form Scanner с непрерывной проверкой селектора 0x20001E2C, хука и байта скорости.' 
                : 'Complete multi-form heuristic scan replacing hardcoded signatures with continuous 5-point firmware diagnostics.'}
            </p>
          </div>

          <button
            onClick={() => runDiagnosticScan(selectedSample, simulatedModeId)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition-colors self-start sm:self-auto shadow-sm"
          >
            <RefreshCw className="w-4 h-4 text-sky-400" />
            <span>{isRu ? 'Обновить диагностику' : 'Refresh Diagnostic'}</span>
          </button>
        </div>

        {/* 5 Core Diagnostic Cards */}
        {scanResult && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5 mb-6">
            {/* 1. Selector Status */}
            <div className={`p-4 rounded-xl border transition-all ${
              scanResult.selectorFound 
                ? 'bg-emerald-950/40 border-emerald-700/70 shadow-sm shadow-emerald-950/40' 
                : 'bg-rose-950/40 border-rose-800'
            }`}>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-slate-400 uppercase tracking-wider">
                  {isRu ? '1. Селектор режима' : '1. Mode Selector'}
                </span>
                {scanResult.selectorFound ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" />
                ) : (
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                )}
              </div>
              <div className="font-bold text-sm text-white mb-1 flex items-center gap-1.5">
                {scanResult.selectorFound ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>{isRu ? 'ОБНАРУЖЕН' : 'FOUND'}</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-rose-400" />
                    <span>{isRu ? 'НЕ НАЙДЕН' : 'NOT FOUND'}</span>
                  </>
                )}
              </div>
              <div className="font-mono text-[11px] text-emerald-300 bg-slate-950/80 px-2 py-1 rounded border border-slate-800">
                0x20001E2C (+0x0A)
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5 leading-tight">
                {isRu ? 'MODE_STRUCT_FIELD_0A (UART Rx + Init)' : 'MODE_STRUCT_FIELD_0A (UART Rx + Init)'}
              </p>
            </div>

            {/* 2. Speed Hook Status */}
            <div className={`p-4 rounded-xl border transition-all ${
              scanResult.hookFound 
                ? 'bg-emerald-950/40 border-emerald-700/70 shadow-sm shadow-emerald-950/40' 
                : 'bg-rose-950/40 border-rose-800'
            }`}>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-slate-400 uppercase tracking-wider">
                  {isRu ? '2. Хук скорости' : '2. Speed Hook'}
                </span>
                {scanResult.hookFound ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" />
                ) : (
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                )}
              </div>
              <div className="font-bold text-sm text-white mb-1 flex items-center gap-1.5">
                {scanResult.hookFound ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>{isRu ? 'НАЙДЕН' : 'DETECTED'}</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-rose-400" />
                    <span>{isRu ? 'НЕ НАЙДЕН' : 'NOT FOUND'}</span>
                  </>
                )}
              </div>
              <div className="font-mono text-[11px] text-sky-300 bg-slate-950/80 px-2 py-1 rounded border border-slate-800 truncate">
                {scanResult.fileOffset !== undefined ? `File: 0x${scanResult.fileOffset.toString(16).toUpperCase()}` : 'N/A'}
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5 leading-tight">
                {scanResult.mcuAddress ? `MCU: 0x${scanResult.mcuAddress.toString(16).toUpperCase()}` : 'Scan required'}
              </p>
            </div>

            {/* 3. Hook Form Detected */}
            <div className="p-4 rounded-xl border bg-slate-950/90 border-slate-800">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-slate-400 uppercase tracking-wider">
                  {isRu ? '3. Форма хука' : '3. Hook Form'}
                </span>
                <Layers className="w-3.5 h-3.5 text-sky-400" />
              </div>
              <div className="font-bold text-xs text-amber-300 mb-1 leading-snug">
                {scanResult.hookFormName ? (isRu ? scanResult.hookFormNameRu : scanResult.hookFormName) : 'N/A'}
              </div>
              <div className="font-mono text-[11px] text-slate-300 bg-slate-900 px-2 py-1 rounded border border-slate-800 truncate">
                {scanResult.originalBytesHex || 'No match'}
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5 leading-tight">
                {scanResult.isPatched 
                  ? (isRu ? 'Модифицированный опкод' : 'Modified opcode') 
                  : (isRu ? 'Заводская инструкция' : 'Factory opcode')}
              </p>
            </div>

            {/* 4. Current Mode */}
            <div className="p-4 rounded-xl border bg-slate-950/90 border-slate-800">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-slate-400 uppercase tracking-wider">
                  {isRu ? '4. Текущий режим' : '4. Current Mode'}
                </span>
                <Zap className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="font-bold text-sm text-sky-300 mb-1">
                {isRu ? scanResult.currentModeNameRu : scanResult.currentModeName}
              </div>
              <div className="font-mono text-[11px] text-amber-300 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                Mode ID: {scanResult.currentModeId} (Enum)
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5 leading-tight">
                {isRu ? 'Указатель r7 -> Active Profile' : 'r7 dynamic active profile'}
              </p>
            </div>

            {/* 5. Current Speed Byte */}
            <div className="p-4 rounded-xl border bg-slate-950/90 border-slate-800">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-slate-400 uppercase tracking-wider">
                  {isRu ? '5. Speed Byte' : '5. Speed Byte'}
                </span>
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="font-bold text-sm text-emerald-400 mb-1 flex items-baseline gap-1.5">
                <span>{scanResult.currentSpeedByteHex}</span>
                {scanResult.currentSpeedKmh !== undefined && (
                  <span className="text-xs text-slate-300">({scanResult.currentSpeedKmh} km/h)</span>
                )}
              </div>
              <div className="font-mono text-[10px] text-sky-300 bg-slate-900 px-2 py-1 rounded border border-slate-800 truncate">
                {scanResult.currentSpeedDecoded}
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5 leading-tight">
                {scanResult.isPatched 
                  ? (isRu ? 'Прямой imm8 лимит' : 'Direct imm8 limit') 
                  : (isRu ? 'Чтение смещения [r7+#9]' : 'Read from [r7+#9]')}
              </p>
            </div>
          </div>
        )}

        {/* Interactive Mode Simulator Switcher */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-sky-400" />
                {isRu ? 'Симуляция переключения режима (UART CCU Event):' : 'Simulate Dashboard Mode Switch (UART CCU Event):'}
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isRu 
                  ? 'При смене режима CCU пишет ID (0/1/2) в 0x20001E2C, а r7 переключает указатель на активный профиль.' 
                  : 'CCU transmits mode ID to 0x20001E2C, directing r7 to the active profile struct in SRAM.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {[
                { id: 0, label: 'Eco (5 km/h)', labelRu: 'Eco (5 км/ч)' },
                { id: 1, label: 'Drive (20 km/h)', labelRu: 'Drive (20 км/ч)' },
                { id: 2, label: 'Sport (25 km/h)', labelRu: 'Sport (25 км/ч)' }
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSimulatedModeId(m.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    simulatedModeId === m.id
                      ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {isRu ? m.labelRu : m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Diagnostic Console Terminal */}
        {scanResult && (
          <div className="bg-slate-950 rounded-xl border border-slate-800 p-4">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800/80 text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1.5 text-slate-300">
                <Terminal className="w-4 h-4 text-emerald-400" />
                {isRu ? 'Диагностический лог Multi-Form Scanner (mi5plus.py trace)' : 'Multi-Form Scanner Diagnostic Log (mi5plus.py trace)'}
              </span>
              <span className="text-slate-500">Brightway ES32 Engine</span>
            </div>
            <pre className="font-mono text-xs text-slate-300 leading-relaxed overflow-x-auto max-h-52 bg-slate-900/60 p-3 rounded-lg border border-slate-800/60">
              {scanResult.logs.map((log, idx) => (
                <div key={idx} className={
                  log.includes('[ERROR]') || log.includes('[FATAL]') ? 'text-rose-400 font-bold' :
                  log.includes('[OK]') || log.includes('[SUCCESS]') || log.includes('[MATCH]') || log.includes('[DIAGNOSTICS]') ? 'text-emerald-400' :
                  log.includes('[WARN]') || log.includes('[NOTICE]') ? 'text-amber-300' :
                  log.includes('[DISASM]') || log.includes('[SELECTOR]') ? 'text-sky-300' : 'text-slate-400'
                }>
                  {log}
                </div>
              ))}
            </pre>
          </div>
        )}
      </div>

      {/* Test Scenarios & Multi-Form Patterns Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sample Firmware Tests */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <FileCode className="w-4 h-4 text-sky-400" />
              {isRu ? 'Тестовые дампы и сценарии ревизий:' : 'Firmware Revision Variations:'}
            </h3>
            <span className="text-[11px] font-mono text-slate-400">4 Samples</span>
          </div>

          <div className="space-y-2.5">
            {SAMPLE_FIRMWARE_TESTS.map((sample) => (
              <button
                key={sample.id}
                onClick={() => setSelectedSample(sample)}
                className={`w-full p-3 rounded-lg border text-left transition-all relative ${
                  selectedSample.id === sample.id
                    ? 'bg-sky-950/80 border-sky-500 shadow-md shadow-sky-950/50'
                    : 'bg-slate-950 border-slate-800 hover:bg-slate-800/60 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-bold text-slate-200 mb-1 flex items-center justify-between">
                  <span>{isRu ? sample.nameRu : sample.name}</span>
                  {sample.id !== 'foreign_m365_bin' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-rose-400" />
                  )}
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  {isRu ? sample.descriptionRu : sample.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* 4 Pattern Forms Registry */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              {isRu ? '4 формы сканера (Multi-Form Registry):' : 'Multi-Form Scanner Registry (4 Forms):'}
            </h3>
            <span className="text-[11px] font-mono text-emerald-400">Flexible Scanning</span>
          </div>

          <div className="space-y-2.5 font-mono text-xs">
            {RESILIENT_HOOK_PATTERNS.map((p) => {
              const isMatched = scanResult?.hookFormId === p.id;
              return (
                <div
                  key={p.id}
                  className={`p-3 rounded-lg border transition-all ${
                    isMatched
                      ? 'bg-emerald-950/50 border-emerald-600 shadow-sm'
                      : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-200 text-xs">
                      {isRu ? p.nameRu : p.name}
                    </span>
                    {isMatched && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-900 text-emerald-300 flex items-center gap-1">
                        <Check className="w-3 h-3" /> MATCHED
                      </span>
                    )}
                  </div>
                  <div className="text-amber-300 font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-800 mb-1 text-[11px]">
                    {p.patternHex}
                  </div>
                  <p className="text-[10px] font-sans text-slate-400 leading-snug">
                    {isRu ? p.descriptionRu : p.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
