import React from 'react';
import { RAM_PARAMETER_MAP } from '../data/firmwareData';
import { ShieldAlert, AlertTriangle, CheckCircle2, HelpCircle, XCircle, Search } from 'lucide-react';

export const MultiModeAnalyzer: React.FC = () => {
  return (
    <div className="space-y-6" id="multimode-explorer">
      {/* Top Banner on Mode Source State */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-700/60 rounded">
                Mode Dispatcher & RAM Mapping
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Eco / Drive / Sport Investigation
              </span>
            </div>
            <h2 className="text-lg font-bold text-white mt-1">
              Multi-Mode Profile Architecture & Hypothesis Testing
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl">
              Investigation into mode selection logic (<code className="font-mono text-cyan-300">Eco</code>, <code className="font-mono text-cyan-300">Drive</code>, <code className="font-mono text-cyan-300">Sport</code>), parameter RAM addresses, and disproved hypotheses.
            </p>
          </div>
        </div>
      </div>

      {/* Disproved Hypothesis Banner: 0x200002B7 */}
      <div className="bg-rose-950/30 border border-rose-800/60 rounded-xl p-5">
        <div className="flex items-start gap-3.5">
          <div className="p-2 bg-rose-600/20 text-rose-400 rounded-lg shrink-0 mt-0.5">
            <XCircle className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-rose-200">
                DISPROVED HYPOTHESIS: 0x200002B7 is NOT the Eco/Drive/Sport Selector
              </h3>
              <span className="px-2 py-0.5 text-[10px] font-mono bg-rose-900/60 text-rose-300 border border-rose-700 rounded">
                Confidence: CONFIRMED DISPROVED
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Prior hypothesis claimed <code className="font-mono text-rose-300">0x200002B7</code> was an active profile selector with values <code className="font-mono text-rose-300">0=Eco, 1=Drive, 2=Sport</code>.
              <strong> Disassembly analysis in region 0x5B50–0x5BC0 strictly disproved this:</strong>
            </p>
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 space-y-1">
              <div className="text-cyan-400">0x08005B70: LDR  r0, [pc, #0x230]  ; r0 = &amp;0x200002B7</div>
              <div className="text-cyan-400">0x08005B72: LDRB r0, [r0, #0]       ; Load state byte</div>
              <div className="text-amber-400 font-bold">0x08005B74: CMP  r0, #8            ; Bounds check vs 8 (9 FSM states!)</div>
              <div className="text-cyan-400">0x08005B76: BHI  0x08005B82        ; Discard if &gt; 8</div>
              <div className="text-emerald-400">0x08005B78: TBB  [pc, r0]          ; 9-way jump table for general runtime FSM</div>
            </div>
            <p className="text-xs text-slate-400">
              <strong>Conclusion:</strong> 0x200002B7 represents an internal runtime state machine with indices 0 through 8, not a 3-mode rider profile switch. Do not create patches targeting this address.
            </p>
          </div>
        </div>
      </div>

      {/* Target Roadmap: What is Needed for Independent Eco/Drive/Sport Patches */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span>
            <h4 className="text-xs font-bold text-white uppercase">1. Mode Input Handler</h4>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Trace BLE / Dashboard UART frame receiving speed mode button presses (single/double clicks). Locate the target variable storing current rider mode ID.
          </p>
          <span className="inline-block mt-3 px-2 py-0.5 text-[10px] font-mono bg-slate-800 text-slate-400 rounded">
            Status: Active RE
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400"></span>
            <h4 className="text-xs font-bold text-white uppercase">2. Profile Struct Dispatch</h4>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Locate where the pointer <code className="font-mono text-cyan-300">r7</code> is initialized before calling <code className="font-mono text-cyan-300">0x08005C74</code>. Verify if 3 static structs exist in Flash or 1 struct in RAM.
          </p>
          <span className="inline-block mt-3 px-2 py-0.5 text-[10px] font-mono bg-slate-800 text-slate-400 rounded">
            Status: Active RE
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            <h4 className="text-xs font-bold text-white uppercase">3. Dedicated Limiters</h4>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            If 3 distinct profile source tables exist, generate 3 dedicated patches (<code className="font-mono text-emerald-300">speed_eco</code>, <code className="font-mono text-emerald-300">speed_drive</code>, <code className="font-mono text-emerald-300">speed_sport</code>).
          </p>
          <span className="inline-block mt-3 px-2 py-0.5 text-[10px] font-mono bg-slate-800 text-slate-400 rounded">
            Status: Blocked on Proof
          </span>
        </div>
      </div>

      {/* Parameter RAM Map Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Exploratory Parameter RAM Map (0x200014AD – 0x200014C5)</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Parsed from global configuration initialization loop. Semantics marked strictly as UNCONFIRMED.
            </p>
          </div>
          <span className="px-2.5 py-1 text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-700/60 rounded">
            13 Parameter Slots
          </span>
        </div>

        <div className="overflow-x-auto text-xs font-mono">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-950/80 text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4">Param ID</th>
                <th className="py-2.5 px-4">RAM Destination</th>
                <th className="py-2.5 px-4">Investigative Hypothesis</th>
                <th className="py-2.5 px-4">Confidence</th>
                <th className="py-2.5 px-4">Data-flow Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {RAM_PARAMETER_MAP.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-800/40">
                  <td className="py-2 px-4 text-cyan-400 font-bold">{entry.paramId}</td>
                  <td className="py-2 px-4 text-emerald-400 font-bold">{entry.ramAddress}</td>
                  <td className="py-2 px-4 text-slate-200">{entry.currentHypothesis}</td>
                  <td className="py-2 px-4">
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-950 text-amber-300 border border-amber-700/60 rounded">
                      {entry.confidence}
                    </span>
                  </td>
                  <td className="py-2 px-4 text-slate-400 text-[11px]">{entry.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
