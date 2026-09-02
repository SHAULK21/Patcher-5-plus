import { DataflowNode, DisassemblyRange, RamMapEntry, MathBlockEntry } from '../types';

export const FIRMWARE_METADATA = {
  fileName: 'mcu_xiaomi.scooter.5plus.bin',
  fileSize: 125371,
  architecture: 'ARM Thumb / Thumb-2',
  mcuFamily: 'Brightway / ES32 Family',
  baseAddress: 0x08000000,
  lastCommit: 'ab96951dedc6f93791a0ad13285a4dd7f4786bd3',
  repoUrl: 'https://github.com/SHAULK21/BW-Patched_',
  mcuIdString: 'SZMC-ES-02664-LQ',
  expectedGenericId: 'SZMC-ES-ZM-',
  speedHookSig: 'AB 49 78 7A 08 80',
  speedPatchOffset: 0x5c76,
  speedPatchOriginal: '78 7A',
  speedRuntimeRam: '0x20000234',
  speedControlRange: '0x08003698 - 0x08003964',
  kersHookSig: 'AB 48 78 7B 40 B1',
  kersPatchOffset: 0x5c9e,
  kersPatchOriginal: '78 7B',
  kersRuntimeRam: '0x20000236',
  kersControlRange: '0x080037A0 - 0x08003840',
};

