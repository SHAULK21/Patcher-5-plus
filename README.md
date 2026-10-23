# Xiaomi 5 Plus — strict reference patcher

This program really replaces the reference instruction at file offset 0x5C76
and recalculates the inner and outer component-A CRCs, then checks component B.
It is a **research package patcher**, not a
verified scooter flasher. Static validation cannot establish physical speed,
mode behaviour, controller safety, OTA acceptance or hardware flash addressing.

## Supported input

Only the untouched complete package is accepted:
- Size: 125371 bytes.
- SHA-256: bdcec9c57c53279a19c28e437003e06e11f441170a349f94f7fdb140edd33cf4.
- Hook: AB 49 78 7A 08 80 at 0x5C74.
- CRC field: 0xB0..0xB1, big endian.
- CRC coverage: [0x100, 0x8D00), CRC-16/XMODEM (poly 0x1021, init 0).
- Outer component-A CRC: field 0x11..0x12, little endian, covers [0x80,0x8D00).
- Component-B CRC: field 0x1F..0x20, little endian, covers [0x8D00,0x1E480).
- LDR literal at 0x5F24: 0x20000234.
- OTA trailer: 0x1E484.

Unknown versions, raw dumps, truncated packages, altered inputs and already
patched outputs are rejected. Always generate each variant from the original.
Values 1..60 are raw parameters; this bound is an application limit, not a
proven safe speed range.

## Run

Python needs no third-party dependencies for patching:

    python verified_patcher.py original.bin
    python verified_patcher.py original.bin parameter35.research.bin --parameter 35

The second command writes an exclusively created output and a JSON manifest
with hashes and all actual changed offsets. Input files are never overwritten.
Only 0x5C76..0x5C77 and CRC bytes 0xB0..0xB1 and 0x11..0x12 may change. KERS, the other
component and the signed trailer stay byte-for-byte unchanged.
The order is instruction, inner CRC, then outer CRC: the outer region includes
the updated inner CRC field. Parameter 35 produces inner CRC 0x9DB1 and outer
CRC 0x8AC4 (stored as C4 8A). The report's `crc_valid` now means all three CRCs
match. Individual results and regions are included in `component_crcs` and
`inner_component_crc_valid`, `outer_component_crc_valid`, `second_component_crc_valid`.

For the browser interface:

    npm ci
    npm run dev

For Streamlit:

    pip install -r requirements.txt
    streamlit run streamlit_app.py

All active patch panels use strict validation. The previous independent
patch writers, unsafe generated scripts and fabricated sample workflows have
been retired from the application.

## Reverse engineering

    pip install 'capstone>=5,<6'
    python tools/reverse_report.py original.bin > reverse-report.json

This read-only tool independently disassembles selected known instruction
windows and reports **file offsets**, never invented physical MCU addresses.
See XIAOMI_5PLUS_RE_SPEC.md for verified bytes and unresolved questions.

Read-only cryptographic verification is optional and separate from patching:

    pip install -r requirements-re.txt
    python tools/verify_ota.py original.bin

This verifies ECDSA/SHA-256 over [0,0x1E4C6) under the embedded leaf key and the
leaf certificate under the embedded intermediate. The original passes; patched
packages fail (exit 1). Malformed/unsupported inputs exit 2. Root trust and
bootloader acceptance are not established. No signing or flashing is performed.
The patch manifest states `ota_signature_verification: not_performed`; its
`invalidated_by_patch` status describes the known effect of changing the signed
data, not a cryptographic verification performed by the browser/patching core.

## Tests

    python -m unittest discover -s tests -v
    npx tsx --test tests/patcher.test.ts
    npm run build

The original firmware is not committed or downloaded by CI. Positive Python
guard/patch tests use a clearly labelled synthetic fixture and a test-only
reference hash. Production still rejects that fixture. Actual reference
integration tests are skipped unless REFERENCE_FW points to the original:

    REFERENCE_FW=/absolute/path/original.bin python -m unittest discover -s tests -v
    REFERENCE_FW=/absolute/path/original.bin npx tsx --test tests/patcher.test.ts

On Windows PowerShell set $env:REFERENCE_FW to the original file path first.
Install `requirements.txt` and `requirements-re.txt` to run the complete Python
suite, including Streamlit and cryptographic integration tests. Tests also
reproduce the old output (valid inner CRC, stale outer CRC) and require rejection.

## Flashing status

- KERS patch is blocked: stock 0x5C9E is 42 54, STRB r2,[r0,r1].
- Extracting an OTA prefix as a raw hardware image is blocked.
- The output retains the original signature material; it is **not re-signed**.
  Changing the signed region invalidates that signature even when all CRCs match.
  Do not use the stock OTA updater.
- Two Cortex-M-compatible component images are present: A at file [0x100,0x8D00)
  maps to analysis address 0; B at [0x8D00,0x1E480) maps to 0x08003000. Neither the
  complete OTA nor its stripped prefix is proven to map to a single flash image.
- Safe hardware use requires identifying the exact components, MCU and
  bootloader layout, comparing a complete factory dump and validating behaviour
  on a recoverable test unit. No write/erase operation is provided here.

## Historical analysis files

The active React entrypoint uses `StrictStudio` only. Older components and
`src/data/reData.ts` retain historical, unverified mode/KERS/address claims and
are not evidence or active patch paths. Use XIAOMI_5PLUS_RE_SPEC.md and the
read-only tools for current findings. In particular, the hook reads byte +9
of a received packet, not a proven active-profile structure.
