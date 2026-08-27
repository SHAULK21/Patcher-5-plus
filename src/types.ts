export type ConfidenceLevel = 'CONFIRMED' | 'STRONG CANDIDATE' | 'UNCONFIRMED' | 'REFUTED';

export interface REItem {
  id: string;
  category: 'speed' | 'modes' | 'current_power' | 'security';
  title: string;
  titleRu: string;
  confidence: ConfidenceLevel;
  mcuAddress?: string;
  fileOffset?: string;
  originalBytes?: string;
  patchedBytes?: string;
  description: string;
  descriptionRu: string;
  evidence: string[];
  evidenceRu: string[];
  caveats?: string;
  caveatsRu?: string;
}

export interface ModeEntry {
  modeName: string;
  modeNameRu: string;
  code: number;
  nominalSpeedKmh: number;
  scaledInternalValue: number;
  status: ConfidenceLevel;
  storageType: string;
  storageTypeRu: string;
  details: string;
  detailsRu: string;
}

export interface DataFlowStep {
  step: number;
  name: string;
  nameRu: string;
  location: string;
  codeSnippet: string;
  description: string;
  descriptionRu: string;
  status: ConfidenceLevel;
}

export interface MemoryEntry {
  id: string;
  offsetOrAddr: string;
  sizeBytes: number;
  type: 'Flash' | 'RAM' | 'Register';
  name: string;
  description: string;
  status: ConfidenceLevel;
}

export interface HookPattern {
  id: string;
  name: string;
  nameRu: string;
  patternHex: string; // e.g. "?? 49 78 7A 08 80"
  description: string;
  descriptionRu: string;
  regexStr: string;
  isPristine: boolean;
  isAlreadyPatched: boolean;
}

export interface FirmwareFingerprint {
  modelTag: string;
  mcuArch: string;
  baseAddress: string;
  vectorTableOffset: string;
  minFirmwareSize: number;
  maxFirmwareSize: number;
  knownHardwareRevisions: string[];
  indicators: {
    rule: string;
    ruleRu: string;
    status: 'VERIFIED' | 'IN_PROGRESS';
  }[];
}

export interface DiagnosticScanResult {
  fingerprintMatch: boolean;
  fingerprintName: string;
  fileSize: number;
  
  // 5 Key Diagnostic Parameters
  selectorFound: boolean;
  selectorAddress: string;
  selectorRefInfo: string;
  selectorRefInfoRu: string;
  
  hookFound: boolean;
  hookFormId?: string;
  hookFormName?: string;
  hookFormNameRu?: string;
  
  currentModeId: number; // 0=Eco, 1=Drive, 2=Sport
  currentModeName: string;
  currentModeNameRu: string;
  
  currentSpeedByteHex: string; // e.g. "78 7A" or "23 20"
  currentSpeedDecoded: string; // e.g. "LDRB r0, [r7, #9]" or "MOVS r0, #35"
  currentSpeedKmh?: number;
  
  fileOffset?: number;
  mcuAddress?: number;
  originalBytesHex?: string;
  regBase?: string;
  structOffsetHex?: string;
  isPatched?: boolean;
  logs: string[];
}

