import React from 'react';
import { Cpu, ShieldCheck, GitCommit, FileCode, Activity, Sliders } from 'lucide-react';
import { FIRMWARE_METADATA } from '../data/firmwareData';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const navTabs = [
    { id: 'streamlit-studio', label: 'Streamlit Studio (Ползунки)', icon: Sliders, badge: 'New' },
    { id: 'dataflow', label: 'Dataflow Tracing', icon: Activity, badge: 'Crucial' },
    { id: 'patcher', label: 'Speed & KERS Patcher', icon: Cpu, badge: 'v1.1' },
    { id: 'disassembly', label: 'ARM Thumb Disassembly', icon: FileCode },
    { id: 'multimode', label: 'Eco / Drive / Sport & RAM', icon: ShieldCheck },
    { id: 'current-power', label: 'Current & Thermal', icon: Activity },
    { id: 'security', label: 'Cert & Checksum', icon: ShieldCheck },
    { id: 'git-discipline', label: 'Git Commits', icon: GitCommit },
    { id: 'ai-assistant', label: 'AI RE Copilot', icon: Cpu, badge: 'Gemini' },
  ];

  return (
    <header id="main-header" className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-600/20 border border-blue-500/30 rounded-xl text-blue-400">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-semibold tracking-tight text-white">
                  BW-Patched — Xiaomi 5 Plus
                </h1>
                <span className="px-2 py-0.5 text-xs font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded">
                  ES32 / Brightway
                </span>
                <span className="px-2 py-0.5 text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                  Thumb-2 @ 0x08000000
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Target: <span className="font-mono text-slate-300">{FIRMWARE_METADATA.fileName}</span> ({FIRMWARE_METADATA.fileSize.toLocaleString()} B) • Commit <span className="font-mono text-cyan-400">{FIRMWARE_METADATA.lastCommit.substring(0, 8)}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs font-mono flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-slate-300">Hook:</span>
              <span className="text-emerald-300 font-bold">0x5C74 (AB 49 78 7A 08 80)</span>
            </div>
            <a
              href={FIRMWARE_METADATA.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 transition-colors flex items-center gap-1.5"
            >
              <GitCommit className="w-3.5 h-3.5 text-cyan-400" />
              <span>SHAULK21/BW-Patched_</span>
            </a>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 overflow-x-auto no-scrollbar border-t border-slate-800/60 pt-1 pb-2">
          {navTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-nav-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded text-[10px] uppercase font-mono ${
                      isActive ? 'bg-blue-700 text-blue-100' : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
