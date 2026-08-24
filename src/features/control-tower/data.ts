import { and, desc, eq } from "drizzle-orm";

import {
  projectCurrentOperations,
  projectJobTimeline,
} from "@/features/current-operations";
import type {
  IssueAssignment,
  JobSnapshot,
  OperationalIssue,
} from "@/features/current-operations";
import { calculateFacilityPerformance } from "@/features/facility-performance";
import type {
  FacilityPerformanceWindow,
  FacilityPerformanceWindowKey,
} from "@/features/facility-performance/types";
import {
  listManufacturingEvents,
  resolveFacilityAsOf,
} from "@/features/manufacturing-events/repository";
import type {
  Facility,
  NormalizedManufacturingEvent,
  Priority,
} from "@/features/manufacturing-events";
import type { EventType } from "@/features/manufacturing-events/types";
import type { HeliconDatabase } from "@db/client";
import {
  eventImports,
  operationalIssueAssignments,
  responders,
} from "@db/schema";

import type {
  Assignee,
  ControlTowerIssue,
  ControlTowerJob,
  ControlTowerPageData,
  ImportQualitySummary,
  JobCondition,
  JobDetail,
  PerformanceWindow,
  Responder,
  Severity,
  TimelineEvent,
} from "./types";

const CONTROL_TOWER_EVENT_TYPES = [
  "job_created",
  "tool_ready",
  "job_started",
  "cycle_completed",
  "job_blocked",
  "job_unblocked",
  "job_hold",
  "job_completed",
] satisfies EventType[];

function conditionForJob(job: JobSnapshot, asOf: string): JobCondition {
  if (job.state === "blocked") return "blocked";
  if (job.state === "held") return "held";
  if (!job.startedAt) return "not-started";
  if (Date.parse(job.targetDueAt) < Date.parse(asOf)) return "past-due";
  return "active";
}

function mapJob(job: JobSnapshot, asOf: string): ControlTowerJob {
  return {
    jobId: job.jobId,
    priority: job.priority,
    condition: conditionForJob(job, asOf),
    ...(job.blockReason && { conditionReason: job.blockReason }),
    conditionSince: job.currentConditionSince,
    createdAt: job.createdAt,
    ...(job.startedAt && { startedAt: job.startedAt }),
    customerId: job.customerId,
    partId: job.partId,
    material: job.material,
    targetQuantity: job.targetQuantity,
    producedQuantity: job.producedQuantity,
    remainingQuantity: job.remainingQuantity,
    targetDueAt: job.targetDueAt,
    ...(job.machineId && { machineId: job.machineId }),
    ...(job.toolId && { toolId: job.toolId }),
    ...(job.operatorId && { operatorId: job.operatorId }),
  };
}

function mapIssue(issue: OperationalIssue): ControlTowerIssue {
  return {
    issueKey: issue.issueKey,
    jobId: issue.jobId,
    severity: issue.severity,
    condition: issue.condition === "past_due" ? "past-due" : issue.condition,
    ...(issue.job.blockReason && { conditionReason: issue.job.blockReason }),
    detectedAt: issue.detectedAt,
    affectedUnits: issue.affectedUnits,
    recommendedAction: issue.recommendedAction,
    ...(issue.assignee && { assignee: issue.assignee }),
    jobPriority: issue.job.priority,
  };
}

function comparePriority(left: Priority, right: Priority) {
  const rank: Record<Priority, number> = { high: 0, normal: 1, low: 2 };
  return rank[left] - rank[right];
}

function compareIssues(left: ControlTowerIssue, right: ControlTowerIssue) {
  const severityRank: Record<Severity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  return (
    severityRank[left.severity] - severityRank[right.severity] ||
    comparePriority(left.jobPriority, right.jobPriority) ||
    right.affectedUnits - left.affectedUnits ||
    Date.parse(left.detectedAt) - Date.parse(right.detectedAt) ||
    left.jobId.localeCompare(right.jobId)
  );
}

