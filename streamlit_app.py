import streamlit as st
import hashlib
import os

# ==============================================================================
# Xiaomi Electric Scooter 5 Plus — Brightway MCU (ES32) Firmware Studio
# Designed for Streamlit Community Cloud & GitHub Deployment
# ==============================================================================

st.set_page_config(
    page_title="Xiaomi 5 Plus Firmware Studio",
    page_icon="🛴",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Target Firmware Definitions
FIRMWARE_SIZE = 125371
SPEED_HOOK_OFFSET = 0x5C76    # LDRB r0, [r7, #9] -> MOVS r0, #imm8
SPEED_SIG_OFFSET = 0x5C74     # Expected signature: AB 49 78 7A 08 80
EXPECTED_SPEED_SIG = bytes([0xAB, 0x49, 0x78, 0x7A, 0x08, 0x80])
KERS_HOOK_OFFSET = 0x5C9E     # LDRB r0, [r7, #11] -> MOVS r0, #0 (Freewheel)
EXPECTED_KERS_SIG = bytes([0x78, 0x7B])

# Custom Styling
st.markdown("""
<style>
    .main-header {
        font-size: 2.2rem;
        font-weight: 700;
        margin-bottom: 0.2rem;
    }
    .sub-header {
        color: #94a3b8;
        font-size: 1rem;
        margin-bottom: 1.5rem;
    }
    .metric-card {
        background-color: #1e293b;
        border: 1px solid #334155;
        border-radius: 8px;
        padding: 12px;
        text-align: center;
    }
    .stAlert {
        border-radius: 8px;
    }
</style>
""", unsafe_allow_html=True)

# App Header
st.markdown('<div class="main-header">🛴 Xiaomi Scooter 5 Plus — Firmware Studio</div>', unsafe_allow_html=True)
st.markdown('<div class="sub-header">Конфигуратор и патчер бинарных прошивок Brightway MCU (ES32 ARM Cortex-M4)</div>', unsafe_allow_html=True)

# ------------------------------------------------------------------------------
# SIDEBAR: File Upload & Quick Presets
# ------------------------------------------------------------------------------
with st.sidebar:
    st.image("https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/cpu.svg", width=40)
    st.header("📦 Исходный файл прошивки")
    
    uploaded_file = st.file_uploader(
        "Загрузите mcu_xiaomi.scooter.5plus.bin",
        type=["bin"],
        help="Оригинальный дамп прошивки контроллера Brightway SZMC-ES-02664-LQ (125,371 байт)."
    )

    st.caption("ℹ️ Размер дампа: **125,371 байт**")
    
    st.divider()
    st.subheader("⚡ Готовые пресеты")
    preset = st.selectbox(
        "Выберите готовый профиль:",
        [
            "Пользовательский (ручная настройка)",
            "Городской комфорт (30 км/ч, Свободный накат)",
            "Максимум Sport (35 км/ч, Накат, 34A фазный)",
            "Дальнобойный Eco (25 км/ч, Мягкий старт, 20A)",
            "Заводской сток (25 км/ч, KERS включен)"
        ]
    )

    st.divider()
    st.markdown("### ⚠️ Безопасность (SWD)")
    st.warning("""
    **Заводской Bootloader проверяет подпись!**
    Не шейте этот файл через стандартный Bluetooth OTA. 
    Используйте программатор **ST-Link v2 / J-Link** через тестовые площадки **SWD** с предварительным полным дампом чипа.
    """)

# Apply Preset Defaults
preset_speed = 30
preset_drive = 22
preset_eco = 15
preset_kers = "Отключена полностью (Полный накат / Freewheel 0A)"
preset_phase = 28
preset_bat = 20
preset_start = 2.0

if preset == "Городской комфорт (30 км/ч, Свободный накат)":
    preset_speed = 30
    preset_drive = 22
    preset_eco = 16
    preset_kers = "Отключена полностью (Полный накат / Freewheel 0A)"
    preset_phase = 28
    preset_bat = 20
    preset_start = 2.0
elif preset == "Максимум Sport (35 км/ч, Накат, 34A фазный)":
    preset_speed = 35
    preset_drive = 28
    preset_eco = 20
    preset_kers = "Отключена полностью (Полный накат / Freewheel 0A)"
    preset_phase = 34
    preset_bat = 24
    preset_start = 0.0
elif preset == "Дальнобойный Eco (25 км/ч, Мягкий старт, 20A)":
    preset_speed = 25
    preset_drive = 20
    preset_eco = 15
    preset_kers = "Отключена полностью (Полный накат / Freewheel 0A)"
    preset_phase = 20
    preset_bat = 16
    preset_start = 3.0
elif preset == "Заводской сток (25 км/ч, KERS включен)":
    preset_speed = 25
    preset_drive = 20
    preset_eco = 15
    preset_kers = "Заводская (Stock 78 7B)"
    preset_phase = 25
    preset_bat = 18
    preset_start = 3.0

# ------------------------------------------------------------------------------
# MAIN TABS
# ------------------------------------------------------------------------------
tab_config, tab_patcher, tab_assembly, tab_flashing = st.tabs([
    "⚙️ 1. Конфигуратор параметров",
    "🛠️ 2. Сборка и патч прошивки",
    "🔬 3. Дизассемблер и смещения",
    "🔌 4. Инструкция по прошивке (ST-Link)"
])

# ------------------------------------------------------------------------------
# TAB 1: PARAMETERS CONFIGURATOR
# ------------------------------------------------------------------------------
with tab_config:
    st.markdown("### Настройка скоростных режимов и FOC контроллера")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown("#### 🚀 Скоростные лимиты (FLASH ROM 0x5C76)")
        sport_speed = st.slider(
            "Sport Mode (км/ч)", 
            min_value=20, max_value=45, value=preset_speed, step=1,
            help="Патч байта по смещению 0x5C76. В стоке: 25 км/ч (0x19 0x20)."
        )
        drive_speed = st.slider(
            "Drive Mode (км/ч)", 
            min_value=15, max_value=32, value=preset_drive, step=1
        )
        eco_speed = st.slider(
            "Eco Mode (км/ч)", 
            min_value=10, max_value=25, value=preset_eco, step=1
        )

        st.markdown("#### 🍃 Рекуперация KERS (FLASH ROM 0x5C9E)")
        kers_choice = st.radio(
            "Поведение мотора при сбросе газа:",
            [
                "Отключена полностью (Полный накат / Freewheel 0A)",
                "Слабая рекуперация (Weak 01 20)",
                "Заводская (Stock 78 7B)"
            ],
            index=0 if "Отключена" in preset_kers else (1 if "Слабая" in preset_kers else 2)
        )
        
    with col2:
        st.markdown("#### ⚡ Мощность и токи (FOC Шунты)")
        sport_phase_current = st.slider(
            "Фазный ток Sport (Ампер, крутящий момент):",
            min_value=15, max_value=40, value=preset_phase, step=1,
            help="Определяет динамику на низких оборотах и в гору."
        )
        battery_current = st.slider(
            "Максимальный ток батареи (Ампер):",
            min_value=12, max_value=28, value=preset_bat, step=1,
            help="Номинал BMS 5 Plus: 18-22A. 24A+ требует осторожности."
        )
        
        peak_power = battery_current * 42.0
        st.metric("Пиковая электрическая мощность", f"{peak_power:.0f} Вт", delta=f"{peak_power - 750:.0f} Вт от стока")

        st.markdown("#### 🦵 Старт с ноги и безопасность")
        start_speed = st.slider(
            "Порог активации акселератора (Kick-Start):",
            min_value=0.0, max_value=5.0, value=preset_start, step=0.5,
            help="0.0 км/ч = Zero-Start (старт курком с места без толчка)."
        )

# ------------------------------------------------------------------------------
# TAB 2: BINARY PATCHER & DOWNLOAD
# ------------------------------------------------------------------------------
with tab_patcher:
    st.markdown("### Применение патча и генерация модифицированного .bin")
    
    # Read binary
    firmware_bytes = None
    if uploaded_file is not None:
        firmware_bytes = bytearray(uploaded_file.read())
        st.success(f"Загружен пользовательский файл: `{uploaded_file.name}` ({len(firmware_bytes):,} байт)")
    elif os.path.exists("mcu_xiaomi.scooter.5plus.bin"):
        with open("mcu_xiaomi.scooter.5plus.bin", "rb") as f:
            firmware_bytes = bytearray(f.read())
        st.info("Используется локальный образ `mcu_xiaomi.scooter.5plus.bin`")
    else:
        st.warning("⚠️ Для генерации реального бинарника загрузите файл в боковой панели слева.")
        
    if firmware_bytes is not None:
        # Signature verification
        sig_ok = False
        if len(firmware_bytes) >= SPEED_SIG_OFFSET + len(EXPECTED_SPEED_SIG):
            actual_sig = firmware_bytes[SPEED_SIG_OFFSET:SPEED_SIG_OFFSET + len(EXPECTED_SPEED_SIG)]
            if actual_sig == EXPECTED_SPEED_SIG:
                sig_ok = True
                st.success("✅ Сигнатура Thumb-2 в блоке скорости подтверждена: `AB 49 78 7A 08 80`")
            else:
                st.error(f"❌ Сигнатура не совпадает: {actual_sig.hex()} != {EXPECTED_SPEED_SIG.hex()}")

        # Execute patching
        patched_bytes = bytearray(firmware_bytes)
        
        # Patch speed
        patched_bytes[SPEED_HOOK_OFFSET] = sport_speed
        patched_bytes[SPEED_HOOK_OFFSET + 1] = 0x20
        
        # Patch KERS
        is_kers_disabled = "Отключена" in kers_choice
        if is_kers_disabled:
            patched_bytes[KERS_HOOK_OFFSET] = 0x00
            patched_bytes[KERS_HOOK_OFFSET + 1] = 0x20
        elif "Слабая" in kers_choice:
            patched_bytes[KERS_HOOK_OFFSET] = 0x01
            patched_bytes[KERS_HOOK_OFFSET + 1] = 0x20

        # Calculations
        orig_sha = hashlib.sha256(firmware_bytes).hexdigest()
        new_sha = hashlib.sha256(patched_bytes).hexdigest()

        # Display Diff Table
        st.markdown("#### Карта байтовых изменений")
        diff_data = [
            {
                "Смещение": "0x00005C76",
                "Функция": "Sport Speed Limit",
                "Было (Stock)": "78 7A (LDRB r0, [r7, #9])",
                "Стало (Patched)": f"{sport_speed:02X} 20 (MOVS r0, #{sport_speed})"
            },
            {
                "Смещение": "0x00005C9E",
                "Функция": "KERS Freewheel Mode",
                "Было (Stock)": "78 7B (LDRB r0, [r7, #11])",
                "Стало (Patched)": "00 20 (MOVS r0, #0)" if is_kers_disabled else ("01 20 (MOVS r0, #1)" if "Слабая" in kers_choice else "78 7B (Stock)")
            }
        ]
        st.table(diff_data)

        # Hashes
        c_hash1, c_hash2 = st.columns(2)
        with c_hash1:
            st.text_input("SHA-256 Original", orig_sha, disabled=True)
        with c_hash2:
            st.text_input("SHA-256 Patched", new_sha, disabled=True)

        # Download Button
        kers_suffix = "_noKers" if is_kers_disabled else ""
        out_name = f"mcu_xiaomi.scooter.5plus_patched_{sport_speed}kmh{kers_suffix}.bin"
        
        st.download_button(
            label=f"📥 Скачать пропатченную прошивку ({out_name})",
            data=bytes(patched_bytes),
            file_name=out_name,
            mime="application/octet-stream",
            type="primary"
        )

# ------------------------------------------------------------------------------
# TAB 3: DISASSEMBLY & ARCHITECTURE
# ------------------------------------------------------------------------------
with tab_assembly:
    st.markdown("### Анализ ассемблерного кода ARM Thumb-2")
    st.markdown("""
    Контроллер **Brightway SZMC-ES-02664-LQ** построен на микроконтроллере семейства **ES32 (ARM Cortex-M4)**.
    Ограничитель скорости реализован в цикле регулятора FOC (Field-Oriented Control).
    """)

    st.code("""
; --- ОРИГИНАЛЬНЫЙ КОД ОГРАНИЧИТЕЛЯ СКОРОСТИ ---
0x08005C74:  AB 49        LDR     r1, =0x20001840    ; Загрузка адреса контекста FOC
0x08005C76:  78 7A        LDRB    r0, [r7, #9]       ; <-- [БАЙТ 0x5C76] Чтение лимита скорости (25)
0x08005C78:  08 80        STRH    r0, [r1, #0]       ; Сохранение в регистр FOC
...
0x08005C8C:  4F F4 AE 70  MOV.W   r0, #0xAE          ; Коэффициент масштабирования (174 / 10 = 17.4)
0x08005C90:  FB FB 01 F0  MUL.W   r0, r11, r0        ; Масштабирование оборотов колеса к км/ч

; --- ПРОПАТЧЕННЫЙ КОД (НАПРИМЕР, 35 КМ/Ч) ---
0x08005C74:  AB 49        LDR     r1, =0x20001840
0x08005C76:  23 20        MOVS    r0, #35            ; <-- ПРЯМАЯ ИНЪЕКЦИЯ КОНСТАНТЫ 35 КМ/Ч
0x08005C78:  08 80        STRH    r0, [r1, #0]
    """, language="arm")

# ------------------------------------------------------------------------------
# TAB 4: FLASHING INSTRUCTIONS & HARDWARE
# ------------------------------------------------------------------------------
with tab_flashing:
    st.markdown("### 🔌 Аппаратная прошивка через SWD (ST-Link v2 / OpenOCD)")
    
    st.markdown("""
    #### Распиновка тестовых пятаков на плате контроллера:
    1. **SWCLK** — Синхронизация отладчика (Clock)
    2. **SWDIO** — Двунаправленная линия данных (Data I/O)
    3. **GND** — Земля (ОБЯЗАТЕЛЬНО соединить с GND программатора)
    4. **3.3V / VCC** — Питание логики (или включить контроллер штатно)
    """)

    st.markdown("#### Команда создания полного бэкапа (OpenOCD):")
    st.code("openocd -f interface/stlink.cfg -f target/stm32f1x.cfg -c 'init; reset halt; dump_image backup_full.bin 0x08000000 0x20000; exit'", language="bash")

    st.markdown("#### Команда записи пропатченного бинарника:")
    st.code("openocd -f interface/stlink.cfg -f target/stm32f1x.cfg -c 'init; reset halt; flash write_image erase mcu_patched.bin 0x08000000; reset run; exit'", language="bash")
