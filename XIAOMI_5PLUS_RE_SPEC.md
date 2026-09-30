# Xiaomi 5 Plus — byte evidence and unresolved hardware mapping

Reference SHA-256:
bdcec9c57c53279a19c28e437003e06e11f441170a349f94f7fdb140edd33cf4
Reference size: 125371 bytes.

The following byte observations came from the supplied original OTA during
the audit. They do not establish hardware flashing or physical speed.

## Package structure

| File offset | Observation |
| --- | --- |
| 0x0000 | Package header; not a normal Cortex-M vector table |
| 0x000A | EU1 tag |
| 0x0018 | BU1 tag |
| 0x0090 | SZMC-ES-02664-LQ marker |
| 0x0086 | Big-endian length 0x8C00 |
| 0x00B0 | CRC 0xEC8C over [0x100,0x8D00) |
| 0x0100 | Vector-like data: SP=0x20002280, reset value=0x000000D5 |
| 0x8D00 | Another vector-like region: SP=0x20003B78, reset=0x0800315D |
| 0x1E484 | MI EF TFOTA marker, model and certificate material |

The different reset address conventions suggest a multi-component container.
It is not established which component is the primary motor controller and
whether the first component is linked at zero/remapped or another address.
The blanket formula MCU=0x08000000+file_offset is not valid evidence.
Removing the trailer leaves 124036 bytes including the package header and
multiple regions; it does not create a proven raw MCU flash image.

## Confirmed local hook instructions

| File offset | Bytes | Thumb instruction |
| --- | --- | --- |
| 0x5C74 | AB 49 | LDR r1,[PC,#0x2AC] |
| 0x5C76 | 78 7A | LDRB r0,[r7,#9] |
| 0x5C78 | 08 80 | STRH r0,[r1] |
| 0x5C7A | AB 48 | LDR r0,[PC,#0x2AC] |
| 0x5C7C | 40 7A | LDRB r0,[r0,#9] |
| 0x5C7E | 06 28 | CMP r0,#6 |
| 0x5C80 | 02 D9 | BLS (file target 0x5C88) |

For the first LDR, aligned PC plus displacement resolves to file offset
0x5F24; its literal is 34 02 00 20 = RAM 0x20000234.
The replacement XX 20 is MOVS r0,#XX. It changes flags, unlike LDRB.
In this local straight-line sequence CMP at 0x5C7E overwrites N/Z/C/V before
the visible conditional branch. This observation does not replace a complete
control-flow, interrupt and runtime analysis.

35 produces 23 20 at 0x5C76 and CRC 0x9DB1 at 0xB0.
The audit found four actual changed bytes for this variant.
The browser's former output left the old CRC and was invalid.

## Rejected KERS patch

Stock bytes at 0x5C9E are **42 54 = STRB r2,[r0,r1]**, not 78 7B.
Immediately before, 0x5C9C contains 5A 22 = MOVS r2,#90.
Replacing the STRB with MOVS r0,#0 removes a memory write and changes r0.
There is no evidence this is a safe regenerative-braking modification.
Both disabling and weakening KERS are blocked.

## Unproven semantics

- Raw parameter XX is not independently established as physical km/h.
- Per-mode Eco/Drive/Sport behaviour is not established.
- 0x200002DC has a word input-derived writer, not a proven 0/1/2 mode enum.
- 0x200001DE and 0x20001E2C are fields requiring runtime writer/value tracing.
- The previous claimed scaling at 0x5C8C is wrong for this package:
  bytes there are 05 60 = STR r5,[r0], not a multiplication.
- A certificate marker is not proof of successful signature verification.
- CRC checks do not verify digital signatures or authenticate a changed OTA.

## Implemented trust boundary

The untouched entire-package SHA-256 pins all surrounding code, data and
metadata. Structural checks validate the full unique pattern, RAM literal,
declared CRC layout and trailer. Output validation compares every byte with
the original and permits only the instruction pair and CRC pair to differ.
No wildcard fallback or force switch is provided. KERS and hardware image
extraction are blocked. Signed trailer bytes are preserved, but the modified
package is not presented as authenticated or flashable.

## Required evidence to finish hardware support

Identify component targets and exact MCU revisions; obtain and compare a
complete factory dump with the OTA payloads; establish load/erase boundaries,
bootloader validation and recovery; trace parameter writers and consumers;
then verify modes, braking and fault handling on a recoverable test device.
The software currently creates research packages only.
