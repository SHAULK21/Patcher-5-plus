# Xiaomi Electric Scooter 5 Plus — Verified Firmware Analysis & Patcher Tool

[![Streamlit App](https://static.streamlit.io/badges/streamlit_badge_black_white.svg)](https://streamlit.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/Platform-Brightway%20%2F%20SZMC-blue.svg)](https://github.com)
[![MCU](https://img.shields.io/badge/Architecture-ARM%20Cortex--M%20(Thumb--2)-brightgreen.svg)](https://github.com)

A specialized, verified reverse-engineering toolkit and Streamlit web application for analyzing, patching, and flashing custom firmware on the **Xiaomi Electric Scooter 5 Plus** equipped with the **Brightway / SZMC Controller (`SZMC-ES-02664-LQ`, firmware build `WZKPA81223 V100`)**.

---

## ⚡ Key Confirmed Features

- **🛡️ Safe 2-Byte Thumb-2 Speed Hook:** Modifies strictly the dynamic profile speed-reading instruction at file offset `0x5C74` (`LDRB r0, [r7, #9]` ➔ `MOVS r0, #speed`), preserving critical SRAM pointer literal pools (`0x3440` / `0x3C80`) to eliminate HardFault crashes and bricking risks.
- **🔒 Automated CRC-16 Recalculation:** Recomputes the big-endian CRC-16-CCITT checksum over the protected region `[0x100 : 0x8D00)` (35,840 bytes) and rewrites offset `0xB0` to satisfy bootloader integrity checks.
- **🔍 Automated Binary Analyzer:** Identifies device markers (`SZMC-ES-02664-LQ`), verifies CRC-16 header validity, detects OTA signature blocks, and presents a real-time Thumb-2 disassembly view.
- **⚡ Instant ST-Link Image Generator:** Generates a ready-to-flash 64 KB binary image (`.bin`) with valid vector tables mapped to base address `0x08000000`.
- **🔌 Hardware Flashing Guide (SWD / ST-Link):** Step-by-step instructions and command-line scripts (`OpenOCD`, `st-flash`, `pyOCD`) for removing factory Readout Protection (RDP Level 1) and writing custom firmware.

---

## 🧠 Reverse Engineering Specifications (CONFIRMED)

| Parameter | Value | Status |
| :--- | :--- | :--- |
| **Platform** | Brightway / SZMC (`SZMC-ES-02664-LQ`) | **CONFIRMED** |
| **Target Vehicle** | Xiaomi Electric Scooter 5 Plus (`xiaomi.scooter.5plus`) | **CONFIRMED** |
| **Firmware Build** | `WZKPA81223 V100` | **CONFIRMED** |
| **Device Marker** | File Offset `0x90` (`SZMC-ES-02664-LQ`) | **CONFIRMED** |
| **Protected Region** | `[0x100 : 0x8D00)` (35,840 bytes) | **CONFIRMED** |
| **CRC-16 Location** | File Offset `0xB0` (2 bytes, big-endian) | **CONFIRMED** |
| **Speed Hook Offset** | File Offset `0x5C74` (Signature: `AB 49 78 7A 08 80`) | **CONFIRMED** |
| **Runtime Speed RAM** | `0x20000234` (1 writer at `0x5C74`, 3 reads) | **CONFIRMED** |
| **SPEED_CONTROL Block**| `0x3698 – 0x3964` (`(val * 174) / 10` ramp & clamp) | **CONFIRMED** |

---

## 🚀 Getting Started

### 1. Running Locally with Streamlit

Clone the repository and install requirements:

```bash
git clone https://github.com/your-username/xiaomi-5plus-patcher.git
cd xiaomi-5plus-patcher

# Install dependencies
pip install -r requirements.txt

# Launch the Streamlit application
streamlit run main.py
```

The web dashboard will open at `http://localhost:8501`.

### 2. Deploying to Streamlit Cloud

1. Fork or push this repository to your GitHub account.
2. Go to [share.streamlit.io](https://share.streamlit.io/) and create a new app.
3. Select your repository, branch, and set **Main file path** to `main.py`.
4. Deploy! All dependencies in `requirements.txt` will install automatically.

---

## 🔌 Hardware Flashing Guide (ST-Link V2 / SWD)

### 1. Controller Board Pinout (4-Pin SWD)

Locate the 4 debug test pads on the ESC controller board inside the scooter deck:

| ESC Board Pad | ST-Link V2 Pin | Description |
| :--- | :--- | :--- |
| **GND** | `GND` | Common Ground (Pin 1) |
| **SWDIO** | `SWDIO` | Data line (Pin 2) |
| **SWCLK** | `SWCLK` | Clock line (Pin 3) |
| **3.3V (VCC)** | `3.3V` | 3.3V Logic Power (Pin 4) |

### 2. Flashing via Command Line (`st-flash` & `OpenOCD`)

```bash
# 1. Verify connection to the ARM Cortex-M target
st-info --probe

# 2. Disable factory Readout Protection (RDP Level 1)
# Note: Unlocking RDP will erase existing protected Flash memory
openocd -f interface/stlink.cfg -f target/stm32f1x.cfg -c "init; reset halt; stm32f1x unlock 0; reset halt; exit"

# 3. Write the patched firmware binary to base address 0x08000000
st-flash --reset write xiaomi_5plus_patched_35kmh_crc_fixed.bin 0x08000000

# 4. Verify data integrity
st-flash verify xiaomi_5plus_patched_35kmh_crc_fixed.bin 0x08000000
```

---

## ⚖️ Disclaimer

This tool is provided for educational and reverse-engineering research purposes only. Modifying scooter firmware and altering maximum speed limits may void manufacturer warranty, exceed local traffic regulations, and place additional thermal stress on battery/FET components. Use at your own risk.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
