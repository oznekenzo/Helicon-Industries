import type {
  BlockReason,
  Facility,
  NormalizedManufacturingEvent,
  Priority,
} from "@/features/manufacturing-events";

export type JobState = "created" | "started" | "blocked" | "held" | "completed";

export type OperationalIssueCondition = "blocked" | "held" | "past_due";

export type IssueSeverity = "critical" | "high" | "medium" | "low";

export type JobSnapshot = {
  jobId: string;
  facility: Facility;
  customerId: string;
  partId: string;
  material: string;
  priority: Priority;
  targetQuantity: number;
  targetDueAt: string;
  state: JobState;
  createdAt: string;
  createdEventId: string;
  startedAt?: string;
  startedEventId?: string;
  completedAt?: string;
  machineId?: string;
  toolId?: string;
  operatorId?: string;
  producedQuantity: number;
  remainingQuantity: number;
  currentConditionSince: string;
  currentConditionEventId: string;
  currentConditionMachineId?: string;
  blockReason?: BlockReason;
  sourceEventIds: string[];
};

export type IssueOwner = {
  responderId: string;
  displayName: string;
  role: string;
  assignedAt: string;
};

export type IssueAssignment = IssueOwner & {
  issueKey: string;
  jobId: string;
};

export type OperationalIssue = {
  issueKey: string;
  jobId: string;
  condition: OperationalIssueCondition;
  severity: IssueSeverity;
  detectedAt: string;
  conditionAgeSeconds: number;
  affectedUnits: number;
  dueAt: string;
  recommendedAction: string;
  evidenceEventIds: string[];
  owner?: IssueOwner;
  job: JobSnapshot;
};

export type CurrentOperationsCounts = {
  actionRequired: number;
  activeWip: number;
  dueNext24Hours: number;
  blockedOrHeld: number;
  pastDueWip: number;
  needsOwner: number;
};

export type CurrentOperationsSnapshot = {
  facility: Facility;
  asOf: string;
  counts: CurrentOperationsCounts;
  views: {
    actionRequired: OperationalIssue[];
    activeWip: JobSnapshot[];
    dueNext24Hours: JobSnapshot[];
    blockedOrHeld: JobSnapshot[];
    pastDueWip: JobSnapshot[];
    needsOwner: OperationalIssue[];
  };
};

export type JobTimeline = {
  facility: Facility;
  asOf: string;
  job: JobSnapshot;
  events: NormalizedManufacturingEvent[];
};

export type Responder = {
  id: string;
  displayName: string;
  role: string;
};

export type ProjectCurrentOperationsInput = {
  facility: Facility;
  asOf: string;
  assignments?: IssueAssignment[];
};
