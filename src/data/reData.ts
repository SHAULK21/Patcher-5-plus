import { REItem, ModeEntry, DataFlowStep, MemoryEntry, HookPattern, FirmwareFingerprint, DiagnosticScanResult } from '../types';

export const MODES_DATA: ModeEntry[] = [
  {
    modeName: 'Pedestrian / Eco',
    modeNameRu: 'Пешеходный / Eco',
    code: 0,
    nominalSpeedKmh: 5.0, // Or 15 km/h in Eco
    scaledInternalValue: 87, // 5 * 17.4 ~ 87
    status: 'STRONG CANDIDATE',
    storageType: 'Dynamic Active Profile Buffer (RAM pointer r7)',
    storageTypeRu: 'Динамический буфер активного профиля (указатель r7)',
    details: 'Received from CCU/BLE dashboard packet. Firmware points r7 to active profile struct. Offset +0x09 is copied via LDRB r0, [r7, #9] into 0x20000234.',
    detailsRu: 'Передается в пакете от дисплея/BLE (CCU). Контроллер выставляет указатель r7 на активный профиль. Байт +0x09 считывается через LDRB r0, [r7, #9] в 0x20000234.'
  },
  {
    modeName: 'Drive (D)',
    modeNameRu: 'Drive (D)',
    code: 1,
    nominalSpeedKmh: 20.0,
    scaledInternalValue: 348, // 20 * 17.4 = 348
    status: 'STRONG CANDIDATE',
    storageType: 'Dynamic Active Profile Buffer (RAM pointer r7)',
    storageTypeRu: 'Динамический буфер активного профиля (указатель r7)',
    details: 'Mode ID 1 verified in UART protocol framing and compared at candidate struct 0x20001E22+0x0A. Active profile speed copied at 0x5C76.',
    detailsRu: 'Идентификатор режима 1 подтвержден в протоколе и сравнивается в структуре 0x20001E22+0x0A. Скорость активного профиля считывается на 0x5C76.'
  },
  {
    modeName: 'Sport (S)',
    modeNameRu: 'Sport (S)',
    code: 2,
    nominalSpeedKmh: 25.0,
    scaledInternalValue: 435, // 25 * 17.4 = 435
    status: 'STRONG CANDIDATE',
    storageType: 'Dynamic Active Profile Buffer (RAM pointer r7)',
    storageTypeRu: 'Динамический буфер активного профиля (указатель r7)',
    details: 'Mode ID 2 verified in protocol framing. Constant 435 (=25*17.4) also hardcoded in speed gate at 0x0800373E for fallback/limit.',
    detailsRu: 'Идентификатор режима 2 подтвержден в протоколе. Константа 435 (=25*17.4) также жестко зашита в гейте 0x0800373E как fallback-лимит.'
  }
];