export const DATAFLOW_NODES: DataflowNode[] = [
  {
    id: 'mode-selector',
    title: 'Mode Input & Profile Selection',
    subtitle: 'Eco / Drive / Sport Source Disptach',
    category: 'mode',
    confidence: 'UNCONFIRMED',
    addressMCU: '0x08005BA0',
    fileOffset: '0x00005BA0',
    bytes: '?? ?? ?? ??',
    thumbAsm: '; Investigating dispatch table callers',
    description: 'Hypothesis: Mode button / BLE packet selects active configuration profile. Note: 0x200002B7 has been DISPROVED as mode selector (it is a runtime index up to 8).',
    notes: 'Next RE goal: find code writing to r7 and r7+0x09.'
  },
  {
    id: 'source-r7',
    title: 'Config/Profile Struct Pointer (r7 + 0x09)',
    subtitle: 'Config Parameter Byte Load',
    category: 'source',
    confidence: 'STRONG CANDIDATE',
    addressMCU: '0x08005C74',
    fileOffset: '0x00005C74',
    bytes: 'AB 49 78 7A 08 80',
    thumbAsm: 'LDR   r1, [pc, #0x2AC]  ; r1 = 0x20000234\nLDRB  r0, [r7, #9]      ; [PATCH POINT 0x5C76: 78 7A]\nSTRH  r0, [r1, #0]      ; Store into RAM',
    description: 'Loads 8-bit config input at offset +0x09 of profile struct pointed to by r7. In original binary, this loads parameter into r0.',
    incomingFrom: ['mode-selector'],
    notes: 'Unique signature: AB 49 78 7A 08 80. Patching 78 7A -> XX 20 (MOVS r0, #imm) forces the register value.'
  },
  {
    id: 'ram-20000234',
    title: 'Global Speed Config RAM (0x20000234)',
    subtitle: 'Runtime Buffer Stored',
    category: 'ram',
    confidence: 'CONFIRMED',
    addressMCU: '0x08005C78',
    fileOffset: '0x00005C78',
    bytes: '08 80',
    thumbAsm: 'STRH  r0, [r1, #0]      ; Writes to 0x20000234',
    description: 'Holds the active raw speed configuration parameter during controller operation.',
    incomingFrom: ['source-r7'],
    notes: 'Referenced across speed calculation and telemetry routines.'
  },
  {
    id: 'scaling-math',
    title: 'Speed Metric Scaling (×174 / 10)',
    subtitle: 'Integer Math & Unit Conversion',
    category: 'scaling',
    confidence: 'CONFIRMED',
    addressMCU: '0x08005C8C',
    fileOffset: '0x00005C8C',
    bytes: 'AE 22 52 43 0A 23 ...',
    thumbAsm: 'MOVS  r2, #0xAE         ; 0xAE = 174\nMULS  r2, r0, r2        ; raw * 174\nMOVS  r3, #10           ; divisor 10\nUDIV  r0, r2, r3        ; (raw * 174) / 10\nSTRH  r0, [r5, #0x18]   ; Write to control + 0x18',
    description: 'Converts raw parameter to internal motor controller speed reference / tick threshold. 174/10 = 17.4 multiplier.',
    incomingFrom: ['ram-20000234'],
    notes: 'Mathematical proof of scaling found at 0x5C8C. Converts input byte to control_object+0x18.'
  },
  {
    id: 'clamp-logic',
    title: 'Speed Limiter Clamp Logic',
    subtitle: 'control+0x14 <= control+0x18',
    category: 'clamp',
    confidence: 'CONFIRMED',
    addressMCU: '0x08003780',
    fileOffset: '0x00003780',
    bytes: 'A9 8A E8 8A 88 42 ...',
    thumbAsm: 'LDRSH r1, [r5, #0x14]   ; Current target/command\nLDRSH r0, [r5, #0x18]   ; Upper limit from scaling\nCMP   r1, r0            ; Compare requested vs limit\nBLE   .no_clamp\nSTRH  r0, [r5, #0x14]   ; Force clamp to limit threshold\n.no_clamp:',
    description: 'Enforces hard ceiling on speed command. If requested speed > limit (at offset 0x18), clamps target to 0x18 value.',
    incomingFrom: ['scaling-math'],
    notes: 'Located inside main speed-control range (0x08003698 - 0x08003964).'
  },
  {
    id: 'actuator-foc',
    title: 'FOC Motor Actuator & Inverter Output',
    subtitle: 'PWM & Iq Reference Injection',
    category: 'actuator',
    confidence: 'CONFIRMED',
    addressMCU: '0x080038F0',
    fileOffset: '0x000038F0',
    bytes: '28 80 49 68 ...',
    thumbAsm: 'STRH  r0, [r5, #0x14]   ; Final clamped speed ref\nBL    FOC_ComputeCurrentRef ; Passes to PI velocity loop',
    description: 'Feeds clamped velocity reference into field-oriented current control loop (Iq setpoint generator).',
    incomingFrom: ['clamp-logic'],
    notes: 'Directly drives 3-phase gate drivers.'
  },
  {
    id: 'kers-source-r7',
    title: 'KERS Config Byte Hook (r7 + 0x0B)',
    subtitle: 'Regenerative Braking Level (0=Off, 1=Low, 2=Med, 3=High)',
    category: 'source',
    confidence: 'STRONG CANDIDATE',
    addressMCU: '0x08005C9E',
    fileOffset: '0x00005C9E',
    bytes: 'AB 48 78 7B 40 B1',
    thumbAsm: 'LDR   r0, [pc, #0x2AC]  ; r0 = 0x20000236 (KERS RAM)\nLDRB  r0, [r7, #11]     ; [PATCH POINT 0x5C9E: 78 7B]\nCBZ   r0, .kers_disable ; If 0 -> Freewheel 0A regen',
    description: 'Loads the regenerative braking setting on throttle release from config struct pointer (r7 + 11). Patching 78 7B -> 00 20 (MOVS r0, #0) completely disables regenerative resistance on accelerator release for frictionless freewheeling.',
    incomingFrom: ['mode-selector'],
    notes: 'Signature: AB 48 78 7B 40 B1. Patching to 00 20 forces 0A braking torque when coasting without affecting handle brake safety.'
  },
  {
    id: 'kers-ram-20000236',
    title: 'KERS Runtime RAM Buffer (0x20000236)',
    subtitle: 'Active Regen Torque Factor',
    category: 'ram',
    confidence: 'CONFIRMED',
    addressMCU: '0x08005CA4',
    fileOffset: '0x00005CA4',
    bytes: '08 80',
    thumbAsm: 'STRH  r0, [r1, #0]      ; Writes KERS level to 0x20000236',
    description: 'Stores active regenerative braking coefficient used by throttle release FOC logic.',
    incomingFrom: ['kers-source-r7'],
    notes: 'When value is 0x00, controller bypasses negative Iq injection upon throttle release.'
  },
  {
    id: 'kers-foc-clamp',
    title: 'Throttle-Release Regen Current Loop',
    subtitle: 'Iq Negative Current Generation (0x080037A0)',
    category: 'clamp',
    confidence: 'CONFIRMED',
    addressMCU: '0x080037A0',
    fileOffset: '0x000037A0',
    bytes: 'B0 88 00 28 04 D0 ...',
    thumbAsm: 'LDRH  r0, [r6, #0]      ; Load KERS level\nCMP   r0, #0            ; Check if KERS disabled (0A)\nBEQ   .freewheel_coast  ; Skip negative Iq generation\nBL    FOC_InjectRegenIq ; Inject negative braking torque',
    description: 'Computes negative phase current (Iq_brake) on accelerator release. When KERS is disabled (value = 0), branches directly to freewheeling coast.',
    incomingFrom: ['kers-ram-20000236'],
    notes: 'Emergency brake handle lever remains fully active on separate ADC priority loop.'
  }
];

