import React, { useRef, useState } from 'react';
import { applySpeedPatch, REFERENCE_SHA256, REFERENCE_SIZE } from '../utils/patcher';

export function StrictStudio() {
  const [input, setInput] = useState<Uint8Array | null>(null);
  const [value, setValue] = useState(35);
  const [status, setStatus] = useState('');
  const [result, setResult] = useState<Awaited<ReturnType<typeof applySpeedPatch>> | null>(null);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);

  async function upload(file?: File) {
    const id = ++generation.current;
    setResult(null); setInput(null); setStatus('');
    if (!file) return;
    if (file.size !== REFERENCE_SIZE) { setStatus('Неверный размер: нужен оригинальный OTA 125 371 байт.'); return; }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (id === generation.current) setInput(bytes);
    } catch (e) { if (id === generation.current) setStatus(String(e)); }
  }

  async function patch() {
    if (!input || busy) return;
    const id = ++generation.current;
    setBusy(true); setResult(null); setStatus('');
    try {
      const r = await applySpeedPatch(input, { speedHexImm: value.toString(16).padStart(2, '0') });
      if (id === generation.current) { setResult(r); setStatus(r.message); }
    } finally { setBusy(false); }
  }

  function download(bytes: Uint8Array, name: string, type: string) {
    const copy = new Uint8Array(bytes.length); copy.set(bytes);
    const url = URL.createObjectURL(new Blob([copy.buffer], { type }));
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Xiaomi 5 Plus — строгий патчер</h1>
      <p>Изменяет подтверждённую инструкцию и пересчитывает CRC. Результат — исследовательский пакет.
        Возможность аппаратной прошивки и физическая скорость ещё не подтверждены.
        Модифицированный файл не переподписывается для штатного OTA.</p>
      <section className="rounded-xl bg-slate-900 p-5 space-y-3">
        <p>Поддерживается только полный оригинал: {REFERENCE_SIZE.toLocaleString()} байт.</p>
        <p className="break-all text-xs font-mono">SHA-256: {REFERENCE_SHA256}</p>
        <input aria-label="Оригинальный OTA" type="file" accept=".bin,.ota" disabled={busy}
          onChange={e => { void upload(e.target.files?.[0]); }} />
        <label className="block">Значение параметра (1–60, соответствие км/ч не доказано)
          <input type="number" min={1} max={60} step={1} value={value} disabled={busy}
            className="ml-3 bg-slate-800 p-2 rounded w-24"
            onChange={e => { ++generation.current; setValue(Number(e.target.value)); setResult(null); setStatus(''); }} />
        </label>
        <p>KERS заблокирован: по старому адресу 0x5C9E находится другая инструкция.</p>
        <button className="bg-blue-700 rounded px-4 py-2 disabled:opacity-40"
          disabled={!input || busy || !Number.isInteger(value) || value < 1 || value > 60}
          onClick={() => { void patch(); }}>{busy ? 'Проверка…' : 'Проверить и применить патч'}</button>
      </section>
      {status && <p role="status" className="break-words">{status}</p>}
      {result?.success && result.patchedBuffer && result.report && <section className="space-y-3">
        <p>Готов исследовательский файл. Для штатного OTA и записи полного пакета в flash он не подтверждён.</p>
        <pre className="text-xs overflow-auto bg-slate-900 p-4">{JSON.stringify(result.report, null, 2)}</pre>
        <button className="bg-blue-700 rounded px-4 py-2" onClick={() =>
          download(result.patchedBuffer!, 'xiaomi_5plus_parameter_' + result.report!.parameter + '.research.bin', 'application/octet-stream')}>
          Скачать изменённый пакет
        </button>{' '}
        <button className="bg-slate-700 rounded px-4 py-2" onClick={() =>
          download(new TextEncoder().encode(JSON.stringify(result.report, null, 2)), 'patch-report.json', 'application/json')}>
          Скачать отчёт изменений
        </button>
      </section>}
      <a className="text-blue-400" href="https://github.com/SHAULK21/Patcher-5-plus">Исходный код и ограничения</a>
    </div>
  </main>;
}
