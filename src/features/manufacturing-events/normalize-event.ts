import { createHash } from "node:crypto";

import type { ValidatedManufacturingEvent } from "./schema";
import type {
  NormalizedEventMetadata,
  NormalizedManufacturingEvent,
} from "./types";

type SourceMetadata = {
  facility: NormalizedEventMetadata["facility"];
  priority?: NormalizedEventMetadata["priority"];
  target_due_at?: string;
  target_quantity?: number;
  unit_price_estimate?: number;
  tool_id?: string;
  operator_id?: string;
  cycle_time_seconds?: number;
  defect_code?: NormalizedEventMetadata["defectCode"];
  inspector_id?: string;
  reason?: NormalizedEventMetadata["reason"];
  good_quantity?: number;
  scrap_quantity?: number;
  lot_id?: string;
  signal?: NormalizedEventMetadata["signal"];
};

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortJsonValue(entry)]),
    );
  }

  return value;
}

export function canonicalizeJson(value: unknown): string {
  return JSON.stringify(sortJsonValue(value));
}

export function fingerprintJson(value: unknown): string {
  return createHash("sha256").update(canonicalizeJson(value)).digest("hex");
}

function include<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function normalizeMetadata(source: SourceMetadata): NormalizedEventMetadata {
  return {
    facility: source.facility,
    ...(include(source.priority) && { priority: source.priority }),
    ...(include(source.target_due_at) && { targetDueAt: source.target_due_at }),
    ...(include(source.target_quantity) && {
      targetQuantity: source.target_quantity,
    }),
    ...(include(source.unit_price_estimate) && {
      unitPriceEstimate: source.unit_price_estimate,
    }),
    ...(include(source.tool_id) && { toolId: source.tool_id }),
    ...(include(source.operator_id) && { operatorId: source.operator_id }),
    ...(include(source.cycle_time_seconds) && {
      cycleTimeSeconds: source.cycle_time_seconds,
    }),
    ...(include(source.defect_code) && { defectCode: source.defect_code }),
    ...(include(source.inspector_id) && { inspectorId: source.inspector_id }),
    ...(include(source.reason) && { reason: source.reason }),
    ...(include(source.good_quantity) && {
      goodQuantity: source.good_quantity,
    }),
    ...(include(source.scrap_quantity) && {
      scrapQuantity: source.scrap_quantity,
    }),
    ...(include(source.lot_id) && { lotId: source.lot_id }),
    ...(include(source.signal) && { signal: source.signal }),
  };
}

export function normalizeEvent(
  event: ValidatedManufacturingEvent,
  sourceLine: number,
  payloadFingerprint: string,
): NormalizedManufacturingEvent {
  return {
    eventId: event.event_id,
    occurredAt: event.timestamp,
    eventType: event.event_type,
    jobId: event.job_id,
    partId: event.part_id,
    customerId: event.customer_id,
    machineId: event.machine_id,
    material: event.material,
    quantity: event.quantity,
    metadata: normalizeMetadata(event.metadata),
    sourceLine,
    payloadFingerprint,
  };
}
