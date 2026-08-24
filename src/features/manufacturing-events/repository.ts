import { and, asc, eq, inArray, lte, max } from "drizzle-orm";

import type { HeliconDatabase } from "@db/client";
import { manufacturingEvents } from "@db/schema";

import type {
  EventType,
  Facility,
  NormalizedEventMetadata,
  NormalizedManufacturingEvent,
} from "./types";

type DatabaseEvent = typeof manufacturingEvents.$inferSelect;

export type ManufacturingEventQuery = {
  facility: Facility;
  asOf: string;
  jobId?: string;
  eventTypes?: EventType[];
};

export function normalizedTimestamp(value: string, label: string) {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    throw new Error(`${label} must be a valid ISO-8601 timestamp.`);
  }

  return new Date(timestamp).toISOString();
}

function include<T>(value: T | null): value is T {
  return value !== null;
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

export async function resolveFacilityAsOf(
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

export async function listManufacturingEvents(
  db: HeliconDatabase,
  query: ManufacturingEventQuery,
) {
  if (query.eventTypes?.length === 0) {
    return [];
  }

  const filters = [
    eq(manufacturingEvents.facility, query.facility),
    lte(manufacturingEvents.occurredAt, query.asOf),
  ];

  if (query.jobId) {
    filters.push(eq(manufacturingEvents.jobId, query.jobId));
  }

  if (query.eventTypes) {
    filters.push(inArray(manufacturingEvents.eventType, query.eventTypes));
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
