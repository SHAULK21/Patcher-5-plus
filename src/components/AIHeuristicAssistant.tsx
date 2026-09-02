import React, { useState } from 'react';
import { Cpu, Send, Sparkles, RefreshCw, CheckCircle, AlertTriangle, FileCode } from 'lucide-react';

export const AIHeuristicAssistant: React.FC = () => {
  const [snippet, setSnippet] = useState<string>(
`// Target: 0x5C74 Speed Hook
0x08005C72: LDR   r1, [pc, #0x2AC]  ; r1 = 0x20000234
0x08005C76: LDRB  r0, [r7, #9]      ; 78 7A
0x08005C78: STRH  r0, [r1, #0]      ; 08 80
0x08005C84: MOVS  r2, #0xAE         ; 174
0x08005C86: MULS  r2, r0, r2
0x08005C88: MOVS  r3, #10
0x08005C8A: UDIV  r0, r2, r3
0x08005C8E: STRH  r0, [r5, #0x18]`
  );

  const [query, setQuery] = useState<string>(
    'Trace the data-flow from r7+0x09 to control+0x18. Is 78 7A -> XX 20 a safe patch? Categorize all conclusions.'
  );

  const [targetAddress, setTargetAddress] = useState<string>('0x08005C74 / Offset 0x5C74');
  const [loading, setLoading] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [engineSource, setEngineSource] = useState<string | null>(null);

  const handleRunAnalysis = async () => {
    setLoading(true);
    setAnalysisResult(null);

    try {
      const response = await fetch('/api/ai-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeSnippet: snippet,
          query: query,
          targetAddress: targetAddress,
          context: 'Xiaomi Scooter 5 Plus (Brightway MCU / ES32, Thumb-2 @ 0x08000000, size 125371 bytes)'
        })
      });

      const data = await response.json();
      setAnalysisResult(data.analysis);
      setEngineSource(data.source || 'gemini-ai');
    } catch (err: any) {
      setAnalysisResult(`Error running analysis: ${err.message}`);
      setEngineSource('error');
    } finally {
      setLoading(false);
    }
  };

  const loadPreset = (presetType: 'speed-hook' | 'kers-hook' | 'state-200002b7' | 'clamp-loop' | 'shunt-math') => {
    switch (presetType) {
      case 'speed-hook':
        setTargetAddress('0x08005C74 / Offset 0x5C74');
        setSnippet(
`0x08005C72: LDR   r1, [pc, #0x2AC]  ; r1 = 0x20000234
0x08005C76: LDRB  r0, [r7, #9]      ; 78 7A
0x08005C78: STRH  r0, [r1, #0]      ; 08 80
0x08005C84: MOVS  r2, #0xAE         ; 174
0x08005C86: MULS  r2, r0, r2
0x08005C88: MOVS  r3, #10
0x08005C8A: UDIV  r0, r2, r3
0x08005C8E: STRH  r0, [r5, #0x18]`
        );
        setQuery('Analyze register lifespans and verify that replacing 78 7A with MOVS r0, #imm8 does not cause register spill or stack corruption.');
        break;
      case 'kers-hook':
        setTargetAddress('0x08005C9E / Offset 0x5C9E');
        setSnippet(
`0x08005C9C: LDR   r0, [pc, #0x2B4]  ; r0 = 0x20000236 (KERS Level buffer)
0x08005C9E: LDRB  r0, [r7, #11]     ; 78 7B (Original load KERS config)
0x08005CA0: CBZ   r0, .zero_kers    ; 40 B1
0x08005CA2: STRB  r0, [r1, #0x0B]   ; Store active regen strength
.zero_kers:
0x080037A0: LDRB  r0, [0x20000236]  ; FOC Loop KERS check
0x080037A2: CMP   r0, #0
0x080037A4: BEQ   .freewheel_coast  ; Zero Iq injection -> Freewheeling`
        );
        setQuery('Verify data-flow of patching 0x5C9E from 78 7B to 00 20 (MOVS r0, #0). Does forcing KERS=0 safely bypass regenerative braking without affecting brake handle lever safety interrupts?');
        break;
      case 'state-200002b7':
        setTargetAddress('0x08005B70 / Offset 0x5B70');
        setSnippet(
`0x08005B70: LDR   r0, [pc, #0x230]  ; r0 = 0x200002B7
0x08005B72: LDRB  r0, [r0, #0]
0x08005B74: CMP   r0, #8            ; Compare against 8
0x08005B76: BHI   0x08005B82
0x08005B78: TBB   [pc, r0]          ; 9-entry table`
        );
        setQuery('Verify why 0x200002B7 is proven to be a 9-state FSM rather than a 3-mode Eco/Drive/Sport selector.');
        break;
      case 'clamp-loop':
        setTargetAddress('0x08003780 / Offset 0x3780');
        setSnippet(
`0x08003780: LDRSH r1, [r5, #0x14]   ; Requested target speed
0x08003782: LDRSH r0, [r5, #0x18]   ; Upper speed limit threshold
0x08003784: CMP   r1, r0
0x08003786: BLE   .no_clamp
0x08003788: STRH  r0, [r5, #0x14]   ; Enforce clamp
.no_clamp:`
        );
        setQuery('Confirm how control+0x14 and control+0x18 interact in this speed limiting clamp subroutine.');
        break;
      case 'shunt-math':
        setTargetAddress('0x08005714 / Offset 0x5714');
        setSnippet(
`0x08005714: MOVS  r2, #18
0x08005716: MULS  r2, r0, r2
0x08005718: MOVS  r3, #10
0x0800571A: UDIV  r2, r2, r3        ; r2 = (r0 * 1.8)`
        );
        setQuery('Analyze potential physical meanings of the x1.8 multiplier block and list requirements to verify if this is battery current vs phase current.');
        break;
    }
  };

  return (
    <div className="space-y-6" id="ai-assistant-workspace">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs font-semibold bg-blue-950 text-blue-300 border border-blue-700/60 rounded flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-blue-400" />
                AI-Assisted ARM Thumb Reverse Engineering
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Gemini 2.5 Flash + Local Heuristic Engine
              </span>
            </div>
            <h2 className="text-lg font-bold text-white mt-1">
              ARM Cortex-M Disassembly &amp; Dataflow Copilot
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl">
              Inspect register dataflows, verify Thumb-2 opcodes, and analyze subroutine bounds with strict evidence categorization (<code className="font-mono text-emerald-300">CONFIRMED</code> / <code className="font-mono text-blue-300">STRONG CANDIDATE</code> / <code className="font-mono text-amber-300">UNCONFIRMED</code>).
            </p>
          </div>
        </div>
      </div>

      {/* Preset Quick Selectors */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-slate-400 font-medium whitespace-nowrap">Load Preset:</span>
        <button
          id="btn-preset-speed-hook"
          onClick={() => loadPreset('speed-hook')}
          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg whitespace-nowrap"
        >
          Speed Hook (0x5C74)
        </button>
        <button
          id="btn-preset-kers-hook"
          onClick={() => loadPreset('kers-hook')}
          className="px-3 py-1.5 bg-cyan-950/40 hover:bg-cyan-900/50 text-cyan-300 border border-cyan-800/80 rounded-lg whitespace-nowrap"
        >
          KERS / Freewheel (0x5C9E)
        </button>
        <button
          id="btn-preset-state-200002b7"
          onClick={() => loadPreset('state-200002b7')}
          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg whitespace-nowrap"
        >
          0x200002B7 State FSM
        </button>
        <button
          id="btn-preset-clamp-loop"
          onClick={() => loadPreset('clamp-loop')}
          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg whitespace-nowrap"
        >
          Limiter Clamp (0x3780)
        </button>
        <button
          id="btn-preset-shunt-math"
          onClick={() => loadPreset('shunt-math')}
          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg whitespace-nowrap"
        >
          Scaling Math (0x5714)
        </button>
      </div>

      {/* Editor & Prompt Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Code & Query Input */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Target Address / Memory Offset:
              </label>
              <input
                type="text"
                id="input-ai-target-addr"
                value={targetAddress}
                onChange={(e) => setTargetAddress(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                ARM Thumb Assembly Snippet:
              </label>
              <textarea
                id="textarea-ai-snippet"
                rows={9}
                value={snippet}
                onChange={(e) => setSnippet(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 font-mono text-xs text-emerald-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Analysis Query &amp; Focus Directives:
              </label>
              <textarea
                id="textarea-ai-query"
                rows={3}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              id="btn-run-ai-analysis"
              onClick={handleRunAnalysis}
              disabled={loading}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-lg text-xs font-semibold shadow-md shadow-blue-600/30 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Analyzing Disassembly...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Execute RE Analysis</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Analysis Results */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 min-h-[440px] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-bold text-white">Reverse Engineering Assessment</h3>
                </div>
                {engineSource && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    Source: {engineSource}
                  </span>
                )}
              </div>

              {analysisResult ? (
                <div className="mt-4 prose prose-invert max-w-none text-xs text-slate-300 leading-relaxed space-y-3 font-sans whitespace-pre-wrap">
                  {analysisResult}
                </div>
              ) : (
                <div className="py-20 text-center text-slate-500 text-xs">
                  <FileCode className="w-10 h-10 mx-auto text-slate-700 mb-2" />
                  <p>Click <strong className="text-slate-400">"Execute RE Analysis"</strong> to generate an in-depth data-flow breakdown.</p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-500">
              Analysis strictly adheres to Brightway ES32 / Cortex-M architecture with verified register constraints.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