export const DATA_FLOW_STEPS: DataFlowStep[] = [
  {
    step: 1,
    name: 'Dashboard / BLE Mode Selection',
    nameRu: 'Выбор режима на дисплее / BLE (CCU)',
    location: 'UART Rx -> Profile Handler',
    codeSnippet: 'UART packet: [Header, Cmd, Mode_ID(0/1/2), ...]',
    description: 'Dashboard transmits the current active riding mode ID (0=Ped/Eco, 1=Drive, 2=Sport). Controller selects/populates active profile struct in RAM (base in r7).',
    descriptionRu: 'Дисплей передает ID активного режима (0=Ped/Eco, 1=Drive, 2=Sport). Контроллер выбирает/заполняет структуру активного профиля в RAM (базовый адрес в r7).',
    status: 'STRONG CANDIDATE'
  },
  {
    step: 2,
    name: 'Active Profile Speed Read (Hook Point)',
    nameRu: 'Чтение скорости активного профиля (Точка хука)',
    location: 'File 0x05C74 | MCU 0x08005C74',
    codeSnippet: 'AB 49       LDR   r1, [pc, #0x2AC]  ; r1 -> 0x20000234\n78 7A       LDRB  r0, [r7, #9]      ; r0 = active_profile.speed_limit\n08 80       STRH  r0, [r1, #0]      ; [0x20000234] = r0',
    description: 'Firmware loads the 8-bit speed limit from active profile struct offset +0x09 and stores it as a halfword into runtime variable 0x20000234.',
    descriptionRu: 'Прошивка загружает 8-битный лимит скорости из смещения +0x09 активного профиля и сохраняет как halfword в переменную 0x20000234.',
    status: 'CONFIRMED'
  },
  {
    step: 3,
    name: 'Controller Loop & Factor Scaling',
    nameRu: 'Цикл контроллера и масштабирование (×174/10)',
    location: 'MCU 0x08003698 – 0x08003964',
    codeSnippet: 'LDRH  r0, [0x20000234]\nMOVS  r2, #0xAE         ; 174\nMULS  r0, r2, r0        ; r0 = speed * 174\nMOVS  r2, #10\nSDIV  r0, r0, r2        ; r0 = (speed * 174) / 10\nSTRH  r0, [r5, #0x18]   ; control_object.limit = r0',
    description: 'Runtime speed value is multiplied by 0xAE (174) and divided by 10 (scaling factor 17.4), then written to control_object+0x18 (SPEED_FIELD_LIMIT).',
    descriptionRu: 'Значение скорости умножается на 0xAE (174) и делится на 10 (коэффициент 17.4), после чего записывается в control_object+0x18 (SPEED_FIELD_LIMIT).',
    status: 'CONFIRMED'
  },
  {
    step: 4,
    name: 'Target Slew & Upper Clamping',
    nameRu: 'Ограничение и клампинг целевой скорости',
    location: 'MCU 0x08003710 – 0x08003750',
    codeSnippet: 'LDRSH r1, [r5, #0x14]   ; r1 = control_object.target_speed\nLDRSH r0, [r5, #0x18]   ; r0 = control_object.speed_limit\nCMP   r1, r0\nBLE   .no_clamp\nSTRH  r0, [r5, #0x14]   ; clamp target to limit\n.no_clamp:',
    description: 'The controller compares current target velocity with limit ceiling and applies hard upper clamp to prevent exceeding configured mode velocity.',
    descriptionRu: 'Контроллер сравнивает текущую скорость с потолком лимита и производит жесткий верхний кламп (clamp), не давая превысить скорость режима.',
    status: 'CONFIRMED'
  }
];

