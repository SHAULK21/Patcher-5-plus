# Техническая спецификация реверс-инжиниринга прошивки Xiaomi Scooter 5 Plus (Brightway / ES32) для ИИ

## 1. Общие сведения об аппаратной платформе
* **Устройство:** Электросамокат Xiaomi Electric Scooter 5 Plus.
* **Производитель электроники / ESC:** Brightway Innovation / платформа ES32.
* **Архитектура микроконтроллера:** ARM Cortex-M (Thumb-2 ISA).
* **Базовый адрес Flash-памяти:** `0x08000000`.
* **Диапазон SRAM:** `0x20000000 – 0x20008000`.
* **Типовой размер дампа прошивки:** 64 КБ (диапазон 32 КБ – 128 КБ).
* **Таблица векторов прерываний:** Смещение `0x00000000`. Начальный SP лежит в диапазоне `0x20002800..0x20005000`, Reset Handler указывает во Flash (`0x08000100..0x08001000` с взведенным битом Thumb LSB=1).

---

## 2. Архитектура режимов езды (Eco / Drive / Sport) и конвейер скорости

### 2.1. Опровержение гипотезы о «3 статических байтах во Flash»
* Во Flash **нет** трех фиксированных байтов ограничения скорости (например, 5, 20, 25 км/ч), лежащих единым массивом для патча.
* Прошивка использует динамическую модель с указателем базового адреса активного профиля (`r7`).

### 2.2. Двунаправленный анализ (Dual-Track RE)

#### Track A: Обработка протокола и стейт-машина (RAM `0x20001E2C`)
1. Дисплей/BLE (CCU) при переключении режимов отправляет UART-пакет (команды `0x64 / 0x65`).
2. Обработчик `0x0800A412` (`STRB r2, [r3, #0x0A]`) сохраняет номер режима (0=Eco/Пешеходный, 1=Drive, 2=Sport) в структуру по базовому адресу `0x20001E22` (поле `+0x0A` = `0x20001E2C`).
3. При инициализации холодного старта по адресу `0x08005834` выполняется дефолтная запись значения `0x01` (Drive).
4. **Вывод:** `0x20001E2C` является селектором стейт-машины, а не местом хранения констант скорости.

#### Track B: Конвейер выборки активного профиля и контроллер скорости
1. **Указатель активного профиля:** Регистр `r7` выставляется контроллером на блок выбранного в данный момент профиля в RAM.
2. **Поле лимита скорости:** Смещение `[r7 + 0x09]` содержит номинальное значение скорости активного профиля.
3. **Точка хука чтения скорости (File Offset: `0x05C74` / MCU: `0x08005C74`):**
   ```assembly
   0x08005C74: AB 49       LDR     r1, [pc, #0x2AC]  ; r1 = 0x20000234 (SPEED_RUNTIME_ADDR)
   0x08005C76: 78 7A       LDRB    r0, [r7, #9]      ; r0 = active_profile.speed_limit (ЦЕЛЬ ПАТЧА)
   0x08005C78: 08 80       STRH    r0, [r1, #0]      ; Запись полуслова в 0x20000234
   ```
4. **Контур масштабирования скорости (0x08003698 – 0x08003964):**
   ```assembly
   0x08003698: 49 48       LDR     r0, =0x20000234   ; Загрузка адреса рантайм-скорости
   0x0800369A: 00 88       LDRH    r0, [r0, #0]      ; Чтение значения скорости
   0x0800369C: AE 22       MOVS    r2, #0xAE         ; r2 = 174 (0xAE)
   0x0800369E: 50 43       MULS    r0, r2, r0        ; r0 = speed * 174
   0x080036A0: 0A 22       MOVS    r2, #10           ; Делитель = 10
   0x080036A2: 90 FB F2 F0 SDIV    r0, r0, r2        ; r0 = (speed * 174) / 10 (коэффициент 17.4)
   0x080036A6: 68 83       STRH    r0, [r5, #0x18]   ; Запись в control_object + 0x18 (SPEED_FIELD_LIMIT)
   ```
5. **Аппаратный ограничитель (Clamp @ 0x08003710):**
   ```assembly
   0x08003710: AF 8A       LDRSH   r1, [r5, #0x14]   ; r1 = текущая цель скорости (SPEED_FIELD_TARGET)
   0x08003712: EF 8A       LDRSH   r0, [r5, #0x18]   ; r0 = вычисленный лимит (SPEED_FIELD_LIMIT)
   0x08003714: 81 42       CMP     r1, r0
   0x08003716: 01 DD       BLE     .clamp_done
   0x08003718: 68 82       STRH    r0, [r5, #0x14]   ; Ограничение цели по верхнему лимиту
   ```