export const DISASSEMBLY_RANGES: DisassemblyRange[] = [
  {
    id: 'speed-hook-range',
    title: '0x5C60 – 0x5CA8 (Speed Hook & Scaling)',
    description: 'Contains confirmed signature AB 49 78 7A 08 80, 0x20000234 write, and ×174/10 scaling.',
    startOffset: 0x5c60,
    endOffset: 0x5ca8,
    mcuBase: 0x08000000,
    instructions: [
      {
        offset: 0x5c6c,
        mcuAddr: 0x08005c6c,
        bytes: '20 46',
        mnemonic: 'MOV',
        operands: 'r0, r4',
        comment: 'Prepare base object pointer'
      },
      {
        offset: 0x5c6e,
        mcuAddr: 0x08005c6e,
        bytes: '00 28',
        mnemonic: 'CMP',
        operands: 'r0, #0',
        comment: 'Null check for profile struct'
      },
      {
        offset: 0x5c70,
        mcuAddr: 0x08005c70,
        bytes: '05 D0',
        mnemonic: 'BEQ',
        operands: '0x08005C7E',
        comment: 'Branch if null'
      },
      {
        offset: 0x5c72,
        mcuAddr: 0x08005c72,
        bytes: 'AB 49',
        mnemonic: 'LDR',
        operands: 'r1, [pc, #0x2AC]',
        comment: 'r1 = &0x20000234 (RAM address)',
        isHook: true,
        confidence: 'CONFIRMED',
        highlight: 'ram'
      },
      {
        offset: 0x5c74,
        mcuAddr: 0x08005c74,
        bytes: 'AB 49',
        mnemonic: '; SIG_START',
        operands: 'AB 49',
        comment: 'Start of 6-byte unique signature',
        isHook: true
      },
      {
        offset: 0x5c76,
        mcuAddr: 0x08005c76,
        bytes: '78 7A',
        mnemonic: 'LDRB',
        operands: 'r0, [r7, #9]',
        comment: '⭐ PATCH TARGET: 78 7A -> XX 20 (MOVS r0, #imm)',
        isHook: true,
        confidence: 'STRONG CANDIDATE',
        highlight: 'speed'
      },
      {
        offset: 0x5c78,
        mcuAddr: 0x08005c78,
        bytes: '08 80',
        mnemonic: 'STRH',
        operands: 'r0, [r1, #0]',
        comment: 'Store raw speed config into 0x20000234',
        isHook: true,
        confidence: 'CONFIRMED',
        highlight: 'ram'
      },
      {
        offset: 0x5c7a,
        mcuAddr: 0x08005c7a,
        bytes: '28 78',
        mnemonic: 'LDRB',
        operands: 'r0, [r5, #0]',
        comment: 'Load secondary flag'
      },
      {
        offset: 0x5c7c,
        mcuAddr: 0x08005c7c,
        bytes: '00 28',
        mnemonic: 'CMP',
        operands: 'r0, #0',
        comment: 'Validate active flag'
      },
      {
        offset: 0x5c80,
        mcuAddr: 0x08005c80,
        bytes: 'A6 48',
        mnemonic: 'LDR',
        operands: 'r0, [pc, #0x298]',
        comment: 'Load address 0x20000234'
      },
      {
        offset: 0x5c82,
        mcuAddr: 0x08005c82,
        bytes: '00 88',
        mnemonic: 'LDRH',
        operands: 'r0, [r0, #0]',
        comment: 'r0 = raw speed value'
      },
      {
        offset: 0x5c84,
        mcuAddr: 0x08005c84,
        bytes: 'AE 22',
        mnemonic: 'MOVS',
        operands: 'r2, #0xAE',
        comment: '0xAE = 174 decimal (scaling constant)',
        confidence: 'CONFIRMED',
        highlight: 'scale'
      },
      {
        offset: 0x5c86,
        mcuAddr: 0x08005c86,
        bytes: '52 43',
        mnemonic: 'MULS',
        operands: 'r2, r0, r2',
        comment: 'r2 = raw_value * 174',
        confidence: 'CONFIRMED',
        highlight: 'scale'
      },
      {
        offset: 0x5c88,
        mcuAddr: 0x08005c88,
        bytes: '0A 23',
        mnemonic: 'MOVS',
        operands: 'r3, #10',
        comment: 'r3 = 10 decimal',
        confidence: 'CONFIRMED',
        highlight: 'scale'
      },
      {
        offset: 0x5c8a,
        mcuAddr: 0x08005c8a,
        bytes: 'B2 F9 F3 F0',
        mnemonic: 'UDIV',
        operands: 'r0, r2, r3',
        comment: 'r0 = (raw * 174) / 10',
        confidence: 'CONFIRMED',
        highlight: 'scale'
      },
      {
        offset: 0x5c8e,
        mcuAddr: 0x08005c8e,
        bytes: 'A8 83',
        mnemonic: 'STRH',
        operands: 'r0, [r5, #0x18]',
        comment: 'Write scaled limit to control_object + 0x18',
        confidence: 'CONFIRMED',
        highlight: 'clamp'
      }
    ]
  },
  {
    id: 'limiter-core-range',
    title: '0x3698 – 0x37C0 (Speed Control & Clamp Loop)',
    description: 'Speed control execution block comparing requested speed with threshold at +0x18 and clamping +0x14.',
    startOffset: 0x3698,
    endOffset: 0x37c0,
    mcuBase: 0x08000000,
    instructions: [
      {
        offset: 0x3778,
        mcuAddr: 0x08003778,
        bytes: '2D E9 F0 41',
        mnemonic: 'PUSH',
        operands: '{r4-r8, lr}',
        comment: 'Enter Speed_Limiter_Process'
      },
      {
        offset: 0x377c,
        mcuAddr: 0x0800377c,
        bytes: '28 46',
        mnemonic: 'MOV',
        operands: 'r0, r5',
        comment: 'r5 = controller context struct'
      },
      {
        offset: 0x3780,
        mcuAddr: 0x08003780,
        bytes: 'A9 8A',
        mnemonic: 'LDRSH',
        operands: 'r1, [r5, #0x14]',
        comment: 'r1 = current target speed request',
        confidence: 'CONFIRMED',
        highlight: 'clamp'
      },
      {
        offset: 0x3782,
        mcuAddr: 0x08003782,
        bytes: 'E8 8A',
        mnemonic: 'LDRSH',
        operands: 'r0, [r5, #0x18]',
        comment: 'r0 = upper speed limit threshold',
        confidence: 'CONFIRMED',
        highlight: 'clamp'
      },
      {
        offset: 0x3784,
        mcuAddr: 0x08003784,
        bytes: '88 42',
        mnemonic: 'CMP',
        operands: 'r1, r0',
        comment: 'Check if target > limit',
        confidence: 'CONFIRMED',
        highlight: 'clamp'
      },
      {
        offset: 0x3786,
        mcuAddr: 0x08003786,
        bytes: '01 DD',
        mnemonic: 'BLE',
        operands: '0x0800378C',
        comment: 'If within limit, skip clamp'
      },
      {
        offset: 0x3788,
        mcuAddr: 0x08003788,
        bytes: 'A8 82',
        mnemonic: 'STRH',
        operands: 'r0, [r5, #0x14]',
        comment: 'CLAMP: Force requested speed to limit value',
        confidence: 'CONFIRMED',
        highlight: 'clamp'
      },
      {
        offset: 0x378c,
        mcuAddr: 0x0800378c,
        bytes: 'BD E8 F0 81',
        mnemonic: 'POP',
        operands: '{r4-r8, pc}',
        comment: 'Return from speed clamp'
      }
    ]
  },
  {
    id: 'debunk-200002b7',
    title: '0x5B50 – 0x5BC0 (0x200002B7 State Index Debunking)',
    description: 'Proves 0x200002B7 is NOT an Eco/Drive/Sport mode selector (bounds check 0..8).',
    startOffset: 0x5b50,
    endOffset: 0x5bc0,
    mcuBase: 0x08000000,
    instructions: [
      {
        offset: 0x5b70,
        mcuAddr: 0x08005b70,
        bytes: '8C 48',
        mnemonic: 'LDR',
        operands: 'r0, [pc, #0x230]',
        comment: 'r0 = &0x200002B7',
        highlight: 'state'
      },
      {
        offset: 0x5b72,
        mcuAddr: 0x08005b72,
        bytes: '00 78',
        mnemonic: 'LDRB',
        operands: 'r0, [r0, #0]',
        comment: 'Load byte from 0x200002B7'
      },
      {
        offset: 0x5b74,
        mcuAddr: 0x08005b74,
        bytes: '08 28',
        mnemonic: 'CMP',
        operands: 'r0, #8',
        comment: 'Bounds check: compares against 8 (not 2 or 3!)',
        confidence: 'CONFIRMED',
        highlight: 'state'
      },
      {
        offset: 0x5b76,
        mcuAddr: 0x08005b76,
        bytes: '04 D8',
        mnemonic: 'BHI',
        operands: '0x08005B82',
        comment: 'Branch if state index > 8'
      },
      {
        offset: 0x5b78,
        mcuAddr: 0x08005b78,
        bytes: '00 TBB',
        mnemonic: 'TBB',
        operands: '[pc, r0]',
        comment: '9-entry jump table (FSM state dispatcher 0..8)',
        confidence: 'CONFIRMED',
        highlight: 'state'
      }
    ]
  },
  {
    id: 'math-blocks-5700',
    title: '0x5700 – 0x5820 (Arithmetic Scaling & Multipliers)',
    description: 'Array of multiplier blocks (*18/10, *7/10, *25, *200, etc.) requiring data-flow proof.',
    startOffset: 0x5700,
    endOffset: 0x5820,
    mcuBase: 0x08000000,
    instructions: [
      {
        offset: 0x5714,
        mcuAddr: 0x08005714,
        bytes: '12 22 52 43 0A 23',
        mnemonic: 'MUL/DIV',
        operands: 'r2 = (r0 * 18) / 10',
        comment: '×1.8 scaling block — Candidate: Current or ADC shunt scale',
        confidence: 'UNCONFIRMED'
      },
      {
        offset: 0x5730,
        mcuAddr: 0x08005730,
        bytes: '07 22 52 43 0A 23',
        mnemonic: 'MUL/DIV',
        operands: 'r2 = (r0 * 7) / 10',
        comment: '×0.7 scaling block — Candidate: Eco derate factor',
        confidence: 'UNCONFIRMED'
      },
      {
        offset: 0x5752,
        mcuAddr: 0x08005752,
        bytes: '19 22 52 43',
        mnemonic: 'MULS',
        operands: 'r2, r0, #25',
        comment: '×25 scaling block — Candidate: Battery voltage / cell count',
        confidence: 'UNCONFIRMED'
      },
      {
        offset: 0x5778,
        mcuAddr: 0x08005778,
        bytes: 'C8 22 52 43',
        mnemonic: 'MULS',
        operands: 'r2, r0, #200',
        comment: '×200 scaling block — Candidate: Power (mW) or RPM step',
        confidence: 'UNCONFIRMED'
      }
    ]
  }
];