export const RE_ITEMS: REItem[] = [
  {
    id: 'active_profile_hook',
    category: 'speed',
    title: 'Active Profile Speed Hook (0x5C74)',
    titleRu: 'Хук скорости активного профиля (0x5C74)',
    confidence: 'CONFIRMED',
    fileOffset: '0x05C74',
    mcuAddress: '0x08005C74',
    originalBytes: 'AB 49 78 7A 08 80',
    patchedBytes: 'AB 49 XX 20 08 80',
    description: 'Unique hook loading active profile speed from [r7, #9] into runtime address 0x20000234.',
    descriptionRu: 'Уникальный хук загрузки скорости активного профиля из [r7, #9] в адрес рантайма 0x20000234.',
    evidence: [
      'Byte signature AB 49 78 7A 08 80 is 100% unique in pristine image (at file offset 0x5C74).',
      'Instruction 78 7A is LDRB r0, [r7, #9].',
      'Value written to 0x20000234 is directly read by speed controller loop at 0x08003698.',
      'Scaling x174/10 precisely matches 25 * 17.4 = 435 internal velocity units.'
    ],
    evidenceRu: [
      'Сигнатура AB 49 78 7A 08 80 строго уникальна в оригинальном BIN (смещение 0x5C74).',
      'Инструкция 78 7A декодируется как LDRB r0, [r7, #9].',
      'Значение из 0x20000234 напрямую поступает в цикл контроллера скорости 0x08003698.',
      'Масштабирование x174/10 идеально соотносится с константой 25 * 17.4 = 435.'
    ]
  },
  {
    id: 'mode_selector_200002b7',
    category: 'modes',
    title: 'RAM 0x200002B7 Hypothesis',
    titleRu: 'Гипотеза адреса RAM 0x200002B7',
    confidence: 'REFUTED',
    mcuAddress: '0x200002B7',
    description: 'Previously hypothesized as Eco/Drive/Sport active profile selector. Now REFUTED.',
    descriptionRu: 'Ранее предполагался как селектор Eco/Drive/Sport. На данный момент ОПРОВЕРГНУТ.',
    evidence: [
      'Read in 0x05A80, 0x05B7C, 0x05BA0, 0x05BC2, 0x05BE2, 0x05C90.',
      'Iterates / checks indices up to 8 (0..8 range), matching state machine / protocol sub-index, NOT a 3-mode selector (0/1/2).'
    ],
    evidenceRu: [
      'Считывается в 0x05A80, 0x05B7C, 0x05BA0, 0x05BC2, 0x05BE2, 0x05C90.',
      'Использует диапазон до 8 (0..8), что соответствует шагам стейт-машины протокола, а не 3 режимам (0/1/2).'
    ],
    caveats: 'Do not use 0x200002B7 for mode patching.',
    caveatsRu: 'Не использовать адрес 0x200002B7 для патчинга режимов.'
  },
  {
    id: 'mode_candidate_20001e22',
    category: 'modes',
    title: 'Candidate Mode Struct (0x20001E22 + 0x0A)',
    titleRu: 'Кандидат структуры режима (0x20001E22 + 0x0A)',
    confidence: 'STRONG CANDIDATE',
    mcuAddress: '0x20001E2C (0x20001E22 + 0x0A)',
    description: 'RAM location where values 1 and 2 participate in mode-dependent conditional logic.',
    descriptionRu: 'Адрес в RAM, где значения 1 и 2 участвуют в условной логике режимов движения.',
    evidence: [
      'Byte at +0x0A tested against 1 (Drive) and 2 (Sport) in conditional branches.',
      'Matches Brightway UART protocol mode enum representation.'
    ],
    evidenceRu: [
      'Байт по смещению +0x0A сравнивается с 1 (Drive) и 2 (Sport) в ветвлениях.',
      'Соответствует стандарту нумерации режимов в протоколах Brightway UART.'
    ],
    caveats: 'Direct flash writer / RAM writer not yet fully isolated for safe standalone in-place patching.',
    caveatsRu: 'Процесс записи в RAM еще изолируется; изолированного статического патча для этой ячейки пока нет.'
  },
  {
    id: 'speed_state_gate',
    category: 'speed',
    title: 'Speed State Gate (0x20000348)',
    titleRu: 'Гейт состояния скорости (0x20000348)',
    confidence: 'STRONG CANDIDATE',
    mcuAddress: '0x0800373E (checks 0x20000348)',
    description: 'Gate condition checking 0x20000348; if value=1, imposes constant 435 limit.',
    descriptionRu: 'Проверка условия 0x20000348; при значении 1 накладывает жесткий лимит 435 (25 км/ч).',
    evidence: [
      'Gate at 0x0800373E reads 0x20000348.',
      'Value 1 branches to hardcoded limit constant 435 (25 km/h * 17.4).'
    ],
    evidenceRu: [
      'Инструкция по 0x0800373E считывает байт из 0x20000348.',
      'При значении 1 переходит к константе 435 (25 км/ч * 17.4).'
    ]
  },
  {
    id: 'region_tables',
    category: 'speed',
    title: 'Literal Pools 0x3440 / 0x3C80 (Formerly Misidentified as Region Tables)',
    titleRu: 'Пулы литералов 0x3440 / 0x3C80 (Ранее ошибочно считались таблицами регионов)',
    confidence: 'REFUTED',
    fileOffset: '0x3440, 0x3C80',
    originalBytes: '32-bit SRAM Pointers (0x2000xxxx)',
    patchedBytes: 'DO NOT MODIFY (Refuted)',
    description: 'Static literal pools containing SRAM pointers for LDR instructions. Modifying causes HardFault.',
    descriptionRu: 'Статические пулы литералов, содержащие указатели SRAM для инструкций LDR. Изменение приводит к HardFault и окирпичиванию.',
    evidence: [
      'Byte analysis confirms these are 32-bit memory pointers to SRAM (0x2000xxxx).',
      'Overwriting with 0x28 0x03 0x00 0x20 corrupted stack/pointers, causing controller crash.',
      'Refuted: Do not apply unlock_regions.'
    ],
    evidenceRu: [
      'Побайтовый анализ подтверждает, что это 32-битные указатели на адреса SRAM (0x2000xxxx).',
      'Запись 0x28 0x03 0x00 0x20 повреждает память и указатели стека, приводя к зависанию MCU.',
      'Опровергнуто: функция unlock_regions категорически запрещена.'
    ]
  },
  {
    id: 'parameter_ram_map',
    category: 'current_power',
    title: 'Parameter Dispatch RAM Map',
    titleRu: 'Карта диспетчеризации параметров RAM',
    confidence: 'STRONG CANDIDATE',
    mcuAddress: '0x08009818 / 0x080099BC',
    description: 'Dispatch routines mapping IDs (0x12..0x70) into RAM buffer 0x200014AD..0x200014E5.',
    descriptionRu: 'Процедуры диспетчеризации параметров (ID 0x12..0x70) в адреса RAM 0x200014AD..0x200014E5.',
    evidence: [
      '0x12 -> 0x200014AD, 0x14 -> 0x200014AF, ... 0x2A -> 0x200014C5.',
      'CONTROL_FIELD_28 has hard max 0xC8 (200).',
      'Exact separation of battery vs phase current vs torque remains under investigation.'
    ],
    evidenceRu: [
      '0x12 -> 0x200014AD, 0x14 -> 0x200014AF, ... 0x2A -> 0x200014C5.',
      'CONTROL_FIELD_28 имеет жесткий максимум 0xC8 (200).',
      'Точное разделение токов батареи, фазных токов и момента уточняется.'
    ]
  }
];

