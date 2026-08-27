import React from 'react';
import { MODES_DATA, RE_ITEMS } from '../data/reData';
import { Gauge, CheckCircle2, AlertTriangle, XCircle, HelpCircle, Layers, ShieldCheck, Zap } from 'lucide-react';

interface Props {
  isRu: boolean;
}

export const ModeAnalysisCard: React.FC<Props> = ({ isRu }) => {
  return (
    <div className="space-y-6">
      {/* 3 Modes Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {MODES_DATA.map((mode) => (
          <div 
            key={mode.code} 
            className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-full blur-xl pointer-events-none" />
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-sky-300 font-bold border border-slate-700">
                  MODE ID #{mode.code}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/60 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> CANDIDATE
                </span>
              </div>

              <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
                <Gauge className="w-5 h-5 text-sky-400" />
                {isRu ? mode.modeNameRu : mode.modeName}
              </h3>

              <div className="grid grid-cols-2 gap-2 my-3 p-3 bg-slate-950 rounded-lg border border-slate-800/80 font-mono text-xs">
                <div>
                  <div className="text-slate-500 text-[10px] uppercase">
                    {isRu ? 'Номинал' : 'Nominal'}
                  </div>
                  <div className="text-slate-200 font-semibold text-sm">
                    {mode.nominalSpeedKmh} km/h
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 text-[10px] uppercase">
                    {isRu ? 'В контроллере (x17.4)' : 'Internal (x17.4)'}
                  </div>
                  <div className="text-emerald-400 font-semibold text-sm">
                    {mode.scaledInternalValue}
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed mb-3">
                {isRu ? mode.detailsRu : mode.details}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="truncate">{isRu ? mode.storageTypeRu : mode.storageType}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Architectural Summary on Eco / Drive / Sport in ES32 5 Plus */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" />
          {isRu ? 'Архитектура режимов: Почему в 5 Plus нет 3 статических байтов во Flash?' : 'Modes Architecture: Why 5 Plus lacks 3 static Flash speed bytes'}
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-sm text-slate-300">
          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
              <h4 className="font-semibold text-slate-100 flex items-center gap-2 mb-2 text-xs uppercase tracking-wide text-sky-400">
                <span>1.</span> {isRu ? 'Модель Активного Профиля (Active Profile Loader)' : 'Active Profile Loader Model'}
              </h4>
              <p className="text-xs leading-relaxed text-slate-300">
                {isRu
                  ? 'В контроллерах Brightway ES32 (Xiaomi 5 Plus) прошивка не читает 3 фиксированных слова из Flash (как в M365). Скорость активного режима передается от BLE/CCU или динамически загружается в буфер профиля. Указатель r7 указывает на текущий активный профиль, а смещение +0x09 считывается единой инструкцией 78 7A (LDRB r0, [r7, #9]) на смещении 0x5C76.'
                  : 'In Brightway ES32 (Xiaomi 5 Plus), firmware does not read 3 fixed Flash constants. Instead, the speed is dynamically loaded into an active profile buffer in RAM. Register r7 points to active profile structure, and offset +0x09 is loaded by instruction 78 7A (LDRB r0, [r7, #9]) at offset 0x5C76.'}
              </p>
            </div>

            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
              <h4 className="font-semibold text-slate-100 flex items-center gap-2 mb-2 text-xs uppercase tracking-wide text-rose-400">
                <span>2.</span> {isRu ? 'Статус адреса 0x200002B7 (ОПРОВЕРГНУТ)' : 'Status of 0x200002B7 (REFUTED)'}
              </h4>
              <p className="text-xs leading-relaxed text-slate-300">
                {isRu
                  ? 'Адрес 0x200002B7 использовался в ранних гипотезах как селектор 0/1/2. Трассировка функций 0x05A80-0x05C90 показала, что это переменная стейт-машины протокола с диапазоном 0..8. Ее нельзя использовать как селектор режима!'
                  : 'Address 0x200002B7 was hypothesized as a 0/1/2 mode selector. Trace across 0x05A80-0x05C90 showed it is a protocol state machine index handling range 0..8, NOT a 3-mode selector.'}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
              <h4 className="font-semibold text-slate-100 flex items-center gap-2 mb-2 text-xs uppercase tracking-wide text-emerald-400">
                <span>3.</span> {isRu ? 'Кандидат режима: 0x20001E22 + 0x0A' : 'Candidate Mode Struct: 0x20001E22 + 0x0A'}
              </h4>
              <p className="text-xs leading-relaxed text-slate-300">
                {isRu
                  ? 'По адресу 0x20001E22 смещение +0x0A участвует в условных проверках со значениями 1 (Drive) и 2 (Sport). До тех пор, пока процесс записи из UART в эту ячейку не изолирован на 100%, патчер безопасно использует проверенный хук активного профиля 0x5C76.'
                  : 'At RAM 0x20001E22, field +0x0A participates in conditional checks against values 1 (Drive) and 2 (Sport). Until full writer isolation is verified, the patcher uses the verified active-profile hook at 0x5C76.'}
              </p>
            </div>

            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
              <h4 className="font-semibold text-slate-100 flex items-center gap-2 mb-2 text-xs uppercase tracking-wide text-amber-400">
                <span>4.</span> {isRu ? 'Стратегия патча в mi5plus.py' : 'Patching Strategy in mi5plus.py'}
              </h4>
              <p className="text-xs leading-relaxed text-slate-300">
                {isRu
                  ? 'Замена 78 7A -> XX 20 на 0x5C76 меняет скорость любого активного профиля на фиксированное значение XX. Это рабочий, надежный метод разблокировки скорости без риска повреждения протокола передачи.'
                  : 'Patching 78 7A -> XX 20 at 0x5C76 safely overrides the speed limit of whichever profile is active to constant XX, avoiding experimental RAM patches.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