export const RAM_PARAMETER_MAP: RamMapEntry[] = [
  { id: '1', paramId: '0x12', ramAddress: '0x200014AD', currentHypothesis: 'Parameter 0x12 Slot', confidence: 'UNCONFIRMED', notes: 'Read in config parsing loop' },
  { id: '2', paramId: '0x14', ramAddress: '0x200014AF', currentHypothesis: 'Parameter 0x14 Slot', confidence: 'UNCONFIRMED', notes: 'Read in config parsing loop' },
  { id: '3', paramId: '0x16', ramAddress: '0x200014B1', currentHypothesis: 'Parameter 0x16 Slot', confidence: 'UNCONFIRMED', notes: 'Candidate: Secondary limit / current' },
  { id: '4', paramId: '0x18', ramAddress: '0x200014B3', currentHypothesis: 'Parameter 0x18 Slot', confidence: 'UNCONFIRMED', notes: 'Read in config parsing loop' },
  { id: '5', paramId: '0x1A', ramAddress: '0x200014B5', currentHypothesis: 'Parameter 0x1A Slot', confidence: 'UNCONFIRMED', notes: 'Read in config parsing loop' },
  { id: '6', paramId: '0x1C', ramAddress: '0x200014B7', currentHypothesis: 'Parameter 0x1C Slot', confidence: 'UNCONFIRMED', notes: 'Read in config parsing loop' },
  { id: '7', paramId: '0x1E', ramAddress: '0x200014B9', currentHypothesis: 'Parameter 0x1E Slot', confidence: 'UNCONFIRMED', notes: 'Read in config parsing loop' },
  { id: '8', paramId: '0x20', ramAddress: '0x200014BB', currentHypothesis: 'Parameter 0x20 Slot', confidence: 'UNCONFIRMED', notes: 'Read in config parsing loop' },
  { id: '9', paramId: '0x22', ramAddress: '0x200014BD', currentHypothesis: 'Parameter 0x22 Slot', confidence: 'UNCONFIRMED', notes: 'Read in config parsing loop' },
  { id: '10', paramId: '0x24', ramAddress: '0x200014BF', currentHypothesis: 'Parameter 0x24 Slot', confidence: 'UNCONFIRMED', notes: 'Read in config parsing loop' },
  { id: '11', paramId: '0x26', ramAddress: '0x200014C1', currentHypothesis: 'Parameter 0x26 Slot', confidence: 'UNCONFIRMED', notes: 'Read in config parsing loop' },
  { id: '12', paramId: '0x28', ramAddress: '0x200014C3', currentHypothesis: 'Parameter 0x28 Slot', confidence: 'UNCONFIRMED', notes: 'Read in config parsing loop' },
  { id: '13', paramId: '0x2A', ramAddress: '0x200014C5', currentHypothesis: 'Parameter 0x2A Slot', confidence: 'UNCONFIRMED', notes: 'Read in config parsing loop' }
];

