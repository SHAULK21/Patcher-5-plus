#!/usr/bin/env python3
"""Read-only disassembly of the supported OTA. Requires capstone>=5,<6.
Reports FILE OFFSETS. It does not infer physical flash addressing.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from verified_patcher import Mi5PlusPatcher

def report(raw):
    from capstone import Cs, CS_ARCH_ARM, CS_MODE_THUMB, CS_MODE_LITTLE_ENDIAN
    Mi5PlusPatcher.validate_reference(raw)
    md = Cs(CS_ARCH_ARM, CS_MODE_THUMB | CS_MODE_LITTLE_ENDIAN)
    md.detail = True
    blocks = {}
    # Known instruction-aligned local windows, NOT a whole-image code/data sweep.
    for name, start, end in [
        ("hook_context", 0x5C60, 0x5CCA),
        ("mode_candidate_read", 0x3FA0, 0x3FBC),
        ("input_derived_writer", 0x5E22, 0x5E32),
    ]:
        blocks[name] = [
            {"file_offset": ins.address, "bytes": ins.bytes.hex(" "),
             "mnemonic": ins.mnemonic, "operands": ins.op_str}
            for ins in md.disasm(raw[start:end], start)
        ]
    hook = list(md.disasm(raw[0x5C74:0x5C7A], 0x5C74))
    rejected = list(md.disasm(raw[0x5C9E:0x5CA0], 0x5C9E))
    if [(i.mnemonic, i.size) for i in hook] != [("ldr", 2), ("ldrb", 2), ("strh", 2)]:
        raise ValueError("Independent hook decode mismatch")
    if len(rejected) != 1 or rejected[0].mnemonic != "strb":
        raise ValueError("Independent rejected KERS decode mismatch")
    literal = ((0x5C74 + 4) & ~3) + 0xAB * 4
    return {
        "sha256": hashlib.sha256(raw).hexdigest(),
        "analysis": Mi5PlusPatcher.analyze(raw),
        "file_offset_disassembly": blocks,
        "hook_literal_file_offset": literal,
        "hook_ram_destination": int.from_bytes(raw[literal:literal+4], "little"),
        "vector_like_regions": [
            {"file_offset": off,
             "initial_sp": int.from_bytes(raw[off:off+4], "little"),
             "reset_value": int.from_bytes(raw[off+4:off+8], "little")}
            for off in (0x100, 0x8D00)
        ],
        "limitations": [
            "EU1/BU1 headers and different vector address conventions suggest multiple components.",
            "Component function and physical flash mapping are not established.",
            "Literal XREF scans can include data and second halves of Thumb-2 instructions.",
            "No proven Eco/Drive/Sport selector or KERS hook.",
            "No authenticated modified OTA or hardware flash image is produced.",
        ],
    }

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("input", type=Path)
    args = p.parse_args()
    print(json.dumps(report(args.input.read_bytes()), indent=2))
