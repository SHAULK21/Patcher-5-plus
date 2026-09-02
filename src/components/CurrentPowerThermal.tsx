import React, { useState } from 'react';
import { MATH_SCALING_BLOCKS } from '../data/firmwareData';
import { MathBlockEntry } from '../types';
import { Zap, Flame, Cpu, AlertTriangle, HelpCircle, CheckCircle2, TrendingDown } from 'lucide-react';

export const CurrentPowerThermal: React.FC = () => {
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [inverterTemp, setInverterTemp] = useState<number>(55);
  const [nominalPhaseCurrent, setNominalPhaseCurrent] = useState<number>(30);

  const filteredBlocks = MATH_SCALING_BLOCKS.filter(b => {
    if (selectedFilter === 'all') return true;
    return b.category === selectedFilter;
  });

  // Calculate dynamic derating factor based on temperature
  // Normal up to 65C, derates linearly down to 0% at 85C
  const getDeratingFactor = (temp: number) => {
    if (temp <= 65) return 1.0;
    if (temp >= 85) return 0.0;
    return 1.0 - (temp - 65) / 20;
  };

  const deratingFactor = getDeratingFactor(inverterTemp);
  const effectivePhaseCurrent = (nominalPhaseCurrent * deratingFactor).toFixed(1);
  const estimatedPowerWatts = ((48 * (nominalPhaseCurrent * 0.55)) * deratingFactor).toFixed(0);

  return (
    <div className="space-y-6" id="current-power-explorer">
      {/* Top Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs font-semibold bg-cyan-950 text-cyan-300 border border-cyan-700/60 rounded">
                FOC &amp; Thermal Subsystem
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Battery Current vs Phase Current vs Thermal Clamps
              </span>
            </div>
            <h2 className="text-lg font-bold text-white mt-1">
              Current, Power &amp; Thermal Derating Architecture
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl">
              Strict engineering distinction between <strong>Battery Current</strong> (DC bus limit), <strong>Phase Current</strong> (AC stator torque Iq), and <strong>Thermal Foldback</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Critical Concept Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2 text-cyan-400">
            <Zap className="w-4 h-4" />
            <h3 className="text-xs font-bold text-white uppercase">1. Battery Current (I_bat)</h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            DC current drawn from the 48V battery pack. Dictates total electric power: <code className="font-mono text-cyan-300">P = V_bat × I_bat</code>. Limited by BMS and DC bus trace temperature.
          </p>
          <div className="mt-3 p-2 bg-slate-950 rounded text-[11px] font-mono text-slate-400">
            Dataflow: ADC Shunt &rarr; Filter &rarr; Battery Limit Clamp
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2 text-emerald-400">
            <Cpu className="w-4 h-4" />
            <h3 className="text-xs font-bold text-white uppercase">2. Phase Current (I_phase / Iq)</h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            AC current delivered to the 3-phase BLDC motor coils. Dictates low-speed torque: <code className="font-mono text-emerald-300">Torque = Kt × Iq</code>. Phase current can exceed battery current at low speeds.
          </p>
          <div className="mt-3 p-2 bg-slate-950 rounded text-[11px] font-mono text-slate-400">
            Dataflow: Throttle &rarr; Iq Setpoint &rarr; PI Current Loop &rarr; SVPWM
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2 text-amber-400">
            <Flame className="w-4 h-4" />
            <h3 className="text-xs font-bold text-white uppercase">3. Thermal Derating (Foldback)</h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            NTC thermistors on MOSFET heatsink and motor stator monitor junction heat. When temp &gt; 65°C, controller clamps Iq and power linearly.
          </p>
          <div className="mt-3 p-2 bg-slate-950 rounded text-[11px] font-mono text-slate-400">
            Dataflow: NTC ADC &rarr; Look-up Curve &rarr; Iq Max Scaling Clamp
          </div>
        </div>
      </div>

      {/* Interactive Thermal Foldback Simulator */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Interactive Thermal Derating Model</h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Derating Threshold: 65°C &bull; Cutoff: 85°C
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1.5 font-semibold">
                <span className="text-slate-300">MOSFET / Inverter Temperature:</span>
                <span className={`font-mono font-bold ${inverterTemp >= 75 ? 'text-rose-400' : inverterTemp >= 65 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {inverterTemp}°C
                </span>
              </div>
              <input
                type="range"
                min="25"
                max="90"
                value={inverterTemp}
                onChange={(e) => setInverterTemp(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                <span>25°C (Ambient)</span>
                <span>65°C (Derate Start)</span>
                <span>85°C (Full Cutoff)</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5 font-semibold">
                <span className="text-slate-300">Nominal Phase Target:</span>
                <span className="font-mono text-cyan-400 font-bold">{nominalPhaseCurrent} A</span>
              </div>
              <input
                type="range"
                min="15"
                max="45"
                value={nominalPhaseCurrent}
                onChange={(e) => setNominalPhaseCurrent(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>
          </div>

          <div className="lg:col-span-2 grid grid-cols-3 gap-3">
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-center flex flex-col justify-center">
              <span className="text-[11px] text-slate-400 block mb-1">Thermal Derate Factor</span>
              <span className="text-2xl font-bold font-mono text-white">
                {(deratingFactor * 100).toFixed(0)}%
              </span>
              <span className="text-[10px] text-slate-500 mt-1 font-mono">
                {deratingFactor < 1.0 ? `${((1 - deratingFactor) * 100).toFixed(0)}% throttled` : 'Nominal output'}
              </span>
            </div>

            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-center flex flex-col justify-center">
              <span className="text-[11px] text-slate-400 block mb-1">Effective Clamped Phase (Iq)</span>
              <span className="text-2xl font-bold font-mono text-emerald-400">
                {effectivePhaseCurrent} <span className="text-xs">A</span>
              </span>
              <span className="text-[10px] text-slate-500 mt-1 font-mono">
                Stator torque output
              </span>
            </div>

            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-center flex flex-col justify-center">
              <span className="text-[11px] text-slate-400 block mb-1">Estimated Power Ceiling</span>
              <span className="text-2xl font-bold font-mono text-cyan-400">
                {estimatedPowerWatts} <span className="text-xs">W</span>
              </span>
              <span className="text-[10px] text-slate-500 mt-1 font-mono">
                @ 48V DC bus nominal
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Arithmetic Multiplier Table (0x5700+) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-bold text-white">Disassembled Math &amp; Scaling Blocks (0x5700 – 0x5820)</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Identified arithmetic multiplier blocks. Marked as UNCONFIRMED until full dataflow from sensor to actuator is proven.
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {['all', 'speed', 'current', 'power', 'thermal'].map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedFilter(cat)}
                className={`px-2.5 py-1 rounded text-xs capitalize transition-colors font-medium ${
                  selectedFilter === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto text-xs font-mono">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-950/80 text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4">Offset</th>
                <th className="py-2.5 px-4">MCU Addr</th>
                <th className="py-2.5 px-4">Multiplier</th>
                <th className="py-2.5 px-4">Raw Instructions</th>
                <th className="py-2.5 px-4">Candidate Engineering Meaning</th>
                <th className="py-2.5 px-4">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredBlocks.map(block => (
                <tr key={block.id} className="hover:bg-slate-800/40">
                  <td className="py-2.5 px-4 text-slate-400">{block.offset}</td>
                  <td className="py-2.5 px-4 text-cyan-400 font-bold">{block.mcuAddress}</td>
                  <td className="py-2.5 px-4 text-emerald-400 font-bold">{block.multiplier}</td>
                  <td className="py-2.5 px-4 text-slate-300 font-mono text-[11px]">{block.rawInstructions}</td>
                  <td className="py-2.5 px-4 text-slate-200">{block.candidateMeaning}</td>
                  <td className="py-2.5 px-4">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-semibold rounded ${
                        block.confidence === 'CONFIRMED'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                          : 'bg-amber-950 text-amber-300 border border-amber-700/60'
                      }`}
                    >
                      {block.confidence}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
