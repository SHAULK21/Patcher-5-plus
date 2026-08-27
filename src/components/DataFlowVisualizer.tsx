import React, { useState } from 'react';
import { DATA_FLOW_STEPS } from '../data/reData';
import { DataFlowStep } from '../types';
import { ArrowRight, CheckCircle2, AlertTriangle, Cpu, Terminal, ShieldAlert } from 'lucide-react';

interface Props {
  isRu: boolean;
}

export const DataFlowVisualizer: React.FC<Props> = ({ isRu }) => {
  const [selectedStep, setSelectedStep] = useState<DataFlowStep>(DATA_FLOW_STEPS[1]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-100 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-sky-400" />
            {isRu ? 'Data-Flow Пайплайн: От режима до ограничения скорости' : 'Data-Flow Pipeline: From Mode to Speed Limiter'}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {isRu 
              ? 'Восстановленная цепочка прохождения данных: выбор режима -> указатель r7 -> хук 0x5C76 -> масштабирование -> кламп' 
              : 'Traced execution chain: Mode selector -> r7 pointer -> 0x5C76 hook -> factor scaling -> actuator clamp'}
          </p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full font-mono bg-sky-950 text-sky-300 border border-sky-800 self-start sm:self-auto">
          MCU ARM Thumb-2 @ 0x08000000
        </span>
      </div>

      {/* Horizontal / Grid Flow Steps */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        {DATA_FLOW_STEPS.map((step) => {
          const isSelected = selectedStep.step === step.step;
          return (
            <button
              key={step.step}
              onClick={() => setSelectedStep(step)}
              className={`text-left p-3.5 rounded-lg border transition-all relative ${
                isSelected
                  ? 'bg-sky-950/70 border-sky-500 shadow-md shadow-sky-950/50'
                  : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-900 text-sky-400 border border-slate-700">
                  STEP {step.step}
                </span>
                {step.status === 'CONFIRMED' ? (
                  <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> CONFIRMED
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> CANDIDATE
                  </span>
                )}
              </div>
              <div className="font-medium text-sm text-slate-200 line-clamp-1">
                {isRu ? step.nameRu : step.name}
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-1 truncate">
                {step.location}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Step Detail Box */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-300 flex items-center justify-center font-bold text-xs">
              {selectedStep.step}
            </span>
            <h3 className="font-semibold text-slate-100 text-base">
              {isRu ? selectedStep.nameRu : selectedStep.name}
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
            {selectedStep.location}
          </span>
        </div>

        <p className="text-sm text-slate-300 mb-4 leading-relaxed">
          {isRu ? selectedStep.descriptionRu : selectedStep.description}
        </p>

        <div className="bg-slate-900 rounded border border-slate-800 p-3">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 font-mono">
            <span className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-sky-400" />
              {isRu ? 'Ассемблерный / Протокольный код' : 'Disassembled / Protocol Stream'}
            </span>
            <span className="text-slate-500">ARM Cortex-M Thumb</span>
          </div>
          <pre className="font-mono text-xs text-emerald-300 bg-slate-950 p-3 rounded overflow-x-auto leading-relaxed border border-slate-800/80">
            {selectedStep.codeSnippet}
          </pre>
        </div>

        {selectedStep.step === 2 && (
          <div className="mt-4 p-3 rounded bg-emerald-950/40 border border-emerald-800/50 flex items-start gap-2.5 text-xs text-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong>{isRu ? 'Ключевая точка патча (Patch Hook):' : 'Key Patch Hook Point:'}</strong>{' '}
              {isRu 
                ? 'Инструкция LDRB r0, [r7, #9] (78 7A) заменяется на MOVS r0, #imm8 (XX 20), принудительно переопределяя значение активного профиля перед записью в 0x20000234.' 
                : 'Instruction LDRB r0, [r7, #9] (78 7A) is replaced with MOVS r0, #imm8 (XX 20), overriding active profile limit before STRH into 0x20000234.'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