function mapPerformanceWindow(
  window: FacilityPerformanceWindow,
): PerformanceWindow {
  const prior = window.prior;
  const labels: Record<FacilityPerformanceWindowKey, string> = {
    "7d": "TRAILING 7 DAYS",
    "14d": "TRAILING 14 DAYS",
    all: "ALL RECORDED HISTORY",
  };

  return {
    key: window.key,
    label: labels[window.key],
    onTimeCompletion: {
      value: window.current.onTimeCompletion.rate,
      numerator: window.current.onTimeCompletion.onTimeJobs,
      denominator: window.current.onTimeCompletion.completedJobs,
      priorValue: prior?.onTimeCompletion.rate ?? null,
      delta: window.comparison.onTimeCompletionPercentagePoints,
      deltaUnit: "percentage-points",
    },
    goodUnitsProduced: {
      value: window.current.goodUnitsProduced.units,
      priorValue: prior?.goodUnitsProduced.units ?? null,
      delta: window.comparison.goodUnitsProducedPercent,
      deltaUnit: "percent",
      dailyValues: window.current.dailyGoodUnits.map(
        (bucket) => bucket.goodUnits,
      ),
    },
    productionYield: {
      value: window.current.productionYield.rate,
      priorValue: prior?.productionYield.rate ?? null,
      delta: window.comparison.productionYieldPercentagePoints,
      deltaUnit: "percentage-points",
      goodUnits: window.current.productionYield.goodUnits,
      scrapUnits: window.current.productionYield.scrapUnits,
    },
  };
}

async function loadAssignments(db: HeliconDatabase) {
  const rows = await db
    .select({
      issueKey: operationalIssueAssignments.issueKey,
      jobId: operationalIssueAssignments.jobId,
      responderId: responders.id,
      displayName: responders.displayName,
      role: responders.role,
      assignedAt: operationalIssueAssignments.assignedAt,
    })
    .from(operationalIssueAssignments)
    .innerJoin(
      responders,
      eq(operationalIssueAssignments.responderId, responders.id),
    );

  const assignments = rows.map((row) => ({
    issueKey: row.issueKey,
    jobId: row.jobId,
    responderId: row.responderId,
    displayName: row.displayName,
    role: row.role,
    assignedAt: new Date(row.assignedAt).toISOString(),
  })) satisfies IssueAssignment[];

  return assignments;
}

async function loadResponders(db: HeliconDatabase): Promise<Responder[]> {
  return db
    .select({
      id: responders.id,
      displayName: responders.displayName,
      role: responders.role,
    })
    .from(responders)
    .where(eq(responders.active, true));
}

async function loadImportQuality(
  db: HeliconDatabase,
): Promise<ImportQualitySummary | null> {
  const [latest] = await db
    .select({
      sourceName: eventImports.sourceName,
      completedAt: eventImports.completedAt,
      totalLineCount: eventImports.totalLineCount,
      acceptedEventCount: eventImports.acceptedEventCount,
      invalidLineCount: eventImports.invalidLineCount,
      identicalDuplicateCount: eventImports.identicalDuplicateCount,
      conflictingDuplicateCount: eventImports.conflictingDuplicateCount,
      report: eventImports.report,
    })
    .from(eventImports)
    .where(eq(eventImports.status, "completed"))
    .orderBy(desc(eventImports.completedAt))
    .limit(1);

  if (!latest?.completedAt || !latest.report) return null;

  const coverage = latest.report.coverage;
  const missingFields = [
    { label: "operator", count: coverage.jobStartedWithoutOperator },
    { label: "inspector", count: coverage.inspectionWithoutInspector },
    { label: "tool", count: coverage.cycleWithoutTool },
    { label: "machine", count: coverage.cycleWithoutMachine },
  ].filter((item) => item.count > 0);

  return {
    sourceName: latest.sourceName,
    completedAt: new Date(latest.completedAt).toISOString(),
    totalLineCount: latest.totalLineCount,
    acceptedEventCount: latest.acceptedEventCount,
    invalidLineCount: latest.invalidLineCount,
    repeatedEventIdCount: latest.report.repeatedEventIdCount,
    identicalDuplicateCount: latest.identicalDuplicateCount,
    conflictingDuplicateCount: latest.conflictingDuplicateCount,
    missingFields,
  };
}

