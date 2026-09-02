export type ConfidenceLevel = 'CONFIRMED' | 'STRONG CANDIDATE' | 'UNCONFIRMED';

export interface DataflowNode {
  id: string;
  title: string;
  subtitle: string;
  category: 'actuator' | 'clamp' | 'scaling' | 'ram' | 'hook' | 'source' | 'mode';
  confidence: ConfidenceLevel;
  addressMCU: string;
  fileOffset: string;
  bytes: string;
  thumbAsm: string;
  description: string;
  incomingFrom?: string[];
  notes?: string;
}

export interface DisassemblyInstruction {
  offset: number;
  mcuAddr: number;
  bytes: string;
  mnemonic: string;
  operands: string;
  comment?: string;
  isHook?: boolean;
  confidence?: ConfidenceLevel;
  highlight?: 'speed' | 'clamp' | 'scale' | 'ram' | 'state';
}

export interface DisassemblyRange {
  id: string;
  title: string;
  description: string;
  startOffset: number;
  endOffset: number;
  mcuBase: number;
  instructions: DisassemblyInstruction[];
}

export interface RamMapEntry {
  id: string;
  paramId: string;
  ramAddress: string;
  currentHypothesis: string;
  confidence: ConfidenceLevel;
  notes: string;
}

export interface MathBlockEntry {
  id: string;
  offset: string;
  mcuAddress: string;
  operation: string;
  multiplier: string;
  rawInstructions: string;
  candidateMeaning: string;
  confidence: ConfidenceLevel;
  category: 'speed' | 'current' | 'power' | 'thermal' | 'unknown';
}

export interface PatchConfig {
  targetSpeedImm: number; // e.g. 0x19 (25), 0x1E (30), 0x23 (35)
  customHex?: string;
  preserveSig: boolean;
  disableKers?: boolean; // Complete disable of regenerative braking on throttle release
  kersMode?: 'stock' | 'disabled' | 'low' | 'medium' | 'high';
}

export interface PatchResult {
  success: boolean;
  message: string;
  signatureFound: boolean;
  signatureOffset: number;
  originalBytes: string;
  patchedBytes: string;
  kersPatchApplied?: boolean;
  kersOriginalBytes?: string;
  kersPatchedBytes?: string;
  fileSize: number;
  sha256Original: string;
  sha256Patched: string;
  patchedBuffer?: Uint8Array;
}
