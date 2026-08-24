export const EVENT_TYPES = [
  "job_created",
  "tool_ready",
  "job_started",
  "cycle_completed",
  "inspection_passed",
  "inspection_failed",
  "job_blocked",
  "job_unblocked",
  "job_hold",
  "job_completed",
  "maintenance_ping",
  "material_lot_scan",
  "sensor_glitch",
  "shift_handoff",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const FACILITIES = ["la_01", "la_02"] as const;
export type Facility = (typeof FACILITIES)[number];

export const PRIORITIES = ["low", "normal", "high"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const DEFECT_CODES = [
  "voids",
  "delamination",
  "dimensional",
  "surface",
  "resin_rich",
  "other",
] as const;
export type DefectCode = (typeof DEFECT_CODES)[number];

export const BLOCK_REASONS = [
  "missing_tool",
  "material_wait",
  "engineering_hold",
  "awaiting_qc",
  "machine_fault",
] as const;
export type BlockReason = (typeof BLOCK_REASONS)[number];

export const RESOLVED_BLOCK_REASONS = [
  "resolved_missing_tool",
  "resolved_material_wait",
  "resolved_engineering_hold",
  "resolved_awaiting_qc",
  "resolved_machine_fault",
] as const;
export type ResolvedBlockReason = (typeof RESOLVED_BLOCK_REASONS)[number];

export const SENSOR_SIGNALS = ["temp", "pressure", "platen"] as const;
export type SensorSignal = (typeof SENSOR_SIGNALS)[number];

export type NormalizedEventMetadata = {
  facility: Facility;
  priority?: Priority;
  targetDueAt?: string;
  targetQuantity?: number;
  unitPriceEstimate?: number;
  toolId?: string;
  operatorId?: string;
  cycleTimeSeconds?: number;
  defectCode?: DefectCode;
  inspectorId?: string;
  reason?: BlockReason | ResolvedBlockReason;
  goodQuantity?: number;
  scrapQuantity?: number;
  lotId?: string;
  signal?: SensorSignal;
};

export type NormalizedManufacturingEvent = {
  eventId: string;
  occurredAt: string;
  eventType: EventType;
  jobId: string;
  partId: string;
  customerId: string;
  machineId: string | null;
  material: string;
  quantity: number;
  metadata: NormalizedEventMetadata;
  sourceLine: number;
  payloadFingerprint: string;
};

export type ValidationDetail = {
  path: string;
  message: string;
};

export type ImportIssueCode =
  | "invalid_json"
  | "invalid_event"
  | "identical_duplicate"
  | "conflicting_duplicate";

export type ImportIssue = {
  code: ImportIssueCode;
  lineNumber: number;
  eventId?: string;
  message: string;
  details?: ValidationDetail[];
};

export type RawRecordDisposition = "blank" | "accepted" | ImportIssueCode;

export type RawEventRecord = {
  lineNumber: number;
  rawLine: string;
  rawPayload?: unknown;
  eventId?: string;
  payloadFingerprint?: string;
  disposition: RawRecordDisposition;
};

export type CoverageReport = {
  jobStartedWithoutOperator: number;
  inspectionWithoutInspector: number;
  cycleWithoutTool: number;
  cycleWithoutMachine: number;
  jobCreatedWithoutUnitPrice: number;
};

export type ImportReport = {
  totalLineCount: number;
  blankLineCount: number;
  nonEmptyLineCount: number;
  acceptedEventCount: number;
  invalidLineCount: number;
  duplicateOccurrenceCount: number;
  repeatedEventIdCount: number;
  identicalDuplicateCount: number;
  conflictingDuplicateCount: number;
  firstOccurredAt: string | null;
  lastOccurredAt: string | null;
  eventTypeCounts: Record<EventType, number>;
  coverage: CoverageReport;
};

export type IngestionResult = {
  events: NormalizedManufacturingEvent[];
  rawRecords: RawEventRecord[];
  issues: ImportIssue[];
  report: ImportReport;
};

export type JsonLineSource = Iterable<string> | AsyncIterable<string>;