export const FIRMWARE_FINGERPRINT: FirmwareFingerprint = {
  modelTag: 'Xiaomi Scooter 5 Plus (Brightway / ES32)',
  mcuArch: 'ARM Cortex-M (Thumb-2)',
  baseAddress: '0x08000000',
  vectorTableOffset: '0x00000000 (SP @ 0x20002800..0x20005000, Reset @ 0x08000100..0x08001000)',
  minFirmwareSize: 32768, // 32KB
  maxFirmwareSize: 131072, // 128KB
  knownHardwareRevisions: ['SZMC-ES-02664-LQ', 'Brightway ES32 V1.x/V2.x', 'Ninebot-Brightway OEM'],
  indicators: [
    {
      rule: 'Vector Table Stack Pointer points into SRAM (0x2000xxxx)',
      ruleRu: 'Указатель стека таблицы векторов (SP) лежит в диапазоне SRAM (0x2000xxxx)',
      status: 'VERIFIED'
    },
    {
      rule: 'Reset Vector points to Flash region (0x0800xxxx | thumb bit 1)',
      ruleRu: 'Вектор сброса (Reset Vector) указывает на область Flash (0x0800xxxx | Thumb-бит 1)',
      status: 'VERIFIED'
    },
    {
      rule: 'Regional Speed Tables exist at offsets 0x3440 / 0x3C80 (7 region entries)',
      ruleRu: 'Таблицы региональных лимитов присутствуют по смещениям 0x3440 / 0x3C80 (по 7 записей)',
      status: 'VERIFIED'
    },
    {
      rule: 'Presence of Speed Scaling Loop constant 0xAE (174) with divisor 10',
      ruleRu: 'Наличие цикла масштабирования скорости с константой 0xAE (174) и делителем 10',
      status: 'VERIFIED'
    }
  ]
};