export async function getControlTowerPageData(
  db: HeliconDatabase,
  facility: Facility,
): Promise<ControlTowerPageData> {
  const asOf = await resolveFacilityAsOf(db, facility);
  const events = await listManufacturingEvents(db, {
    facility,
    asOf,
    eventTypes: CONTROL_TOWER_EVENT_TYPES,
  });
  const assignments = await loadAssignments(db);
  const roster = await loadResponders(db);
  const importQuality = await loadImportQuality(db);
  const performance = calculateFacilityPerformance(events, { facility, asOf });
  const operations = projectCurrentOperations(events, {
    facility,
    asOf,
    assignments,
  });
  const issues = operations.currentIssues.map(mapIssue);
  issues.sort(compareIssues);
  const issueByJob = new Map(issues.map((issue) => [issue.jobId, issue]));
  const mapJobs = (source: JobSnapshot[]) =>
    source.map((snapshot) => {
      const job = mapJob(snapshot, asOf);
      const currentIssue = issueByJob.get(job.jobId);
      return { ...job, ...(currentIssue && { currentIssue }) };
    });
  const notStarted = mapJobs(operations.views.notStarted).sort(
    (left, right) =>
      Date.parse(left.targetDueAt) - Date.parse(right.targetDueAt),
  );
  const activeWip = mapJobs(operations.views.activeWip).sort(
    (left, right) =>
      comparePriority(left.priority, right.priority) ||
      Date.parse(left.targetDueAt) - Date.parse(right.targetDueAt),
  );
  const dueNext24Hours = mapJobs(operations.views.dueNext24Hours).sort(
    (left, right) =>
      Date.parse(left.targetDueAt) - Date.parse(right.targetDueAt) ||
      comparePriority(left.priority, right.priority),
  );
  const blockedHeld = mapJobs(operations.views.blockedOrHeld).sort(
    (left, right) =>
      comparePriority(left.priority, right.priority) ||
      Date.parse(left.conditionSince) - Date.parse(right.conditionSince),
  );
  const pastDue = mapJobs(operations.views.pastDueWip).sort(
    (left, right) =>
      comparePriority(left.priority, right.priority) ||
      Date.parse(left.targetDueAt) - Date.parse(right.targetDueAt),
  );
  const needsAssignment = issues.filter((issue) => !issue.assignee);

  return {
    facility,
    asOf,
    performance: {
      "7d": mapPerformanceWindow(performance.windows["7d"]),
      "14d": mapPerformanceWindow(performance.windows["14d"]),
      all: mapPerformanceWindow(performance.windows.all),
    },
    counts: {
      "needs-assignment": needsAssignment.length,
      "not-started": notStarted.length,
      "active-wip": activeWip.length,
      "due-next-24h": dueNext24Hours.length,
      "blocked-held": blockedHeld.length,
      "past-due-wip": pastDue.length,
    },
    views: {
      "needs-assignment": needsAssignment,
      "not-started": notStarted,
      "active-wip": activeWip,
      "due-next-24h": dueNext24Hours,
      "blocked-held": blockedHeld,
      "past-due-wip": pastDue,
    },
    currentIssues: issues,
    responders: roster,
    importQuality,
  };
}

