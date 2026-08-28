#!/usr/bin/env python3
"""
Deep Architecture & Pattern Discoverer for Brightway SZMC-ES-02664-LQ (Xiaomi 5 Plus)
Searches for:
1. Kick-start threshold (Скорость старта / толчка ногой)
2. Per-mode switch-case speed tables (Выбор скорости по режимам: Eco, Drive, Sport)
3. Power / Phase Current limits (Лимиты тока и мощности)
"""

import struct
import re

class BrightwayArchitectureAnalyzer:
    """
    Analyzes Cortex-M Thumb-2 bytecode patterns for Brightway/SZMC ESC firmware.
    """

    @staticmethod
    def analyze_kick_start_speed(data: bytes, base_addr=0x08000000):
        """
        Kick-start speed detection:
        Factory default is usually 3 km/h (0x03), 4 km/h (0x04) or 5 km/h (0x05).
        Logic:
        1. Compare wheel speed against threshold:
           CMP rX, #3 (0x03, 0x28..0x2F) or CMP rX, #4 (0x04, 0x28..0x2F) or CMP rX, #5 (0x05, 0x28..0x2F)
           Followed by conditional branch BHI / BLS / BGE / BLT.
        2. Or Profile load: LDRB r0, [rX, #offset] where offset is near +0x08..+0x0B.
        """
        results = []
        for i in range(0, len(data) - 4, 2):
            b0, b1 = data[i], data[i+1]
            # Check for CMP rX, #3, #4, #5
            if (0x28 <= b1 <= 0x2F) and (b0 in (3, 4, 5)):
                reg = b1 - 0x28
                threshold = b0
                # Next instruction check for branch
                next_code = data[i+2] | (data[i+3] << 8)
                is_branch = (next_code & 0xF000) == 0xD000 or (next_code & 0xF800) == 0xE000
                results.append({
                    "offset": i,
                    "address": hex(base_addr + i),
                    "type": "CMP_KICK_START",
                    "threshold_kmh": threshold,
                    "reg": f"r{reg}",
                    "opcode": f"{b0:02X} {b1:02X}",
                    "has_branch_following": is_branch,
                    "description": f"CMP r{reg}, #{threshold} (Порог старта с толчка)"
                })
        return results

    @staticmethod
    def analyze_mode_switch_dispatch(data: bytes, base_addr=0x08000000):
        """
        Mode Switch & Speed Table Dispatch:
        The CCU (Display) sends Mode ID (0 = Pedestrian/Eco, 1 = Drive, 2 = Sport).
        ESC firmware evaluates mode using either:
        Method A: Switch-case dispatch:
           CMP rX, #1 (0x01, 0x28..0x2F) -> BEQ Mode_Drive
           CMP rX, #2 (0x02, 0x28..0x2F) -> BEQ Mode_Sport
           (else Eco/Pedestrian default)
        Method B: Flash Lookup Table:
           Array of bytes [0x05, 0x14, 0x19] (5 km/h, 20 km/h, 25 km/h)
           or [0x0F, 0x14, 0x19] (15 km/h, 20 km/h, 25 km/h)
           Indexed via LDRB r0, [table_base, r_mode]
        """
        results = {
            "mode_branches": [],
            "lookup_tables": []
        }

        # 1. Look for sequential mode comparisons (CMP #1, BEQ, CMP #2, BEQ)
        for i in range(0, len(data) - 12, 2):
            b0, b1 = data[i], data[i+1]
            if (0x28 <= b1 <= 0x2F) and b0 == 1: # CMP rX, #1
                reg = b1 - 0x28
                # Check if followed by branch, then CMP rX, #2
                # Look ahead up to 10 bytes
                for delta in (2, 4, 6, 8):
                    if i + delta + 1 < len(data):
                        c0, c1 = data[i + delta], data[i + delta + 1]
                        if c1 == (0x28 + reg) and c0 == 2: # CMP same rX, #2
                            results["mode_branches"].append({
                                "offset_mode1": i,
                                "offset_mode2": i + delta,
                                "address": hex(base_addr + i),
                                "reg": f"r{reg}",
                                "description": f"Полноценный switch-case диспетчер режимов (Mode 0, 1, 2) на регистре r{reg}"
                            })

        # 2. Look for byte arrays of speed limits: [05, 14, 19] or [0F, 14, 19] or [06, 14, 19]
        speed_patterns = [
            (b"\x05\x14\x19", "Pedestrian 5, Drive 20, Sport 25"),
            (b"\x06\x14\x19", "Pedestrian 6, Drive 20, Sport 25"),
            (b"\x0F\x14\x19", "Eco 15, Drive 20, Sport 25"),
            (b"\x14\x14\x19", "Eco 20, Drive 20, Sport 25"),
            (b"\x06\x0F\x14\x19", "Pedestrian 6, Eco 15, Drive 20, Sport 25"),
        ]
        for pat, desc in speed_patterns:
            for m in re.finditer(re.escape(pat), data):
                results["lookup_tables"].append({
                    "offset": m.start(),
                    "address": hex(base_addr + m.start()),
                    "bytes": pat.hex(" "),
                    "description": desc
                })

        return results

    @staticmethod
    def analyze_power_current_limits(data: bytes, base_addr=0x08000000):
        """
        Current & Power Limits in FOC Motor Controller:
        1. Current limits are stored as 16-bit integers in mA / raw ADC counts:
           - 15A = 15000 mA (0x3A98) or 150 dA (0x0096)
           - 16A = 16000 mA (0x3E80)
           - 18A = 18000 mA (0x4650)
           - 20A = 20000 mA (0x4E20)
           - 25A = 25000 mA (0x61A8) (Sport peak)
           - 30A = 30000 mA (0x7530)
           - ADC counts for shunt (e.g. 2048 baseline, max delta 1500-3000: 0x05DC..0x0BB8)
        2. Immediate loads:
           - MOVS rX, #imm8 (for scaled values)
           - LDR rX, [PC, #imm] (for 16-bit / 32-bit current constants)
        """
        results = []
        # Search for typical current constants in 16-bit values
        target_currents = [
            (15000, 0x3A98, "15.0A (Eco/Standard Limit)"),
            (16000, 0x3E80, "16.0A (Standard Phase Current)"),
            (18000, 0x4650, "18.0A (Drive Mode Limit)"),
            (20000, 0x4E20, "20.0A (Sport Nominal Limit)"),
            (25000, 0x61A8, "25.0A (Sport Peak / 5 Plus Max)"),
            (27000, 0x6978, "27.0A (Peak Phase Limit)"),
            (30000, 0x7530, "30.0A (Absolute Hardware Limit)"),
        ]

        for cur_ma, hex_val, desc in target_currents:
            needle_le = struct.pack("<H", hex_val)
            for m in re.finditer(re.escape(needle_le), data):
                off = m.start()
                results.append({
                    "offset": off,
                    "address": hex(base_addr + off),
                    "current_ma": cur_ma,
                    "raw_hex": needle_le.hex(" "),
                    "description": desc
                })

        return results

print("BrightwayArchitectureAnalyzer ready.")
