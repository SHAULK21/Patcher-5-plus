#!/usr/bin/env python3
"""Evidence-first Xiaomi Electric Scooter 5 Plus patcher core."""
from __future__ import annotations

import hashlib
from dataclasses import dataclass, asdict

MARKER = b"SZMC-ES-02664-LQ"
MODEL_MARKER = b"xiaomi.scooter.5plus"
OTA_MAGIC = b"MI\xEFTFOTA"
CERT_MAGIC = b"-----BEGIN CERTIFICATE-----"
REFERENCE_SIZE = 125371
REFERENCE_SHA256 = "bdcec9c57c53279a19c28e437003e06e11f441170a349f94f7fdb140edd33cf4"
FLASH_BASE = 0x08000000
SPEED_HOOK = 0x5C76
SPEED_SIG = b"\xAB\x49\x78\x7A\x08\x80"
SPEED_RUNTIME = 0x20000234
MODE_CANDIDATE = 0x200001DE
MODE_FIELD = 0x200002DC
CRC_POLY = 0x1021


def crc16_ccitt(data: bytes) -> int:
    crc = 0
    for b in data:
        crc ^= b << 8
        for _ in range(8):
            crc = (((crc << 1) ^ CRC_POLY) if crc & 0x8000 else (crc << 1)) & 0xFFFF
    return crc


def _ldr_literal_targets(data: bytes):
    out = []
    for off in range(0, len(data) - 3, 2):
        op = int.from_bytes(data[off:off+2], "little")
        if (op & 0xF800) != 0x4800:
            continue
        rt = (op >> 8) & 7
        imm = (op & 0xFF) * 4
        pc = (FLASH_BASE + off + 4) & ~3
        lit_off = pc - FLASH_BASE + imm
        if 0 <= lit_off <= len(data) - 4:
            value = int.from_bytes(data[lit_off:lit_off+4], "little")
            out.append((off, rt, value, lit_off))
    return out


def _thumb16(data: bytes, off: int) -> int:
    return int.from_bytes(data[off:off+2], "little") if off + 2 <= len(data) else -1


def trace_ram_field(data: bytes, address: int):
    """Trace all literal XREFs and classify the immediate Thumb memory operation."""
    refs = []
    for off, reg, value, lit_off in _ldr_literal_targets(data):
        if value != address:
            continue
        op = _thumb16(data, off + 2)
        item = {
            "instruction": off,
            "register": reg,
            "literal": lit_off,
            "address": address,
            "next_opcode": op,
            "access": "unknown",
        }
        # Register-offset/immediate-zero Thumb forms.
        cls = op & 0xF800
        rn = (op >> 3) & 7
        rt = op & 7
        if rn == reg:
            if cls == 0x6800:
                item["access"] = f"read_word_r{rt}"
            elif cls == 0x7800:
                item["access"] = f"read_byte_r{rt}"
            elif cls == 0x6000:
                item["access"] = f"write_word_r{rt}"
            elif cls == 0x7000:
                item["access"] = f"write_byte_r{rt}"
            elif cls == 0x8800:
                item["access"] = f"read_halfword_r{rt}"
            elif cls == 0x8000:
                item["access"] = f"write_halfword_r{rt}"
        refs.append(item)
    return refs


def trace_mode_candidate(data: bytes):
    refs = []
    for off, reg, value, lit_off in _ldr_literal_targets(data):
        if value == MODE_CANDIDATE:
            refs.append({"instruction": off, "register": reg, "literal": lit_off, "address": value})
    return refs


@dataclass
class Analysis:
    size: int
    sha256: str
    known_reference: bool
    marker_offset: int | None
    crc_offset: int | None
    crc_start: int | None
    crc_end: int | None
    stored_crc: int | None
    computed_crc: int | None
    crc_valid: bool
    speed_hook: int | None
    speed_state: str
    ota_trailer: int | None
    mode_candidate: int
    mode_xrefs: list
    mode_field: int
    mode_field_xrefs: list