function timelineEvent(event: NormalizedManufacturingEvent): TimelineEvent {
  return {
    eventId: event.eventId,
    eventType: event.eventType,
    occurredAt: event.occurredAt,
    quantity: event.quantity,
    ...(event.machineId && { machineId: event.machineId }),
    ...(event.metadata.toolId && { toolId: event.metadata.toolId }),
    ...(event.metadata.operatorId && { operatorId: event.metadata.operatorId }),
    ...(event.metadata.defectCode && {
      defectCode: event.metadata.defectCode,
    }),
    ...(event.metadata.reason && { reason: event.metadata.reason }),
  };
}

export async function getControlTowerJobDetail(
  db: HeliconDatabase,
  facility: Facility,
  jobId: string,
): Promise<JobDetail> {
  const asOf = await resolveFacilityAsOf(db, facility);
  const events = await listManufacturingEvents(db, { facility, asOf, jobId });
  const projected = projectJobTimeline(events, { facility, asOf, jobId });
  const completion = events.find(
    (event) => event.eventType === "job_completed",
  );
  const passed = events.filter(
    (event) => event.eventType === "inspection_passed",
  );
  const failed = events.filter(
    (event) => event.eventType === "inspection_failed",
  );
  const ready = [...events]
    .reverse()
    .find(
      (event) =>
        event.eventType === "tool_ready" &&
        event.metadata.toolId &&
        event.machineId,
    );

  return {
    job: mapJob(projected.job, asOf),
    goodUnits: completion?.metadata.goodQuantity ?? null,
    scrapUnits: completion?.metadata.scrapQuantity ?? null,
    cycleCount: events.filter((event) => event.eventType === "cycle_completed")
      .length,
    inspectedPassed: passed.reduce((sum, event) => sum + event.quantity, 0),
    inspectedFailed: failed.reduce((sum, event) => sum + event.quantity, 0),
    defectCodes: [
      ...new Set(failed.flatMap((event) => event.metadata.defectCode ?? [])),
    ],
    ...(ready?.machineId && {
      toolLocation: {
        locationId: ready.machineId,
        reportedAt: ready.occurredAt,
      },
    }),
    timeline: events.map(timelineEvent),
  };
}

export async function assignControlTowerIssue(
  db: HeliconDatabase,
  input: {
    facility: Facility;
    issueKey: string;
    jobId: string;
    responderId: string;
  },
) {
  const asOf = await resolveFacilityAsOf(db, input.facility);
  const events = await listManufacturingEvents(db, {
    facility: input.facility,
    asOf,
    jobId: input.jobId,
  });
  const timeline = projectJobTimeline(events, {
    facility: input.facility,
    asOf,
    jobId: input.jobId,
  });
  const job = timeline.job;
  const activeIssueKey =
    job.state === "blocked" || job.state === "held"
      ? `${job.state}:${job.jobId}:${job.currentConditionEventId}`
      : !job.completedAt && Date.parse(job.targetDueAt) < Date.parse(asOf)
        ? `past_due:${job.jobId}:${job.targetDueAt}`
        : null;
  if (activeIssueKey !== input.issueKey) {
    throw new Error("This issue is no longer active.");
  }

  const [responder] = await db
    .select({
      id: responders.id,
      displayName: responders.displayName,
      role: responders.role,
    })
    .from(responders)
    .where(
      and(eq(responders.id, input.responderId), eq(responders.active, true)),
    )
    .limit(1);
  if (!responder) throw new Error("The selected technician is unavailable.");

  const assignedAt = new Date().toISOString();
  await db
    .insert(operationalIssueAssignments)
    .values({
      issueKey: input.issueKey,
      jobId: job.jobId,
      responderId: responder.id,
      assignedAt,
    })
    .onConflictDoUpdate({
      target: operationalIssueAssignments.issueKey,
      set: {
        jobId: job.jobId,
        responderId: responder.id,
        assignedAt,
      },
    });

  return {
    issueKey: input.issueKey,
    assignment: {
      responderId: responder.id,
      displayName: responder.displayName,
      role: responder.role,
      assignedAt,
    } satisfies Assignee,
  };
}
