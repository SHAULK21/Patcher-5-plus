import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { webcrypto } from 'node:crypto';
import { applySpeedPatch, checkComponentCrcs, crc16Ccitt, findSpeedHooks, generatePythonScript, hexToBytes, verifyOutput, REFERENCE_SIZE } from '../src/utils/patcher';

Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });

test('CRC-16/XMODEM standard vector', () => {
  assert.equal(crc16Ccitt(new TextEncoder().encode('123456789')), 0x31C3);
});
test('unknown and fake buffers cannot produce output', async () => {
  for (const input of [new Uint8Array(), hexToBytes('AB49787A0880'), new Uint8Array(REFERENCE_SIZE)]) {
    const r = await applySpeedPatch(input, { speedHexImm: '23' });
    assert.equal(r.success, false); assert.equal(r.patchedBuffer, undefined);
  }
});
test('full pattern distinguishes incomplete and ambiguous matches', () => {
  assert.deepEqual(findSpeedHooks(hexToBytes('AB49787A0880')), [2]);
  assert.deepEqual(findSpeedHooks(hexToBytes('0000787A0000')), []);
  assert.equal(findSpeedHooks(hexToBytes('AB49787A0880 AB4923200880')).length, 2);
});
test('KERS and malformed values always refused', async () => {
  for (const options of [
    { speedHexImm: '23', disableKers: true },
    { speedHexImm: '23', kersHexImm: '01' },
    ...['00','FF','3D','23junk','1','-1','1.5'].map(speedHexImm => ({ speedHexImm })),
  ]) assert.equal((await applySpeedPatch(new Uint8Array(REFERENCE_SIZE), options)).success, false);
  assert.throws(() => generatePythonScript('23', 35, true));
  assert.throws(() => hexToBytes('xyz'));
});

test('component CRC checks include little-endian outer and second fields and reject truncation', () => {
  const data = new Uint8Array(REFERENCE_SIZE);
  data[0x100] = 0x12;
  data[0x8D00] = 0x34;
  const inner = crc16Ccitt(data.subarray(0x100, 0x8D00));
  data.set([inner >> 8, inner & 0xFF], 0xB0);
  const outer = crc16Ccitt(data.subarray(0x80, 0x8D00));
  data.set([outer & 0xFF, outer >> 8], 0x11);
  const second = crc16Ccitt(data.subarray(0x8D00, 0x1E480));
  data.set([second & 0xFF, second >> 8], 0x1F);
  for (const check of Object.values(checkComponentCrcs(data))) assert.equal(check.valid, true);
  data[0x11] ^= 1;
  assert.equal(checkComponentCrcs(data).outer_component.valid, false);
  assert.equal(checkComponentCrcs(data).inner_component.valid, true);
  assert.equal(checkComponentCrcs(data.subarray(0, 0x1E47F)).second_component.valid, false);
  for (const check of Object.values(checkComponentCrcs(new Uint8Array()))) assert.equal(check.valid, false);
});
test('real OTA gives expected CRC and only allowed changes', { skip: !process.env.REFERENCE_FW }, async () => {
  const raw = new Uint8Array(fs.readFileSync(process.env.REFERENCE_FW!));
  const result = await applySpeedPatch(raw, { speedHexImm: '23' });
  assert.equal(result.success, true, result.message);
  assert.equal(result.patchedBuffer![0xB0], 0x9D);
  assert.equal(result.patchedBuffer![0xB1], 0xB1);
  assert.deepEqual(Array.from(result.patchedBuffer!.subarray(0x11, 0x13)), [0xC4, 0x8A]);
  const allowed = new Set([0x11, 0x12, 0xB0, 0xB1, 0x5C76, 0x5C77]);
  for (const entry of result.report!.changes) assert.ok(allowed.has(entry.offset));
  assert.deepEqual(result.patchedBuffer!.subarray(0x1E484), raw.subarray(0x1E484));
  assert.deepEqual(result.patchedBuffer!.subarray(0x8D00), raw.subarray(0x8D00));
  assert.deepEqual(result.report!.changed_offsets, [0x11, 0x12, 0xB0, 0xB1, 0x5C76, 0x5C77]);
  assert.equal(result.report!.inner_component_crc_valid, true);
  assert.equal(result.report!.outer_component_crc_valid, true);
  assert.equal(result.report!.second_component_crc_valid, true);
  assert.equal(result.report!.ota_signature_verification, 'not_performed');
  assert.match(result.report!.ota_signature_status, /invalidated_by_patch/);
  assert.equal(result.report!.root_trust_verified, false);
  assert.equal((await applySpeedPatch(result.patchedBuffer!, { speedHexImm: '23' })).success, false);
});

test('real OTA output verifier rejects stale outer CRC and additional mutations', { skip: !process.env.REFERENCE_FW }, async () => {
  const raw = new Uint8Array(fs.readFileSync(process.env.REFERENCE_FW!));
  const result = await applySpeedPatch(raw, { speedHexImm: '23' });
  assert.equal(result.success, true, result.message);
  const legacy = new Uint8Array(result.patchedBuffer!);
  legacy.set(raw.subarray(0x11, 0x13), 0x11);
  assert.equal(checkComponentCrcs(legacy).inner_component.valid, true);
  assert.equal(checkComponentCrcs(legacy).outer_component.valid, false);
  await assert.rejects(verifyOutput(raw, legacy, 35), /outer_component CRC/);
  const changedSecond = new Uint8Array(result.patchedBuffer!);
  changedSecond[0x8D20] ^= 1;
  const crc = crc16Ccitt(changedSecond.subarray(0x8D00, 0x1E480));
  changedSecond.set([crc & 0xFF, crc >> 8], 0x1F);
  await assert.rejects(verifyOutput(raw, changedSecond, 35), /Unexpected bytes modified/);
  const truncated = result.patchedBuffer!.subarray(0, raw.length - 1);
  await assert.rejects(verifyOutput(raw, truncated, 35), /Output size changed/);
  await assert.rejects(verifyOutput(raw, result.patchedBuffer!, 35.5), /integer/);
});
