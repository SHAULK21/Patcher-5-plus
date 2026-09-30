import type { PatchResult } from '../types';

export const REFERENCE_SHA256 = 'bdcec9c57c53279a19c28e437003e06e11f441170a349f94f7fdb140edd33cf4';
export const REFERENCE_SIZE = 125371;
const HOOK = 0x5C76;
const START = 0x100;
const END = 0x8D00;
const CRC_OFFSET = 0xB0;
const SIG = [0xAB, 0x49, 0x78, 0x7A, 0x08, 0x80];

export function bytesToHex(bytes: Uint8Array, separator = ' '): string {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0').toUpperCase()).join(separator);
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s/g, '');
  if (!/^(?:[0-9a-f]{2})*$/i.test(clean)) throw new Error('Invalid hex bytes');
  return Uint8Array.from(clean.match(/../g) || [], s => parseInt(s, 16));
}

export async function calculateSHA256(buffer: Uint8Array): Promise<string> {
  const copy = new Uint8Array(buffer.length);
  copy.set(buffer);
  const digest = await crypto.subtle.digest('SHA-256', copy.buffer);
  return bytesToHex(new Uint8Array(digest), '').toLowerCase();
}

export function crc16Ccitt(data: Uint8Array): number {
  let crc = 0;
  for (const b of data) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) crc = ((crc << 1) ^ ((crc & 0x8000) ? 0x1021 : 0)) & 0xFFFF;
  }
  return crc;
}

function matches(b: Uint8Array, offset: number, bytes: readonly number[]): boolean {
  return offset >= 0 && offset + bytes.length <= b.length && bytes.every((v, i) => b[offset + i] === v);
}

export function findSpeedHooks(b: Uint8Array): number[] {
  const hits: number[] = [];
  for (let i = 0; i + 6 <= b.length; i++) {
    if (b[i] === 0xAB && b[i + 1] === 0x49 && b[i + 4] === 0x08 && b[i + 5] === 0x80 &&
        ((b[i + 2] === 0x78 && b[i + 3] === 0x7A) || b[i + 3] === 0x20)) hits.push(i + 2);
  }
  return hits;
}

export async function validateReference(input: Uint8Array): Promise<string> {
  // Snapshot is the caller's responsibility; applySpeedPatch snapshots before awaiting.
  if (input.length !== REFERENCE_SIZE) throw new Error('Unsupported size. Upload the untouched reference OTA.');
  const hash = await calculateSHA256(input);
  if (hash !== REFERENCE_SHA256) throw new Error('Unknown or modified SHA-256. Use the original reference OTA.');
  if (!matches(input, 0x90, Array.from(new TextEncoder().encode('SZMC-ES-02664-LQ'))) ||
      input[0x86] !== 0x8C || input[0x87] !== 0x00) throw new Error('Protected region layout mismatch');
  const stored = (input[CRC_OFFSET] << 8) | input[CRC_OFFSET + 1];
  if (stored !== crc16Ccitt(input.subarray(START, END))) throw new Error('Input CRC is invalid');
  const hits = findSpeedHooks(input);
  if (hits.length !== 1 || hits[0] !== HOOK || !matches(input, HOOK - 2, SIG)) throw new Error('Hook not unique or full signature mismatch');
  if (!matches(input, 0x5F24, [0x34, 0x02, 0x00, 0x20])) throw new Error('Hook RAM destination mismatch');
  if (!matches(input, 0x5C7A, [0xAB, 0x48, 0x40, 0x7A, 0x06, 0x28, 0x02, 0xD9])) throw new Error('Following instructions mismatch');
  if (!matches(input, 0x5C9E, [0x42, 0x54])) throw new Error('Unexpected rejected KERS instruction');
  if (!matches(input, 0x1E484, [0x4D, 0x49, 0xEF, 0x54, 0x46, 0x4F, 0x54, 0x41])) throw new Error('OTA trailer mismatch');
  return hash;
}

export interface PatchOptions {
  speedHexImm: string;
  disableKers?: boolean;
  kersHexImm?: string;
}

export interface ResearchReport {
  input_sha256: string;
  output_sha256: string;
  parameter: number;
  changes: { offset: number; before: number; after: number }[];
  crc_valid: boolean;
  format: string;
  ota_signature_status: string;
  hardware_flash_verified: boolean;
  physical_kmh_verified: boolean;
  kers_modified: boolean;
}

