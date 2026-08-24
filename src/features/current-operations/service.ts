import { and, asc, eq, inArray } from "drizzle-orm";

import {
  listManufacturingEvents,
  normalizedTimestamp,
  resolveFacilityAsOf,
} from "@/features/manufacturing-events/repository";
import type { Facility } from "@/features/manufacturing-events/types";
import type { HeliconDatabase } from "@db/client";
import { operationalIssueAssignments, responders } from "@db/schema";

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
  const asOf = await resolveFacilityAsOf(db, query.facility, query.asOf);
  const events = await listManufacturingEvents(db, {
    facility: query.facility,
    asOf,
  });
  const withoutAssignments = projectCurrentOperations(events, {
    facility: query.facility,
    asOf,
  });
  const assignments = await loadAssignments(
    db,
    withoutAssignments.currentIssues.map((issue) => issue.issueKey),
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
  const asOf = await resolveFacilityAsOf(db, query.facility, query.asOf);
  const events = await listManufacturingEvents(db, {
    facility: query.facility,
    asOf,
    jobId: query.jobId,
  });

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
  const issue = snapshot.currentIssues.find(
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
