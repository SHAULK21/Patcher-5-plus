import React, { useState } from 'react';
import { DISASSEMBLY_RANGES, FIRMWARE_METADATA } from '../data/firmwareData';
import { DisassemblyInstruction } from '../types';
import { Search, Code, CheckCircle, Info } from 'lucide-react';

export const DisassemblyViewer: React.FC = () => {
  const [selectedRangeId, setSelectedRangeId] = useState<string>(DISASSEMBLY_RANGES[0].id);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const currentRange = DISASSEMBLY_RANGES.find(r => r.id === selectedRangeId) || DISASSEMBLY_RANGES[0];

  const filteredInstructions = currentRange.instructions.filter(inst => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      inst.mnemonic.toLowerCase().includes(q) ||
      inst.operands.toLowerCase().includes(q) ||
      (inst.comment && inst.comment.toLowerCase().includes(q)) ||
      inst.bytes.toLowerCase().includes(q) ||
      `0x${inst.offset.toString(16)}`.toLowerCase().includes(q) ||
      `0x${inst.mcuAddr.toString(16)}`.toLowerCase().includes(q)
    );
  });

  const getInstructionHighlightClass = (inst: DisassemblyInstruction) => {
    if (inst.isHook || inst.highlight === 'speed') {
      return 'bg-blue-950/40 border-l-4 border-blue-500 text-blue-100';
    }
    if (inst.highlight === 'clamp') {
      return 'bg-emerald-950/30 border-l-4 border-emerald-500 text-emerald-100';
    }
    if (inst.highlight === 'scale') {
      return 'bg-purple-950/30 border-l-4 border-purple-500 text-purple-100';
    }
    if (inst.highlight === 'state') {
      return 'bg-amber-950/30 border-l-4 border-amber-500 text-amber-100';
    }
    if (inst.highlight === 'ram') {
      return 'bg-cyan-950/30 border-l-4 border-cyan-500 text-cyan-100';
    }
    return 'hover:bg-slate-800/40 text-slate-300';
  };

  return (
    <div className="space-y-6" id="disassembly-explorer">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs font-semibold bg-blue-950 text-blue-300 border border-blue-700/60 rounded">
                ARM Thumb / Thumb-2 Disassembler
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Base Address: 0x08000000
              </span>
            </div>
            <h2 className="text-lg font-bold text-white mt-1">
              Firmware Disassembly & Micro-Architecture Analyzer
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl">
              Inspect critical MCU subroutines, register usage (<code className="font-mono text-cyan-300">r0–r7</code>), and opcodes extracted from <code className="font-mono text-slate-200">{FIRMWARE_METADATA.fileName}</code>.
            </p>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              id="disasm-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search mnemonic, address, opcode..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Range Selection Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {DISASSEMBLY_RANGES.map(range => {
          const isSelected = selectedRangeId === range.id;
          return (
            <button
              key={range.id}
              id={`range-btn-${range.id}`}
              onClick={() => setSelectedRangeId(range.id)}
              className={`p-3.5 rounded-xl text-left border transition-all ${
                isSelected
                  ? 'bg-slate-800 border-blue-500 shadow-md shadow-blue-500/10'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="text-xs font-bold text-slate-200">{range.title}</div>
              <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{range.description}</p>
              <div className="mt-2 text-[10px] font-mono text-cyan-400">
                Range: 0x{range.startOffset.toString(16).toUpperCase()} – 0x{range.endOffset.toString(16).toUpperCase()}
              </div>
            </button>
          );
        })}
      </div>

      {/* Disassembly Code Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4 text-blue-400" />
            <span className="font-semibold text-white">{currentRange.title}</span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400 font-mono">{filteredInstructions.length} instructions displayed</span>
          </div>

          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1.5 text-blue-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-500"></span> Patch Point / Speed
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span> Clamp Logic
            </span>
            <span className="flex items-center gap-1.5 text-purple-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-purple-500"></span> Scaling Math
            </span>
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500"></span> State Index
            </span>
          </div>
        </div>

        <div className="overflow-x-auto font-mono text-xs max-h-[600px] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-950/80 sticky top-0 z-10 text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4">Offset</th>
                <th className="py-2.5 px-4">MCU Addr</th>
                <th className="py-2.5 px-4">Hex Opcode</th>
                <th className="py-2.5 px-4">Mnemonic</th>
                <th className="py-2.5 px-4">Operands</th>
                <th className="py-2.5 px-4">Disassembly Comment / Evidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredInstructions.map((inst) => (
                <tr
                  key={`${inst.offset}-${inst.mcuAddr}`}
                  className={`transition-colors ${getInstructionHighlightClass(inst)}`}
                >
                  <td className="py-2 px-4 text-slate-400">
                    0x{inst.offset.toString(16).padStart(4, '0').toUpperCase()}
                  </td>
                  <td className="py-2 px-4 text-cyan-400 font-bold">
                    0x{inst.mcuAddr.toString(16).toUpperCase()}
                  </td>
                  <td className="py-2 px-4 text-amber-300/90 font-mono">
                    {inst.bytes}
                  </td>
                  <td className="py-2 px-4 text-emerald-400 font-bold">
                    {inst.mnemonic}
                  </td>
                  <td className="py-2 px-4 text-slate-200">
                    {inst.operands}
                  </td>
                  <td className="py-2 px-4 text-slate-400 text-[11px]">
                    {inst.comment}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deep-dive Instruction Annotation Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 space-y-1">
          <p className="font-semibold text-white">ARM Thumb Instruction Decoding Summary:</p>
          <p>
            At file offset <code className="font-mono text-cyan-300">0x5C76</code>, the instruction <code className="font-mono text-slate-100">78 7A</code> is decoded as Thumb <code className="font-mono text-emerald-300">LDRB r0, [r7, #9]</code>.
            Replacing this with <code className="font-mono text-slate-100">XX 20</code> produces Thumb <code className="font-mono text-emerald-300">MOVS r0, #imm8</code>.
            Because both instructions occupy exactly 2 bytes (16-bit halfword) and write exclusively to register <code className="font-mono text-cyan-300">r0</code>, execution continues seamlessly into downstream scaling at <code className="font-mono text-cyan-300">0x5C84</code> without stack corruption.
          </p>
        </div>
      </div>
    </div>
  );
};