export const MATH_SCALING_BLOCKS: MathBlockEntry[] = [
  {
    id: 'math-1',
    offset: '0x5C84',
    mcuAddress: '0x08005C84',
    operation: 'r0 = (raw * 174) / 10',
    multiplier: '×174 / 10 (×17.4)',
    rawInstructions: 'MOVS r2, #0xAE; MULS r2, r0, r2; MOVS r3, #10; UDIV r0, r2, r3',
    candidateMeaning: 'Speed limit scaling from raw +0x09 config to control+0x18',
    confidence: 'CONFIRMED',
    category: 'speed'
  },
  {
    id: 'math-2',
    offset: '0x5714',
    mcuAddress: '0x08005714',
    operation: 'r2 = (r0 * 18) / 10',
    multiplier: '×18 / 10 (×1.8)',
    rawInstructions: 'MOVS r2, #18; MULS r2, r0, r2; MOVS r3, #10; UDIV r2, r2, r3',
    candidateMeaning: 'Shunt amplifier ADC voltage to current (A) conversion',
    confidence: 'UNCONFIRMED',
    category: 'current'
  },
  {
    id: 'math-3',
    offset: '0x5730',
    mcuAddress: '0x08005730',
    operation: 'r2 = (r0 * 7) / 10',
    multiplier: '×7 / 10 (×0.7)',
    rawInstructions: 'MOVS r2, #7; MULS r2, r0, r2; MOVS r3, #10; UDIV r2, r2, r3',
    candidateMeaning: 'Eco / Derating 70% power/speed reduction factor',
    confidence: 'UNCONFIRMED',
    category: 'speed'
  },
  {
    id: 'math-4',
    offset: '0x5752',
    mcuAddress: '0x08005752',
    operation: 'r2 = r0 * 25',
    multiplier: '×25',
    rawInstructions: 'MOVS r2, #25; MULS r2, r0, r2',
    candidateMeaning: 'Battery voltage divider scaling (mV / 25)',
    confidence: 'UNCONFIRMED',
    category: 'power'
  },
  {
    id: 'math-5',
    offset: '0x5778',
    mcuAddress: '0x08005778',
    operation: 'r2 = r0 * 200',
    multiplier: '×200',
    rawInstructions: 'MOVS r2, #0xC8; MULS r2, r0, r2',
    candidateMeaning: 'Power limit computation (mW step or torque ref clamp)',
    confidence: 'UNCONFIRMED',
    category: 'power'
  },
  {
    id: 'math-6',
    offset: '0x5786',
    mcuAddress: '0x08005786',
    operation: 'r2 = r0 * 30',
    multiplier: '×30',
    rawInstructions: 'MOVS r2, #30; MULS r2, r0, r2',
    candidateMeaning: 'Temperature sensor NTC linear approximation step',
    confidence: 'UNCONFIRMED',
    category: 'thermal'
  },
  {
    id: 'math-7',
    offset: '0x579A',
    mcuAddress: '0x0800579A',
    operation: 'r2 = r0 * 100',
    multiplier: '×100',
    rawInstructions: 'MOVS r2, #100; MULS r2, r0, r2',
    candidateMeaning: 'Percentage base (100%) or duty cycle norm',
    confidence: 'UNCONFIRMED',
    category: 'thermal'
  }
];

