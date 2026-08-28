# Xiaomi Scooter 5 Plus (Brightway / ES32) — Verified Reverse Engineering Specification & Handoff

## Purpose of this Document
Every finding below was verified by disassembling the real binary (`mcu_xiaomi.scooter.5plus.bin`, SHA-256 `bdcec9c5...`, size 125371 bytes) with Capstone in ARM Thumb/Thumb-2 mode.

**Status Labels:**
- **CONFIRMED** — Verified directly against real file bytes/disassembly.
- **STRONG CANDIDATE** — Well-supported by disassembly, under active tracing.
- **UNCONFIRMED** — A lead, not yet traced.
- **REFUTED** — An earlier hypothesis actively disproven by byte-level evidence.

---

## 1. Firmware Identity & Container Structure

* **File:** `mcu_xiaomi.scooter.5plus.bin`, **125371 bytes**
* **SHA-256:** `bdcec9c5c53279a19c28e437003e06e11f441170a349f94f7fdb140edd33cf4`
* **Format:** Signed OTA package with embedded PEM certificate blocks (near `0x1E4CB`). **CONFIRMED.**
* **Device Identification String (File Offset `0x90`):** `SZMC-ES-02664-LQ`. **CONFIRMED.**
* **Build Identifiers:** `WZKPA81223` (offset `0x89D0`), `xiaomi.scooter.5plus` (offset `0x1E4A5`). **CONFIRMED.**

### Structural Protected Region & CRC-16 Verification (CONFIRMED)
* **Size Field (Offset `0x86` / `marker - 0xA`):** `0x8C00` (35840 bytes, big-endian).
* **CRC-16 Field (Offset `0xB0` / `marker + 0x20`):** `0xEC8C` (2 bytes, big-endian).
* **Algorithm:** CRC-16-CCITT (poly `0x1021`, init `0x0000`, rev=False, xorOut=0x0000).
* **Protected Range:** `[0x100 : 0x8D00)` (`size = 0x8C00` bytes starting at `marker + 0x70`).
* **Verification:** Computing CRC-16 over `[0x100 : 0x8D00)` produces `0xEC8C` **exactly**.
* **Integrity Mandate:** The confirmed speed hook at `0x5C74` lies inside `[0x100 : 0x8D00)`. Any byte patch inside this region **MUST** recalculate CRC-16 and rewrite it to `0xB0` to prevent bootloader self-check rejection.

---

## 2. Speed Limit Hook — CONFIRMED (The Working Patch Point)

* **Location:** File Offset `0x5C74`
* **Exact Signature (6 bytes):** `AB 49 78 7A 08 80`
* **Disassembly:**
  ```armasm
  0x5C74: AB 49       LDR   r1, [pc, #0x2AC]   ; r1 = 0x20000234 (SPEED_RUNTIME_ADDR)
  0x5C76: 78 7A       LDRB  r0, [r7, #9]       ; r0 = payload byte at r7+9  <-- PATCH TARGET
  0x5C78: 08 80       STRH  r0, [r1, #0]       ; [0x20000234] = r0
  ```
* **Patch:** Replace `78 7A` (`LDRB r0, [r7, #9]`) with `MOVS r0, #imm8` (`[speed_kmh, 0x20]`), e.g., `23 20` for 35 km/h.
* **Single Runtime Writer:** RAM address `0x20000234` has **only 1 write in the entire 125KB binary** (this hook at `0x5C74`) and 3 reads:
  1. `0x1290` — Torque curve interpolation.
  2. `0x1672` — Fault-detection / curve selection.
  3. `0x36EC` — SPEED_CONTROL ramp/clamp function.

---

## 3. SPEED_CONTROL Function (File `0x3698 – 0x3964`) — CONFIRMED

* **Role:** Rate-limiter and ramp controller (gradually ramps motor target to the value at `0x20000234`).
* **Math:** Reads `[0x20000234]`, computes `(value * 174) / 10` (scale factor 17.4), writes to `control_object + 0x18`.
* **Clamp:** Upper clamp `CMP` + `BLE` against target field.
* **Mode Branching:** **Zero mode-dependent branches** found across this entire function.

---

## 4. Settings Protocol Dispatcher (File `0x51FC – 0x5E50`) — CONFIRMED

* **Entry Point:** File Offset `0x51FC`.
* **Sub-Command `0x12.0x20` (Offset `0x5BE2`):** Unpacks settings blob containing 7 boolean flags (`0x20000219`..`0x20000224`), validated percentage fields (`r7+7`, `r7+8` with 101 clamp), and the speed limit byte at `r7+9` (written to `0x20000234`).
* **Queue System:** Ring queue consumer at `0x4F4C`. Parameter index `0x200002B7` wraps at 8 (range 0..7).

---

## 5. Eco/Drive/Sport Modes — REFUTED Fabrications & Real Behavior

* **REFUTED:** Claims of a tri-state mode selector at `0x20001E2C` (`MODE_STRUCT_FIELD_0A`), handler at `0x0800A412`, or default write at `0x08005834`. Real disassembly disproves all three.
* **REFUTED:** Claims of region tables at `0x3440 / 0x3C80`. These are static SRAM pointer literals.
* **Real Behavior:** The app/BLE sends settings packets (`0x12.0x20`) writing directly to `0x20000234`. The single hook at `0x5C74` overrides the speed setting universally.

---

## 6. Implementation Summary

1. Find `AB 49 78 7A 08 80` at offset `0x5C74`.
2. Replace `78 7A` with `[target_speed_kmh, 0x20]`.
3. Compute CRC-16 over `[0x100 : 0x8D00)`.
4. Write 2-byte big-endian CRC to offset `0xB0`.
