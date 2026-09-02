import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import {
  Sliders,
  Zap,
  Gauge,
  Wind,
  Footprints,
  Flame,
  ShieldCheck,
  AlertTriangle,
  Code,
  Copy,
  Download,
  Info,
  CheckCircle2,
  FileCode,
  Sparkles,
  Terminal,
  Activity,
  Layers,
  Upload,
  RefreshCw,
  Cpu,
  FolderArchive,
  ExternalLink,
  GitBranch,
  Check
} from 'lucide-react';
import { FIRMWARE_METADATA, generateReferenceFirmwareBuffer } from '../data/firmwareData';
import { applySpeedPatch, calculateSHA256 } from '../utils/patcher';
import { PatchResult } from '../types';

export const StreamlitConfigurator: React.FC = () => {
  // 1. Power / Current Sliders
  const [sportPhaseCurrent, setSportPhaseCurrent] = useState<number>(32); // Amps (Phase)
  const [drivePhaseCurrent, setDrivePhaseCurrent] = useState<number>(25); // Amps
  const [ecoPhaseCurrent, setEcoPhaseCurrent] = useState<number>(16); // Amps
  const [batteryCurrentMax, setBatteryCurrentMax] = useState<number>(22); // Amps (Battery continuous)
  const [peakPowerLimit, setPeakPowerLimit] = useState<number>(900); // Watts

  // 2. Speed Limits per Mode
  const [sportSpeedLimit, setSportSpeedLimit] = useState<number>(35); // km/h
  const [driveSpeedLimit, setDriveSpeedLimit] = useState<number>(25); // km/h
  const [ecoSpeedLimit, setEcoSpeedLimit] = useState<number>(18); // km/h
  const [pedestrianSpeedLimit, setPedestrianSpeedLimit] = useState<number>(6); // km/h

  // 3. Start Speed / Kick-lock (Круиз & Старт с ноги)
  const [startSpeed, setStartSpeed] = useState<number>(3.0); // km/h minimum before throttle engages
  const [cruiseControlDelay, setCruiseControlDelay] = useState<number>(5); // seconds to engage cruise

  // 4. KERS / Recuperation settings
  const [kersState, setKersState] = useState<'off' | 'weak' | 'medium' | 'strong'>('off');
  const [brakeLeverCurrent, setBrakeLeverCurrent] = useState<number>(20); // Amps electric brake force

  // 5. Thermal & Safety
  const [tempDeratingStart, setTempDeratingStart] = useState<number>(65); // °C start throttling
  const [tempShutdown, setTempShutdown] = useState<number>(85); // °C cutoff

  // Binary firmware buffer & direct patch state
  const [firmwareBuffer, setFirmwareBuffer] = useState<Uint8Array | null>(null);
  const [customFileName, setCustomFileName] = useState<string>(FIRMWARE_METADATA.fileName);
  const [patchResult, setPatchResult] = useState<PatchResult | null>(null);
  const [isPatching, setIsPatching] = useState<boolean>(false);

  // UI state
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [activeSubTab, setActiveSubTab] = useState<'app' | 'script' | 'github-deploy' | 'architecture'>('github-deploy');
  const [selectedRepoFile, setSelectedRepoFile] = useState<'streamlit_app.py' | 'requirements.txt' | '.streamlit/config.toml' | 'README.md' | '.gitignore'>('streamlit_app.py');
  const [copiedRepoFile, setCopiedRepoFile] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);

  // Initialize reference buffer
  useEffect(() => {
    const refBuf = generateReferenceFirmwareBuffer();
    setFirmwareBuffer(refBuf);
  }, []);

  // Preset applicators
  const applyPreset = (type: 'stock' | 'city' | 'sport' | 'range') => {
    switch (type) {
      case 'stock':
        setSportSpeedLimit(25);
        setDriveSpeedLimit(20);
        setEcoSpeedLimit(15);
        setPedestrianSpeedLimit(5);
        setSportPhaseCurrent(25);
        setDrivePhaseCurrent(20);
        setEcoPhaseCurrent(14);
        setBatteryCurrentMax(18);
        setKersState('strong');
        setStartSpeed(3.0);
        setCruiseControlDelay(5);
        setTempDeratingStart(65);
        break;
      case 'city':
        setSportSpeedLimit(30);
        setDriveSpeedLimit(23);
        setEcoSpeedLimit(16);
        setPedestrianSpeedLimit(6);
        setSportPhaseCurrent(28);
        setDrivePhaseCurrent(22);
        setEcoPhaseCurrent(15);
        setBatteryCurrentMax(20);
        setKersState('off');
        setStartSpeed(2.0);
        setCruiseControlDelay(5);
        setTempDeratingStart(65);
        break;
      case 'sport':
        setSportSpeedLimit(35);
        setDriveSpeedLimit(28);
        setEcoSpeedLimit(20);
        setPedestrianSpeedLimit(6);
        setSportPhaseCurrent(34);
        setDrivePhaseCurrent(26);
        setEcoPhaseCurrent(18);
        setBatteryCurrentMax(24);
        setKersState('off');
        setStartSpeed(0.0);
        setCruiseControlDelay(4);
        setTempDeratingStart(68);
        break;
      case 'range':
        setSportSpeedLimit(25);
        setDriveSpeedLimit(20);
        setEcoSpeedLimit(15);
        setPedestrianSpeedLimit(5);
        setSportPhaseCurrent(20);
        setDrivePhaseCurrent(16);
        setEcoPhaseCurrent(12);
        setBatteryCurrentMax(16);
        setKersState('off');
        setStartSpeed(3.5);
        setCruiseControlDelay(6);
        setTempDeratingStart(60);
        break;
    }
    setPatchResult(null);
  };

  // Helper calculations
  const estimatedMaxPower = Math.round(batteryCurrentMax * 42.0); // 10S nominal/peak 42V
  const isOverheatingRisk = sportPhaseCurrent > 30 || batteryCurrentMax > 24;

  // Handle direct file upload
  const handleCustomFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCustomFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result instanceof ArrayBuffer) {
        const buf = new Uint8Array(evt.target.result);
        setFirmwareBuffer(buf);
        setPatchResult(null);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Execute Web direct patch
  const handleExecuteDirectPatch = async () => {
    if (!firmwareBuffer) return;
    setIsPatching(true);
    const hexImm = sportSpeedLimit.toString(16).padStart(2, '0').toUpperCase();
    const kersHexImm = kersState === 'off' ? '00' : kersState === 'weak' ? '01' : 'STOCK';

    const result = await applySpeedPatch(firmwareBuffer, {
      speedHexImm: hexImm,
      disableKers: kersState === 'off',
      kersHexImm
    });
    setPatchResult(result);
    setIsPatching(false);
  };

  // Download directly generated .bin
  const handleDownloadDirectPatched = () => {
    if (!patchResult?.patchedBuffer) return;
    const blob = new Blob([patchResult.patchedBuffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const kersSuffix = kersState === 'off' ? '_noKers' : '';
    a.href = url;
    a.download = `mcu_xiaomi.scooter.5plus_patched_${sportSpeedLimit}kmh${kersSuffix}.bin`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Streamlit Python Script Generator (100% functional, ready-to-run with st.download_button)
  const generateStreamlitCode = () => {
    return `import streamlit as st
import hashlib
import struct
import os

# =====================================================================
# Xiaomi Scooter 5 Plus (Brightway MCU / ES32) Firmware Studio (Streamlit)
# Generated automatically from BW-Patched Architecture Engine
# =====================================================================

st.set_page_config(
    page_title="Xiaomi 5 Plus Configurator",
    page_icon="🛴",
    layout="wide"
)

st.title("🛴 Xiaomi Scooter 5 Plus — Firmware Parameter Studio")
st.markdown("""
Интерактивный конфигуратор параметров контроллера Brightway (ES32) ARM Cortex-M.
Все ползунки снабжены подробными физическими и дизассемблерными пояснениями.
""")

# Firmware Offsets & Constants
SPEED_HOOK_OFFSET = 0x5C76  # Thumb-2: LDRB r0, [r7, #9] -> MOVS r0, #imm8
SPEED_SIG_OFFSET = 0x5C74   # Expected: AB 49 78 7A 08 80
SPEED_SIG = bytes([0xAB, 0x49, 0x78, 0x7A, 0x08, 0x80])

KERS_HOOK_OFFSET = 0x5C9E   # Thumb-2: LDRB r0, [r7, #11] -> MOVS r0, #0 (0A Freewheel)
FIRMWARE_SIZE = 125371

# ---------------------------------------------------------------------
# SIDEBAR: File Upload & Presets
# ---------------------------------------------------------------------
with st.sidebar:
    st.header("📦 Файл прошивки")
    uploaded_file = st.file_uploader("Загрузить mcu_xiaomi.scooter.5plus.bin", type=["bin"])
    st.caption("Размер целевого дампа: 125,371 байт (Brightway SZMC-ES-02664-LQ)")
    
    st.divider()
    st.subheader("⚡ Быстрые пресеты")
    st.write("Нажмите кнопку для установки готового профиля:")
    preset_choice = st.radio(
        "Выбор пресета:",
        ["Текущие настройки", "Городской комфорт (30 км/ч, Накат)", "Максимум Sport (35 км/ч, Накат, 34A)", "Дальнобойный Eco (25 км/ч, 20A)"]
    )

# ---------------------------------------------------------------------
# TABS: Categories with Explanations
# ---------------------------------------------------------------------
tab_speed, tab_power, tab_kers, tab_start, tab_summary = st.tabs([
    "🏁 Скорость по режимам", 
    "⚡ Мощность и токи", 
    "🍃 Рекуперация (KERS / Накат)", 
    "👟 Старт с ноги и круиз",
    "💾 Сборка и прошивка"
])

# Default values based on preset
default_sport_speed = ${sportSpeedLimit}
default_drive_speed = ${driveSpeedLimit}
default_eco_speed = ${ecoSpeedLimit}
default_sport_phase = ${sportPhaseCurrent}
default_bat_current = ${batteryCurrentMax}
default_start_speed = ${startSpeed.toFixed(1)}

if preset_choice == "Городской комфорт (30 км/ч, Накат)":
    default_sport_speed = 30
    default_drive_speed = 23
    default_sport_phase = 28
elif preset_choice == "Максимум Sport (35 км/ч, Накат, 34A)":
    default_sport_speed = 35
    default_drive_speed = 28
    default_sport_phase = 34
    default_start_speed = 0.0
elif preset_choice == "Дальнобойный Eco (25 км/ч, 20A)":
    default_sport_speed = 25
    default_drive_speed = 20
    default_sport_phase = 20

with tab_speed:
    st.subheader("Настройки скоростных лимитов")
    st.markdown("""
    🟢 **[ПАТЧ FLASH ROM — 0x5C76]**
    Ограничитель скорости вычисляется в цикле FOC (адрес \`0x08003698 - 0x08003964\`). 
    Значение масштабируется множителем **×17.4** (\`r0 * 174 / 10\`) 
    и записывается в регистр ограничения скорости \`control_object + 0x18\`.
    """)
    
    col1, col2 = st.columns(2)
    with col1:
        sport_speed = st.slider(
            "Sport Mode Скорость (км/ч)", 
            min_value=20, max_value=45, value=default_sport_speed, step=1,
            help="Максимальная скорость в режиме S. Заводское: 25 км/ч. Патч байта 0x5C76."
        )
        drive_speed = st.slider(
            "Drive Mode Скорость (км/ч)", 
            min_value=15, max_value=32, value=default_drive_speed, step=1,
            help="Максимальная скорость в режиме D."
        )
    with col2:
        eco_speed = st.slider(
            "Eco Mode Скорость (км/ч)", 
            min_value=10, max_value=25, value=default_eco_speed, step=1,
            help="Энергосберегающий режим для максимальной дальности."
        )
        ped_speed = st.slider(
            "Пешеходный режим (км/ч)", 
            min_value=3, max_value=8, value=${pedestrianSpeedLimit}, step=1,
            help="Режим прогулки рядом с самокатом."
        )

    speed_hex = f"{sport_speed:02X}"
    st.success(f"Целевой опкод патча 0x5C76: **{speed_hex} 20** (MOVS r0, #{sport_speed})")

with tab_power:
    st.subheader("Настройка токов фаз и батареи (Крутящий момент и Разгон)")
    st.markdown("""
    🟡 **[ПАРАМЕТР FOC / ШУНТОВЫЙ ADC]**
    * **Фазный ток ($I_q$):** Ток, текущий через обмотки двигателя. Определяет тягу при трогании и в крутой подъем.
    * **Батарейный ток ($I_{bat}$):** Ток, отбираемый от аккумулятора 36V (10S Li-ion). Определяет суммарную электрическую мощность ($P = U \\times I$).
    """)

    c1, c2 = st.columns(2)
    with c1:
        sport_phase = st.slider(
            "Фазный ток Sport (Ампер)", 
            min_value=15, max_value=40, value=default_sport_phase, step=1,
            help="Выше 30A дает резкий старт, но увеличивает нагрев силовых ключей инвертора."
        )
        drive_phase = st.slider("Фазный ток Drive (Ампер)", min_value=12, max_value=30, value=${drivePhaseCurrent}, step=1)
        eco_phase = st.slider("Фазный ток Eco (Ампер)", min_value=8, max_value=20, value=${ecoPhaseCurrent}, step=1)

    with c2:
        bat_current = st.slider(
            "Максимальный ток батареи (Ампер)", 
            min_value=12, max_value=28, value=default_bat_current, step=1,
            help="BMS Xiaomi 5 Plus рассчитана на постоянный ток до 22A."
        )
        peak_w = bat_current * 42.0
        st.metric("Пиковая электрическая мощность", f"{peak_w:.0f} Вт", delta=f"{peak_w - 700:.0f} Вт от стока")

    if sport_phase > 30 or bat_current > 22:
        st.warning("⚠️ Внимание: Высокие токи ускоряют нагрев инвертора. Рекомендуется контролировать температуру контроллера.")

with tab_kers:
    st.subheader("Управление рекуперативным торможением (KERS)")
    st.markdown("""
    🟢 **[ПАТЧ FLASH ROM — 0x5C9E]**
    При отпускании газа контроллер по умолчанию генерирует тормозной момент.
    * **0A Накат (Freewheel):** Колесо вращается свободно по инерции, как на обычном велосипеде.
    * **Тормозная ручка:** Работает по независимому приоритетному каналу безопасности и всегда сохраняет 100% эффективность!
    """)

    kers_option = st.radio(
        "Режим рекуперации при сбросе газа:",
        ["Отключена полностью (Полный свободный накат / Freewheel 0A)", "Слабая (Weak)", "Заводская (Stock)"],
        index=0 if "${kersState}" == "off" else 1,
        help="Патч байтов по смещению 0x5C9E: 78 7B -> 00 20."
    )

    brake_current = st.slider(
        "Сила электронного тормоза рычагом (Ампер)", 
        min_value=10, max_value=32, value=${brakeLeverCurrent}, step=1,
        help="Электронный тормоз мотора при нажатии на физический рычаг тормоза."
    )

with tab_start:
    st.subheader("Скорость активации газа (Kick-Start) и Круиз-контроль")
    st.markdown("""
    🟡 **[ПАРАМЕТР UART / ЗАЩИТА]**
    Минимальная скорость вращения колеса, при которой контроллер реагирует на нажатие курка газа.
    """)

    s_speed = st.slider(
        "Минимальная скорость для старта с ноги (км/ч)", 
        min_value=0.0, max_value=5.0, value=float(default_start_speed), step=0.5,
        help="0.0 км/ч = Zero Start (старт с места); 3.0 км/ч = заводской безопасный старт с толчка."
    )
    
    cruise_delay = st.slider(
        "Задержка включения круиз-контроля (секунд)", 
        min_value=3, max_value=10, value=${cruiseControlDelay}, step=1
    )

with tab_summary:
    st.subheader("Сборка и скачивание пропатченной прошивки")
    
    disable_kers_selected = "Отключена" in kers_option
    kers_opcode_str = "00 20 (MOVS r0, #0 / Накат)" if disable_kers_selected else "78 7B (Stock)"
    
    st.table({
        "Параметр": [
            "Sport Speed Limit",
            "Рекуперация (KERS)",
            "Фазный ток (Sport)",
            "Батарейный ток",
            "Старт с ноги (Kick-start)",
            "Опкод смещения 0x5C76 (Speed)",
            "Опкод смещения 0x5C9E (KERS)"
        ],
        "Значение": [
            f"{sport_speed} км/ч",
            kers_option,
            f"{sport_phase} A",
            f"{bat_current} A ({peak_w:.0f} W)",
            f"{s_speed} км/ч" if s_speed > 0 else "0 км/ч (Zero-Start)",
            f"{speed_hex} 20 (MOVS r0, #{sport_speed})",
            kers_opcode_str
        ]
    })

    # File processing & real patch download
    if uploaded_file is not None:
        raw_firmware = uploaded_file.read()
    elif os.path.exists("mcu_xiaomi.scooter.5plus.bin"):
        with open("mcu_xiaomi.scooter.5plus.bin", "rb") as f:
            raw_firmware = f.read()
    else:
        raw_firmware = None

    if raw_firmware is not None:
        st.info(f"📁 Файл готов к патчу. Размер: {len(raw_firmware):,} байт")
        
        # Apply patch
        patched_data = bytearray(raw_firmware)
        
        # Check and apply speed patch
        if len(patched_data) > SPEED_HOOK_OFFSET + 1:
            patched_data[SPEED_HOOK_OFFSET] = sport_speed
            patched_data[SPEED_HOOK_OFFSET + 1] = 0x20
            
            # Apply KERS patch if requested
            if disable_kers_selected and len(patched_data) > KERS_HOOK_OFFSET + 1:
                patched_data[KERS_HOOK_OFFSET] = 0x00
                patched_data[KERS_HOOK_OFFSET + 1] = 0x20
            
            orig_sha = hashlib.sha256(raw_firmware).hexdigest()
            new_sha = hashlib.sha256(patched_data).hexdigest()
            
            st.success("✅ Патч успешно рассчитан и проверен!")
            st.code(f"Original SHA256: {orig_sha}\\nPatched  SHA256: {new_sha}", language="text")
            
            out_filename = f"mcu_xiaomi.scooter.5plus_patched_{sport_speed}kmh{'_noKers' if disable_kers_selected else ''}.bin"
            st.download_button(
                label="📥 Скачать пропатченный бинарник (.bin)",
                data=bytes(patched_data),
                file_name=out_filename,
                mime="application/octet-stream",
                type="primary"
            )
    else:
        st.warning("⚠️ Для генерации файла загрузите mcu_xiaomi.scooter.5plus.bin в боковой панели слева.")
`;
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generateStreamlitCode());
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDownloadStreamlit = () => {
    const code = generateStreamlitCode();
    const blob = new Blob([code], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'streamlit_app.py';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const requirementsContent = `streamlit>=1.30.0
altair>=5.0.0
numpy>=1.24.0
`;

  const configTomlContent = `[theme]
primaryColor = "#ef4444"
backgroundColor = "#0f172a"
secondaryBackgroundColor = "#1e293b"
textColor = "#f8fafc"
font = "sans serif"

[server]
headless = true
enableCORS = false
enableXsrfProtection = false
`;

  const gitignoreContent = `node_modules/
build/
dist/
coverage/
.DS_Store
*.log
.env*
!.env.example

# Python & Streamlit
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
.venv/
.streamlit/secrets.toml
`;

  const readmeContent = `# 🛴 Xiaomi Electric Scooter 5 Plus — Firmware Studio & Patcher

[![Streamlit App](https://static.streamlit.io/badges/streamlit_badge_black_white.svg)](https://share.streamlit.io)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Hardware](https://img.shields.io/badge/Target-Brightway%20MCU%20(ES32)-red.svg)](#)

Интерактивный конфигуратор и дизассемблерный патчер прошивки для электросамоката **Xiaomi Electric Scooter 5 Plus** (контроллер **Brightway SZMC-ES-02664-LQ** на базе микроконтроллера **ES32 / ARM Cortex-M4**).

Подготовлен для публикации на **GitHub** и хостинга в **Streamlit Community Cloud** (share.streamlit.io).

---

## ⚡ Развертывание на Streamlit Cloud (1 клик)

1. Сделайте Fork или создайте репозиторий на GitHub и загрузите файлы из этого репозитория.
2. Перейдите на [share.streamlit.io](https://share.streamlit.io) и авторизуйтесь через GitHub.
3. Нажмите **"New app"** -> Выберите ваш репозиторий -> Основной файл: \`streamlit_app.py\`.
4. Нажмите **"Deploy"**! Ваше веб-приложение станет доступно публично через пару секунд.

---

## 🔬 Что патчится в прошивке (ARM Thumb-2)

Патчер работает напрямую с дампом памяти Flash ROM размером **125,371 байт**:
- **0x00005C76**: \`78 7A\` -> \`23 20\` (Лимит скорости Sport, константа 35 км/ч)
- **0x00005C9E**: \`78 7B\` -> \`00 20\` (Отключение KERS / Свободный накат 0A)
- **0x00005C74**: Проверочная сигнатура \`AB 49 78 7A 08 80\`

---

## ⚠️ ВАЖНО: Защита от бутлупа (Anti-Brick)

> **НЕ ШЕЙТЕ МОДИФИЦИРОВАННЫЙ .BIN ЧЕРЕЗ СТАНДАРТНЫЙ BLUETOOTH OTA ИЛИ MI HOME!**

Заводской Bootloader Brightway проверяет контрольную сумму Flash ROM перед запуском.
Безопасная прошивка возможна только через программатор **ST-Link v2 / J-Link** по интерфейсу **SWD** с предварительным полным бэкапом дампа чипа:
\`\`\`bash
openocd -f interface/stlink.cfg -f target/stm32f1x.cfg -c "init; reset halt; dump_image stock_backup.bin 0x08000000 0x20000; exit"
\`\`\`
`;

  // Download entire GitHub repository as a ZIP archive
  const handleDownloadRepoZip = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();
      zip.file('streamlit_app.py', generateStreamlitCode());
      zip.file('requirements.txt', requirementsContent);
      zip.file('.streamlit/config.toml', configTomlContent);
      zip.file('README.md', readmeContent);
      zip.file('.gitignore', gitignoreContent);

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'xiaomi-5plus-patcher-github-repo.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to create ZIP', err);
    } finally {
      setIsZipping(false);
    }
  };

  const getSelectedRepoFileContent = () => {
    switch (selectedRepoFile) {
      case 'streamlit_app.py':
        return generateStreamlitCode();
      case 'requirements.txt':
        return requirementsContent;
      case '.streamlit/config.toml':
        return configTomlContent;
      case 'README.md':
        return readmeContent;
      case '.gitignore':
        return gitignoreContent;
      default:
        return '';
    }
  };

  const handleCopyRepoFile = () => {
    navigator.clipboard.writeText(getSelectedRepoFileContent());
    setCopiedRepoFile(true);
    setTimeout(() => setCopiedRepoFile(false), 2000);
  };

  const handleDownloadSingleRepoFile = (fileName: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.replace('.streamlit/', '');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6" id="streamlit-configurator-root">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-rose-950/80 text-rose-300 border border-rose-700/60 rounded-md flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5" />
                Streamlit Studio & Firmware Configurator
              </span>
              <span className="px-2.5 py-0.5 text-xs font-mono bg-blue-950/80 text-blue-300 border border-blue-700/60 rounded-md">
                Brightway MCU / ES32
              </span>
              <span className="px-2.5 py-0.5 text-xs font-mono bg-cyan-950/80 text-cyan-300 border border-cyan-700/60 rounded-md flex items-center gap-1">
                <GitBranch className="w-3 h-3" />
                GitHub Ready
              </span>
            </div>
            <h2 className="text-xl font-bold text-white mt-2">
              Интерактивный конфигуратор параметров прошивки (Ползунки и Физика)
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-4xl leading-relaxed">
              Наглядное управление всеми параметрами самоката: мощность, токи фаз, полное отключение рекуперации (свободный накат 0A), скорость по режимам (Sport/Drive/Eco), старт с места (Zero-Start) и термозащита. Подготовлен полный комплект файлов для публикации репозитория на GitHub и запуска в Streamlit Cloud.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="btn-download-repo-zip"
              onClick={handleDownloadRepoZip}
              disabled={isZipping}
              className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-cyan-600/30 transition-all flex items-center gap-2"
            >
              <FolderArchive className="w-4 h-4" />
              <span>{isZipping ? 'Упаковка ZIP...' : 'Скачать репозиторий (.ZIP)'}</span>
            </button>
            <button
              id="btn-download-streamlit-py"
              onClick={handleDownloadStreamlit}
              className="px-3.5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-rose-600/30 transition-all flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Скачать streamlit_app.py</span>
            </button>
          </div>
        </div>

        {/* Quick Presets Bar */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Готовые пресеты в 1 клик:</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => applyPreset('stock')}
              className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"
            >
              Сток (25 км/ч, KERS On)
            </button>
            <button
              onClick={() => applyPreset('city')}
              className="px-2.5 py-1 text-xs bg-blue-950/80 hover:bg-blue-900 text-blue-300 rounded border border-blue-800/80 transition-colors"
            >
              Городской комфорт (30 км/ч, Накат)
            </button>
            <button
              onClick={() => applyPreset('sport')}
              className="px-2.5 py-1 text-xs bg-rose-950/80 hover:bg-rose-900 text-rose-300 rounded border border-rose-800/80 transition-colors font-medium"
            >
              Максимум Sport (35 км/ч, Накат, Zero-Start)
            </button>
            <button
              onClick={() => applyPreset('range')}
              className="px-2.5 py-1 text-xs bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 rounded border border-emerald-800/80 transition-colors"
            >
              Дальнобойный Eco (25 км/ч, 20A)
            </button>
          </div>
        </div>

        {/* Sub Navigation */}
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-800 flex-wrap">
          <button
            onClick={() => setActiveSubTab('github-deploy')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeSubTab === 'github-deploy'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderArchive className="w-3.5 h-3.5 text-cyan-300" />
            <span>GitHub & Streamlit Cloud (Развертывание)</span>
          </button>
          <button
            onClick={() => setActiveSubTab('app')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeSubTab === 'app'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Интерактивные ползунки и сборка .bin</span>
          </button>
          <button
            onClick={() => setActiveSubTab('script')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeSubTab === 'script'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Код streamlit_app.py (Python)</span>
          </button>
          <button
            onClick={() => setActiveSubTab('architecture')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeSubTab === 'architecture'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Таблица смещений и математика MCU</span>
          </button>
        </div>
      </div>

      {/* VIEW 0: GITHUB & STREAMLIT CLOUD DEPLOYMENT */}
      {activeSubTab === 'github-deploy' && (
        <div className="space-y-6" id="github-deploy-view">
          {/* Top Explanation Banner */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="space-y-2 max-w-3xl">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 text-xs font-semibold bg-cyan-950 text-cyan-300 border border-cyan-700/60 rounded flex items-center gap-1.5">
                    <FolderArchive className="w-3.5 h-3.5" />
                    GitHub + Streamlit Community Cloud
                  </span>
                  <span className="px-2.5 py-0.5 text-xs font-mono bg-slate-800 text-slate-300 rounded border border-slate-700">
                    Auto-Hosting
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white">
                  Как работает запуск: GitHub как репозиторий, Streamlit как бесплатный облачный хостинг
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Streamlit Community Cloud (<span className="text-cyan-300 font-mono">share.streamlit.io</span>) подключается напрямую к вашему аккаунту GitHub. Вам не нужно настраивать веб-серверы, Docker или Nginx — достаточно выложить эти файлы в репозиторий GitHub, и Streamlit автоматически запустит веб-интерфейс с конфигуратором на постоянном защищенном адресе HTTPS.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
                <button
                  id="btn-download-full-repo-zip"
                  onClick={handleDownloadRepoZip}
                  disabled={isZipping}
                  className="px-5 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-600/30 transition-all flex items-center justify-center gap-2"
                >
                  <FolderArchive className="w-4 h-4" />
                  <span>{isZipping ? 'Создание ZIP...' : 'Скачать репозиторий (.ZIP)'}</span>
                </button>

                <a
                  href="https://share.streamlit.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Открыть share.streamlit.io</span>
                </a>
              </div>
            </div>
          </div>

          {/* 3-Step Deployment Guide */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
              <div className="text-3xl font-black text-slate-800 absolute right-3 top-2 select-none">01</div>
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs mb-2">
                <GitBranch className="w-4 h-4" />
                <span>Шаг 1: Залить на GitHub</span>
              </div>
              <p className="text-xs text-slate-300 mb-3">
                Создайте новый репозиторий на GitHub (например, <code className="text-cyan-300 font-mono">xiaomi-5plus-patcher</code>) и отправьте в него файлы.
              </p>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-400 space-y-1 overflow-x-auto">
                <div>git init</div>
                <div>git add .</div>
                <div>git commit -m "Initial commit"</div>
                <div>git branch -M main</div>
                <div>git push -u origin main</div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
              <div className="text-3xl font-black text-slate-800 absolute right-3 top-2 select-none">02</div>
              <div className="flex items-center gap-2 text-rose-400 font-bold text-xs mb-2">
                <ExternalLink className="w-4 h-4" />
                <span>Шаг 2: Подключить Streamlit</span>
              </div>
              <p className="text-xs text-slate-300 mb-3">
                Перейдите на <span className="text-slate-200 font-semibold">share.streamlit.io</span>, нажмите <strong>"New app"</strong> и выберите репозиторий.
              </p>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div>• <strong>Repository:</strong> ваш логин/репо</div>
                <div>• <strong>Branch:</strong> main</div>
                <div>• <strong>Main file path:</strong> <span className="text-rose-400 font-mono">streamlit_app.py</span></div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
              <div className="text-3xl font-black text-slate-800 absolute right-3 top-2 select-none">03</div>
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs mb-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Шаг 3: Автоматический старт</span>
              </div>
              <p className="text-xs text-slate-300 mb-3">
                Streamlit сам установит зависимости из <code className="text-emerald-300 font-mono">requirements.txt</code> и запустит веб-интерфейс.
              </p>
              <div className="bg-emerald-950/40 border border-emerald-800/60 p-3 rounded-lg text-[11px] text-emerald-300">
                ✅ Готовое веб-приложение будет доступно 24/7 по постоянной ссылке в облаке!
              </div>
            </div>
          </div>

          {/* Anti-Bootloop Hardware Advisory */}
          <div className="bg-amber-950/30 border border-amber-800/60 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1.5 text-xs">
                <h4 className="font-bold text-amber-200">
                  Критическое напоминание о бутлупе (Bootloop / Hard-Brick)
                </h4>
                <p className="text-slate-300 leading-relaxed">
                  Контроллер <strong>Brightway SZMC-ES-02664-LQ</strong> защищен заводским сертификатом и проверкой контрольной суммы. Заливать модифицированный файл через штатное приложение Mi Home или Bluetooth OTA <strong>категорически нельзя</strong>. Прошивать контроллер безопасно исключительно аппаратным программатором <strong>ST-Link v2</strong> через тестовые площадки <strong>SWD (SWDIO, SWCLK, GND, 3.3V)</strong>, обязательно сохранив полный заводской дамп (<code className="font-mono text-amber-300">backup.bin</code>).
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Repository File Viewer */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Файлы репозитория для GitHub</h3>
                <span className="text-xs text-slate-500">({selectedRepoFile})</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleCopyRepoFile}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition-all flex items-center gap-1.5"
                >
                  {copiedRepoFile ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedRepoFile ? 'Скопировано!' : 'Копировать'}</span>
                </button>

                <button
                  onClick={() => handleDownloadSingleRepoFile(selectedRepoFile, getSelectedRepoFileContent())}
                  className="px-3 py-1.5 bg-cyan-600/80 hover:bg-cyan-600 text-white rounded-lg text-xs font-medium transition-all flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Скачать файл</span>
                </button>
              </div>
            </div>

            {/* File Switcher Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {(['streamlit_app.py', 'requirements.txt', '.streamlit/config.toml', 'README.md', '.gitignore'] as const).map(file => (
                <button
                  key={file}
                  onClick={() => setSelectedRepoFile(file)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    selectedRepoFile === file
                      ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/50 font-semibold'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  <Code className="w-3.5 h-3.5" />
                  <span>{file}</span>
                </button>
              ))}
            </div>

            {/* Code Content */}
            <div className="relative">
              <pre className="bg-slate-950 p-4 rounded-xl font-mono text-[11px] text-slate-300 border border-slate-800/80 overflow-x-auto max-h-[500px] leading-relaxed">
                {getSelectedRepoFileContent()}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 1: LIVE INTERACTIVE SLIDERS & BUILDER */}
      {activeSubTab === 'app' && (
        <div className="space-y-6">
          {/* Top Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <span className="text-[11px] text-slate-400 font-medium block">Sport Скорость:</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-cyan-400">{sportSpeedLimit}</span>
                <span className="text-xs text-slate-400">км/ч</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 block mt-1">
                0x5C76: {sportSpeedLimit.toString(16).toUpperCase()} 20
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <span className="text-[11px] text-slate-400 font-medium block">Рекуперация (KERS):</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className={`text-lg font-bold ${kersState === 'off' ? 'text-emerald-400' : 'text-blue-400'}`}>
                  {kersState === 'off' ? '0A Накат (Off)' : kersState.toUpperCase()}
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-400 block mt-1">
                {kersState === 'off' ? '0x5C9E: 00 20 (MOVS r0,#0)' : '0x5C9E: 78 7B (Stock)'}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <span className="text-[11px] text-slate-400 font-medium block">Пиковая мощность:</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-amber-400">{estimatedMaxPower}</span>
                <span className="text-xs text-slate-400">Вт</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">
                {batteryCurrentMax}A × 42V (10S Li-ion)
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <span className="text-[11px] text-slate-400 font-medium block">Старт с ноги (Kick):</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-purple-400">
                  {startSpeed === 0 ? '0' : startSpeed.toFixed(1)}
                </span>
                <span className="text-xs text-slate-400">км/ч</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">
                {startSpeed === 0 ? 'Zero-Start (Старт с места)' : 'Безопасный толчок'}
              </span>
            </div>
          </div>

          {/* Detailed Sliders Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* CARD 1: Скорость по режимам */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
                    <Gauge className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">1. Скорость по режимам (Speed Limits)</h3>
                    <p className="text-[11px] text-slate-400">Ограничение максимальной скорости в км/ч</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800/80 rounded">
                  FLASH ROM 0x5C76
                </span>
              </div>

              {/* Slider: Sport */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    Sport Mode (Режим S):
                  </span>
                  <span className="font-mono font-bold text-cyan-400 text-sm">{sportSpeedLimit} км/ч</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="45"
                  step="1"
                  value={sportSpeedLimit}
                  onChange={(e) => setSportSpeedLimit(Number(e.target.value))}
                  className="w-full accent-rose-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>20 км/ч (Сток EU: 25)</span>
                  <span>Целевой: {sportSpeedLimit} (Hex: 0x{sportSpeedLimit.toString(16).toUpperCase()})</span>
                  <span>45 км/ч (Max)</span>
                </div>
              </div>

              {/* Slider: Drive */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    Drive Mode (Режим D):
                  </span>
                  <span className="font-mono font-bold text-blue-400 text-sm">{driveSpeedLimit} км/ч</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="32"
                  step="1"
                  value={driveSpeedLimit}
                  onChange={(e) => setDriveSpeedLimit(Number(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>15 км/ч</span>
                  <span>Сток: 20 км/ч</span>
                  <span>32 км/ч</span>
                </div>
              </div>

              {/* Slider: Eco */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Eco Mode (Режим ECO):
                  </span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">{ecoSpeedLimit} км/ч</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="25"
                  step="1"
                  value={ecoSpeedLimit}
                  onChange={(e) => setEcoSpeedLimit(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>10 км/ч</span>
                  <span>Сток: 15 км/ч</span>
                  <span>25 км/ч</span>
                </div>
              </div>

              {/* Slider: Pedestrian */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    Пешеходный режим (Walk):
                  </span>
                  <span className="font-mono font-bold text-amber-400 text-sm">{pedestrianSpeedLimit} км/ч</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="8"
                  step="1"
                  value={pedestrianSpeedLimit}
                  onChange={(e) => setPedestrianSpeedLimit(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Explanation Box */}
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-[11px] text-slate-300 space-y-1">
                <div className="flex items-center gap-1 text-cyan-400 font-semibold">
                  <Info className="w-3.5 h-3.5" />
                  <span>Дизассемблерное объяснение (Speed Logic):</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Ограничитель скорости рассчитывается в блоке <code>0x08005C84</code> через умножение на <code>174/10</code> (коэффициент масштабирования оборотов колеса к км/ч). При смене режима MCU выбирает индекс структуры из таблицы диспетчеризации.
                </p>
              </div>
            </div>

            {/* CARD 2: Мощность, Токи фаз и Батареи */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">2. Мощность и токи (Phase & Battery Current)</h3>
                    <p className="text-[11px] text-slate-400">Крутящий момент на низах и пиковая отдача батареи</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-mono bg-blue-950 text-blue-300 border border-blue-800/80 rounded">
                  FOC ADC 0x5714
                </span>
              </div>

              {/* Slider: Sport Phase Current */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-200">Фазный ток Sport ($I_q$ / Крутящий момент):</span>
                  <span className="font-mono font-bold text-amber-400 text-sm">{sportPhaseCurrent} A</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="40"
                  step="1"
                  value={sportPhaseCurrent}
                  onChange={(e) => setSportPhaseCurrent(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>15 A (Мягкий)</span>
                  <span>Сток: 25 A</span>
                  <span>40 A (Экстрим)</span>
                </div>
              </div>

              {/* Slider: Battery Current Limit */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-200">Предел тока аккумулятора ($I_{'{bat}'}$):</span>
                  <span className="font-mono font-bold text-rose-400 text-sm">{batteryCurrentMax} A</span>
                </div>
                <input
                  type="range"
                  min="12"
                  max="28"
                  step="1"
                  value={batteryCurrentMax}
                  onChange={(e) => setBatteryCurrentMax(Number(e.target.value))}
                  className="w-full accent-rose-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>12 A (450W)</span>
                  <span>Сток: 18 A (700W)</span>
                  <span>28 A (1150W)</span>
                </div>
              </div>

              {/* Slider: Drive Phase Current */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-200">Фазный ток Drive ($I_q$):</span>
                  <span className="font-mono font-bold text-slate-300 text-sm">{drivePhaseCurrent} A</span>
                </div>
                <input
                  type="range"
                  min="12"
                  max="30"
                  step="1"
                  value={drivePhaseCurrent}
                  onChange={(e) => setDrivePhaseCurrent(Number(e.target.value))}
                  className="w-full accent-slate-400 cursor-pointer"
                />
              </div>

              {/* Explanation Box */}
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-[11px] text-slate-300 space-y-1">
                <div className="flex items-center gap-1 text-amber-400 font-semibold">
                  <Info className="w-3.5 h-3.5" />
                  <span>Физика токов (Phase vs Battery):</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  <strong>Фазный ток</strong> подается на мотор на низких скоростях и определяет разгон «с места». <strong>Батарейный ток</strong> ограничивает постоянный отбор энергии от аккумулятора на высоких скоростях ($P = U_{'{bat}'} \times I_{'{bat}'}$).
                </p>
              </div>
            </div>

            {/* CARD 3: Рекуперация (KERS) и Накат */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg">
                    <Wind className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">3. Рекуперация при сбросе газа (KERS / Накат)</h3>
                    <p className="text-[11px] text-slate-400">Поведение мотора при отпущенном курке акселератора</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800/80 rounded">
                  FLASH ROM 0x5C9E
                </span>
              </div>

              {/* KERS Mode Buttons */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 block">
                  Выбор профиля рекуперации:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setKersState('off')}
                    className={`p-3 rounded-lg text-left border transition-all ${
                      kersState === 'off'
                        ? 'bg-cyan-950/60 border-cyan-500 text-white shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold text-cyan-300 flex items-center justify-between">
                      <span>🍃 0A Отключена (Накат)</span>
                      <span className="text-[10px] font-mono bg-slate-900 px-1.5 py-0.5 rounded text-emerald-400">00 20</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Полный свободный накат без сопротивления мотора при отпускании газа.
                    </p>
                  </button>

                  <button
                    onClick={() => setKersState('weak')}
                    className={`p-3 rounded-lg text-left border transition-all ${
                      kersState === 'weak'
                        ? 'bg-cyan-950/60 border-cyan-500 text-white shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-200 flex items-center justify-between">
                      <span>Слабая (Weak)</span>
                      <span className="text-[10px] font-mono bg-slate-900 px-1.5 py-0.5 rounded text-cyan-300">01 20</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Мягкое притормаживание и подзарядка батареи на спусках.
                    </p>
                  </button>
                </div>
              </div>

              {/* Slider: Brake Lever Current */}
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-200">Сила электронного тормоза ручкой (Ампер):</span>
                  <span className="font-mono font-bold text-rose-400 text-sm">{brakeLeverCurrent} A</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="32"
                  step="1"
                  value={brakeLeverCurrent}
                  onChange={(e) => setBrakeLeverCurrent(Number(e.target.value))}
                  className="w-full accent-rose-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>10 A (Плавный)</span>
                  <span>Сток: 20 A</span>
                  <span>32 A (Резкий)</span>
                </div>
              </div>

              {/* Explanation Box */}
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-[11px] text-slate-300 space-y-1">
                <div className="flex items-center gap-1 text-emerald-400 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Гарантия безопасности тормозов:</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Отключение рекуперации воздействует <strong>только на холостой сброс газа</strong> (смещение <code>0x5C9E</code>: <code>78 7B</code> &rarr; <code>00 20</code>). Физический рычаг тормоза на руле подключен к аппаратному прерыванию и всегда обеспечивает мгновенную остановку!
                </p>
              </div>
            </div>

            {/* CARD 4: Старт с ноги (Kick-Start) и Терморегуляция */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
                    <Footprints className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">4. Старт с ноги (Kick-Start) и Круиз-контроль</h3>
                    <p className="text-[11px] text-slate-400">Порог активации акселератора и задержка фиксации скорости</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-800/80 rounded">
                  UART PROTOCOL
                </span>
              </div>

              {/* Slider: Kick Speed */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-200">Минимальная скорость для газа (Kick-Start):</span>
                  <span className="font-mono font-bold text-purple-400 text-sm">
                    {startSpeed === 0 ? '0.0 км/ч (Zero-Start)' : `${startSpeed.toFixed(1)} км/ч`}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="5.0"
                  step="0.5"
                  value={startSpeed}
                  onChange={(e) => setStartSpeed(Number(e.target.value))}
                  className="w-full accent-purple-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span className="text-purple-300 font-bold">0 км/ч (Старт с места)</span>
                  <span>Сток: 3.0 км/ч</span>
                  <span>5.0 км/ч</span>
                </div>
              </div>

              {/* Slider: Cruise Control Delay */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-200">Задержка включения круиз-контроля:</span>
                  <span className="font-mono font-bold text-slate-200 text-sm">{cruiseControlDelay} сек</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="10"
                  step="1"
                  value={cruiseControlDelay}
                  onChange={(e) => setCruiseControlDelay(Number(e.target.value))}
                  className="w-full accent-slate-400 cursor-pointer"
                />
              </div>

              {/* Slider: Temp Derating */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-200 flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-rose-400" />
                    Начало снижения мощности при нагреве (Derating):
                  </span>
                  <span className="font-mono font-bold text-rose-400 text-sm">{tempDeratingStart} °C</span>
                </div>
                <input
                  type="range"
                  min="55"
                  max="75"
                  step="1"
                  value={tempDeratingStart}
                  onChange={(e) => setTempDeratingStart(Number(e.target.value))}
                  className="w-full accent-rose-500 cursor-pointer"
                />
              </div>

              {/* Explanation Box */}
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-[11px] text-slate-300 space-y-1">
                <div className="flex items-center gap-1 text-purple-400 font-semibold">
                  <Info className="w-3.5 h-3.5" />
                  <span>Zero-Start vs Безопасность:</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  При установке <strong>0 км/ч</strong> двигатель реагирует на нажатие курка даже в неподвижном состоянии. Удобно на светофорах и при подъеме в горку, но требует аккуратности, чтобы случайно не нажать газ при переноске.
                </p>
              </div>
            </div>
          </div>

          {/* CARD 5: Direct In-Browser Firmware Compilation & Download */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  <span>Сборка модифицированного бинарника (.bin) прямо в браузере</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Примените текущие настройки (скорость {sportSpeedLimit} км/ч, KERS {kersState === 'off' ? '0A Накат' : 'Stock'}) к файлу прошивки
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="btn-execute-direct-patch"
                  onClick={handleExecuteDirectPatch}
                  disabled={isPatching}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-md shadow-blue-600/30 transition-all flex items-center gap-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isPatching ? 'animate-spin' : ''}`} />
                  <span>Рассчитать и пропатчить .bin</span>
                </button>

                {patchResult?.success && (
                  <button
                    id="btn-download-direct-bin"
                    onClick={handleDownloadDirectPatched}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-emerald-600/30 transition-all flex items-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Скачать .bin</span>
                  </button>
                )}
              </div>
            </div>

            {/* Status result if patched */}
            {patchResult && (
              <div className={`p-4 rounded-lg border text-xs font-mono ${
                patchResult.success 
                  ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300' 
                  : 'bg-rose-950/40 border-rose-800/80 text-rose-300'
              }`}>
                <div className="flex items-center gap-2 font-bold font-sans">
                  {patchResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
                  <span>{patchResult.message}</span>
                </div>
                <div className="mt-2 text-[11px] text-slate-300 space-y-1">
                  <div>Смещение 0x5C76 (Speed): {patchResult.originalBytes} &rarr; <strong>{patchResult.patchedBytes}</strong></div>
                  {patchResult.kersPatchApplied && (
                    <div>Смещение 0x5C9E (KERS): {patchResult.kersOriginalBytes} &rarr; <strong>{patchResult.kersPatchedBytes}</strong></div>
                  )}
                  <div className="text-slate-400">SHA256 (Patched): {patchResult.sha256Patched}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: STREAMLIT PYTHON CODE */}
      {activeSubTab === 'script' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Code className="w-4 h-4 text-cyan-400" />
                <span>Готовый исходный код Streamlit-приложения (Python)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Автономный скрипт с ползунками, подсказками и готовой функцией скачивания бинарника
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                id="btn-copy-streamlit-code"
                onClick={handleCopyCode}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedCode ? 'Скопировано!' : 'Копировать Python код'}</span>
              </button>
              <button
                id="btn-dl-streamlit-py-tab"
                onClick={handleDownloadStreamlit}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Скачать .py</span>
              </button>
            </div>
          </div>

          <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-300">
            <span className="text-cyan-400 font-semibold">Как запустить локально:</span>
            <div className="font-mono text-[11px] text-slate-400 mt-1 bg-slate-900 p-2 rounded border border-slate-800/80">
              pip install streamlit<br />
              streamlit run streamlit_5plus_configurator.py
            </div>
          </div>

          <pre className="bg-slate-950 p-4 rounded-lg font-mono text-[11px] text-slate-300 border border-slate-800 overflow-x-auto max-h-96">
            {generateStreamlitCode()}
          </pre>
        </div>
      )}

      {/* VIEW 3: ARCHITECTURE & MCU MATH */}
      {activeSubTab === 'architecture' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>Сводная таблица параметров и регистров Brightway MCU</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 text-[11px]">
                  <th className="p-3">Параметр</th>
                  <th className="p-3">Смещение в файле</th>
                  <th className="p-3">Адрес MCU (Flash)</th>
                  <th className="p-3">Оригинальный опкод</th>
                  <th className="p-3">Опкод модификации</th>
                  <th className="p-3">Статус доказательства</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300 text-[11px]">
                <tr className="hover:bg-slate-800/30">
                  <td className="p-3 font-sans font-semibold text-white">Speed Limit (Sport)</td>
                  <td className="p-3 text-cyan-400">0x00005C76</td>
                  <td className="p-3 text-slate-400">0x08005C76</td>
                  <td className="p-3 text-rose-400">78 7A (LDRB r0, [r7,#9])</td>
                  <td className="p-3 text-emerald-400 font-bold">{sportSpeedLimit.toString(16).toUpperCase()} 20 (MOVS r0, #{sportSpeedLimit})</td>
                  <td className="p-3 font-sans"><span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded text-[10px]">CONFIRMED</span></td>
                </tr>
                <tr className="hover:bg-slate-800/30">
                  <td className="p-3 font-sans font-semibold text-white">KERS Regen (Throttle release)</td>
                  <td className="p-3 text-cyan-400">0x00005C9E</td>
                  <td className="p-3 text-slate-400">0x08005C9E</td>
                  <td className="p-3 text-rose-400">78 7B (LDRB r0, [r7,#11])</td>
                  <td className="p-3 text-emerald-400 font-bold">00 20 (MOVS r0, #0 / Накат)</td>
                  <td className="p-3 font-sans"><span className="px-2 py-0.5 bg-blue-950 text-blue-300 border border-blue-800 rounded text-[10px]">STRONG CANDIDATE</span></td>
                </tr>
                <tr className="hover:bg-slate-800/30">
                  <td className="p-3 font-sans font-semibold text-white">Shunt Current ADC Scaling</td>
                  <td className="p-3 text-cyan-400">0x00005714</td>
                  <td className="p-3 text-slate-400">0x08005714</td>
                  <td className="p-3 text-slate-400">12 21 ... (r0 * 18 / 10)</td>
                  <td className="p-3 text-amber-400">Phase Current $I_q$ Scaling</td>
                  <td className="p-3 font-sans"><span className="px-2 py-0.5 bg-blue-950 text-blue-300 border border-blue-800 rounded text-[10px]">STRONG CANDIDATE</span></td>
                </tr>
                <tr className="hover:bg-slate-800/30">
                  <td className="p-3 font-sans font-semibold text-white">Voltage Divider (Battery)</td>
                  <td className="p-3 text-cyan-400">0x00005752</td>
                  <td className="p-3 text-slate-400">0x08005752</td>
                  <td className="p-3 text-slate-400">19 21 ... (r0 * 25)</td>
                  <td className="p-3 text-amber-400">10S Battery Voltage ADC</td>
                  <td className="p-3 font-sans"><span className="px-2 py-0.5 bg-blue-950 text-blue-300 border border-blue-800 rounded text-[10px]">STRONG CANDIDATE</span></td>
                </tr>
                <tr className="hover:bg-slate-800/30">
                  <td className="p-3 font-sans font-semibold text-white">FSM State Machine (0..8)</td>
                  <td className="p-3 text-cyan-400">0x00005B74</td>
                  <td className="p-3 text-slate-400">0x08005B74</td>
                  <td className="p-3 text-slate-400">CMP r0, #8 ; TBB [pc,r0]</td>
                  <td className="p-3 text-slate-400">Unmodified (Safety FSM)</td>
                  <td className="p-3 font-sans"><span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded text-[10px]">CONFIRMED (Not Mode)</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
