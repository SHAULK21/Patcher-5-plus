import os
import sys
import struct
import re

# We will create an accurate disassembler and analyzer for Cortex-M Thumb-2 code
# Specifically designed for Brightway SZMC-ES-02664-LQ Xiaomi 5 Plus

class ArmThumb2Disasm:
    @staticmethod
    def disasm_word(b0, b1):
        opcode = b0 | (b1 << 8)
        # MOVS Rd, #imm8: 0010 0ddd iiii iiii (0x2000 | (rd << 8) | imm8)
        if (opcode & 0xF800) == 0x2000:
            rd = (opcode >> 8) & 0x07
            imm8 = opcode & 0xFF
            return f"MOVS r{rd}, #{imm8} (0x{imm8:02X})"
        # LDRB Rt, [Rn, #imm5]: 0111 1iii iinn nttt (0x7800)
        if (opcode & 0xF800) == 0x7800:
            imm5 = (opcode >> 6) & 0x1F
            rn = (opcode >> 3) & 0x07
            rt = opcode & 0x07
            return f"LDRB r{rt}, [r{rn}, #{imm5}]"
        # STRH Rt, [Rn, #imm5*2]: 1000 0iii iinn nttt (0x8000)
        if (opcode & 0xF800) == 0x8000:
            imm5 = (opcode >> 6) & 0x1F
            rn = (opcode >> 3) & 0x07
            rt = opcode & 0x07
            return f"STRH r{rt}, [r{rn}, #{imm5*2}]"
        # LDR Rt, [PC, #imm8*4]: 0100 1ttt iiii iiii (0x4800)
        if (opcode & 0xF800) == 0x4800:
            rt = (opcode >> 8) & 0x07
            imm8 = opcode & 0xFF
            return f"LDR r{rt}, [PC, #{imm8*4}]"
        # CMP Rn, #imm8: 0010 1nnn iiii iiii (0x2800)
        if (opcode & 0xF800) == 0x2800:
            rn = (opcode >> 8) & 0x07
            imm8 = opcode & 0xFF
            return f"CMP r{rn}, #{imm8}"
        return f".short 0x{opcode:04X}"

print("Disassembler ready")
