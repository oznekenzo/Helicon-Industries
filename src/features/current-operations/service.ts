import { and, asc, eq, inArray, lte, max } from "drizzle-orm";

import type {
  Facility,
  NormalizedEventMetadata,
  NormalizedManufacturingEvent,
} from "@/features/manufacturing-events/types";
import type { HeliconDatabase } from "@db/client";
import {
  manufacturingEvents,
  operationalIssueAssignments,
  responders,
} from "@db/schema";

import {
  projectCurrentOperations,
  projectJobTimeline,
} from "./project-current-operations";
import type {
  CurrentOperationsSnapshot,
  IssueAssignment,
  JobTimeline,
  Responder,
} from "./types";

type DatabaseEvent = typeof manufacturingEvents.$inferSelect;

export type CurrentOperationsQuery = {
  facility: Facility;
  asOf?: string;
};

export type JobTimelineQuery = CurrentOperationsQuery & {
  jobId: string;
};

export type AssignOperationalIssueInput = {
  facility: Facility;
  issueKey: string;
  responderId: string;
};

function include<T>(value: T | null): value is T {
  return value !== null;
}

function normalizedTimestamp(value: string, label: string) {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    throw new Error(`${label} must be a valid ISO-8601 timestamp.`);
  }

  return new Date(timestamp).toISOString();
}

function eventFromRow(row: DatabaseEvent): NormalizedManufacturingEvent {
  const metadata: NormalizedEventMetadata = {
    facility: row.facility,
    ...(include(row.priority) && { priority: row.priority }),
    ...(include(row.targetDueAt) && {
      targetDueAt: normalizedTimestamp(
        row.targetDueAt,
        `Event ${row.eventId} target due time`,
      ),
    }),
    ...(include(row.targetQuantity) && {
      targetQuantity: row.targetQuantity,
    }),
    ...(include(row.unitPriceEstimate) && {
      unitPriceEstimate: row.unitPriceEstimate,
    }),
    ...(include(row.toolId) && { toolId: row.toolId }),
    ...(include(row.operatorId) && { operatorId: row.operatorId }),
    ...(include(row.cycleTimeSeconds) && {
      cycleTimeSeconds: row.cycleTimeSeconds,
    }),
    ...(include(row.defectCode) && { defectCode: row.defectCode }),
    ...(include(row.inspectorId) && { inspectorId: row.inspectorId }),
    ...(include(row.reason) && { reason: row.reason }),
    ...(include(row.goodQuantity) && { goodQuantity: row.goodQuantity }),
    ...(include(row.scrapQuantity) && { scrapQuantity: row.scrapQuantity }),
    ...(include(row.lotId) && { lotId: row.lotId }),
    ...(include(row.signal) && { signal: row.signal }),
  };

  return {
    eventId: row.eventId,
    occurredAt: normalizedTimestamp(
      row.occurredAt,
      `Event ${row.eventId} timestamp`,
    ),
    eventType: row.eventType,
    jobId: row.jobId,
    partId: row.partId,
    customerId: row.customerId,
    machineId: row.machineId,
    material: row.material,
    quantity: row.quantity,
    metadata,
    sourceLine: row.sourceLine,
    payloadFingerprint: row.payloadFingerprint,
  };
}

async function resolveAsOf(
  db: HeliconDatabase,
  facility: Facility,
  requestedAsOf?: string,
) {
  if (requestedAsOf) {
    return normalizedTimestamp(requestedAsOf, "asOf");
  }

  const [result] = await db
    .select({ latestOccurredAt: max(manufacturingEvents.occurredAt) })
    .from(manufacturingEvents)
    .where(eq(manufacturingEvents.facility, facility));

  if (!result?.latestOccurredAt) {
    throw new Error(`No manufacturing events exist for facility ${facility}.`);
  }

  return normalizedTimestamp(result.latestOccurredAt, "Latest event timestamp");
}

async function loadEvents(
  db: HeliconDatabase,
  facility: Facility,
  asOf: string,
  jobId?: string,
) {
  const filters = [
    eq(manufacturingEvents.facility, facility),
    lte(manufacturingEvents.occurredAt, asOf),
  ];

  if (jobId) {
    filters.push(eq(manufacturingEvents.jobId, jobId));
  }

  const rows = await db
    .select()
    .from(manufacturingEvents)
    .where(and(...filters))
    .orderBy(
      asc(manufacturingEvents.occurredAt),
      asc(manufacturingEvents.sourceLine),
      asc(manufacturingEvents.eventId),
    );

  return rows.map(eventFromRow);
}

async function loadAssignments(
  db: HeliconDatabase,
  issueKeys: string[],
): Promise<IssueAssignment[]> {
  if (issueKeys.length === 0) {
    return [];
  }

  const assignments = await db
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
    )
    .where(inArray(operationalIssueAssignments.issueKey, issueKeys));

  return assignments.map((assignment) => ({
    ...assignment,
    assignedAt: normalizedTimestamp(
      assignment.assignedAt,
      `Assignment ${assignment.issueKey} timestamp`,
    ),
  }));
}

export async function getCurrentOperations(
  db: HeliconDatabase,
  query: CurrentOperationsQuery,
): Promise<CurrentOperationsSnapshot> {
  const asOf = await resolveAsOf(db, query.facility, query.asOf);
  const events = await loadEvents(db, query.facility, asOf);
  const withoutOwners = projectCurrentOperations(events, {
    facility: query.facility,
    asOf,
  });
  const assignments = await loadAssignments(
    db,
    withoutOwners.views.actionRequired.map((issue) => issue.issueKey),
  );

  return projectCurrentOperations(events, {
    facility: query.facility,
    asOf,
    assignments,
  });
}

export async function getJobTimeline(
  db: HeliconDatabase,
  query: JobTimelineQuery,
): Promise<JobTimeline> {
  const asOf = await resolveAsOf(db, query.facility, query.asOf);
  const events = await loadEvents(db, query.facility, asOf, query.jobId);

  return projectJobTimeline(events, {
    facility: query.facility,
    asOf,
    jobId: query.jobId,
  });
}

export async function listResponders(
  db: HeliconDatabase,
): Promise<Responder[]> {
  return db
    .select({
      id: responders.id,
      displayName: responders.displayName,
      role: responders.role,
    })
    .from(responders)
    .where(eq(responders.active, true))
    .orderBy(asc(responders.id));
}

export async function assignOperationalIssue(
  db: HeliconDatabase,
  input: AssignOperationalIssueInput,
): Promise<IssueAssignment> {
  const snapshot = await getCurrentOperations(db, {
    facility: input.facility,
  });
  const issue = snapshot.views.actionRequired.find(
    (candidate) => candidate.issueKey === input.issueKey,
  );

  if (!issue) {
    throw new Error(
      `Operational issue ${input.issueKey} is not active for facility ${input.facility}.`,
    );
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

  if (!responder) {
    throw new Error(`Active responder ${input.responderId} was not found.`);
  }

  const assignedAt = new Date().toISOString();
  await db
    .insert(operationalIssueAssignments)
    .values({
      issueKey: issue.issueKey,
      jobId: issue.jobId,
      responderId: responder.id,
      assignedAt,
    })
    .onConflictDoUpdate({
      target: operationalIssueAssignments.issueKey,
      set: {
        jobId: issue.jobId,
        responderId: responder.id,
        assignedAt,
      },
    });

  return {
    issueKey: issue.issueKey,
    jobId: issue.jobId,
    responderId: responder.id,
    displayName: responder.displayName,
    role: responder.role,
    assignedAt,
  };
}