class Mi5PlusPatcher:
    """Verified 5 Plus patcher/analyzer."""

    @staticmethod
    def _crc_layout(data: bytes):
        marker = data.find(MARKER)
        if marker < 0:
            return None
        size_pos = marker - 0x0A
        crc_pos = marker + 0x20
        start = marker + 0x70
        if size_pos < 0 or crc_pos + 2 > len(data):
            return None
        size = int.from_bytes(data[size_pos:size_pos+2], "big")
        end = start + size
        if end > len(data):
            return None
        return marker, crc_pos, start, end

    @staticmethod
    def find_speed_hook(data: bytes):
        hits = []
        pos = 0
        while True:
            p = data.find(b"\xAB\x49", pos)
            if p < 0:
                break
            if data[p+4:p+6] == b"\x08\x80":
                mid = data[p+2:p+4]
                if mid == b"\x78\x7A" or (len(mid) == 2 and mid[1] == 0x20):
                    hits.append((p + 2, "patched" if mid[1] == 0x20 else "stock"))
            pos = p + 1
        return hits

    @classmethod
    def analyze(cls, data: bytes) -> dict:
        layout = cls._crc_layout(data)
        hook_hits = cls.find_speed_hook(data)
        stored = computed = None
        valid = False
        marker = crc_off = start = end = None
        if layout:
            marker, crc_off, start, end = layout
            stored = int.from_bytes(data[crc_off:crc_off+2], "big")
            computed = crc16_ccitt(data[start:end])
            valid = stored == computed
        ota = data.find(OTA_MAGIC, max(0, len(data)-0x2000))
        if ota < 0:
            ota = None
        if ota is not None:
            model = data.find(MODEL_MARKER, ota, ota+0x100)
            cert = data.find(CERT_MAGIC, ota)
            if not (ota < model < cert):
                ota = None
        return asdict(Analysis(
            size=len(data), sha256=hashlib.sha256(data).hexdigest(),
            known_reference=len(data) == REFERENCE_SIZE and hashlib.sha256(data).hexdigest() == REFERENCE_SHA256,
            marker_offset=marker, crc_offset=crc_off, crc_start=start, crc_end=end,
            stored_crc=stored, computed_crc=computed, crc_valid=valid,
            speed_hook=hook_hits[0][0] if len(hook_hits) == 1 else None,
            speed_state=hook_hits[0][1] if len(hook_hits) == 1 else "ambiguous_or_missing",
            ota_trailer=ota, mode_candidate=MODE_CANDIDATE,
            mode_xrefs=trace_mode_candidate(data), mode_field=MODE_FIELD,
            mode_field_xrefs=trace_ram_field(data, MODE_FIELD)))

    @classmethod
    def validate_reference(cls, raw: bytes) -> dict:
        """Fail closed: only the complete untouched reference package is accepted."""
        if len(raw) != REFERENCE_SIZE:
            raise ValueError("Unsupported size; raw dumps/extracted images are not supported")
        a = cls.analyze(raw)
        if not a["known_reference"]:
            raise ValueError("Unknown or modified SHA-256; use the untouched reference OTA")
        if cls._crc_layout(raw) != (0x90, 0xB0, 0x100, 0x8D00):
            raise ValueError("Unexpected protected region")
        if not a["crc_valid"]:
            raise ValueError("Input CRC is invalid")
        if cls.find_speed_hook(raw) != [(SPEED_HOOK, "stock")]:
            raise ValueError("Hook must be unique and at the verified offset")
        if raw[0x5C74:0x5C7A] != SPEED_SIG:
            raise ValueError("Full hook signature mismatch")
        literal = ((0x5C74 + 4) & ~3) + 0xAB * 4
        if literal != 0x5F24 or int.from_bytes(raw[literal:literal+4], "little") != SPEED_RUNTIME:
            raise ValueError("Hook RAM destination mismatch")
        if raw[0x5C7A:0x5C82] != bytes.fromhex("AB 48 40 7A 06 28 02 D9"):
            raise ValueError("Following instructions mismatch")
        if raw[0x5C9E:0x5CA0] != bytes.fromhex("42 54"):
            raise ValueError("Unexpected instruction at rejected KERS site")
        if a["ota_trailer"] != 0x1E484 or raw.count(OTA_MAGIC) != 1:
            raise ValueError("Unexpected OTA trailer")
        return a

    @classmethod
    def verify_output(cls, raw: bytes, output: bytes, value: int) -> dict:
        """Verify actual output against the complete original."""
        cls.validate_reference(raw)
        if type(value) is not int or not 1 <= value <= 60:
            raise ValueError("Parameter must be an integer from 1 to 60")
        if len(output) != len(raw):
            raise ValueError("Output size changed")
        allowed = {0xB0, 0xB1, SPEED_HOOK, SPEED_HOOK + 1}
        changed = [i for i, (x, y) in enumerate(zip(raw, output)) if x != y]
        if not set(changed) <= allowed:
            raise ValueError("Unexpected bytes modified")
        if output[SPEED_HOOK:SPEED_HOOK+2] != bytes((value, 0x20)):
            raise ValueError("Output opcode mismatch")
        if not cls.analyze(output)["crc_valid"]:
            raise ValueError("Output CRC is invalid")
        return {
            "input_sha256": hashlib.sha256(raw).hexdigest(),
            "output_sha256": hashlib.sha256(output).hexdigest(),
            "parameter": value,
            "changed_offsets": changed,
            "changes": [{"offset": i, "before": raw[i], "after": output[i]} for i in changed],
            "crc_valid": True,
            "format": "modified-ota-package-for-research",
            "ota_signature_status": "not_re_signed; do not use stock OTA updater",
            "hardware_flash_verified": False,
            "physical_kmh_verified": False,
            "kers_modified": False,
        }

    @classmethod
    def patch_speed(cls, raw: bytes, kmh: int) -> bytes:
        # Compatibility name: value is a raw parameter, not proven physical km/h.
        if type(kmh) is not int or not 1 <= kmh <= 60:
            raise ValueError("Parameter must be an integer from 1 to 60")
        cls.validate_reference(raw)
        data = bytearray(raw)
        data[SPEED_HOOK:SPEED_HOOK+2] = bytes((kmh, 0x20))
        data[0xB0:0xB2] = crc16_ccitt(data[0x100:0x8D00]).to_bytes(2, "big")
        output = bytes(data)
        cls.verify_output(raw, output, kmh)
        return output

    @classmethod
    def extract_ota_image(cls, raw: bytes) -> bytes:
        raise ValueError("Extraction disabled: prefix is not a verified hardware flash image")

    @classmethod
    def patch_and_extract(cls, raw: bytes, kmh: int):
        raise ValueError("Hardware export disabled: address mapping is unverified")


