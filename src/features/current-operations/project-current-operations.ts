import type {
  BlockReason,
  NormalizedManufacturingEvent,
  Priority,
} from "@/features/manufacturing-events";

import type {
  CurrentOperationsSnapshot,
  IssueAssignment,
  IssueSeverity,
  JobSnapshot,
  JobState,
  OperationalIssue,
  OperationalIssueCondition,
  ProjectCurrentOperationsInput,
} from "./types";

const HOURS_24_MS = 24 * 60 * 60 * 1_000;

const SEVERITY_RANK: Record<IssueSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function compareEvents(
  left: NormalizedManufacturingEvent,
  right: NormalizedManufacturingEvent,
) {
  return (
    Date.parse(left.occurredAt) - Date.parse(right.occurredAt) ||
    left.sourceLine - right.sourceLine ||
    left.eventId.localeCompare(right.eventId)
  );
}

function parseTimestamp(value: string, label: string) {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    throw new Error(`${label} must be a valid ISO-8601 timestamp.`);
  }

  return timestamp;
}

function projectJob(jobEvents: NormalizedManufacturingEvent[]): JobSnapshot {
  const events = [...jobEvents].sort(compareEvents);
  const created = events.find((event) => event.eventType === "job_created");

  if (
    !created ||
    created.metadata.priority === undefined ||
    created.metadata.targetQuantity === undefined ||
    created.metadata.targetDueAt === undefined
  ) {
    throw new Error(
      `Job ${events[0]?.jobId ?? "unknown"} is missing a complete job_created event.`,
    );
  }

  let state: JobState = "created";
  let currentConditionSince = created.occurredAt;
  let currentConditionEventId = created.eventId;
  let currentConditionMachineId = created.machineId ?? undefined;
  let blockReason: BlockReason | undefined;
  let startedAt: string | undefined;
  let startedEventId: string | undefined;
  let completedAt: string | undefined;
  let machineId: string | undefined;
  let toolId = created.metadata.toolId;
  let operatorId: string | undefined;
  let producedQuantity = 0;

  for (const event of events) {
    if (completedAt !== undefined) {
      break;
    }

    if (event.eventType === "tool_ready" && event.metadata.toolId) {
      toolId = event.metadata.toolId;
    }

    if (event.eventType === "job_started") {
      startedAt = event.occurredAt;
      startedEventId = event.eventId;
      state = "started";
      currentConditionSince = event.occurredAt;
      currentConditionEventId = event.eventId;
      currentConditionMachineId = event.machineId ?? undefined;
      blockReason = undefined;
      machineId = event.machineId ?? machineId;
      toolId = event.metadata.toolId ?? toolId;
      operatorId = event.metadata.operatorId;
      continue;
    }

    if (event.eventType === "cycle_completed") {
      producedQuantity += event.quantity;
      machineId = event.machineId ?? machineId;
      toolId = event.metadata.toolId ?? toolId;
      continue;
    }

    if (event.eventType === "job_blocked") {
      state = "blocked";
      currentConditionSince = event.occurredAt;
      currentConditionEventId = event.eventId;
      currentConditionMachineId = event.machineId ?? undefined;
      blockReason = event.metadata.reason as BlockReason;
      continue;
    }

    if (event.eventType === "job_unblocked") {
      state = startedAt === undefined ? "created" : "started";
      currentConditionSince = event.occurredAt;
      currentConditionEventId = event.eventId;
      currentConditionMachineId = event.machineId ?? undefined;
      blockReason = undefined;
      continue;
    }

    if (event.eventType === "job_hold") {
      state = "held";
      currentConditionSince = event.occurredAt;
      currentConditionEventId = event.eventId;
      currentConditionMachineId = event.machineId ?? undefined;
      blockReason = undefined;
      continue;
    }

    if (event.eventType === "job_completed") {
      state = "completed";
      completedAt = event.occurredAt;
      currentConditionSince = event.occurredAt;
      currentConditionEventId = event.eventId;
      currentConditionMachineId = event.machineId ?? undefined;
      blockReason = undefined;
    }
  }

  return {
    jobId: created.jobId,
    facility: created.metadata.facility,
    customerId: created.customerId,
    partId: created.partId,
    material: created.material,
    priority: created.metadata.priority,
    targetQuantity: created.metadata.targetQuantity,
    targetDueAt: created.metadata.targetDueAt,
    state,
    createdAt: created.occurredAt,
    createdEventId: created.eventId,
    ...(startedAt && { startedAt }),
    ...(startedEventId && { startedEventId }),
    ...(completedAt && { completedAt }),
    ...(machineId && { machineId }),
    ...(toolId && { toolId }),
    ...(operatorId && { operatorId }),
    producedQuantity,
    remainingQuantity: Math.max(
      created.metadata.targetQuantity - producedQuantity,
      0,
    ),
    currentConditionSince,
    currentConditionEventId,
    ...(currentConditionMachineId && { currentConditionMachineId }),
    ...(blockReason && { blockReason }),
    sourceEventIds: events.map((event) => event.eventId),
  };
}

