import React, { useState } from 'react';
import { DualTrackAnalyzer } from './components/DualTrackAnalyzer';
import { ResilientPatcherScanner } from './components/ResilientPatcherScanner';
import { DataFlowVisualizer } from './components/DataFlowVisualizer';
import { ModeAnalysisCard } from './components/ModeAnalysisCard';
import { DisassemblyViewer } from './components/DisassemblyViewer';
import { SpeedCalculator } from './components/SpeedCalculator';
import { MemoryMapViewer } from './components/MemoryMapViewer';
import { PatchGenerator } from './components/PatchGenerator';
import { FirmwareUploader } from './components/FirmwareUploader';
import { FlashingGuide } from './components/FlashingGuide';
import { 
  Gauge, 
  Cpu, 
  Terminal, 
  Calculator, 
  Database, 
  Code, 
  Languages, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle,
  FileCode,
  Github,
  BookOpen,
  GitFork,
  Fingerprint,
  UploadCloud,
  Binary,
  Wrench
} from 'lucide-react';

export default function App() {
  const [isRu, setIsRu] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'flashing' | 'uploader' | 'scanner' | 'dualtrack' | 'modes' | 'dataflow' | 'disasm' | 'calculator' | 'memory' | 'patch'>('flashing');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-sky-500 selection:text-white">
      {/* Top Header Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-md shadow-sky-500/20">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-tight">
                  Xiaomi Scooter 5 Plus
                </h1>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-sky-950 text-sky-400 border border-sky-800">
                  Brightway ES32
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {isRu ? 'Анализ режимов Eco \\ Drive \\ Sport & Resilient Patcher' : 'Eco \\ Drive \\ Sport Modes RE & Resilient Patcher'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsRu(!isRu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
            >
              <Languages className="w-4 h-4 text-sky-400" />
              <span>{isRu ? 'RU / EN' : 'EN / RU'}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 overflow-x-auto scrollbar-none py-1 border-t border-slate-800/40">
          <button
            onClick={() => setActiveTab('flashing')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
              activeTab === 'flashing'
                ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Wrench className="w-4 h-4 text-emerald-300" />
            {isRu ? 'Прошивка через ST-Link (SWD)' : 'ST-Link / SWD Flashing Guide'}
          </button>

          <button
            onClick={() => setActiveTab('uploader')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
              activeTab === 'uploader'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            {isRu ? 'Загрузка .bin (Live Анализ)' : 'Upload .bin (Live Scan)'}
          </button>

          <button
            onClick={() => setActiveTab('scanner')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
              activeTab === 'scanner'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Fingerprint className="w-4 h-4" />
            {isRu ? 'Адаптивный сканер & Фингерпринт' : 'Resilient Scanner & Fingerprint'}
          </button>

          <button
            onClick={() => setActiveTab('dualtrack')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
              activeTab === 'dualtrack'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <GitFork className="w-4 h-4" />
            {isRu ? 'Track A & Track B Анализ' : 'Track A & Track B Analysis'}
          </button>

          <button
            onClick={() => setActiveTab('modes')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
              activeTab === 'modes'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Gauge className="w-4 h-4" />
            {isRu ? 'Режимы Eco / Drive / Sport' : 'Eco / Drive / Sport Modes'}
          </button>

          <button
            onClick={() => setActiveTab('dataflow')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
              activeTab === 'dataflow'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Cpu className="w-4 h-4" />
            {isRu ? 'Data-Flow Пайплайн' : 'Data-Flow Pipeline'}
          </button>

          <button
            onClick={() => setActiveTab('disasm')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
              activeTab === 'disasm'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Terminal className="w-4 h-4" />
            {isRu ? 'Дизассемблер Thumb-2' : 'Thumb-2 Disassembly'}
          </button>

          <button
            onClick={() => setActiveTab('calculator')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
              activeTab === 'calculator'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Calculator className="w-4 h-4" />
            {isRu ? 'Калькулятор (×174/10)' : 'Speed Math (×174/10)'}
          </button>

          <button
            onClick={() => setActiveTab('memory')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
              activeTab === 'memory'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Database className="w-4 h-4" />
            {isRu ? 'Карта памяти Flash/RAM' : 'Flash/RAM Memory Map'}
          </button>

          <button
            onClick={() => setActiveTab('patch')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
              activeTab === 'patch'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Code className="w-4 h-4" />
            {isRu ? 'Генератор патчей' : 'Patch Generator'}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Verification Status Banner */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-800 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <span className="font-bold text-slate-200">
                {isRu ? 'Верифицированный статус реверс-инжиниринга:' : 'Reverse-Engineering Verification Status:'}
              </span>
              <p className="text-slate-400">
                {isRu 
                  ? 'Хук активного профиля 0x5C76 подтвержден (CONFIRMED). Реализован адаптивный сканер для устойчивости к вариациям прошивок (Fingerprint + Multi-Form Hook Matching).' 
                  : 'Active profile hook 0x5C76 is CONFIRMED. Resilient scanner implemented for firmware variation robustness (Fingerprint + Multi-Form Hook Matching).'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="px-2.5 py-1 rounded-full font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> 0x5C76 CONFIRMED
            </span>
            <span className="px-2.5 py-1 rounded-full font-mono font-bold bg-sky-950 text-sky-300 border border-sky-800">
              RESILIENT SCANNER READY
            </span>
          </div>
        </div>

        {/* Tab Switcher Body */}
        {activeTab === 'flashing' && <FlashingGuide isRu={isRu} targetSpeed={35} />}
        {activeTab === 'uploader' && <FirmwareUploader isRu={isRu} />}
        {activeTab === 'scanner' && <ResilientPatcherScanner isRu={isRu} />}
        {activeTab === 'dualtrack' && <DualTrackAnalyzer isRu={isRu} />}
        {activeTab === 'modes' && <ModeAnalysisCard isRu={isRu} />}
        {activeTab === 'dataflow' && <DataFlowVisualizer isRu={isRu} />}
        {activeTab === 'disasm' && <DisassemblyViewer isRu={isRu} />}
        {activeTab === 'calculator' && <SpeedCalculator isRu={isRu} />}
        {activeTab === 'memory' && <MemoryMapViewer isRu={isRu} />}
        {activeTab === 'patch' && <PatchGenerator isRu={isRu} />}

        {/* Deep RE Summary Section */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-sky-400" />
            {isRu ? 'Техническое резюме анализа режимов Eco / Drive / Sport' : 'Technical Summary of Eco / Drive / Sport Analysis'}
          </h2>

          <div className="space-y-4 text-xs text-slate-300 leading-relaxed font-mono bg-slate-950 p-5 rounded-lg border border-slate-800/80">
            <div>
              <span className="text-emerald-400 font-bold">1. [CONFIRMED] Resilient Hook Architecture & r7 Pointer:</span>
              <p className="text-slate-400 mt-1 pl-4 border-l border-emerald-500/30">
                Контроллер не хранит 3 статичные константы во Flash для каждого режима. Вместо этого r7 указывает на активную структуру, и хук <code className="text-amber-300">LDRB r0, [r7, #9]</code> в 0x5C76 универсально действует на любой активный режим (Eco, Drive, Sport).
              </p>
            </div>

            <div>
              <span className="text-sky-400 font-bold">2. [RESILIENT SCANNER] Защита от вариаций прошивок:</span>
              <p className="text-slate-400 mt-1 pl-4 border-l border-sky-500/30">
                Вместо жестко закодированной сигнатуры <code className="text-slate-200">AB 49 78 7A 08 80</code> сканер проверяет: (1) валидность таблицы векторов ARM; (2) гибкие смещения пула констант LDR; (3) генерализованные базовые регистры; (4) повторные патчи уже модифицированных файлов.
              </p>
            </div>

            <div>
              <span className="text-amber-400 font-bold">3. [DUAL-TRACK RE] Взаимодействие Track A (0x20001E2C) и Track B:</span>
              <p className="text-slate-400 mt-1 pl-4 border-l border-amber-500/30">
                Track A (0x20001E2C) принимает события смены режима от UART/BLE и выставляет активную структуру. Track B непрерывно считывает лимит через <code className="text-slate-200">[r7+0x09]</code> и передает его в контур масштабирования скорости (0x08003698, ×174/10).
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 mt-12 text-center text-xs text-slate-500">
        <p>Xiaomi Scooter 5 Plus (Brightway ES32) Reverse Engineering Analysis Suite • bwpatcher mi5plus.py</p>
      </footer>
    </div>
  );
}

