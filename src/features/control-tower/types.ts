import type { Facility, Priority } from "@/features/manufacturing-events";
import type {
  DefectCode,
  EventType,
} from "@/features/manufacturing-events/types";

export type PerformanceWindowKey = "7d" | "14d" | "all";
export type OperationsViewKey =
  | "needs-assignment"
  | "not-started"
  | "active-wip"
  | "due-next-24h"
  | "blocked-held"
  | "past-due-wip";
export type PriorityFilter = "all" | Priority;
export type Severity = "critical" | "high" | "medium" | "low";
export type JobCondition =
  "not-started" | "active" | "blocked" | "held" | "past-due";

export type PerformanceMetric = {
  value: number | null;
  numerator?: number;
  denominator?: number;
  priorValue: number | null;
  delta: number | null;
  deltaUnit: "percent" | "percentage-points";
};

export type ProductionMetric = PerformanceMetric & {
  dailyValues: number[];
};

export type PerformanceWindow = {
  key: PerformanceWindowKey;
  label: string;
  onTimeCompletion: PerformanceMetric;
  goodUnitsProduced: ProductionMetric;
  productionYield: PerformanceMetric & {
    goodUnits?: number;
    scrapUnits?: number;
  };
};

export type Assignee = {
  responderId: string;
  displayName: string;
  role: string;
  assignedAt: string;
};

export type Responder = {
  id: string;
  displayName: string;
  role: string;
};

export type ControlTowerJob = {
  jobId: string;
  priority: Priority;
  condition: JobCondition;
  conditionReason?: string;
  conditionSince: string;
  createdAt: string;
  startedAt?: string;
  customerId: string;
  partId: string;
  material: string;
  targetQuantity: number;
  producedQuantity: number;
  remainingQuantity: number;
  targetDueAt: string;
  machineId?: string;
  toolId?: string;
  operatorId?: string;
  currentIssue?: ControlTowerIssue;
};

export type ControlTowerIssue = {
  issueKey: string;
  jobId: string;
  severity: Severity;
  condition: Exclude<JobCondition, "active">;
  conditionReason?: string;
  detectedAt: string;
  affectedUnits: number;
  recommendedAction: string;
  assignee?: Assignee;
  jobPriority: Priority;
};

export type OperationsCounts = Record<OperationsViewKey, number>;

export type OperationsViews = {
  "needs-assignment": ControlTowerIssue[];
  "not-started": ControlTowerJob[];
  "active-wip": ControlTowerJob[];
  "due-next-24h": ControlTowerJob[];
  "blocked-held": ControlTowerJob[];
  "past-due-wip": ControlTowerJob[];
};

export type ImportQualitySummary = {
  sourceName: string;
  completedAt: string;
  totalLineCount: number;
  acceptedEventCount: number;
  invalidLineCount: number;
  repeatedEventIdCount: number;
  identicalDuplicateCount: number;
  conflictingDuplicateCount: number;
  missingFields: Array<{ label: string; count: number }>;
};

export type ControlTowerPageData = {
  facility: Facility;
  asOf: string;
  performance: Record<PerformanceWindowKey, PerformanceWindow>;
  counts: OperationsCounts;
  views: OperationsViews;
  currentIssues: ControlTowerIssue[];
  responders: Responder[];
  importQuality: ImportQualitySummary | null;
};

export type TimelineEvent = {
  eventId: string;
  eventType: EventType;
  occurredAt: string;
  quantity: number;
  machineId?: string;
  toolId?: string;
  operatorId?: string;
  defectCode?: DefectCode;
  reason?: string;
};

export type JobDetail = {
  job: ControlTowerJob;
  goodUnits: number | null;
  scrapUnits: number | null;
  cycleCount: number;
  inspectedPassed: number;
  inspectedFailed: number;
  defectCodes: DefectCode[];
  toolLocation?: {
    locationId: string;
    reportedAt: string;
  };
  timeline: TimelineEvent[];
};

export type AssignmentResult =
  | { ok: true; assignment: Assignee; issueKey: string }
  | { ok: false; message: string };
