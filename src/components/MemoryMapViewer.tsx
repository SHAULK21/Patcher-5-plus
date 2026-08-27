import React, { useState } from 'react';
import { MEMORY_MAP, RE_ITEMS } from '../data/reData';
import { MemoryEntry, ConfidenceLevel } from '../types';
import { Database, Search, CheckCircle2, AlertTriangle, XCircle, ShieldCheck } from 'lucide-react';

interface Props {
  isRu: boolean;
}

export const MemoryMapViewer: React.FC<Props> = ({ isRu }) => {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const filtered = MEMORY_MAP.filter((item) => {
    if (filterType !== 'ALL' && item.type !== filterType) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.offsetOrAddr.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getBadge = (status: ConfidenceLevel) => {
    switch (status) {
      case 'CONFIRMED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> CONFIRMED
          </span>
        );
      case 'STRONG CANDIDATE':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> CANDIDATE
          </span>
        );
      case 'REFUTED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800 flex items-center gap-1">
            <XCircle className="w-3 h-3" /> REFUTED
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
            UNCONFIRMED
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-sky-400" />
            {isRu ? 'Карта памяти Flash / RAM & Статусы верификации' : 'Flash & RAM Memory Map & Verification Statuses'}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {isRu 
              ? 'Полный реестр смещений файла и адресов MCU с уровнями достоверности' 
              : 'Complete registry of file offsets and MCU addresses with strict confidence ratings'}
          </p>
        </div>

        {/* Filter and Search */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={isRu ? 'Поиск адреса или имени...' : 'Search address or symbol...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500 w-48"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
          >
            <option value="ALL">{isRu ? 'Все типы' : 'All Types'}</option>
            <option value="Flash">Flash (Code)</option>
            <option value="RAM">RAM (Variables)</option>
          </select>
        </div>
      </div>

      {/* Memory Table */}
      <div className="border border-slate-800 rounded-lg overflow-x-auto bg-slate-950 font-mono text-xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 text-[11px]">
              <th className="py-2.5 px-4 w-44">ADDRESS / FILE OFFSET</th>
              <th className="py-2.5 px-4 w-20">TYPE</th>
              <th className="py-2.5 px-4 w-48">SYMBOL / NAME</th>
              <th className="py-2.5 px-4">FUNCTION / ROLE</th>
              <th className="py-2.5 px-4 w-32">CONFIDENCE</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filtered.map((item) => (
              <tr key={item.id} className="hover:bg-slate-900/50 transition-colors">
                <td className="py-2.5 px-4 text-sky-300 font-bold">{item.offsetOrAddr}</td>
                <td className="py-2.5 px-4">
                  <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                    {item.type}
                  </span>
                </td>
                <td className="py-2.5 px-4 font-semibold text-slate-200">{item.name}</td>
                <td className="py-2.5 px-4 text-slate-300 text-[11px]">{item.description}</td>
                <td className="py-2.5 px-4">{getBadge(item.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
