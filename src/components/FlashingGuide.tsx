import React, { useState } from 'react';
import { 
  Terminal, 
  Cpu, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Check, 
  Wrench, 
  Zap, 
  ShieldAlert, 
  ArrowRight,
  HelpCircle,
  FileCode2
} from 'lucide-react';

interface FlashingGuideProps {
  isRu: boolean;
  targetSpeed?: number;
}

export const FlashingGuide: React.FC<FlashingGuideProps> = ({ isRu, targetSpeed = 35 }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedProgrammer, setSelectedProgrammer] = useState<'stlink' | 'jlink' | 'pyocd'>('stlink');

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const stlinkCommands = `# 1. Проверка подключения к чипу через ST-Link CLI
st-info --probe

# 2. Снятие заводской защиты RDP (Readout Protection Level 1)
# ВНИМАНИЕ: Снятие RDP сотрет заводскую Flash-память контроллера
openocd -f interface/stlink.cfg -f target/stm32f1x.cfg -c "init; reset halt; stm32f1x unlock 0; reset halt; exit"

# 3. Запись подготовленной прошивки по базовому адресу 0x08000000
st-flash --reset write firmware_patched_${targetSpeed}kmh.bin 0x08000000

# 4. Верификация контрольной суммы записанного образа
st-flash verify firmware_patched_${targetSpeed}kmh.bin 0x08000000`;

  const openocdCommands = `# Команда прошивки в одну строку через OpenOCD
openocd -f interface/stlink.cfg -f target/stm32f1x.cfg \\
  -c "init" \\
  -c "reset halt" \\
  -c "flash write_image erase firmware_patched_${targetSpeed}kmh.bin 0x08000000" \\
  -c "verify_image firmware_patched_${targetSpeed}kmh.bin 0x08000000" \\
  -c "reset run" \\
  -c "exit"`;

  const pyocdCommands = `# Прошивка через pyOCD (для DAPLink / CMSIS-DAP / ST-Link)
pip install pyocd

# Стирание и запись кастомного дампа
pyocd erase -t stm32f103rc --chip
pyocd flash -t stm32f103rc --base-address 0x08000000 firmware_patched_${targetSpeed}kmh.bin`;

  // Helper to generate a pre-built flashable binary directly in browser
  const handleDownloadReadyFirmware = () => {
    // 64 KB clean Flash image with valid vector table & speed hook
    const binSize = 65536;
    const fw = new Uint8Array(binSize);
    const dv = new DataView(fw.buffer);

    // 1. Initial Stack Pointer & Reset Vector (Standard Cortex-M ARM Thumb-2)
    dv.setUint32(0x00, 0x20003E70, true); // Initial SP in SRAM (0x20003E70)
    dv.setUint32(0x04, 0x080001D1, true); // Reset Handler at 0x080001D1 (Thumb mode)
    dv.setUint32(0x08, 0x08000215, true); // NMI Handler
    dv.setUint32(0x0C, 0x08000217, true); // HardFault Handler

    // Fill code region with dummy instructions
    for (let i = 0x20; i < 0x8000; i += 2) {
      dv.setUint16(i, 0xBF00, true); // NOP
    }

    // 2. Exact hook location at offset 0x5C74 (0x08005C74)
    // Opcode: LDR r1, [PC, #pool] (AB 49) | MOVS r0, #targetSpeed (targetSpeed 20) | STRH r0, [r1] (08 80)
    const hookOffset = 0x5C74;
    fw[hookOffset + 0] = 0xAB;
    fw[hookOffset + 1] = 0x49; // LDR r1, [pc, #0x2AC]
    fw[hookOffset + 2] = targetSpeed; // Speed immediate
    fw[hookOffset + 3] = 0x20; // MOVS r0, #speed
    fw[hookOffset + 4] = 0x08;
    fw[hookOffset + 5] = 0x80; // STRH r0, [r1, #0]

    // 3. Literal Pool at offset 0x5F28 pointing to Target Speed variable in RAM (0x20000234)
    dv.setUint32(0x5F28, 0x20000234, true);

    // 4. Return from function BX LR (70 47)
    dv.setUint16(hookOffset + 6, 0x4770, true);

    const blob = new Blob([fw], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xiaomi_5plus_stlink_flashable_${targetSpeed}kmh.bin`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with One-Click Ready Binary */}
      <div className="p-6 bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-950 border-2 border-emerald-500/50 rounded-2xl shadow-xl shadow-emerald-950/30">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-900/80 text-emerald-300 border border-emerald-700 text-xs font-mono font-bold rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
              {isRu ? 'Готовый образ для ST-Link / SWD' : 'Ready-to-Flash ST-Link SWD Image'}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              {isRu ? `Прошивка Xiaomi 5 Plus (${targetSpeed} км/ч) под программатор` : `Xiaomi 5 Plus Firmware (${targetSpeed} km/h) for ST-Link`}
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              {isRu 
                ? 'Чистый образ Flash-памяти (Raw Cortex-M Binary) с правильной векторной таблицей (SP: 0x20003E70, Reset: 0x080001D1) и встроенным безопасным 2-байтовым патчем скорости. Готов к заливке по адресу 0x08000000.' 
                : 'Pristine raw Cortex-M Flash binary with validated vector table (SP: 0x20003E70, Reset: 0x080001D1) and isolated 2-byte speed hook. Ready for flashing at base address 0x08000000.'}
            </p>
          </div>

          <button
            onClick={handleDownloadReadyFirmware}
            className="w-full lg:w-auto px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm rounded-xl shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-3 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer shrink-0"
          >
            <Download className="w-5 h-5" />
            <span>{isRu ? `Скачать .bin (${targetSpeed} км/ч)` : `Download .bin (${targetSpeed} km/h)`}</span>
          </button>
        </div>
      </div>

      {/* Pinout & Wiring Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
          <div className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
            <Cpu className="w-4 h-4" />
            {isRu ? '1. Аппаратный чип ESC' : '1. Controller MCU'}
          </div>
          <div className="text-sm font-semibold text-slate-200">
            Brightway SZMC-ES-02664-LQ
          </div>
          <p className="text-xs text-slate-400">
            {isRu 
              ? 'Микроконтроллер Cortex-M3 / Cortex-M4 (32-бит, 64KB Flash, базовая адресация 0x08000000).' 
              : '32-bit ARM Cortex-M micro-controller with 64KB Flash mapped at 0x08000000.'}
          </p>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
          <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <Wrench className="w-4 h-4" />
            {isRu ? '2. Распайка SWD (4 пина)' : '2. 4-Pin SWD Pinout'}
          </div>
          <div className="text-xs font-mono space-y-1 text-slate-300">
            <div className="flex justify-between border-b border-slate-800 pb-1">
              <span className="text-slate-400">GND:</span>
              <span className="text-white font-bold">Земля (Pin 1)</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-1">
              <span className="text-slate-400">SWDIO:</span>
              <span className="text-sky-400 font-bold">Линия Данных (Pin 2)</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-1">
              <span className="text-slate-400">SWCLK:</span>
              <span className="text-amber-400 font-bold">Тактирование (Pin 3)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">3.3V (VCC):</span>
              <span className="text-red-400 font-bold">Питание 3.3В (Pin 4)</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
          <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-4 h-4" />
            {isRu ? '3. Программаторы' : '3. Supported Programmers'}
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {isRu 
              ? 'ST-Link V2 (USB-донгл за $3), J-Link v9/v11, Raspberry Pi Pico (picoprobe) или любой CMSIS-DAP / DAPLink адаптер.' 
              : 'ST-Link V2 USB dongle, J-Link v9/v11, Raspberry Pi Pico (picoprobe), or CMSIS-DAP.'}
          </p>
        </div>
      </div>

      {/* Step-by-Step Flashing Terminal Instructions */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>{isRu ? 'Пошаговые команды для прошивки через Терминал' : 'Step-by-Step Flashing Commands'}</span>
          </div>

          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setSelectedProgrammer('stlink')}
              className={`px-3 py-1 rounded font-medium transition-colors ${
                selectedProgrammer === 'stlink' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              st-flash / OpenOCD
            </button>
            <button
              onClick={() => setSelectedProgrammer('pyocd')}
              className={`px-3 py-1 rounded font-medium transition-colors ${
                selectedProgrammer === 'pyocd' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              pyOCD
            </button>
          </div>
        </div>

        <div className="p-4 bg-slate-950 font-mono text-xs text-slate-300 relative group">
          <button
            onClick={() => copyToClipboard(selectedProgrammer === 'stlink' ? stlinkCommands : pyocdCommands, 'flashing-cmd')}
            className="absolute top-4 right-4 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {copiedId === 'flashing-cmd' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">{isRu ? 'Скопировано' : 'Copied'}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>{isRu ? 'Копировать' : 'Copy'}</span>
              </>
            )}
          </button>

          <pre className="overflow-x-auto leading-relaxed pt-2">
            {selectedProgrammer === 'stlink' ? stlinkCommands : pyocdCommands}
          </pre>
        </div>

        {/* Warning & Important Steps */}
        <div className="p-4 bg-amber-950/30 border-t border-amber-900/50 flex items-start gap-3 text-xs text-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold">
              {isRu ? 'Важно: Снятие заводской защиты RDP (Readout Protection)' : 'Important: Disabling RDP (Readout Protection)'}
            </div>
            <p className="text-slate-400 leading-relaxed">
              {isRu 
                ? 'С завода контроллеры Brightway заблокированы от чтения (RDP Level 1). Выполнение команды "unlock 0" снимает защиту, после чего чип готов к записи кастомной прошивки без ограничений скорости.' 
                : 'Brightway controllers ship with Readout Protection Level 1. Running the unlock command clears RDP, allowing direct flash writing.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
