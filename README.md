# 🛴 Xiaomi Electric Scooter 5 Plus — Firmware Studio & Patcher

Verified firmware analyzer and patcher for Xiaomi Electric Scooter 5 Plus / Brightway `SZMC-ES-02664-LQ`.

## What is now verified

- Reference package: `125371` bytes, SHA-256 `bdcec9c57c53279a19c28e437003e06e11f441170a349f94f7fdb140edd33cf4`.
- Device marker `SZMC-ES-02664-LQ` at `0x90`.
- CRC-16-CCITT over the declared protected region; reference CRC `0xEC8C`.
- Unique speed hook at `0x5C74`: `AB 49 78 7A 08 80`.
- Patch point `0x5C76`: `78 7A` → `XX 20` (`MOVS r0,#XX`).
- Runtime speed RAM address: `0x20000234`.
- Speed-control path around `0x3698–0x3964`, including `value * 174 / 10` and the `0x20001E40` control object clamp.
- OTA trailer marker `MI EF TFOTA` at `0x1E484`; validated extraction preserves the embedded firmware prefix and does not synthesize a 64 KiB image.
- `0x200002DC` is now tracked as a mode/state candidate with XREF tracing, but Eco/Drive/Sport mapping remains deliberately unverified.

## Usage

The Streamlit app uses `verified_patcher.py`:

```bash
pip install -r requirements.txt
streamlit run streamlit_app.py
```

Upload the original `.bin`/`.ota`, inspect the report, choose a speed, and generate a patched file. CRC is recalculated automatically.

CLI:

```bash
python verified_patcher.py input.bin output.bin --speed 35
python verified_patcher.py input.bin image.bin --speed 35 --extract
```

## Important corrections

The old issue #39 signatures for `SIG_MODES` and `remove_speed_check` do not occur in the verified reference firmware, so they are not used by this patcher. Likewise, the old claim that `0x20001E2C` is definitively the Eco/Drive/Sport selector is not accepted without tracing writers.

The project no longer creates artificial 64 KiB binaries with fabricated vector tables. A stripped embedded image is not automatically claimed to be a proven flashable raw dump; bootloader/addressing requirements must be established separately.

## Safety

Firmware modification can brick the controller and may affect vehicle safety. Keep an untouched factory backup. Do not treat static validation as proof that a generated image is safe to flash. Follow applicable local laws and use appropriate hardware recovery procedures.