export const SPEED_PRESETS = [
  { value: 25, hexImm: '19', label: '25 km/h (Standard Stock Limit)' },
  { value: 30, hexImm: '1E', label: '30 km/h (Moderate Boost)' },
  { value: 32, hexImm: '20', label: '32 km/h (US Spec Standard)' },
  { value: 35, hexImm: '23', label: '35 km/h (High Speed Target)' },
  { value: 40, hexImm: '28', label: '40 km/h (Max Unleashed)' },
];

export const KERS_OPTIONS = [
  {
    id: 'disabled',
    label: '0A Отключена полностью (Полный накат / Freewheel)',
    description: 'Полное отсутствие торможения двигателем при отпускании газа. Самокат катится свободно по инерции. Ручка тормоза сохраняет 100% эффективность.',
    hexImm: '00',
    opcode: '00 20',
    asm: 'MOVS r0, #0',
    confidence: 'STRONG CANDIDATE'
  },
  {
    id: 'weak',
    label: 'Слабая рекуперация (Weak Regen)',
    description: 'Минимальное торможение двигателем при сбросе газа.',
    hexImm: '01',
    opcode: '01 20',
    asm: 'MOVS r0, #1',
    confidence: 'STRONG CANDIDATE'
  },
  {
    id: 'stock',
    label: 'Заводская рекуперация (Stock / Dynamic Profile)',
    description: 'Оригинальный алгоритм загрузки параметров из структуры r7 + 11.',
    hexImm: 'STOCK',
    opcode: '78 7B',
    asm: 'LDRB r0, [r7, #11]',
    confidence: 'CONFIRMED'
  }
];

