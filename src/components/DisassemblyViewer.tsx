import React, { useState } from 'react';
import { DISASM_SNIPPETS } from '../data/reData';
import { Terminal, Code2, ArrowRight, Eye, Check } from 'lucide-react';

interface Props {
  isRu: boolean;
}

export const DisassemblyViewer: React.FC<Props> = ({ isRu }) => {
  const [selectedSnippetIdx, setSelectedSnippetIdx] = useState(0);
  const [simulatedSpeed, setSimulatedSpeed] = useState(35);
  const [copied, setCopied] = useState(false);

  const snippet = DISASM_SNIPPETS[selectedSnippetIdx];
  const hexImm = simulatedSpeed.toString(16).toUpperCase().padStart(2, '0');

  const copyPatch = () => {
    navigator.clipboard.writeText(`0x05C76: 78 7A -> ${hexImm} 20 (MOVS r0, #${simulatedSpeed})`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Terminal className="w-5 h-5 text-emerald-400" />
            {isRu ? 'Дизассемблер ARM Thumb-2 & Анализ инструкций' : 'ARM Thumb-2 Disassembly & Instruction Analysis'}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {isRu 
              ? 'Точный листинг инструкций ARM Cortex-M с комментариями и точками модификации' 
              : 'Precise ARM Cortex-M instruction trace with memory comments and patch targets'}
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 self-start sm:self-auto">
          {DISASM_SNIPPETS.map((s, idx) => (
            <button
              key={s.address}
              onClick={() => setSelectedSnippetIdx(idx)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                selectedSnippetIdx === idx
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {s.address}
            </button>
          ))}
        </div>
      </div>

      {/* Snippet Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
          <Code2 className="w-4 h-4 text-sky-400" />
          {isRu ? snippet.titleRu : snippet.title}
        </h3>
        <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
          Base: {snippet.address}
        </span>
      </div>

      {/* Disassembly Table */}
      <div className="border border-slate-800 rounded-lg overflow-x-auto bg-slate-950 font-mono text-xs mb-6">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 text-[11px]">
              <th className="py-2.5 px-4 w-28">OFFSET</th>
              <th className="py-2.5 px-4 w-28">OPCODE (HEX)</th>
              <th className="py-2.5 px-4 w-48">INSTRUCTION</th>
              <th className="py-2.5 px-4">ANNOTATION / COMMENT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {snippet.lines.map((line) => {
              const isHook = line.offset === '0x08005C76';
              return (
                <tr
                  key={line.offset}
                  className={`transition-colors ${
                    isHook ? 'bg-sky-950/40 hover:bg-sky-950/60' : 'hover:bg-slate-900/50'
                  }`}
                >
                  <td className="py-2.5 px-4 text-slate-400 font-semibold">{line.offset}</td>
                  <td className="py-2.5 px-4">
                    {isHook ? (
                      <span className="inline-flex items-center gap-1.5 font-bold text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/80">
                        {line.hex}
                        <ArrowRight className="w-3 h-3 text-sky-400" />
                        {hexImm} 20
                      </span>
                    ) : (
                      <span className="text-emerald-400">{line.hex}</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-sky-300 font-bold">
                    {isHook ? (
                      <span>
                        <span className="line-through text-slate-500 mr-2">{line.asm}</span>
                        <span className="text-amber-300">MOVS r0, #{simulatedSpeed}</span>
                      </span>
                    ) : (
                      line.asm
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-slate-300 text-[11px]">{line.comment}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Interactive Live Hook Modifier */}
      {selectedSnippetIdx === 0 && (
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-slate-200">
              {isRu ? 'Интерактивная замена опкода хука (0x05C76):' : 'Interactive Hook Opcode Simulator (0x05C76):'}
            </div>
            <div className="text-[11px] text-slate-400">
              {isRu 
                ? `Выбрано: ${simulatedSpeed} -> Опкод: ${hexImm} 20 (Thumb MOVS r0, #${simulatedSpeed})`
                : `Selected: ${simulatedSpeed} -> Opcode: ${hexImm} 20 (Thumb MOVS r0, #${simulatedSpeed})`}
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <input
              type="range"
              min="15"
              max="45"
              value={simulatedSpeed}
              onChange={(e) => setSimulatedSpeed(Number(e.target.value))}
              className="w-32 accent-sky-500 cursor-pointer"
            />
            <span className="font-mono text-sm font-bold text-sky-400 w-12 text-center bg-slate-900 py-1 rounded border border-slate-800">
              {simulatedSpeed}
            </span>
            <button
              onClick={copyPatch}
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {copied ? (isRu ? 'Скопировано!' : 'Copied!') : (isRu ? 'Копировать' : 'Copy')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
