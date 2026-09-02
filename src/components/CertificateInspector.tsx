import React from 'react';
import { FIRMWARE_METADATA } from '../data/firmwareData';
import { ShieldCheck, AlertTriangle, Key, Lock, CheckCircle, FileText } from 'lucide-react';

export const CertificateInspector: React.FC = () => {
  return (
    <div className="space-y-6" id="certificate-inspector">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs font-semibold bg-purple-950 text-purple-300 border border-purple-700/60 rounded">
                Bootloader &amp; Cryptographic Security
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Integrity &amp; Certificate Analysis
              </span>
            </div>
            <h2 className="text-lg font-bold text-white mt-1">
              Certificate, Signature &amp; Bootloader Acceptance
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl">
              Investigation into firmware integrity checks, embedded X.509/ASN.1 certificates, and bootloader update packet acceptance criteria for Xiaomi Scooter 5 Plus.
            </p>
          </div>
        </div>
      </div>

      {/* Signature ID Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2 text-cyan-400 mb-2">
            <Lock className="w-5 h-5" />
            <h3 className="text-sm font-bold text-white">5 Plus Specific Identifier (Discovered)</h3>
          </div>
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs space-y-1">
            <div className="text-slate-400">MCU Identifier String:</div>
            <div className="text-emerald-400 font-bold text-sm">{FIRMWARE_METADATA.mcuIdString}</div>
            <div className="text-slate-500 text-[11px] mt-1">Found in header descriptors of 5 Plus BIN (125,371 bytes).</div>
          </div>
          <p className="text-xs text-slate-300 mt-3 leading-relaxed">
            Xiaomi Scooter 5 Plus uses custom board tag <code className="font-mono text-cyan-300">SZMC-ES-02664-LQ</code>. Generic ES32 patchers expecting older tags will fail validation checks.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2 text-amber-400 mb-2">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="text-sm font-bold text-white">Generic ES32 Expectation (Not Ported)</h3>
          </div>
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs space-y-1">
            <div className="text-slate-400">Generic Legacy Tag:</div>
            <div className="text-rose-400 font-bold text-sm">{FIRMWARE_METADATA.expectedGenericId}</div>
            <div className="text-slate-500 text-[11px] mt-1">Used in older Brightway ES32 generation models.</div>
          </div>
          <p className="text-xs text-slate-300 mt-3 leading-relaxed">
            <strong>Critical Directive:</strong> Do NOT port checksum/signature logic from generic ES32 models blindly without checking 5 Plus bootloader verification subroutines.
          </p>
        </div>
      </div>

      {/* Embedded Certificate Details */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-2 text-purple-400 mb-3">
          <Key className="w-5 h-5" />
          <h3 className="text-sm font-bold text-white">Embedded PEM Certificate Marker in Binary</h3>
        </div>

        <div className="space-y-3">
          <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 space-y-1">
            <div className="text-slate-500">-----BEGIN CERTIFICATE-----</div>
            <div className="text-slate-400">MIIB...[OEM Signing Certificate for ES32 Platform]...</div>
            <div className="text-slate-400">Subject: O=Brightway / Xiaomi Scooter 5 Plus / SZMC-ES-02664-LQ</div>
            <div className="text-slate-500">-----END CERTIFICATE-----</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[11px]">1. Boundary Check</span>
              <span className="text-slate-200 mt-0.5 block">Signed payload ends before trailing certificate block.</span>
            </div>
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[11px]">2. Bootloader Verification</span>
              <span className="text-slate-200 mt-0.5 block">SWD flashing bypasses cert checks; BLE OTA requires wrapper.</span>
            </div>
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[11px]">3. Flash Target</span>
              <span className="text-slate-200 mt-0.5 block">Flash Base 0x08000000 - 0x0801E9BB (125,371 bytes).</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bootloader Acceptance Investigation Matrix */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-bold text-white mb-3">Flashing &amp; Verification Research Matrix</h3>
        <div className="space-y-2.5 text-xs text-slate-300">
          <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/40 flex items-start gap-2.5">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-emerald-300">SWD / ST-Link / DAPLink Direct Flashing:</strong>
              <p className="text-slate-400 mt-0.5">Surgical 2-byte patch (<code className="font-mono text-slate-200">78 7A &rarr; XX 20</code>) executes immediately when programmed via SWD pins on controller PCB without bootloader rejection.</p>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-blue-950/30 border border-blue-800/40 flex items-start gap-2.5">
            <FileText className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-blue-300">BLE OTA Update Wrapper:</strong>
              <p className="text-slate-400 mt-0.5">For wireless flashing via ScooterHacking / m365 / custom BLE app, research is active on packet header CRC16 and model ID header formatting.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
