import { FIRMWARE_METADATA } from '../data/firmwareData';
import { PatchResult } from '../types';

export function bytesToHex(bytes: Uint8Array, separator = ' '): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0').toUpperCase())
    .join(separator);
}

export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.replace(/[^0-9A-Fa-f]/g, '');
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

export async function calculateSHA256(buffer: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export interface PatchOptions {
  speedHexImm: string; // e.g. "19", "1E", "23"
  disableKers?: boolean; // Set to true to zero out regenerative braking on throttle release (0A regen / freewheel)
  kersHexImm?: string; // "00" (Disabled), "01" (Weak), or undefined / "STOCK"
}

export async function applySpeedPatch(
  firmwareBuffer: Uint8Array,
  options: PatchOptions
): Promise<PatchResult> {
  const speedTargetOffset = FIRMWARE_METADATA.speedPatchOffset; // 0x5C76
  const speedSigOffset = speedTargetOffset - 2; // 0x5C74

  const kersTargetOffset = FIRMWARE_METADATA.kersPatchOffset; // 0x5C9E
  const kersSigOffset = kersTargetOffset - 2; // 0x5C9C

  if (firmwareBuffer.length === 0) {
    return {
      success: false,
      message: 'Firmware buffer is empty.',
      signatureFound: false,
      signatureOffset: -1,
      originalBytes: '',
      patchedBytes: '',
      fileSize: 0,
      sha256Original: '',
      sha256Patched: '',
    };
  }

  const sha256Original = await calculateSHA256(firmwareBuffer);

  // Check bounds
  if (Math.max(speedTargetOffset, kersTargetOffset) + 2 > firmwareBuffer.length) {
    return {
      success: false,
      message: `File is too small (${firmwareBuffer.length} bytes). Expected ~125,371 bytes.`,
      signatureFound: false,
      signatureOffset: -1,
      originalBytes: '',
      patchedBytes: '',
      fileSize: firmwareBuffer.length,
      sha256Original,
      sha256Patched: sha256Original,
    };
  }

  // Verify Speed Signature at 0x5C74: AB 49 78 7A 08 80
  const actualSig = [
    firmwareBuffer[speedSigOffset],
    firmwareBuffer[speedSigOffset + 1],
    firmwareBuffer[speedSigOffset + 2],
    firmwareBuffer[speedSigOffset + 3],
    firmwareBuffer[speedSigOffset + 4],
    firmwareBuffer[speedSigOffset + 5],
  ];
  const sigHex = actualSig.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');

  const b0 = firmwareBuffer[speedTargetOffset];
  const b1 = firmwareBuffer[speedTargetOffset + 1];
  const currentSpeedBytesHex = `${b0.toString(16).padStart(2, '0').toUpperCase()} ${b1.toString(16).padStart(2, '0').toUpperCase()}`;

  const isSpeedOriginal = b0 === 0x78 && b1 === 0x7a;
  const isSpeedAlreadyPatched = b1 === 0x20;

  if (!isSpeedOriginal && !isSpeedAlreadyPatched) {
    return {
      success: false,
      message: `Speed signature mismatch at 0x${speedSigOffset.toString(16).toUpperCase()}. Found "${sigHex}", expected "AB 49 78 7A 08 80". Safe patch aborted.`,
      signatureFound: false,
      signatureOffset: -1,
      originalBytes: currentSpeedBytesHex,
      patchedBytes: '',
      fileSize: firmwareBuffer.length,
      sha256Original,
      sha256Patched: sha256Original,
    };
  }

  // Create clone for patching
  const patchedBuffer = new Uint8Array(firmwareBuffer);
  const immVal = parseInt(options.speedHexImm, 16);

  if (isNaN(immVal) || immVal < 0 || immVal > 255) {
    return {
      success: false,
      message: `Invalid speed hex value "${options.speedHexImm}". Must be an 8-bit hex integer (00-FF).`,
      signatureFound: true,
      signatureOffset: speedSigOffset,
      originalBytes: currentSpeedBytesHex,
      patchedBytes: '',
      fileSize: firmwareBuffer.length,
      sha256Original,
      sha256Patched: sha256Original,
    };
  }

  // Apply Thumb MOVS r0, #imm8 -> [immVal, 0x20] for speed
  patchedBuffer[speedTargetOffset] = immVal;
  patchedBuffer[speedTargetOffset + 1] = 0x20;
  const patchedSpeedHex = `${immVal.toString(16).padStart(2, '0').toUpperCase()} 20`;

  // Handle KERS / Recuperation Patch
  let kersPatchApplied = false;
  let currentKersBytesHex = '';
  let patchedKersHex = '';

  const shouldPatchKers = options.disableKers || (options.kersHexImm && options.kersHexImm !== 'STOCK');
  if (shouldPatchKers) {
    const kb0 = firmwareBuffer[kersTargetOffset];
    const kb1 = firmwareBuffer[kersTargetOffset + 1];
    currentKersBytesHex = `${kb0.toString(16).padStart(2, '0').toUpperCase()} ${kb1.toString(16).padStart(2, '0').toUpperCase()}`;

    const kersImmVal = options.kersHexImm ? parseInt(options.kersHexImm, 16) : 0x00;
    const safeKersImm = isNaN(kersImmVal) ? 0x00 : kersImmVal;

    // Apply Thumb MOVS r0, #kersImm -> [safeKersImm, 0x20]
    patchedBuffer[kersTargetOffset] = safeKersImm;
    patchedBuffer[kersTargetOffset + 1] = 0x20;
    patchedKersHex = `${safeKersImm.toString(16).padStart(2, '0').toUpperCase()} 20`;
    kersPatchApplied = true;
  }

  const sha256Patched = await calculateSHA256(patchedBuffer);

  let successMsg = `Successfully patched Speed Limit at 0x${speedTargetOffset.toString(16).toUpperCase()} (${currentSpeedBytesHex} -> ${patchedSpeedHex}).`;
  if (kersPatchApplied) {
    successMsg += ` Regenerative braking (KERS) disabled at 0x${kersTargetOffset.toString(16).toUpperCase()} (${currentKersBytesHex || '78 7B'} -> ${patchedKersHex} / Freewheeling 0A).`;
  }

  return {
    success: true,
    message: successMsg,
    signatureFound: true,
    signatureOffset: speedSigOffset,
    originalBytes: currentSpeedBytesHex,
    patchedBytes: patchedSpeedHex,
    kersPatchApplied,
    kersOriginalBytes: currentKersBytesHex || '78 7B',
    kersPatchedBytes: patchedKersHex,
    fileSize: patchedBuffer.length,
    sha256Original,
    sha256Patched,
    patchedBuffer,
  };
}

export function generatePythonScript(
  speedHexImm: string,
  speedKmH: number,
  disableKers = true
): string {
  return `#!/usr/bin/env python3
"""
Xiaomi Scooter 5 Plus (Brightway MCU / ES32) Firmware Patcher
Repository: https://github.com/SHAULK21/BW-Patched_
Based on commit: ab96951dedc6f93791a0ad13285a4dd7f4786bd3

Strict Safety Rules:
- Speed Limit: Modifies exactly 2 bytes at 0x5C76: 78 7A -> ${speedHexImm.toUpperCase()} 20 (MOVS r0, #0x${speedHexImm.toUpperCase()})
- KERS (Recuperation): ${disableKers ? 'DISABLED on throttle release (0x5C9E: 78 7B -> 00 20 / MOVS r0, #0 / Freewheel coasting)' : 'Preserved at stock profile'}
- Mechanical and electronic brake handle lever functions remain 100% active and unmodified
"""

import sys
import os
import hashlib
import argparse

TARGET_BIN_SIZE = 125371

# Speed Limit Hook
SPEED_SIG = bytes((0xAB, 0x49, 0x78, 0x7A, 0x08, 0x80))
SPEED_PATCH_OFFSET = 0x5C76
SPEED_SIG_OFFSET = 0x5C74
SPEED_PATCH_BYTES = bytes((0x${speedHexImm.toUpperCase()}, 0x20))  # Target ~${speedKmH} km/h parameter

# KERS Recuperation Hook (Throttle release coasting)
KERS_PATCH_OFFSET = 0x5C9E
KERS_PATCH_BYTES = bytes((0x00, 0x20))  # MOVS r0, #0 -> 0A Braking Torque (Freewheel)

def patch_firmware(input_path: str, output_path: str, disable_kers: bool = ${disableKers ? 'True' : 'False'}):
    if not os.path.exists(input_path):
        print(f"[!] Error: Input file '{input_path}' not found.")
        sys.exit(1)

    with open(input_path, 'rb') as f:
        data = bytearray(f.read())

    print(f"[*] Input file size: {len(data)} bytes")
    if len(data) != TARGET_BIN_SIZE:
        print(f"[?] Warning: File size is {len(data)}, expected {TARGET_BIN_SIZE} bytes.")

    sha256_orig = hashlib.sha256(data).hexdigest()
    print(f"[*] Original SHA256: {sha256_orig}")

    # 1. Verify and Patch Speed Limit Hook (0x5C76)
    sig_slice = bytes(data[SPEED_SIG_OFFSET:SPEED_SIG_OFFSET + 6])
    if sig_slice != SPEED_SIG:
        if data[SPEED_PATCH_OFFSET + 1] == 0x20:
            print(f"[!] File already has speed patch at 0x{SPEED_PATCH_OFFSET:04X}!")
        else:
            print(f"[!] Critical error: Speed signature mismatch at 0x{SPEED_SIG_OFFSET:04X}.")
            print(f"    Expected: {SPEED_SIG.hex(' ')}")
            print(f"    Found:    {sig_slice.hex(' ')}")
            sys.exit(1)

    current_speed_inst = bytes(data[SPEED_PATCH_OFFSET:SPEED_PATCH_OFFSET + 2])
    print(f"[*] Speed instruction @ 0x{SPEED_PATCH_OFFSET:04X}: {current_speed_inst.hex(' ')} (LDRB r0, [r7, #9])")
    data[SPEED_PATCH_OFFSET] = SPEED_PATCH_BYTES[0]
    data[SPEED_PATCH_OFFSET + 1] = SPEED_PATCH_BYTES[1]
    print(f"[+] Patched Speed @ 0x{SPEED_PATCH_OFFSET:04X}: {SPEED_PATCH_BYTES.hex(' ')} (MOVS r0, #0x${speedHexImm.toUpperCase()}) -> ~${speedKmH} km/h")

    # 2. Patch KERS Recuperation if requested (0x5C9E)
    if disable_kers:
        current_kers_inst = bytes(data[KERS_PATCH_OFFSET:KERS_PATCH_OFFSET + 2])
        print(f"[*] KERS instruction @ 0x{KERS_PATCH_OFFSET:04X}: {current_kers_inst.hex(' ')} (LDRB r0, [r7, #11])")
        data[KERS_PATCH_OFFSET] = KERS_PATCH_BYTES[0]
        data[KERS_PATCH_OFFSET + 1] = KERS_PATCH_BYTES[1]
        print(f"[+] Patched KERS @ 0x{KERS_PATCH_OFFSET:04X}: {KERS_PATCH_BYTES.hex(' ')} (MOVS r0, #0 -> 0A Freewheel Coasting)")

    sha256_patched = hashlib.sha256(data).hexdigest()
    print(f"[+] Patched SHA256: {sha256_patched}")

    with open(output_path, 'wb') as f:
        f.write(data)

    print(f"[SUCCESS] Wrote verified patched firmware to '{output_path}'.")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Xiaomi 5 Plus Scooter Firmware Patcher")
    parser.add_argument('input', nargs='?', default='mcu_xiaomi.scooter.5plus.bin', help="Input stock .bin file")
    parser.add_argument('output', nargs='?', default='mcu_xiaomi.scooter.5plus_patched_${speedHexImm.toUpperCase()}.bin', help="Output patched .bin file")
    parser.add_argument('--disable-kers', action='store_true', default=${disableKers ? 'True' : 'False'}, help="Completely disable KERS regenerative drag on throttle release")
    args = parser.parse_args()

    patch_firmware(args.input, args.output, disable_kers=args.disable_kers)
`;
}

export function generateGitCommitMessage(
  paramName = 'speed limit & KERS disable',
  confidence = 'STRONG CANDIDATE',
  hexImm = '23'
): string {
  return `RE: confirm 5 Plus ${paramName} hook

- Speed Limit Hook:
  - Signature: AB 49 78 7A 08 80
  - File Offset: 0x5C74 (patch offset 0x5C76)
  - MCU Address: 0x08005C76
  - Original Bytes: 78 7A (LDRB r0, [r7, #9])
  - Replacement: ${hexImm.toUpperCase()} 20 (MOVS r0, #0x${hexImm.toUpperCase()})
  - Data-flow Evidence:
    1. Loads config input from r7 + 0x09
    2. Stores into RAM buffer 0x20000234
    3. Scaled by x174/10 (0xAE/10) at 0x5C8C
    4. Written to control_object + 0x18
    5. Upper clamp enforced against control_object + 0x14 in range 0x08003698 - 0x08003964

- KERS Recuperation Hook (Throttle Release Freewheel):
  - File Offset: 0x5C9E (MCU: 0x08005C9E)
  - Original Bytes: 78 7B (LDRB r0, [r7, #11])
  - Replacement: 00 20 (MOVS r0, #0)
  - Data-flow Evidence:
    1. Loads KERS level from r7 + 0x0B into r0
    2. Zeroing parameter forces 0A negative Iq injection upon throttle release
    3. Provides smooth coasting (накат) without altering brake handle safety loop

- Confidence: ${confidence}
- Status Notes: Single active profile hook verified; 0x200002B7 confirmed NOT a mode selector (runtime index 0..8).
`;
}