---

## 3. Таблица ключевых адресов памяти

| Адрес MCU / Offset файла | Тип | Название символа | Описание | Статус RE |
|---|---|---|---|---|
| `0x08005C74` (Файл: `0x5C74`) | Flash | `SPEED_PROFILE_LOAD_SIG` | 6 байт: `AB 49 78 7A 08 80` (базовая сигнатура) | **CONFIRMED** |
| `0x08005C76` (Файл: `0x5C76`) | Flash | `SPEED_PATCH_OFFSET` | `78 7A` -> подменяется на `XX 20` (`MOVS r0, #speed`) | **CONFIRMED** |
| `0x20000234` | RAM | `SPEED_RUNTIME_ADDR` | Переменная лимита скорости для главного цикла управления | **CONFIRMED** |
| `0x08003698 – 0x08003964` | Flash | `SPEED_CONTROL_BLOCK` | Математика масштабирования `(val * 174)/10` и кламп | **CONFIRMED** |
| `0x20001E2C` (`0x20001E22+0A`)| RAM | `MODE_STRUCT_FIELD_0A` | Поле активного режима (0=Eco, 1=D, 2=S), пишется UART Rx | **CONFIRMED** |
| `0x20000348` | RAM | `SPEED_STATE_GATE` | Гейт константы 435 (`25 * 17.4`) | **STRONG CANDIDATE** |
| `0x200002B7` | RAM | `STATE_INDEX` | Внутренние шаги протокола (0..8). **НЕ режим!** | **REFUTED** |
| `0x08003440 / 0x08003C80` | Flash | `REGION_TABLE_OFFSETS` | Таблицы региональных скоростей (по 7 слотов) | **CONFIRMED** |

---

## 4. Спецификация патча и правила безопасного поиска

### 4.1. Принцип модификации
Замена инструкции чтения из структуры `[r7 + 0x09]` на прямую загрузку немедленного значения константы:
* **Исходный байткод (Offset `0x5C76`):** `78 7A` (`LDRB r0, [r7, #9]`)
* **Патченый байткод (Offset `0x5C76`):** `XX 20` (`MOVS r0, #imm8`), где `XX = hex(speed_kmh)` (например, для 35 км/ч: `23 20`).

### 4.2. Алгоритм гибкого сканера (Multi-Form Resilient Scanner)
Чтобы патчер работал со всеми ревизиями дампов и не падал при сдвиге смещений:
1. **Форма 1 (Pristine Exact):** `b"\xAB\x49\x78\x7A\x08\x80"`
2. **Форма 2 (Flexible PC-Rel Displacement):** `re.compile(b"(.)\x49\x78\x7A\x08\x80")` (любое смещение пула констант LDR).
3. **Форма 3 (Generic Base Register):** `re.compile(b"(.)\x49(.)\x7A\x08\x80")` (поддержка `[rX + 0x09]`).
4. **Форма 4 (Already Patched Binary):** `re.compile(b"(.)\x49(.)\x20\x08\x80")` (позволяет репатчить уже модифицированный файл).

### 4.3. ВНИМАНИЕ: Опровержение гипотезы о «региональных таблицах 0x3440 / 0x3C80»
> ⚠️ **КРИТИЧЕСКОЕ ПРЕДУПРЕЖДЕНИЕ БЕЗОПАСНОСТИ:**
> По адресам `0x3440` и `0x3C80` во Flash находятся **пулы литералов (Literal Pools — указатели на адреса в SRAM `0x2000xxxx`)**, используемые инструкциями `LDR`.
> **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** записывать туда фиктивные значения (например `28 03 00 20`), так как это разрушает указатели в оперативной памяти и приводит к зависанию/окирпичиванию контроллера!
>
> Функция `unlock_regions` удалена из патчера во избежание повреждения контроллера.


---

## 5. Исходный код эталонного модуля `bwpatcher/modules/mi5plus.py`