if __name__ == "__main__":
    import argparse
    import json
    from pathlib import Path
    p = argparse.ArgumentParser(description="Strict research patcher; no flashing or OTA signing")
    p.add_argument("input", type=Path)
    p.add_argument("output", type=Path, nargs="?")
    p.add_argument("--speed", "--parameter", type=int, dest="parameter")
    p.add_argument("--extract", action="store_true", help="Unsupported; always refused")
    args = p.parse_args()
    if args.extract:
        p.error("Extraction disabled; OTA prefix is not a verified flash image")
    try:
        raw = args.input.read_bytes()
        if args.parameter is None:
            print(json.dumps(Mi5PlusPatcher.analyze(raw), indent=2))
        else:
            if args.output is None or not args.output.name.endswith(".research.bin"):
                p.error("Specify a separate output ending in .research.bin")
            manifest = args.output.with_suffix(args.output.suffix + ".json")
            if args.input.resolve() == args.output.resolve() or args.output.exists() or manifest.exists():
                p.error("Refusing to overwrite input, output or report")
            output = Mi5PlusPatcher.patch_speed(raw, args.parameter)
            report = Mi5PlusPatcher.verify_output(raw, output, args.parameter)
            with args.output.open("xb") as f:
                f.write(output)
            try:
                with manifest.open("x", encoding="utf-8") as f:
                    json.dump(report, f, indent=2)
            except Exception:
                args.output.unlink()
                raise
            print(json.dumps(report, indent=2))
    except (ValueError, OSError) as exc:
        p.exit(1, str(exc) + "\n")