export async function applySpeedPatch(firmwareBuffer: Uint8Array, options: PatchOptions): Promise<PatchResult & { report?: ResearchReport }> {
  const input = new Uint8Array(firmwareBuffer); // Snapshot prevents mutation during async hashing.
  const result: PatchResult = {
    success: false, message: '', signatureFound: false, signatureOffset: -1,
    originalBytes: '', patchedBytes: '', fileSize: input.length,
    sha256Original: '', sha256Patched: '', kersPatchApplied: false,
  };
  try {
    if (options.disableKers || (options.kersHexImm !== undefined && options.kersHexImm !== 'STOCK'))
      throw new Error('KERS patch blocked: 0x5C9E is STRB r2,[r0,r1], not a verified KERS hook.');
    if (!/^[0-9a-f]{2}$/i.test(options.speedHexImm)) throw new Error('Parameter must be exactly two hex digits');
    const value = parseInt(options.speedHexImm, 16);
    if (value < 1 || value > 60) throw new Error('Raw parameter must be 1..60; physical km/h is unverified');
    result.sha256Original = await validateReference(input);
    const output = new Uint8Array(input);
    output.set([value, 0x20], HOOK);
    const crc = crc16Ccitt(output.subarray(START, END));
    output.set([crc >> 8, crc & 0xFF], CRC_OFFSET);
    const changes: ResearchReport['changes'] = [];
    const allowed = new Set([CRC_OFFSET, CRC_OFFSET + 1, HOOK, HOOK + 1]);
    for (let i = 0; i < input.length; i++) {
      if (input[i] !== output[i]) {
        if (!allowed.has(i)) throw new Error('Unexpected bytes modified');
        changes.push({ offset: i, before: input[i], after: output[i] });
      }
    }
    if (crc16Ccitt(output.subarray(START, END)) !== ((output[CRC_OFFSET] << 8) | output[CRC_OFFSET + 1]))
      throw new Error('Output CRC validation failed');
    if (!matches(output, HOOK, [value, 0x20])) throw new Error('Output opcode mismatch');
    const hash = await calculateSHA256(output);
    return {
      ...result, success: true, signatureFound: true, signatureOffset: HOOK - 2,
      originalBytes: '78 7A', patchedBytes: bytesToHex(output.subarray(HOOK, HOOK + 2)),
      patchedBuffer: output, sha256Patched: hash,
      message: 'Instruction patched and CRC verified. Research package; hardware flashing and OTA signing are unverified.',
      report: {
        input_sha256: result.sha256Original, output_sha256: hash, parameter: value,
        changes, crc_valid: true, format: 'modified-ota-package-for-research',
        ota_signature_status: 'not_re_signed; do not use stock OTA updater',
        hardware_flash_verified: false, physical_kmh_verified: false, kers_modified: false,
      },
    };
  } catch (error) {
    return { ...result, message: error instanceof Error ? error.message : String(error) };
  }
}

export function generatePythonScript(speedHexImm: string, _speedKmH: number, disableKers = false): string {
  if (disableKers) throw new Error('KERS export disabled; hook unverified');
  if (!/^[0-9a-f]{2}$/i.test(speedHexImm)) throw new Error('Invalid parameter');
  const value = parseInt(speedHexImm, 16);
  if (value < 1 || value > 60) throw new Error('Parameter out of range');
  return [
    '#!/usr/bin/env python3',
    '# Requires verified_patcher.py from the same repository.',
    '# Research package only; no verified hardware flashing or OTA signing.',
    'from pathlib import Path',
    'from verified_patcher import Mi5PlusPatcher',
    'import json, sys',
    'source, target = map(Path, sys.argv[1:3])',
    'if not target.name.endswith(".research.bin") or source.resolve() == target.resolve():',
    '    raise ValueError("Use a separate .research.bin output")',
    'raw = source.read_bytes()',
    'output = Mi5PlusPatcher.patch_speed(raw, ' + value + ')',
    'report = Mi5PlusPatcher.verify_output(raw, output, ' + value + ')',
    'with target.open("xb") as f:',
    '    f.write(output)',
    'print(json.dumps(report, indent=2))',
    '',
  ].join('\n');
}

export function generateGitCommitMessage(_paramName = 'speed parameter', _confidence = 'STATIC', hexImm = '23'): string {
  return 'Patch reference parameter to ' + hexImm + '; recalculate CRC; KERS untouched; hardware/OTA compatibility unverified';
}