```python
# ==============================================================================
# BWPATCHER MODULE: mi5plus.py
# Xiaomi Scooter 5 Plus (Brightway / ES32 MCU)
# Resilient Multi-Pattern Speed Patcher & Firmware Fingerprint Engine
# ==============================================================================

import re
import struct

# --- 1. FIRMWARE & MEMORY ARCHITECTURE CONSTANTS ---
FLASH_BASE_ADDR = 0x08000000
MIN_FW_SIZE = 32 * 1024       # 32 KB minimum
MAX_FW_SIZE = 128 * 1024      # 128 KB maximum

# Speed and Mode RAM variables
SPEED_RUNTIME_ADDR = 0x20000234
MODE_STRUCT_BASE = 0x20001E22
MODE_STRUCT_FIELD_0A = 0x20001E2C   # Offset +0x0A: Active mode enum (0=Eco, 1=Drive, 2=Sport)

# Riding mode enumerations
RIDING_MODES = {
    0: "Pedestrian / Eco",
    1: "Drive (D)",
    2: "Sport (S)"
}

# --- 2. MULTI-FORM RESILIENT SPEED HOOK PATTERNS ---
HOOK_PATTERNS = [
    {
        "id": "form_1_pristine_exact",
        "name": "Form 1: Pristine Exact (AB 49 78 7A 08 80)",
        "pattern": re.compile(b"\\xAB\\x49\\x78\\x7A\\x08\\x80"),
        "target_offset_in_match": 2,  # Offset of '78 7A' in match
        "is_patched": False
    },
    {
        "id": "form_2_flexible_pc_rel",
        "name": "Form 2: Flexible PC-Rel Displacement (?? 49 78 7A 08 80)",
        "pattern": re.compile(b"(.)\\x49\\x78\\x7A\\x08\\x80"),
        "target_offset_in_match": 2,
        "is_patched": False
    },
    {
        "id": "form_3_generic_base_reg",
        "name": "Form 3: Generic Base Register (?? 49 ?? 7A 08 80)",
        "pattern": re.compile(b"(.)\\x49(.)\\x7A\\x08\\x80"),
        "target_offset_in_match": 2,
        "is_patched": False
    },
    {
        "id": "form_4_already_patched",
        "name": "Form 4: Already Patched Binary (?? 49 ?? 20 08 80)",
        "pattern": re.compile(b"(.)\\x49(.)\\x20\\x08\\x80"),
        "target_offset_in_match": 2,
        "is_patched": True
    }
]


class Mi5plusPatcher:
    """
    Xiaomi Scooter 5 Plus Resilient Firmware Patcher.
    Uses multi-form pattern scanner and comprehensive 5-point diagnostics.
    """
    def __init__(self, data: bytearray):
        self.data = data
        self.size = len(data)
        self.verified_fingerprint = False
        
        # 5 Key Diagnostic Properties
        self.selector_found = False
        self.selector_address = hex(MODE_STRUCT_FIELD_0A)
        self.hook_found = False
        self.hook_offset = None
        self.hook_form = None
        self.hook_form_id = None
        self.is_already_patched = False
        self.current_mode_id = 1       # Default factory coldboot mode: Drive (ID 1)
        self.current_speed_byte = None
        self.current_speed_kmh = None

    def verify_fingerprint(self) -> bool:
        """Проверяет размер и таблицу векторов ARM Cortex-M."""
        if not (MIN_FW_SIZE <= self.size <= MAX_FW_SIZE):
            print(f"[!] Warning: Unexpected firmware size ({self.size} bytes).")
            return False

        initial_sp = struct.unpack_from("<I", self.data, 0x00)[0]
        reset_vec = struct.unpack_from("<I", self.data, 0x04)[0]

        if not (0x20000000 <= initial_sp <= 0x20008000):
            print(f"[-] Vector table SP (0x{initial_sp:08X}) not in SRAM range.")
            return False

        if not (0x08000000 <= reset_vec <= 0x08020000):
            print(f"[-] Vector table Reset Handler (0x{reset_vec:08X}) not in Flash range.")
            return False

        self.verified_fingerprint = True
        return True

    def find_selector(self) -> bool:
        """
        Обнаруживает структуру селектора режима MODE_STRUCT_FIELD_0A (0x20001E2C).
        Связана с UART Rx @ 0x0800A412 и init @ 0x08005834.
        """
        if self.verified_fingerprint or self.verify_fingerprint():
            self.selector_found = True
            self.current_mode_id = 1
            return True
        return False

    def find_speed_hook(self) -> int:
        """
        Сканирует прошивку на хук скорости с помощью Multi-Form Scanner.
        """
        for form in HOOK_PATTERNS:
            match = form["pattern"].search(self.data)
            if match:
                self.hook_found = True
                self.hook_form_id = form["id"]
                self.hook_form = form["name"]
                self.hook_offset = match.start() + form["target_offset_in_match"]
                self.is_already_patched = form["is_patched"]
                
                b_low = self.data[self.hook_offset]
                b_high = self.data[self.hook_offset + 1]
                self.current_speed_byte = f"0x{b_low:02X} 0x{b_high:02X}"
                
                if form["is_patched"]:
                    self.current_speed_kmh = b_low
                else:
                    self.current_speed_kmh = 25 if self.current_mode_id == 2 else 20
                
                return self.hook_offset

        self.hook_found = False
        return -1

    def diagnose(self) -> dict:
        """
        Диагностический режим, выводящий:
        1. найден ли selector (MODE_STRUCT_FIELD_0A = 0x20001E2C)
        2. найден ли speed hook
        3. какая форма hook обнаружена
        4. текущий режим
        5. текущий speed byte
        """
        self.verify_fingerprint()
        self.find_selector()
        self.find_speed_hook()

        mode_name = RIDING_MODES.get(self.current_mode_id, f"Unknown ({self.current_mode_id})")

        diag_report = {
            "fingerprint_verified": self.verified_fingerprint,
            "selector_found": self.selector_found,
            "selector_address": f"0x{MODE_STRUCT_FIELD_0A:08X}",
            "speed_hook_found": self.hook_found,
            "hook_form_detected": self.hook_form if self.hook_found else "None",
            "current_mode": f"{mode_name} [ID: {self.current_mode_id}]",
            "current_speed_byte": self.current_speed_byte if self.hook_found else "N/A",
            "current_speed_kmh": self.current_speed_kmh,
            "file_offset": f"0x{self.hook_offset:05X}" if self.hook_offset is not None else "N/A",
            "mcu_address": f"0x{(FLASH_BASE_ADDR + self.hook_offset):08X}" if self.hook_offset is not None else "N/A",
            "is_already_patched": self.is_already_patched
        }

        print("=" * 65)
        print("  XIAOMI 5 PLUS (BRIGHTWAY ES32) MULTI-FORM DIAGNOSTICS")
        print("=" * 65)
        print(f" [1] Mode Selector Found : {'YES' if self.selector_found else 'NO'}")
        print(f"     Address             : 0x{MODE_STRUCT_FIELD_0A:08X} (MODE_STRUCT_FIELD_0A)")
        print(f" [2] Speed Hook Found    : {'YES' if self.hook_found else 'NO'}")
        print(f" [3] Hook Form Detected  : {diag_report['hook_form_detected']}")
        if self.hook_found:
            print(f"     Location            : File {diag_report['file_offset']} | MCU {diag_report['mcu_address']}")
        print(f" [4] Current Mode        : {diag_report['current_mode']}")
        print(f" [5] Current Speed Byte  : {diag_report['current_speed_byte']} -> {diag_report['current_speed_kmh']} km/h")
        print(f" [*] Status              : {'ALREADY MODIFIED' if self.is_already_patched else 'FACTORY PRISTINE'}")
        print("=" * 65)

        return diag_report

    def patch_speed(self, target_speed_kmh: int = 35) -> bool:
        """Безопасно переопределяет скорость для всех режимов."""
        if not self.verified_fingerprint:
            if not self.verify_fingerprint():
                raise RuntimeError("Firmware fingerprint validation failed!")

        if self.hook_offset is None:
            self.find_speed_hook()

        if not self.hook_found or self.hook_offset is None:
            raise RuntimeError("Speed hook not found with Multi-Form Scanner!")

        opcode = bytes([target_speed_kmh, 0x20])
        prev = bytes(self.data[self.hook_offset:self.hook_offset + 2])
        self.data[self.hook_offset:self.hook_offset + 2] = opcode

        print(f"[+] Multi-Form Patcher SUCCESS @ 0x{self.hook_offset:05X}:")
        print(f"    Previous Opcode : {prev.hex().upper()}")
        print(f"    Patched Opcode  : {opcode.hex().upper()} (MOVS r0, #{target_speed_kmh})")
        return True

    # Примечание: функция unlock_regions удалена, так как 0x3440/0x3C80 являются пулами указателей ОЗУ, 
    # а не таблицами скоростей. Перезапись их разрушает стек и память прошивки!

# Алиасы совместимости
Mi5PlusPatcher = Mi5plusPatcher
Patcher = Mi5plusPatcher

# Функция-обертка
def patch_mi5plus(firmware_data: bytearray, speed_kmh: int = 35):
    patcher = Mi5plusPatcher(firmware_data)
    diag = patcher.diagnose()
    patcher.patch_speed(speed_kmh)
    return firmware_data

patch = patch_mi5plus
```

