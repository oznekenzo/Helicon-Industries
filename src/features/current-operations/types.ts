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

export type IssueAssignee = {
  responderId: string;
  displayName: string;
  role: string;
  assignedAt: string;
};

export type IssueAssignment = IssueAssignee & {
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
  assignee?: IssueAssignee;
  job: JobSnapshot;
};

export type CurrentOperationsCounts = {
  needsAssignment: number;
  notStarted: number;
  activeWip: number;
  dueNext24Hours: number;
  blockedOrHeld: number;
  pastDueWip: number;
};

export type CurrentOperationsSnapshot = {
  facility: Facility;
  asOf: string;
  counts: CurrentOperationsCounts;
  currentIssues: OperationalIssue[];
  views: {
    needsAssignment: OperationalIssue[];
    notStarted: JobSnapshot[];
    activeWip: JobSnapshot[];
    dueNext24Hours: JobSnapshot[];
    blockedOrHeld: JobSnapshot[];
    pastDueWip: JobSnapshot[];
  };
};

export type JobTimeline = {
  facility: Facility;
  asOf: string;
  job: JobSnapshot;
  events: NormalizedManufacturingEvent[];
};

export type ProjectCurrentOperationsInput = {
  facility: Facility;
  asOf: string;
  assignments?: IssueAssignment[];
};
