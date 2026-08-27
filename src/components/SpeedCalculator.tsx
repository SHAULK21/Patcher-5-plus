import React, { useState } from 'react';
import { Calculator, Zap, ArrowRight, CheckCircle, Info } from 'lucide-react';

interface Props {
  isRu: boolean;
}

export const SpeedCalculator: React.FC<Props> = ({ isRu }) => {
  const [speedVal, setSpeedVal] = useState<number>(32);
  const factor = 17.4; // 174 / 10 = 0xAE / 10

  const rawByte = Math.round(speedVal);
  const hexByte = rawByte.toString(16).toUpperCase().padStart(2, '0');
  const opcode = `${hexByte} 20`; // MOVS r0, #imm8
  const internalScaled = Math.round((rawByte * 174) / 10);
  const stock25Scaled = Math.round((25 * 174) / 10); // 435

  const presets = [
    { label: 'Eco / Ped (Stock)', labelRu: 'Eco / Пешеходный (Завод)', val: 5 },
    { label: 'Drive (Stock)', labelRu: 'Drive (Завод)', val: 20 },
    { label: 'Sport (Stock)', labelRu: 'Sport (Завод)', val: 25 },
    { label: 'Stage 1 (US 30)', labelRu: 'Stage 1 (US 30 км/ч)', val: 30 },
    { label: 'Stage 2 (Max 35)', labelRu: 'Stage 2 (Макс 35 км/ч)', val: 35 },
    { label: 'Custom 36.7', labelRu: 'Custom (36.7 км/ч)', val: 37 }
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-slate-100">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
        <Calculator className="w-5 h-5 text-sky-400" />
        <h2 className="text-xl font-semibold text-white">
          {isRu ? 'Калькулятор масштабирования скорости (×174/10)' : 'Speed Scaling & Opcode Calculator (×174/10)'}
        </h2>
      </div>

      {/* Preset Buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        {presets.map((p) => (
          <button
            key={p.val}
            onClick={() => setSpeedVal(p.val)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              speedVal === p.val
                ? 'bg-sky-600 border-sky-400 text-white shadow-sm'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            {isRu ? p.labelRu : p.label} ({p.val})
          </button>
        ))}
      </div>

      {/* Interactive Controls & Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {/* Input Card */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              {isRu ? '1. Целевая скорость (km/h)' : '1. Target Speed (km/h)'}
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="5"
                max="50"
                value={speedVal}
                onChange={(e) => setSpeedVal(Math.max(1, Math.min(60, Number(e.target.value) || 0)))}
                className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xl font-bold font-mono text-white text-center focus:outline-none focus:border-sky-500"
              />
              <span className="text-sm font-medium text-slate-400">km/h</span>
            </div>
          </div>
          <div className="text-xs text-slate-500 mt-4">
            {isRu ? 'Диапазон: 5 — 45 км/ч' : 'Recommended range: 5 — 45 km/h'}
          </div>
        </div>

        {/* Thumb Opcode Card */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              {isRu ? '2. Опкод Thumb-2 для 0x5C76' : '2. Thumb-2 Opcode for 0x5C76'}
            </div>
            <div className="font-mono text-xl font-bold text-amber-400 bg-slate-900 px-3 py-2 rounded-lg border border-slate-800 flex items-center justify-between">
              <span>{opcode}</span>
              <span className="text-xs text-slate-400 font-normal">MOVS r0, #{rawByte}</span>
            </div>
          </div>
          <div className="text-xs text-slate-400 mt-4">
            {isRu ? 'Заменяет заводские' : 'Replaces stock'} <span className="font-mono text-slate-300 font-bold">78 7A</span> (LDRB r0, [r7, #9])
          </div>
        </div>

        {/* Internal Scaled Limit Card */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              {isRu ? '3. Внутренний лимит (control + 0x18)' : '3. Internal Limit (control + 0x18)'}
            </div>
            <div className="font-mono text-xl font-bold text-emerald-400 bg-slate-900 px-3 py-2 rounded-lg border border-slate-800 flex items-center justify-between">
              <span>{internalScaled}</span>
              <span className="text-xs text-slate-400 font-normal">
                {isRu ? 'ед. скорости' : 'ERPM velocity units'}
              </span>
            </div>
          </div>
          <div className="text-xs text-slate-400 mt-4 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span>
              {isRu 
                ? `Заводской спорт (25) = ${stock25Scaled} ед.` 
                : `Stock Sport (25) = ${stock25Scaled} units`}
            </span>
          </div>
        </div>
      </div>

      {/* Formula Explanation */}
      <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-300 font-mono flex items-start gap-3">
        <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <div className="font-bold text-slate-200 mb-1">
            {isRu ? 'Формула контроллера 5 Plus:' : '5 Plus Controller Scaling Math:'}
          </div>
          <div>
            Velocity_Limit = (Input_Byte * 0xAE) / 10 = ({rawByte} * 174) / 10 ={' '}
            <strong className="text-emerald-400">{internalScaled}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
