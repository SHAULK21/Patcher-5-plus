import React, { useState } from 'react';
import { Header } from './components/Header';
import { StreamlitConfigurator } from './components/StreamlitConfigurator';
import { DataflowTracer } from './components/DataflowTracer';
import { SpeedPatcher } from './components/SpeedPatcher';
import { DisassemblyViewer } from './components/DisassemblyViewer';
import { MultiModeAnalyzer } from './components/MultiModeAnalyzer';
import { CurrentPowerThermal } from './components/CurrentPowerThermal';
import { CertificateInspector } from './components/CertificateInspector';
import { GitCommitGenerator } from './components/GitCommitGenerator';
import { AIHeuristicAssistant } from './components/AIHeuristicAssistant';
import { FIRMWARE_METADATA } from './data/firmwareData';
import { Cpu, ShieldCheck, GitCommit, FileCode, Activity } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('streamlit-studio');

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'streamlit-studio':
        return <StreamlitConfigurator />;
      case 'dataflow':
        return <DataflowTracer />;
      case 'patcher':
        return <SpeedPatcher />;
      case 'disassembly':
        return <DisassemblyViewer />;
      case 'multimode':
        return <MultiModeAnalyzer />;
      case 'current-power':
        return <CurrentPowerThermal />;
      case 'security':
        return <CertificateInspector />;
      case 'git-discipline':
        return <GitCommitGenerator />;
      case 'ai-assistant':
        return <AIHeuristicAssistant />;
      default:
        return <DataflowTracer />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Header */}
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {renderActiveTab()}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900/90 border-t border-slate-800/80 py-6 text-xs text-slate-400 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-blue-400" />
            <span className="font-semibold text-slate-200">BW-Patched_ Xiaomi Scooter 5 Plus</span>
            <span className="text-slate-600">&bull;</span>
            <span>Target BIN: {FIRMWARE_METADATA.fileName} ({FIRMWARE_METADATA.fileSize.toLocaleString()} B)</span>
          </div>

          <div className="flex items-center space-x-4">
            <span className="font-mono text-slate-500">
              Commit <span className="text-cyan-400">{FIRMWARE_METADATA.lastCommit.substring(0, 8)}</span>
            </span>
            <a
              href={FIRMWARE_METADATA.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
            >
              <GitCommit className="w-3.5 h-3.5" />
              <span>GitHub Repository</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
