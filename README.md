# Xiaomi Electric Scooter 5 Plus — Firmware Analysis & Patcher Tool

[![Streamlit App](https://static.streamlit.io/badges/streamlit_badge_black_white.svg)](https://streamlit.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/Platform-Brightway%20%2F%20SZMC-blue.svg)](https://github.com)
[![MCU](https://img.shields.io/badge/Architecture-ARM%20Cortex--M%20(Thumb--2)-brightgreen.svg)](https://github.com)

A specialized reverse-engineering toolkit and Streamlit web application for analyzing, patching, and flashing custom firmware on the **Xiaomi Electric Scooter 5 Plus** equipped with the **Brightway / SZMC Controller (`SZMC-ES-02664-LQ`, firmware build `WZKPA81223 V100`)**.

---

## ⚡ Key Features

- **🛡️ Safe 2-Byte Thumb-2 Speed Hook:** Modifies strictly the dynamic profile speed-reading instruction (`MOVS r0, #speed`), preserving critical SRAM pointer literal pools (`0x3440` / `0x3C80`) to eliminate HardFault crashes and bricking risks.
- **🔍 Automated Binary Analyzer:** Identifies Cortex-M vector tables (`Initial SP` & `Reset Handler`), detects encrypted Mijia FOTA update containers vs. raw flash dumps, and locates speed limit hooks across multiple compiler code patterns.
- **⚡ Instant ST-Link Image Generator:** Generates a ready-to-flash 64 KB binary image (`.bin`) with valid vector tables mapped to base address `0x08000000`.
- **🔌 Hardware Flashing Guide (SWD / ST-Link):** Step-by-step instructions and command-line scripts (`OpenOCD`, `st-flash`, `pyOCD`) for removing factory Readout Protection (RDP Level 1) and writing custom firmware.

---

## ⚠️ Important Technical Notes

### Why OTA / Bluetooth Flashing is Not Supported
Starting with 5th-generation Xiaomi scooters (including 4 Pro 2nd Gen, 5, and 5 Plus), firmware updates via Bluetooth (OTA) are cryptographically enforced:
1. **ECDSA Signature Verification:** The bootloader rejects any binary with modified bytes due to signature mismatch.
2. **Dashboard Secure Element (BLE / CCU):** Dynamic session authentication tokens (Mijia V3/V4 protocol) block unauthorized flashing commands over BLE.

👉 **Hardware flashing via the 4-pin SWD interface (ST-Link / J-Link / DAPLink) is the only reliable and tested method.**

### Safety Warning on Literal Pools (`0x3440` / `0x3C80`)
Earlier reverse-engineering drafts falsely hypothesized that addresses `0x3440` and `0x3C80` contained regional speed limit tables. Detailed disassembly confirmed these addresses are **static SRAM literal pools** (`0x2000xxxx`). Overwriting them corrupts memory pointers and bricks the controller. **This tool strictly isolates patching to the 2-byte Thumb-2 opcode.**

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
st-flash --reset write xiaomi_5plus_stlink_flashable_35kmh.bin 0x08000000

# 4. Verify data integrity
st-flash verify xiaomi_5plus_stlink_flashable_35kmh.bin 0x08000000
```

---

## 🧠 Reverse Engineering Specifications

| Parameter | Value |
| :--- | :--- |
| **Platform** | Brightway / SZMC (`SZMC-ES-02664-LQ`) |
| **Target Vehicle** | Xiaomi Electric Scooter 5 Plus (`xiaomi.scooter.5plus`) |
| **Firmware Build** | `WZKPA81223 V100` |
| **Flash Base Address** | `0x08000000` (64 KB Flash) |
| **Initial SP** | `0x20003E70` (SRAM) |
| **Reset Handler** | `0x080001D1` |
| **Original Hook Opcode** | `78 7A` (`LDRB r0, [r7, #9]`) |
| **Patched Hook Opcode** | `23 20` (`MOVS r0, #35`) |

---

## ⚖️ Disclaimer

This tool is provided for educational and reverse-engineering research purposes only. Modifying scooter firmware and altering maximum speed limits may void manufacturer warranty, exceed local traffic regulations, and place additional thermal stress on battery/FET components. Use at your own risk.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

