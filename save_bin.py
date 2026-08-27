import sys
import re
import struct

# Write received raw data to binary file
with open("xiaomi_5plus_firmware_raw.bin", "wb") as f:
    f.write(sys.stdin.buffer.read())

print("Raw file written. Size:", len(open("xiaomi_5plus_firmware_raw.bin", "rb").read()))