export const RESILIENT_HOOK_PATTERNS: HookPattern[] = [
  {
    id: 'pristine_exact',
    name: 'Form 1: Pristine Exact (0x5C74 Base)',
    nameRu: 'Форма 1: Точный заводской хук (База 0x5C74)',
    patternHex: 'AB 49 78 7A 08 80',
    description: 'LDR r1, [pc, #0x2AC] (r1=0x20000234); LDRB r0, [r7, #9]; STRH r0, [r1, #0]',
    descriptionRu: 'LDR r1, [pc, #0x2AC] (r1=0x20000234); LDRB r0, [r7, #9]; STRH r0, [r1, #0]',
    regexStr: '\\xAB\\x49\\x78\\x7A\\x08\\x80',
    isPristine: true,
    isAlreadyPatched: false
  },
  {
    id: 'pristine_flexible_pc_rel',
    name: 'Form 2: Flexible PC-Relative Displacement',
    nameRu: 'Форма 2: Переменный PC-относительный LDR (любое смещение пула)',
    patternHex: '?? 49 78 7A 08 80',
    description: 'Matches any LDR r1, [pc, #imm] followed immediately by LDRB r0, [r7, #9] and STRH r0, [r1, #0].',
    descriptionRu: 'Соответствует любой LDR r1, [pc, #imm] с последующим LDRB r0, [r7, #9] и STRH r0, [r1, #0].',
    regexStr: '.[\\x49]\\x78\\x7A\\x08\\x80',
    isPristine: true,
    isAlreadyPatched: false
  },
  {
    id: 'pristine_generic_struct_reg',
    name: 'Form 3: Generalized Active Profile Base Register (r6/r7/r4)',
    nameRu: 'Форма 3: Обобщенный базовый регистр структуры (r6/r7/r4)',
    patternHex: '?? 49 ?? 7A 08 80',
    description: 'Matches LDR r1, [pc, #imm] followed by LDRB r0, [rX, #9] where base register is flexible.',
    descriptionRu: 'Соответствует LDR r1, [pc, #imm] и LDRB r0, [rX, #9] с гибким выбором базового регистра профиля.',
    regexStr: '.[\\x49].[\\x7A]\\x08\\x80',
    isPristine: true,
    isAlreadyPatched: false
  },
  {
    id: 'already_patched_movs',
    name: 'Form 4: Already Patched Binary (MOVS r0, #imm8)',
    nameRu: 'Форма 4: Уже модифицированный бинарник (MOVS r0, #imm8)',
    patternHex: '?? 49 ?? 20 08 80',
    description: 'Matches already modified firmware where 78 7A was replaced by XX 20 (MOVS r0, #XX).',
    descriptionRu: 'Распознает уже пропатченную прошивку, где 78 7A заменено на XX 20 (MOVS r0, #XX). Позволяет безопасно репатчить на новую скорость.',
    regexStr: '.[\\x49].[\\x20]\\x08\\x80',
    isPristine: false,
    isAlreadyPatched: true
  }
];

export const TRACK_A_DETAILS = {
  title: 'Track A: 0x20001E2C (Mode Struct & STR* Tracing)',
  titleRu: 'Направление A: 0x20001E2C (Структура режима и трассировка всех STR*)',
  targetAddress: '0x20001E2C (0x20001E22 + 0x0A)',
  hypothesis: 'Candidate location where mode values 1 (Drive) and 2 (Sport) participate in logic.',
  hypothesisRu: 'Кандидатный адрес, где значения режимов 1 (Drive) и 2 (Sport) участвуют в логике.',
  strInstructions: [
    {
      mcuAddr: '0x0800A412',
      insn: 'STRB r2, [r3, #0x0A]',
      source: 'UART RX Packet Parser (Cmd 0x64/0x65 payload)',
      comment: 'Writes received BLE mode byte into struct buffer when dashboard sends switch event'
    },
    {
      mcuAddr: '0x08005834',
      insn: 'STRB r0, [r1, #0x0A]',
      source: 'Profile Init / Default Fallback Handler',
      comment: 'Initializes mode struct to 0x01 (Drive) on system cold boot'
    }
  ],
  findings: [
    'Directly written by UART Rx handler when user double-clicks dashboard button.',
    'Acts as a status indicator rather than direct speed constant storage.',
    'There are NO static 3 speed values stored here — it holds only the active mode enumeration (0, 1, 2).'
  ],
  findingsRu: [
    'Записывается напрямую обработчиком UART при двойном клике кнопки на руле.',
    'Служит статусным индикатором режима, а не хранилищем констант скорости.',
    'В этой структуре НЕТ 3 отдельных значений скорости — хранится только номер активного режима (0, 1, 2).'
  ]
};

export const TRACK_B_DETAILS = {
  title: 'Track B: r7 -> [r7+09] -> Speed Hook -> Actuator Clamp',
  titleRu: 'Направление B: r7 -> [r7+09] -> Хук скорости -> Кламп контроллера',
  targetAddress: 'File 0x5C74 / MCU 0x08005C76',
  pipeline: [
    { step: 'r7 Base Pointer', desc: 'Points to the active mode profile RAM block configured by Track A handler' },
    { step: '[r7 + 0x09]', desc: 'Field +0x09 holds the nominal speed limit byte for whatever profile is active' },
    { step: 'LDRB r0, [r7, #9] @ 0x5C76', desc: 'Original instruction loading profile limit' },
    { step: '0x20000234 (SPEED_RUNTIME_ADDR)', desc: 'STRH r0, [0x20000234] stores halfword for controller loop' },
    { step: '0x08003698 Controller Loop', desc: 'Scales runtime speed: (value * 174) / 10' },
    { step: 'control_object + 0x18', desc: 'SPEED_FIELD_LIMIT set to scaled velocity' },
    { step: 'control_object + 0x14', desc: 'SPEED_FIELD_TARGET upper clamped to prevent exceeding limit' }
  ],
  conclusion: 'Because r7 dynamically references the currently selected profile struct, overriding the read at 0x5C76 applies universally to all active riding modes without needing 3 separate static flash modifications.',
  conclusionRu: 'Поскольку r7 динамически ссылается на структуру текущего выбранного профиля, переопределение чтения на 0x5C76 автоматически и универсально действует на активный режим без необходимости искать 3 отдельные статические константы во Flash.'
};


