#!/usr/bin/env python3
"""Evidence-first Xiaomi Electric Scooter 5 Plus patcher core.

Merged from the verified BW-Patched work. No synthetic 64 KiB image is created.
"""
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
    """Return (offset, register, literal_value, literal_offset) for Thumb LDR literal forms."""
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
    """Evidence-only XREF report for a RAM address.

    For 0x200002DC this finds every literal reference and classifies the
    immediately following memory operation. It does not infer semantics.
    """
    refs = []
    for off, reg, value, lit_off in _ldr_literal_targets(data):
        if value != address:
            continue
        op_next = _thumb16(data, off + 2)
        op_next2 = _thumb16(data, off + 4)
        item = {
            "instruction": off,
            "register": reg,
            "literal": lit_off,
            "address": address,
            "next_opcode": op_next,
            "next2_opcode": op_next2,
            "access": "unknown",
        }
        # LDR Rt,[Rn] / LDRB Rt,[Rn] / STR Rt,[Rn] / STRB Rt,[Rn]
        if op_next == 0x6800 | (reg << 3):
            item["access"] = "read_word"
        elif op_next == 0x7800 | (reg << 3):
            item["access"] = "read_byte"
        elif op_next == 0x6000 | (reg << 3):
            item["access"] = "write_word"
            item["writer_source"] = "next instruction must be inspected for value"
        elif op_next == 0x7000 | (reg << 3):
            item["access"] = "write_byte"
        elif op_next == 0x8800 | (reg << 3):
            item["access"] = "read_halfword"
        elif op_next == 0x8000 | (reg << 3):
            item["access"] = "write_halfword"
        return_ref = item
        refs.append(return_ref)
    return refs


def trace_mode_candidate(data: bytes):
    """Trace the currently stronger mode candidate without claiming a mapping."""
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
    """Verified 5 Plus patcher/analyzer.

    Confirmed patch: file 0x5C76, LDRB r0,[r7,#9] -> MOVS r0,#speed.
    Confirmed CRC: marker+0x70 for declared big-endian size, stored marker+0x20.
    """

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
        if ota >= 0:
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
    def patch_speed(cls, raw: bytes, kmh: int) -> bytes:
        if not 1 <= int(kmh) <= 255:
            raise ValueError("Speed must be 1..255 km/h")
        data = bytearray(raw)
        hits = cls.find_speed_hook(data)
        if len(hits) != 1:
            raise ValueError(f"Speed hook is not unique: {len(hits)} candidates")
        off, _state = hits[0]
        data[off:off+2] = bytes((int(kmh), 0x20))
        layout = cls._crc_layout(data)
        if layout:
            _marker, crc_off, start, end = layout
            data[crc_off:crc_off+2] = crc16_ccitt(data[start:end]).to_bytes(2, "big")
        return bytes(data)

    @classmethod
    def extract_ota_image(cls, raw: bytes) -> bytes:
        """Strip only the validated MI EF TFOTA signed trailer."""
        a = cls.analyze(raw)
        if a["ota_trailer"] is None:
            return raw
        if not a["crc_valid"]:
            raise ValueError("Refusing OTA extraction: embedded CRC is invalid")
        image = raw[:a["ota_trailer"]]
        post = cls.analyze(image)
        if not post["crc_valid"]:
            raise ValueError("Extracted image failed CRC validation")
        return image

    @classmethod
    def patch_and_extract(cls, raw: bytes, kmh: int):
        patched = cls.patch_speed(raw, kmh)
        return cls.extract_ota_image(patched)


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("input")
    p.add_argument("output")
    p.add_argument("--speed", type=int)
    p.add_argument("--extract", action="store_true")
    args = p.parse_args()
    raw = open(args.input, "rb").read()
    if args.speed is not None:
        raw = Mi5PlusPatcher.patch_speed(raw, args.speed)
    if args.extract:
        raw = Mi5PlusPatcher.extract_ota_image(raw)
    open(args.output, "wb").write(raw)
    print(Mi5PlusPatcher.analyze(raw))
