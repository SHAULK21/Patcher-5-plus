import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { webcrypto } from 'node:crypto';
import { applySpeedPatch, crc16Ccitt, findSpeedHooks, generatePythonScript, hexToBytes, REFERENCE_SIZE } from '../src/utils/patcher';

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
test('real OTA gives expected CRC and only allowed changes', { skip: !process.env.REFERENCE_FW }, async () => {
  const raw = new Uint8Array(fs.readFileSync(process.env.REFERENCE_FW!));
  const result = await applySpeedPatch(raw, { speedHexImm: '23' });
  assert.equal(result.success, true, result.message);
  assert.equal(result.patchedBuffer![0xB0], 0x9D);
  assert.equal(result.patchedBuffer![0xB1], 0xB1);
  const allowed = new Set([0xB0, 0xB1, 0x5C76, 0x5C77]);
  for (const entry of result.report!.changes) assert.ok(allowed.has(entry.offset));
  assert.deepEqual(result.patchedBuffer!.subarray(0x1E484), raw.subarray(0x1E484));
  assert.equal((await applySpeedPatch(result.patchedBuffer!, { speedHexImm: '23' })).success, false);
});