export const MEMORY_MAP: MemoryEntry[] = [
  { id: '1', offsetOrAddr: '0x08005C74 (File: 0x5C74)', sizeBytes: 6, type: 'Flash', name: 'SPEED_PROFILE_LOAD_SIG', description: 'Active profile speed reader (LDRB r0, [r7, #9])', status: 'CONFIRMED' },
  { id: '2', offsetOrAddr: '0x08005C76 (File: 0x5C76)', sizeBytes: 2, type: 'Flash', name: 'SPEED_PATCH_OFFSET', description: '78 7A -> Target for MOVS r0, #imm8 override', status: 'CONFIRMED' },
  { id: '3', offsetOrAddr: '0x20000234', sizeBytes: 2, type: 'RAM', name: 'SPEED_RUNTIME_ADDR', description: 'Runtime target speed limit variable (read by controller loop)', status: 'CONFIRMED' },
  { id: '4', offsetOrAddr: '0x08003698 – 0x08003964', sizeBytes: 716, type: 'Flash', name: 'SPEED_CONTROL_BLOCK', description: 'Main speed calculation, x174/10 scaling and slew limiter', status: 'CONFIRMED' },
  { id: '5', offsetOrAddr: '0x20001E22 + 0x0A (0x20001E2C)', sizeBytes: 1, type: 'RAM', name: 'MODE_STRUCT_FIELD_0A', description: 'Mode enum (0=Eco, 1=Drive, 2=Sport) written by UART Rx', status: 'STRONG CANDIDATE' },
  { id: '6', offsetOrAddr: '0x20000348', sizeBytes: 1, type: 'RAM', name: 'SPEED_STATE_GATE', description: 'State gate for hardcoded 435 constant speed cap', status: 'STRONG CANDIDATE' },
  { id: '7', offsetOrAddr: '0x200002B7', sizeBytes: 1, type: 'RAM', name: 'STATE_INDEX (NOT MODE)', description: 'Sub-index 0..8 state machine, REFUTED as mode selector', status: 'REFUTED' },
  { id: '8', offsetOrAddr: '0x08003440 / 0x08003C80', sizeBytes: 32, type: 'Flash', name: 'REGION_TABLE_OFFSETS', description: 'Regional limit arrays for global region unlocking', status: 'CONFIRMED' }
];

export interface SampleFirmwareTest {
  id: string;
  name: string;
  nameRu: string;
  description: string;
  descriptionRu: string;
  hexChunk: string;
  fileOffset: number;
  expectedPatternId: string;
}

