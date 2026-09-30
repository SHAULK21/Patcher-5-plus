# Xiaomi 5 Plus — strict reference patcher

This program really replaces the reference instruction at file offset 0x5C76
and recalculates the embedded CRC. It is a **research package patcher**, not a
verified scooter flasher. Static validation cannot establish physical speed,
mode behaviour, controller safety, OTA acceptance or hardware flash addressing.

## Supported input

Only the untouched complete package is accepted:
- Size: 125371 bytes.
- SHA-256: bdcec9c57c53279a19c28e437003e06e11f441170a349f94f7fdb140edd33cf4.
- Hook: AB 49 78 7A 08 80 at 0x5C74.
- CRC field: 0xB0..0xB1, big endian.
- CRC coverage: [0x100, 0x8D00), CRC-16/XMODEM (poly 0x1021, init 0).
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
Only 0x5C76..0x5C77 and CRC bytes 0xB0..0xB1 may change. KERS, the other
component and the signed trailer stay byte-for-byte unchanged.

For the browser interface:

    npm install
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

## Flashing status

- KERS patch is blocked: stock 0x5C9E is 42 54, STRB r2,[r0,r1].
- Extracting an OTA prefix as a raw hardware image is blocked.
- The output retains the original signature material; it is **not re-signed**.
  A recalculated CRC is not a new digital signature. Do not use the stock OTA updater.
- Two vector-like regions and component headers are present. Neither the
  complete OTA nor its stripped prefix is proven to map to a single flash image.
- Safe hardware use requires identifying the exact components, MCU and
  bootloader layout, comparing a complete factory dump and validating behaviour
  on a recoverable test unit. No write/erase operation is provided here.
