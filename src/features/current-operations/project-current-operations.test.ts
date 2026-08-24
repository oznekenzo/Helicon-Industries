import { describe, expect, it } from "vitest";

import type {
  BlockReason,
  Facility,
  NormalizedManufacturingEvent,
  Priority,
} from "@/features/manufacturing-events";

import {
  projectCurrentOperations,
  projectJobTimeline,
} from "./project-current-operations";
import type { IssueAssignment } from "./types";

const FACILITY: Facility = "la_01";
const AS_OF = "2026-08-13T12:00:00Z";
let nextSourceLine = 1;

type EventInput = {
  eventId: string;
  eventType: NormalizedManufacturingEvent["eventType"];
  occurredAt: string;
  jobId?: string;
  facility?: Facility;
  machineId?: string | null;
  quantity?: number;
  metadata?: Omit<NormalizedManufacturingEvent["metadata"], "facility">;
};

function event(input: EventInput): NormalizedManufacturingEvent {
  return {
    eventId: input.eventId,
    eventType: input.eventType,
    occurredAt: input.occurredAt,
    jobId: input.jobId ?? "job_0001",
    partId: `part_${input.jobId ?? "job_0001"}`,
    customerId: "cust_test",
    machineId: input.machineId ?? null,
    material: "carbon_epoxy",
    quantity: input.quantity ?? 0,
    metadata: {
      facility: input.facility ?? FACILITY,
      ...input.metadata,
    },
    sourceLine: nextSourceLine++,
    payloadFingerprint: "a".repeat(64),
  };
}

function created(
  jobId: string,
  options: {
    occurredAt?: string;
    dueAt?: string;
    priority?: Priority;
    targetQuantity?: number;
    toolId?: string;
    facility?: Facility;
  } = {},
) {
  const targetQuantity = options.targetQuantity ?? 100;

  return event({
    eventId: `${jobId}_created`,
    eventType: "job_created",
    occurredAt: options.occurredAt ?? "2026-08-10T08:00:00Z",
    jobId,
    facility: options.facility,
    quantity: targetQuantity,
    metadata: {
      priority: options.priority ?? "normal",
      targetDueAt: options.dueAt ?? "2026-08-14T12:00:00Z",
      targetQuantity,
      ...(options.toolId && { toolId: options.toolId }),
    },
  });
}

function started(
  jobId: string,
  occurredAt = "2026-08-11T08:00:00Z",
  metadata: EventInput["metadata"] = {
    operatorId: "op_01",
    toolId: "tool_01",
  },
) {
  return event({
    eventId: `${jobId}_started`,
    eventType: "job_started",
    occurredAt,
    jobId,
    machineId: "press_01",
    metadata,
  });
}

function blocked(
  jobId: string,
  reason: BlockReason,
  occurredAt = "2026-08-12T08:00:00Z",
) {
  return event({
    eventId: `${jobId}_blocked`,
    eventType: "job_blocked",
    occurredAt,
    jobId,
    machineId: reason === "awaiting_qc" ? "qc_01" : "press_01",
    metadata: { reason },
  });
}

function assignment(issueKey: string, jobId: string): IssueAssignment {
  return {
    issueKey,
    jobId,
    responderId: "tech_01",
    displayName: "Maya Chen",
    role: "Tooling technician",
    assignedAt: "2026-08-13T12:05:00Z",
  };
}