function severityFor(
  condition: OperationalIssueCondition,
  priority: Priority,
): IssueSeverity {
  if (condition === "blocked" || condition === "held") {
    return {
      high: "critical",
      normal: "high",
      low: "medium",
    }[priority] as IssueSeverity;
  }

  return {
    high: "high",
    normal: "medium",
    low: "low",
  }[priority] as IssueSeverity;
}

function recommendedActionFor(
  condition: OperationalIssueCondition,
  job: JobSnapshot,
) {
  if (condition === "held") {
    return "Review the held job";
  }

  if (condition === "past_due") {
    return "Replan or expedite the past-due job";
  }

  if (!job.blockReason) {
    throw new Error(`Blocked job ${job.jobId} is missing a block reason.`);
  }

  switch (job.blockReason) {
    case "missing_tool":
      return job.toolId
        ? `Locate and stage ${job.toolId}`
        : "Locate and stage the required tool";
    case "material_wait":
      return `Expedite material for ${job.partId}`;
    case "engineering_hold":
      return "Resolve the engineering hold";
    case "awaiting_qc":
      return job.currentConditionMachineId
        ? `Complete QC review at ${job.currentConditionMachineId}`
        : "Complete the required QC review";
    case "machine_fault": {
      const affectedMachine = job.currentConditionMachineId ?? job.machineId;
      return affectedMachine
        ? `Inspect ${affectedMachine}`
        : "Inspect the affected machine";
    }
  }
}

function issueFor(
  job: JobSnapshot,
  asOfMs: number,
  assignmentByIssueKey: Map<string, IssueAssignment>,
): OperationalIssue | undefined {
  const isActiveWip =
    job.startedAt !== undefined && job.completedAt === undefined;
  let condition: OperationalIssueCondition;
  let issueKey: string;
  let detectedAt: string;
  let evidenceEventIds: string[];

  if (job.state === "blocked" || job.state === "held") {
    condition = job.state;
    issueKey = `${condition}:${job.jobId}:${job.currentConditionEventId}`;
    detectedAt = job.currentConditionSince;
    evidenceEventIds = [job.createdEventId, job.currentConditionEventId];
  } else if (isActiveWip && Date.parse(job.targetDueAt) < asOfMs) {
    condition = "past_due";
    issueKey = `past_due:${job.jobId}:${job.targetDueAt}`;
    detectedAt = job.targetDueAt;
    evidenceEventIds = [job.createdEventId];
  } else {
    return undefined;
  }

  const matchingAssignment = assignmentByIssueKey.get(issueKey);
  const assignment =
    matchingAssignment?.jobId === job.jobId ? matchingAssignment : undefined;

  return {
    issueKey,
    jobId: job.jobId,
    condition,
    severity: severityFor(condition, job.priority),
    detectedAt,
    conditionAgeSeconds: Math.max(
      Math.floor((asOfMs - Date.parse(detectedAt)) / 1_000),
      0,
    ),
    affectedUnits: job.remainingQuantity,
    dueAt: job.targetDueAt,
    recommendedAction: recommendedActionFor(condition, job),
    evidenceEventIds: [...new Set(evidenceEventIds)],
    ...(assignment && {
      owner: {
        responderId: assignment.responderId,
        displayName: assignment.displayName,
        role: assignment.role,
        assignedAt: assignment.assignedAt,
      },
    }),
    job,
  };
}