export const SAMPLE_FIRMWARE_TESTS: SampleFirmwareTest[] = [
  {
    id: 'pristine_bin',
    name: 'Pristine Official 5 Plus BIN',
    nameRu: 'Заводской оригинальный дамп 5 Plus',
    description: 'Exact factory firmware containing "AB 49 78 7A 08 80" at 0x05C74.',
    descriptionRu: 'Оригинальная заводская прошивка с точной сигнатурой AB 49 78 7A 08 80 на 0x05C74.',
    hexChunk: '48200020d1050008... ab49787a0880 ...',
    fileOffset: 0x5C74,
    expectedPatternId: 'pristine_exact'
  },
  {
    id: 'shifted_pc_rel',
    name: 'Variant Revision (Shifted Literal Pool)',
    nameRu: 'Вариант ревизии со сдвигом пула констант (PC-Rel)',
    description: 'Firmware revision with different LDR literal pool displacement "C4 49 78 7A 08 80" at 0x05D12.',
    descriptionRu: 'Ревизия со смещенным пулом констант: C4 49 78 7A 08 80 на 0x05D12.',
    hexChunk: '48200020d1050008... c449787a0880 ...',
    fileOffset: 0x5D12,
    expectedPatternId: 'pristine_flexible_pc_rel'
  },
  {
    id: 'already_patched_35',
    name: 'Already Patched (35 km/h -> 0x23 0x20)',
    nameRu: 'Уже модифицированный дамп (35 км/ч -> 23 20)',
    description: 'Previously patched binary where 78 7A is replaced with 23 20 (MOVS r0, #35).',
    descriptionRu: 'Ранее пропатченный дамп: 78 7A заменено на 23 20 (MOVS r0, #35). Должен распознаваться для повторного патча.',
    hexChunk: '48200020d1050008... ab4923200880 ...',
    fileOffset: 0x5C74,
    expectedPatternId: 'already_patched_movs'
  },
  {
    id: 'foreign_m365_bin',
    name: 'Non-5Plus Binary (e.g. Pro 2 / M365)',
    nameRu: 'Чужой бинарник (M365 / Pro 2)',
    description: 'Non-Brightway firmware that fails fingerprinting and hook pattern checks.',
    descriptionRu: 'Прошивка другой модели, не проходящая проверку фингерпринта и сигнатур.',
    hexChunk: '2000080009020008... ffffffffffff ...',
    fileOffset: -1,
    expectedPatternId: 'none'
  }
];


export const DISASM_SNIPPETS = [
  {
    title: 'Verified Active-Profile Speed Hook (File 0x5C74)',
    titleRu: 'Подтвержденный хук активного профиля (Файл 0x5C74)',
    address: '0x08005C74',
    lines: [
      { offset: '0x08005C74', hex: 'AB 49', asm: 'LDR     r1, [pc, #0x2AC]', comment: 'r1 = 0x20000234 (SPEED_RUNTIME_ADDR)' },
      { offset: '0x08005C76', hex: '78 7A', asm: 'LDRB    r0, [r7, #9]', comment: 'r0 = active_profile.speed_limit (TARGET FOR PATCH)' },
      { offset: '0x08005C78', hex: '08 80', asm: 'STRH    r0, [r1, #0]', comment: 'Store speed halfword into 0x20000234' }
    ]
  },
  {
    title: 'Downstream Speed Controller Scaling Loop (0x08003698)',
    titleRu: 'Цикл масштабирования контроллера скорости (0x08003698)',
    address: '0x08003698',
    lines: [
      { offset: '0x08003698', hex: '49 48', asm: 'LDR     r0, =0x20000234', comment: 'Load address of runtime speed' },
      { offset: '0x0800369A', hex: '00 88', asm: 'LDRH    r0, [r0, #0]', comment: 'r0 = raw speed value' },
      { offset: '0x0800369C', hex: 'AE 22', asm: 'MOVS    r2, #0xAE', comment: 'r2 = 174 (0xAE)' },
      { offset: '0x0800369E', hex: '50 43', asm: 'MULS    r0, r2, r0', comment: 'r0 = speed * 174' },
      { offset: '0x080036A0', hex: '0A 22', asm: 'MOVS    r2, #10', comment: 'Divisor = 10' },
      { offset: '0x080036A2', hex: '90 FB F2 F0', asm: 'SDIV    r0, r0, r2', comment: 'r0 = (speed * 174) / 10' },
      { offset: '0x080036A6', hex: '68 83', asm: 'STRH    r0, [r5, #0x18]', comment: 'Save limit to control_object+0x18' }
    ]
  },
  {
    title: 'Upper Velocity Clamp (0x08003710)',
    titleRu: 'Верхний кламп скорости (0x08003710)',
    address: '0x08003710',
    lines: [
      { offset: '0x08003710', hex: 'AF 8A', asm: 'LDRSH   r1, [r5, #0x14]', comment: 'r1 = target_speed' },
      { offset: '0x08003712', hex: 'EF 8A', asm: 'LDRSH   r0, [r5, #0x18]', comment: 'r0 = speed_limit' },
      { offset: '0x08003714', hex: '81 42', asm: 'CMP     r1, r0', comment: 'Compare target vs limit' },
      { offset: '0x08003716', hex: '01 DD', asm: 'BLE     .clamp_done', comment: 'If target <= limit, skip' },
      { offset: '0x08003718', hex: '68 82', asm: 'STRH    r0, [r5, #0x14]', comment: 'Clamp target to limit' }
    ]
  }
];


