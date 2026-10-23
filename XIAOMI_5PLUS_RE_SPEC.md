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
| 0x0011 | Little-endian outer A CRC 0xD51A over [0x80,0x8D00) |
| 0x0018 | BU1 tag |
| 0x001F | Little-endian B CRC 0x4D44 over [0x8D00,0x1E480) |
| 0x0090 | SZMC-ES-02664-LQ marker |
| 0x0086 | Big-endian length 0x8C00 |
| 0x00B0 | CRC 0xEC8C over [0x100,0x8D00) |
| 0x0100 | Vector-like data: SP=0x20002280, reset value=0x000000D5 |
| 0x8D00 | Another vector-like region: SP=0x20003B78, reset=0x0800315D |
| 0x1E484 | MI EF TFOTA marker, model and certificate material |
| 0x1E4C6 | End of signed data, start of first PEM certificate |
| 0x1E974 | 71-byte DER ECDSA signature; preceding byte is a newline |

The vectors, startup literals and instruction alignment support analysis bases
0 for component A and 0x08003000 for B. For A, file_offset = address + 0x100;
for B, file_offset = address - 0x08003000 + 0x8D00. The physical Flash alias
of A and the assignment of components to exact MCU/board revisions remain unknown.
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

35 produces 23 20 at 0x5C76, inner CRC 0x9DB1 at 0xB0, and outer CRC
0x8AC4 at 0x11 (little-endian bytes C4 8A). This changes six actual bytes.
The earlier writer repaired only the inner CRC and left the outer 0xD51A stale.
Both Python and TypeScript now repair the inner CRC first and the outer second,
and reject that earlier four-byte output. CRC B is checked and remains unchanged.

## Packet field and consumers

At component-A address 0x50FC (file 0x51FC), the dispatcher handles a received
message with packet[1]=0x12 and packet[2]=0x20. The hook copies packet[9] into
halfword RAM 0x20000234. It is not proven that r7 points to an active-mode profile.
The raw value is consumed around A addresses 0x1198, 0x1576 and 0x35F2.
The function at A address 0x3598 compares against the value times 10 and
calculates a limit as value*174/10 or a flag-selected constant 435. The field
is a strong speed-reference/limit candidate; physical km/h and mode semantics
remain unverified. RAM 0x20000229 takes a packet-derived value clamped to 0..2;
mapping those values to Eco/Drive/Sport has not been established.

## Cryptographic signature

For the pinned original, ECDSA/SHA-256/P-256 over file[0:0x1E4C6] verifies
under certificate 2. The leaf certificate verifies under certificate 1. No
trusted Mijia Root is provided. `tools/verify_ota.py` performs these checks.
Changing the hook or CRCs invalidates the original signature. Keeping certificate
and signature bytes unchanged does not authenticate the modified package.

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
the original and permits only the instruction pair and both A CRC pairs to differ.
No wildcard fallback or force switch is provided. KERS and hardware image
extraction are blocked. Signed trailer bytes are preserved, but the modified
package is not presented as authenticated or flashable.

## Required evidence to finish hardware support

Identify component targets and exact MCU revisions; obtain and compare a
complete factory dump with the OTA payloads; establish load/erase boundaries,
bootloader validation and recovery; trace parameter writers and consumers;
then verify modes, braking and fault handling on a recoverable test device.
The software currently creates research packages only.