describe("projectCurrentOperations", () => {
  it("orders events, respects as-of history, clears blocks, and treats the first completion as terminal", () => {
    const jobId = "job_lifecycle";
    const events = [
      event({
        eventId: `${jobId}_completion_2`,
        eventType: "job_completed",
        occurredAt: "2026-08-13T11:00:00Z",
        jobId,
        quantity: 100,
        metadata: { goodQuantity: 99, scrapQuantity: 1 },
      }),
      event({
        eventId: `${jobId}_cycle_after_completion`,
        eventType: "cycle_completed",
        occurredAt: "2026-08-13T10:30:00Z",
        jobId,
        quantity: 90,
        machineId: "press_01",
        metadata: { cycleTimeSeconds: 60, toolId: "tool_01" },
      }),
      event({
        eventId: `${jobId}_completion_1`,
        eventType: "job_completed",
        occurredAt: "2026-08-13T10:00:00Z",
        jobId,
        quantity: 10,
        metadata: { goodQuantity: 9, scrapQuantity: 1 },
      }),
      event({
        eventId: `${jobId}_cycle`,
        eventType: "cycle_completed",
        occurredAt: "2026-08-13T09:00:00Z",
        jobId,
        quantity: 10,
        machineId: "press_01",
        metadata: { cycleTimeSeconds: 60, toolId: "tool_01" },
      }),
      event({
        eventId: `${jobId}_unblocked`,
        eventType: "job_unblocked",
        occurredAt: "2026-08-12T12:00:00Z",
        jobId,
        metadata: { reason: "resolved_machine_fault" },
      }),
      blocked(jobId, "machine_fault"),
      started(jobId),
      created(jobId),
    ];

    const duringBlock = projectCurrentOperations(events, {
      facility: FACILITY,
      asOf: "2026-08-12T10:00:00Z",
    });
    expect(duringBlock.views.activeWip).toHaveLength(1);
    expect(duringBlock.views.blockedOrHeld[0]).toMatchObject({
      jobId,
      state: "blocked",
      producedQuantity: 0,
    });

    const completed = projectCurrentOperations(events, {
      facility: FACILITY,
      asOf: AS_OF,
    });
    expect(completed.counts).toEqual({
      needsAssignment: 0,
      notStarted: 0,
      activeWip: 0,
      dueNext24Hours: 0,
      blockedOrHeld: 0,
      pastDueWip: 0,
    });
    expect(completed.currentIssues).toEqual([]);

    const timeline = projectJobTimeline(events, {
      facility: FACILITY,
      asOf: AS_OF,
      jobId,
    });
    expect(timeline.job).toMatchObject({
      state: "completed",
      completedAt: "2026-08-13T10:00:00Z",
      producedQuantity: 10,
      remainingQuantity: 90,
    });
  });

  it("keeps a held job held while later cycles add produced quantity", () => {
    const jobId = "job_held";
    const events = [
      created(jobId, { targetQuantity: 50 }),
      started(jobId),
      event({
        eventId: `${jobId}_hold`,
        eventType: "job_hold",
        occurredAt: "2026-08-12T08:00:00Z",
        jobId,
      }),
      event({
        eventId: `${jobId}_cycle`,
        eventType: "cycle_completed",
        occurredAt: "2026-08-13T08:00:00Z",
        jobId,
        quantity: 12,
        metadata: { cycleTimeSeconds: 40 },
      }),
    ];

    const snapshot = projectCurrentOperations(events, {
      facility: FACILITY,
      asOf: AS_OF,
    });

    expect(snapshot.views.blockedOrHeld[0]).toMatchObject({
      state: "held",
      producedQuantity: 12,
      remainingQuantity: 38,
      currentConditionEventId: `${jobId}_hold`,
    });
    expect(snapshot.currentIssues[0]).toMatchObject({
      issueKey: `held:${jobId}:${jobId}_hold`,
      recommendedAction: "Review the held job",
    });
  });

  it("keeps a pre-start block in Not started and Blocked / held without counting it as Active WIP", () => {
    const jobId = "job_prestart_block";
    const snapshot = projectCurrentOperations(
      [created(jobId), blocked(jobId, "missing_tool")],
      { facility: FACILITY, asOf: AS_OF },
    );

    expect(snapshot.counts).toMatchObject({
      needsAssignment: 1,
      notStarted: 1,
      activeWip: 0,
      blockedOrHeld: 1,
      pastDueWip: 0,
    });
    expect(snapshot.currentIssues[0]).toMatchObject({
      condition: "blocked",
      affectedUnits: 100,
      recommendedAction: "Locate and stage the required tool",
    });
    expect(snapshot.views.needsAssignment[0]?.jobId).toBe(jobId);
    expect(snapshot.views.notStarted[0]?.jobId).toBe(jobId);
  });

  it("includes incomplete not-started jobs in due and past-due views", () => {
    const overdue = "job_not_started_overdue";
    const dueSoon = "job_not_started_due_soon";
    const future = "job_not_started_future";
    const snapshot = projectCurrentOperations(
      [
        created(future, { dueAt: "2026-08-15T12:00:00Z" }),
        created(dueSoon, { dueAt: "2026-08-13T18:00:00Z" }),
        created(overdue, { dueAt: "2026-08-12T12:00:00Z" }),
      ],
      { facility: FACILITY, asOf: AS_OF },
    );

    expect(snapshot.views.notStarted.map((job) => job.jobId)).toEqual([
      overdue,
      dueSoon,
      future,
    ]);
    expect(snapshot.views.activeWip).toEqual([]);
    expect(snapshot.views.dueNext24Hours.map((job) => job.jobId)).toEqual([
      dueSoon,
    ]);
    expect(snapshot.views.pastDueWip.map((job) => job.jobId)).toEqual([
      overdue,
    ]);
    expect(snapshot.currentIssues).toEqual([
      expect.objectContaining({ jobId: overdue, condition: "past_due" }),
    ]);
    expect(snapshot.views.needsAssignment[0]?.jobId).toBe(overdue);
  });

  it("uses strict due boundaries and coalesces an overdue block into one primary issue", () => {
    const dueSoon = "job_due_soon";
    const dueExactlyNow = "job_due_now";
    const blockedAndPastDue = "job_blocked_past_due";
    const events = [
      created(dueSoon, { dueAt: "2026-08-14T12:00:00Z" }),
      started(dueSoon),
      created(dueExactlyNow, { dueAt: AS_OF }),
      started(dueExactlyNow),
      created(blockedAndPastDue, {
        dueAt: "2026-08-12T12:00:00Z",
        targetQuantity: 80,
      }),
      started(blockedAndPastDue),
      event({
        eventId: `${blockedAndPastDue}_cycle`,
        eventType: "cycle_completed",
        occurredAt: "2026-08-12T06:00:00Z",
        jobId: blockedAndPastDue,
        quantity: 20,
        metadata: { cycleTimeSeconds: 45 },
      }),
      blocked(blockedAndPastDue, "material_wait"),
    ];

    const snapshot = projectCurrentOperations(events, {
      facility: FACILITY,
      asOf: AS_OF,
    });

    expect(snapshot.views.dueNext24Hours.map((job) => job.jobId)).toEqual([
      dueSoon,
    ]);
    expect(snapshot.views.pastDueWip.map((job) => job.jobId)).toEqual([
      blockedAndPastDue,
    ]);
    expect(
      snapshot.currentIssues.filter(
        (issue) => issue.jobId === blockedAndPastDue,
      ),
    ).toEqual([
      expect.objectContaining({
        condition: "blocked",
        affectedUnits: 60,
        recommendedAction: `Expedite material for part_${blockedAndPastDue}`,
      }),
    ]);
  });

  it.each([
    ["missing_tool", "Locate and stage tool_01"],
    ["material_wait", "Expedite material for part_job_action"],
    ["engineering_hold", "Resolve the engineering hold"],
    ["awaiting_qc", "Complete QC review at qc_01"],
    ["machine_fault", "Inspect press_01"],
  ] satisfies [BlockReason, string][])(
    "maps %s to a condition-specific action",
    (reason, expectedAction) => {
      const jobId = "job_action";
      const snapshot = projectCurrentOperations(
        [
          created(jobId, { toolId: "tool_01" }),
          started(jobId),
          blocked(jobId, reason),
        ],
        { facility: FACILITY, asOf: AS_OF },
      );

      expect(snapshot.currentIssues[0]?.recommendedAction).toBe(expectedAction);
    },
  );

  it("derives severity, ranks deterministically, and removes assigned issues from Needs assignment", () => {
    const critical = "job_critical";
    const high = "job_high";
    const medium = "job_medium";
    const low = "job_low";
    const events = [
      created(critical, { priority: "high", targetQuantity: 120 }),
      started(critical),
      blocked(critical, "machine_fault"),
      created(high, {
        priority: "high",
        dueAt: "2026-08-12T00:00:00Z",
        targetQuantity: 200,
      }),
      started(high),
      created(medium, { priority: "low", targetQuantity: 300 }),
      started(medium),
      blocked(medium, "material_wait"),
      created(low, {
        priority: "low",
        dueAt: "2026-08-11T00:00:00Z",
        targetQuantity: 400,
      }),
      started(low),
    ];
    const criticalKey = `blocked:${critical}:${critical}_blocked`;

    const snapshot = projectCurrentOperations(events, {
      facility: FACILITY,
      asOf: AS_OF,
      assignments: [assignment(criticalKey, critical)],
    });

    expect(
      snapshot.currentIssues.map((issue) => [issue.jobId, issue.severity]),
    ).toEqual([
      [critical, "critical"],
      [high, "high"],
      [medium, "medium"],
      [low, "low"],
    ]);
    expect(snapshot.currentIssues[0]?.assignee).toMatchObject({
      responderId: "tech_01",
    });
    expect(
      snapshot.views.needsAssignment.map((issue) => issue.jobId),
    ).not.toContain(critical);
    expect(snapshot.views.blockedOrHeld.map((job) => job.jobId)).toContain(
      critical,
    );
    expect(snapshot.counts.needsAssignment).toBe(3);
  });

  it("applies the complete priority-to-severity matrix", () => {
    const cases = [
      ["job_blocked_high", "high", true, "critical"],
      ["job_blocked_normal", "normal", true, "high"],
      ["job_blocked_low", "low", true, "medium"],
      ["job_past_high", "high", false, "high"],
      ["job_past_normal", "normal", false, "medium"],
      ["job_past_low", "low", false, "low"],
    ] as const;
    const events = cases.flatMap(([jobId, priority, isBlocked]) => [
      created(jobId, {
        priority,
        dueAt: "2026-08-12T00:00:00Z",
      }),
      started(jobId),
      ...(isBlocked ? [blocked(jobId, "material_wait")] : []),
    ]);

    const snapshot = projectCurrentOperations(events, {
      facility: FACILITY,
      asOf: AS_OF,
    });
    const severityByJob = Object.fromEntries(
      snapshot.currentIssues.map((issue) => [issue.jobId, issue.severity]),
    );

    for (const [jobId, , , expectedSeverity] of cases) {
      expect(severityByJob[jobId]).toBe(expectedSeverity);
    }
  });

  it("ranks equal-severity issues by impact, due exposure, and condition age", () => {
    const impact = "job_rank_impact";
    const ageOld = "job_rank_age_old";
    const ageNew = "job_rank_age_new";
    const dueLater = "job_rank_due_later";
    const events = [
      created(impact, {
        dueAt: "2026-08-13T00:00:00Z",
        targetQuantity: 300,
      }),
      blocked(impact, "material_wait", "2026-08-12T12:00:00Z"),
      created(ageOld, {
        dueAt: "2026-08-12T00:00:00Z",
        targetQuantity: 200,
      }),
      blocked(ageOld, "material_wait", "2026-08-11T12:00:00Z"),
      created(ageNew, {
        dueAt: "2026-08-12T00:00:00Z",
        targetQuantity: 200,
      }),
      blocked(ageNew, "material_wait", "2026-08-12T12:00:00Z"),
      created(dueLater, {
        dueAt: "2026-08-13T00:00:00Z",
        targetQuantity: 200,
      }),
      blocked(dueLater, "material_wait", "2026-08-10T12:00:00Z"),
    ];

    const snapshot = projectCurrentOperations(events, {
      facility: FACILITY,
      asOf: AS_OF,
    });

    expect(snapshot.currentIssues.map((issue) => issue.jobId)).toEqual([
      impact,
      ageOld,
      ageNew,
      dueLater,
    ]);
  });

  it("does not transfer an assignment to a new condition episode", () => {
    const jobId = "job_reblocked";
    const firstBlockedEventId = `${jobId}_blocked`;
    const secondBlockedEventId = `${jobId}_blocked_again`;
    const events = [
      created(jobId),
      started(jobId),
      blocked(jobId, "machine_fault", "2026-08-11T10:00:00Z"),
      event({
        eventId: `${jobId}_unblocked`,
        eventType: "job_unblocked",
        occurredAt: "2026-08-12T10:00:00Z",
        jobId,
        metadata: { reason: "resolved_machine_fault" },
      }),
      event({
        eventId: secondBlockedEventId,
        eventType: "job_blocked",
        occurredAt: "2026-08-13T10:00:00Z",
        jobId,
        machineId: "press_02",
        metadata: { reason: "machine_fault" },
      }),
    ];

    const snapshot = projectCurrentOperations(events, {
      facility: FACILITY,
      asOf: AS_OF,
      assignments: [
        assignment(`blocked:${jobId}:${firstBlockedEventId}`, jobId),
      ],
    });

    expect(snapshot.currentIssues[0]?.issueKey).toBe(
      `blocked:${jobId}:${secondBlockedEventId}`,
    );
    expect(snapshot.currentIssues[0]).not.toHaveProperty("assignee");
    expect(snapshot.views.needsAssignment[0]?.jobId).toBe(jobId);
  });

  it("filters other facilities and preserves absent optional production context", () => {
    const jobId = "job_sparse";
    const otherFacilityJob = "job_other_facility";
    const events = [
      created(jobId),
      event({
        eventId: `${jobId}_started`,
        eventType: "job_started",
        occurredAt: "2026-08-11T08:00:00Z",
        jobId,
      }),
      created(otherFacilityJob, { facility: "la_02" }),
    ];

    const timeline = projectJobTimeline(events, {
      facility: FACILITY,
      asOf: AS_OF,
      jobId,
    });

    expect(timeline.job).not.toHaveProperty("operatorId");
    expect(timeline.job).not.toHaveProperty("toolId");
    expect(timeline.job).not.toHaveProperty("machineId");
    expect(timeline.events).toHaveLength(2);
  });
});
