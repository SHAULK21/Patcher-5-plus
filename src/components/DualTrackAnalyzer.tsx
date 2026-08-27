import React, { useState } from 'react';
import { TRACK_A_DETAILS, TRACK_B_DETAILS } from '../data/reData';
import { GitFork, ArrowDown, ArrowRight, CheckCircle2, ShieldCheck, Cpu, Radio, Zap, AlertTriangle, Layers } from 'lucide-react';

interface Props {
  isRu: boolean;
}

export const DualTrackAnalyzer: React.FC<Props> = ({ isRu }) => {
  const [activeSubView, setActiveSubView] = useState<'both' | 'trackA' | 'trackB'>('both');

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <GitFork className="w-5 h-5 text-sky-400" />
            {isRu ? 'Двунаправленный анализ (Dual-Track RE): Track A & Track B' : 'Dual-Track RE Analysis: Track A & Track B'}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {isRu 
              ? 'Исследование взаимосвязи UART-обработчика (0x20001E2C) и конвейера активного профиля (r7 -> [r7+09])' 
              : 'Correlating UART mode handler (0x20001E2C) with active profile dispatch pipeline (r7 -> [r7+09])'}
          </p>
        </div>

        {/* Sub-view switch */}
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setActiveSubView('both')}
            className={`px-3 py-1.5 rounded font-medium transition-all ${
              activeSubView === 'both' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {isRu ? 'Оба трека' : 'Both Tracks'}
          </button>
          <button
            onClick={() => setActiveSubView('trackA')}
            className={`px-3 py-1.5 rounded font-medium transition-all ${
              activeSubView === 'trackA' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Track A (UART/STR*)
          </button>
          <button
            onClick={() => setActiveSubView('trackB')}
            className={`px-3 py-1.5 rounded font-medium transition-all ${
              activeSubView === 'trackB' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Track B (r7/Hook)
          </button>
        </div>
      </div>

      {/* Grid of Two Tracks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Track A Card */}
        {(activeSubView === 'both' || activeSubView === 'trackA') && (
          <div className="bg-slate-950 border border-amber-900/40 rounded-xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/80">
                  TRACK A: UART & MODE STRUCT
                </span>
                <span className="text-xs font-mono text-slate-400">0x20001E2C</span>
              </div>

              <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                <Radio className="w-4 h-4 text-amber-400" />
                {isRu ? 'Трассировка записи (STR*) и селектора 1 / 2' : 'STR* Tracing & 1 / 2 Mode Selection'}
              </h3>

              <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                {isRu ? TRACK_A_DETAILS.hypothesisRu : TRACK_A_DETAILS.hypothesis}
              </p>

              <div className="space-y-2.5 mb-4">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  {isRu ? 'Найденные инструкции STR* в прошивке:' : 'Discovered STR* Instructions:'}
                </div>
                {TRACK_A_DETAILS.strInstructions.map((str, idx) => (
                  <div key={idx} className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 text-xs font-mono">
                    <div className="flex items-center justify-between text-amber-300 font-bold mb-1">
                      <span>{str.mcuAddr}</span>
                      <span className="text-slate-300">{str.insn}</span>
                    </div>
                    <div className="text-slate-400 text-[11px] font-sans">
                      {str.source}: {str.comment}
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-800/80 text-xs text-slate-300 space-y-1.5">
                <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {isRu ? 'Ключевой вывод Track A:' : 'Track A Key Finding:'}
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
                  {isRu 
                    ? TRACK_A_DETAILS.findingsRu.map((f, i) => <li key={i}>{f}</li>)
                    : TRACK_A_DETAILS.findings.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
              <span>{isRu ? 'Роль: Стейт-машина режимов' : 'Role: Mode State Machine'}</span>
              <span className="text-amber-400 font-mono font-semibold">NOT Static Speed Const</span>
            </div>
          </div>
        )}

        {/* Track B Card */}
        {(activeSubView === 'both' || activeSubView === 'trackB') && (
          <div className="bg-slate-950 border border-emerald-900/40 rounded-xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/80">
                  TRACK B: ACTIVE PROFILE DISPATCH
                </span>
                <span className="text-xs font-mono text-slate-400">0x08005C76</span>
              </div>

              <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400" />
                {isRu ? 'Пайплайн r7 -> [r7+09] -> Хук скорости' : 'Pipeline: r7 -> [r7+09] -> Speed Hook'}
              </h3>

              <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                {isRu 
                  ? 'Контроллер динамически выставляет r7 на структуру активного профиля, считывая поле +0x09 через 78 7A (LDRB r0, [r7, #9]) в 0x20000234.' 
                  : 'Firmware points r7 to active profile struct in RAM, executing 78 7A (LDRB r0, [r7, #9]) into 0x20000234.'}
              </p>

              <div className="space-y-1.5 mb-4">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  {isRu ? 'Цепочка выполнения (Execution Chain):' : 'Execution Chain:'}
                </div>
                {TRACK_B_DETAILS.pipeline.map((p, idx) => (
                  <div key={idx} className="flex items-start gap-2 bg-slate-900/90 border border-slate-800 rounded p-2 text-xs">
                    <span className="w-5 h-5 rounded bg-emerald-950 text-emerald-400 flex items-center justify-center font-mono font-bold text-[10px] shrink-0">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-mono font-bold text-emerald-300 text-[11px]">{p.step}</div>
                      <div className="text-slate-400 text-[10px]">{p.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-800/80 text-xs text-slate-300">
                <div className="font-semibold text-emerald-300 flex items-center gap-1.5 mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {isRu ? 'Архитектурное решение:' : 'Architectural Solution:'}
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  {isRu ? TRACK_B_DETAILS.conclusionRu : TRACK_B_DETAILS.conclusion}
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
              <span>{isRu ? 'Статус патча: Проверен & Надежен' : 'Patch Status: Verified & Safe'}</span>
              <span className="text-emerald-400 font-mono font-semibold">1 Universal Hook</span>
            </div>
          </div>
        )}
      </div>

      {/* Synthesis Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-sky-950/80 via-slate-900 to-indigo-950/80 border border-sky-800/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-6 h-6 text-sky-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-white text-sm">
              {isRu 
                ? 'Итоговое архитектурное заключение по режимам Xiaomi 5 Plus' 
                : 'Architectural Synthesis on Xiaomi 5 Plus Riding Modes'}
            </h4>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              {isRu
                ? 'Нам не нужны три отдельных фиктивных speed-паттерна. Указатель r7 динамически выбирает активный профиль, поэтому единый гибкий хук на 0x5C76 (или найденном через resilient-сканер смещении) переопределяет скорость любого активного профиля (Eco/Drive/Sport) без побочных эффектов.'
                : 'Three separate fake speed patterns are not required. Since r7 points dynamically to the active profile struct, a single resilient hook at 0x5C76 universally overrides the speed of whichever profile is active.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
