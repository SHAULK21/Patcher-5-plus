import React, { useState } from 'react';
import { generateGitCommitMessage } from '../utils/patcher';
import { ConfidenceLevel } from '../types';
import { GitCommit, Copy, Check, ShieldAlert } from 'lucide-react';

export const GitCommitGenerator: React.FC = () => {
  const [paramName, setParamName] = useState<string>('speed limit');
  const [confidence, setConfidence] = useState<ConfidenceLevel>('STRONG CANDIDATE');
  const [hexImm, setHexImm] = useState<string>('23');
  const [copied, setCopied] = useState<boolean>(false);

  const commitMessage = generateGitCommitMessage(paramName, confidence, hexImm);

  const handleCopy = () => {
    navigator.clipboard.writeText(commitMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6" id="git-commit-generator">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs font-semibold bg-cyan-950 text-cyan-300 border border-cyan-700/60 rounded">
                Repository Standards
              </span>
              <span className="text-xs text-slate-400 font-mono">
                SHAULK21/BW-Patched_ Rules
              </span>
            </div>
            <h2 className="text-lg font-bold text-white mt-1">
              Git Commit Message Discipline Generator
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl">
              Strict repository policy: Every confirmed hook must be an isolated commit with signature, offset, MCU address, original/replacement opcodes, data-flow trace, and confidence mark.
            </p>
          </div>
        </div>
      </div>

      {/* Commit Configuration Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-bold text-white mb-4">Commit Parameters</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Parameter Name:
            </label>
            <input
              type="text"
              id="input-commit-param-name"
              value={paramName}
              onChange={(e) => setParamName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-blue-500"
              placeholder="speed limit"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Confidence Level:
            </label>
            <select
              id="select-commit-confidence"
              value={confidence}
              onChange={(e) => setConfidence(e.target.value as ConfidenceLevel)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-blue-500"
            >
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="STRONG CANDIDATE">STRONG CANDIDATE</option>
              <option value="UNCONFIRMED">UNCONFIRMED</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Imm8 Replacement (Hex):
            </label>
            <input
              type="text"
              id="input-commit-imm-hex"
              value={hexImm}
              maxLength={2}
              onChange={(e) => setHexImm(e.target.value.toUpperCase())}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-blue-500"
              placeholder="23"
            />
          </div>
        </div>
      </div>

      {/* Formatted Commit Message Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <GitCommit className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Generated Commit Payload</h3>
          </div>
          <button
            id="btn-copy-commit-msg"
            onClick={handleCopy}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied to Clipboard' : 'Copy Commit'}</span>
          </button>
        </div>

        <pre className="p-4 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-emerald-300 whitespace-pre-wrap leading-relaxed overflow-x-auto">
          {commitMessage}
        </pre>

        <div className="mt-4 p-3 bg-slate-950/60 rounded-lg border border-slate-800 flex items-start gap-2.5 text-xs text-slate-400">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p>
            <strong>Commit Rule:</strong> Never bundle unverified speculative patches into git history. Maintain 1 commit per mathematically verified hook with documented trace evidence.
          </p>
        </div>
      </div>
    </div>
  );
};