function compareIssues(left: OperationalIssue, right: OperationalIssue) {
  return (
    SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity] ||
    right.affectedUnits - left.affectedUnits ||
    Date.parse(left.dueAt) - Date.parse(right.dueAt) ||
    right.conditionAgeSeconds - left.conditionAgeSeconds ||
    left.jobId.localeCompare(right.jobId)
  );
}

function compareJobsById(left: JobSnapshot, right: JobSnapshot) {
  return left.jobId.localeCompare(right.jobId);
}

export function projectCurrentOperations(
  events: NormalizedManufacturingEvent[],
  input: ProjectCurrentOperationsInput,
): CurrentOperationsSnapshot {
  const asOfMs = parseTimestamp(input.asOf, "asOf");
  const assignmentByIssueKey = new Map(
    (input.assignments ?? []).map((assignment) => [
      assignment.issueKey,
      assignment,
    ]),
  );
  const eventsByJob = new Map<string, NormalizedManufacturingEvent[]>();

  for (const event of events) {
    if (
      event.metadata.facility !== input.facility ||
      parseTimestamp(event.occurredAt, `Event ${event.eventId} timestamp`) >
        asOfMs
    ) {
      continue;
    }

    const jobEvents = eventsByJob.get(event.jobId) ?? [];
    jobEvents.push(event);
    eventsByJob.set(event.jobId, jobEvents);
  }

  const jobs = [...eventsByJob.values()].map(projectJob);
  const activeWip = jobs
    .filter(
      (job) => job.startedAt !== undefined && job.completedAt === undefined,
    )
    .sort(compareJobsById);
  const dueNext24Hours = activeWip
    .filter((job) => {
      const dueAt = Date.parse(job.targetDueAt);
      return dueAt > asOfMs && dueAt <= asOfMs + HOURS_24_MS;
    })
    .sort(
      (left, right) =>
        Date.parse(left.targetDueAt) - Date.parse(right.targetDueAt) ||
        compareJobsById(left, right),
    );
  const blockedOrHeld = jobs
    .filter((job) => job.state === "blocked" || job.state === "held")
    .sort(
      (left, right) =>
        Date.parse(left.currentConditionSince) -
          Date.parse(right.currentConditionSince) ||
        compareJobsById(left, right),
    );
  const pastDueWip = activeWip
    .filter((job) => Date.parse(job.targetDueAt) < asOfMs)
    .sort(
      (left, right) =>
        right.remainingQuantity - left.remainingQuantity ||
        Date.parse(left.targetDueAt) - Date.parse(right.targetDueAt) ||
        compareJobsById(left, right),
    );
  const actionRequired = jobs
    .map((job) => issueFor(job, asOfMs, assignmentByIssueKey))
    .filter((issue): issue is OperationalIssue => issue !== undefined)
    .sort(compareIssues);
  const needsOwner = actionRequired.filter(
    (issue) => issue.owner === undefined,
  );

  return {
    facility: input.facility,
    asOf: input.asOf,
    counts: {
      actionRequired: actionRequired.length,
      activeWip: activeWip.length,
      dueNext24Hours: dueNext24Hours.length,
      blockedOrHeld: blockedOrHeld.length,
      pastDueWip: pastDueWip.length,
      needsOwner: needsOwner.length,
    },
    views: {
      actionRequired,
      activeWip,
      dueNext24Hours,
      blockedOrHeld,
      pastDueWip,
      needsOwner,
    },
  };
}

export function projectJobTimeline(
  events: NormalizedManufacturingEvent[],
  input: Pick<ProjectCurrentOperationsInput, "facility" | "asOf"> & {
    jobId: string;
  },
) {
  const asOfMs = parseTimestamp(input.asOf, "asOf");
  const timelineEvents = events
    .filter(
      (event) =>
        event.jobId === input.jobId &&
        event.metadata.facility === input.facility &&
        Date.parse(event.occurredAt) <= asOfMs,
    )
    .sort(compareEvents);

  if (timelineEvents.length === 0) {
    throw new Error(
      `Job ${input.jobId} was not found at the selected snapshot.`,
    );
  }

  return {
    facility: input.facility,
    asOf: input.asOf,
    job: projectJob(timelineEvents),
    events: timelineEvents,
  };
}
