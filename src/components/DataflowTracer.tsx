import React, { useState } from 'react';
import { DATAFLOW_NODES } from '../data/firmwareData';
import { ConfidenceLevel, DataflowNode } from '../types';
import { CheckCircle2, AlertTriangle, HelpCircle, ArrowRight, Layers, FileSearch } from 'lucide-react';

export const DataflowTracer: React.FC = () => {
  const [selectedNode, setSelectedNode] = useState<DataflowNode>(DATAFLOW_NODES[1]); // Default to r7+0x09 hook

  const getConfidenceBadge = (confidence: ConfidenceLevel) => {
    switch (confidence) {
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-700/60">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            CONFIRMED
          </span>
        );
      case 'STRONG CANDIDATE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-950 text-blue-300 border border-blue-700/60">
            <AlertTriangle className="w-3.5 h-3.5 text-blue-400" />
            STRONG CANDIDATE
          </span>
        );
      case 'UNCONFIRMED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-700/60">
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            UNCONFIRMED
          </span>
        );
    }
  };

  return (
    <div className="space-y-6" id="dataflow-container">
      {/* Top Banner Alert on Scientific Rigor */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5">
        <div className="flex items-start gap-3.5">
          <div className="p-2 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-lg shrink-0 mt-0.5">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              Reverse Engineering Dataflow: Backwards Tracing from Limiter
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Methodical evidence-based tracing: <code className="text-slate-300 font-mono text-xs">STRH value, [rX, #0x18]</code> &rarr;
              Scaling (<code className="text-slate-300 font-mono text-xs">×174/10</code>) &rarr;
              RAM (<code className="text-slate-300 font-mono text-xs">0x20000234</code>) &rarr;
              Config struct (<code className="text-slate-300 font-mono text-xs">r7 + 0x09</code>) &rarr;
              Mode profile dispatch.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Node Graph Chain */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
        {DATAFLOW_NODES.map((node, index) => {
          const isSelected = selectedNode.id === node.id;
          return (
            <div
              key={node.id}
              id={`flow-node-${node.id}`}
              onClick={() => setSelectedNode(node)}
              className={`cursor-pointer rounded-xl p-4 transition-all border relative flex flex-col justify-between ${
                isSelected
                  ? 'bg-slate-800 border-blue-500 shadow-md shadow-blue-500/10 ring-1 ring-blue-500/30'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span className="text-[11px] font-mono text-slate-400">Step 0{index + 1}</span>
                  {getConfidenceBadge(node.confidence)}
                </div>
                <h3 className="text-xs font-semibold text-slate-200 line-clamp-2">{node.title}</h3>
                <p className="text-[11px] text-slate-400 mt-1 font-mono">{node.addressMCU}</p>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-mono">{node.fileOffset}</span>
                {index < DATAFLOW_NODES.length - 1 && (
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600 hidden md:block" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Node Detailed Deep Dive */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Dataflow Description & Status */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-white">{selectedNode.title}</h3>
                  {getConfidenceBadge(selectedNode.confidence)}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{selectedNode.subtitle}</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded border border-blue-500/20">
                  MCU: {selectedNode.addressMCU}
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Reverse Engineering Analysis
                </h4>
                <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/60 p-3.5 rounded-lg border border-slate-800/80">
                  {selectedNode.description}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  ARM Thumb / Thumb-2 Disassembly
                </h4>
                <pre className="bg-slate-950 p-4 rounded-lg font-mono text-xs text-emerald-400 border border-slate-800 overflow-x-auto whitespace-pre-wrap">
                  {selectedNode.thumbAsm}
                </pre>
              </div>

              {selectedNode.notes && (
                <div className="p-3.5 bg-slate-800/40 rounded-lg border border-slate-700/50 flex items-start gap-2.5">
                  <FileSearch className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-300 leading-normal">{selectedNode.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Strict Verification Checklist */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              State of Truth & Disproved Hypotheses
            </h4>
            <div className="space-y-2.5 text-xs text-slate-300">
              <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-800/40 flex items-start gap-2">
                <span className="text-emerald-400 font-bold">CONFIRMED:</span>
                <span>Speed clamp at 0x08003780 compares <code className="font-mono text-emerald-300">control+0x14</code> against <code className="font-mono text-emerald-300">control+0x18</code> and forces clamp if requested speed is higher.</span>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-800/40 flex items-start gap-2">
                <span className="text-emerald-400 font-bold">CONFIRMED:</span>
                <span>Scaling block at 0x5C84 multiplies raw parameter by 174 (0xAE) and divides by 10 before writing to <code className="font-mono text-emerald-300">control+0x18</code>.</span>
              </div>
              <div className="p-2.5 rounded-lg bg-blue-950/30 border border-blue-800/40 flex items-start gap-2">
                <span className="text-blue-400 font-bold">STRONG CANDIDATE:</span>
                <span>File offset 0x5C74 unique signature <code className="font-mono text-blue-300">AB 49 78 7A 08 80</code> feeds the active profile speed setting into RAM buffer 0x20000234.</span>
              </div>
              <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-800/40 flex items-start gap-2">
                <span className="text-rose-400 font-bold">DISPROVED:</span>
                <span><code className="font-mono text-rose-300">0x200002B7</code> is NOT an Eco/Drive/Sport mode selector. Analysis at 0x5B74 proves it is a general runtime state index with bounds check against 8 (9 FSM states).</span>
              </div>
              <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-800/40 flex items-start gap-2">
                <span className="text-amber-400 font-bold">UNCONFIRMED:</span>
                <span>Values (e.g. 25, 30, 35) are strong candidates for km/h, but exact physical km/h equivalence requires on-wheel or telemetry ERPM verification.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Execution Chain Summary & Backward Trace Action Plan */}
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h4 className="text-sm font-semibold text-slate-200 mb-3">Reverse Path Analysis</h4>
            <div className="space-y-3 relative pl-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800 text-xs">
              <div className="relative">
                <span className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-4 ring-slate-900"></span>
                <p className="font-semibold text-slate-200">1. Actuator Clamping (0x3780)</p>
                <p className="text-slate-400 mt-0.5">LDRSH r0, [r5, #0x18] &rarr; upper ceiling clamp.</p>
              </div>
              <div className="relative">
                <span className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-4 ring-slate-900"></span>
                <p className="font-semibold text-slate-200">2. Scaling Math (0x5C8C)</p>
                <p className="text-slate-400 mt-0.5">x174/10 multiplier writes to control+0x18.</p>
              </div>
              <div className="relative">
                <span className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-4 ring-slate-900"></span>
                <p className="font-semibold text-slate-200">3. Buffer Storage (0x5C78)</p>
                <p className="text-slate-400 mt-0.5">STRH r0, [0x20000234].</p>
              </div>
              <div className="relative">
                <span className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full bg-blue-400 ring-4 ring-slate-900"></span>
                <p className="font-semibold text-slate-200">4. Config Load (0x5C76)</p>
                <p className="text-slate-400 mt-0.5">LDRB r0, [r7, #9] &larr; Patch Target (78 7A).</p>
              </div>
              <div className="relative">
                <span className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-4 ring-slate-900"></span>
                <p className="font-semibold text-slate-200">5. Struct Allocation & Mode Source</p>
                <p className="text-slate-400 mt-0.5">Active investigation: Trace who populates r7.</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h4 className="text-sm font-semibold text-slate-200 mb-2">Next RE Target Directives</h4>
            <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside">
              <li>Disassemble callers allocating and passing <code className="font-mono text-cyan-300">r7</code> to 0x08005C74.</li>
              <li>Scan for candidate struct pointers offset by <code className="font-mono text-cyan-300">+0x09</code> in BLE / profile initialization handlers.</li>
              <li>Verify whether 3 independent mode tables exist or if the firmware dynamically overwrites the single profile buffer in RAM.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