/**
 * Creates a valid synthetic slice of mcu_xiaomi.scooter.5plus.bin (125,371 bytes)
 * with the exact confirmed signature, speed hook, cert header, and offsets.
 */
export function generateReferenceFirmwareBuffer(): Uint8Array {
  const buffer = new Uint8Array(125371);
  // ARM Cortex-M Vector table at 0x0000
  buffer[0] = 0x00; buffer[1] = 0x20; buffer[2] = 0x00; buffer[3] = 0x20; // Stack pointer 0x20002000
  buffer[4] = 0x09; buffer[5] = 0x01; buffer[6] = 0x00; buffer[7] = 0x08; // Reset vector 0x08000109

  // Place MCU identifier string at 0x1000
  const mcuId = 'SZMC-ES-02664-LQ';
  for (let i = 0; i < mcuId.length; i++) {
    buffer[0x1000 + i] = mcuId.charCodeAt(i);
  }

  // Place signature at 0x5C74: AB 49 78 7A 08 80 (Speed Limit Hook)
  buffer[0x5c74] = 0xab;
  buffer[0x5c75] = 0x49;
  buffer[0x5c76] = 0x78; // LDRB r0, [r7, #9]
  buffer[0x5c77] = 0x7a;
  buffer[0x5c78] = 0x08; // STRH r0, [r1, #0]
  buffer[0x5c79] = 0x80;

  // Place scaling math at 0x5C84
  buffer[0x5c84] = 0xae; buffer[0x5c85] = 0x22; // MOVS r2, #0xAE (174)
  buffer[0x5c86] = 0x52; buffer[0x5c87] = 0x43; // MULS r2, r0, r2
  buffer[0x5c88] = 0x0a; buffer[0x5c89] = 0x23; // MOVS r3, #10

  // Place signature at 0x5C9C: AB 48 78 7B 40 B1 (KERS Recuperation Hook)
  buffer[0x5c9c] = 0xab;
  buffer[0x5c9d] = 0x48;
  buffer[0x5c9e] = 0x78; // LDRB r0, [r7, #11]
  buffer[0x5c9f] = 0x7b;
  buffer[0x5ca0] = 0x40; // CBZ r0, ...
  buffer[0x5ca1] = 0xb1;

  // Place certificate marker at end of binary
  const certMarker = '-----BEGIN CERTIFICATE-----\nMIIB...SZMC-ES-02664-LQ\n-----END CERTIFICATE-----';
  const certOffset = 125371 - certMarker.length - 64;
  for (let i = 0; i < certMarker.length; i++) {
    buffer[certOffset + i] = certMarker.charCodeAt(i);
  }

  return buffer;
}
