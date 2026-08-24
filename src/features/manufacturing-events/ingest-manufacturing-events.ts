import type { ZodIssue } from "zod";

import { manufacturingEventSchema } from "./schema";
import {
  canonicalizeJson,
  fingerprintJson,
  normalizeEvent,
} from "./normalize-event";
import {
  EVENT_TYPES,
  type CoverageReport,
  type EventType,
  type ImportIssue,
  type ImportReport,
  type IngestionResult,
  type JsonLineSource,
  type NormalizedManufacturingEvent,
  type RawEventRecord,
} from "./types";

type AcceptedEntry = {
  canonicalPayload: string;
  event: NormalizedManufacturingEvent;
};

function eventIdFrom(value: unknown): string | undefined {
  if (value === null || typeof value !== "object" || !("event_id" in value)) {
    return undefined;
  }

  const eventId = value.event_id;
  return typeof eventId === "string" && eventId.length > 0
    ? eventId
    : undefined;
}

function validationDetails(issues: ZodIssue[]) {
  return issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

function emptyEventTypeCounts(): Record<EventType, number> {
  return Object.fromEntries(
    EVENT_TYPES.map((eventType) => [eventType, 0]),
  ) as Record<EventType, number>;
}

function coverageFor(events: NormalizedManufacturingEvent[]): CoverageReport {
  return {
    jobStartedWithoutOperator: events.filter(
      (event) =>
        event.eventType === "job_started" && !event.metadata.operatorId,
    ).length,
    inspectionWithoutInspector: events.filter(
      (event) =>
        (event.eventType === "inspection_passed" ||
          event.eventType === "inspection_failed") &&
        !event.metadata.inspectorId,
    ).length,
    cycleWithoutTool: events.filter(
      (event) =>
        event.eventType === "cycle_completed" && !event.metadata.toolId,
    ).length,
    cycleWithoutMachine: events.filter(
      (event) => event.eventType === "cycle_completed" && !event.machineId,
    ).length,
    jobCreatedWithoutUnitPrice: events.filter(
      (event) =>
        event.eventType === "job_created" &&
        event.metadata.unitPriceEstimate === undefined,
    ).length,
  };
}

function buildReport(
  events: NormalizedManufacturingEvent[],
  rawRecords: RawEventRecord[],
  repeatedEventIds: Set<string>,
): ImportReport {
  const eventTypeCounts = emptyEventTypeCounts();

  for (const event of events) {
    eventTypeCounts[event.eventType] += 1;
  }

  return {
    totalLineCount: rawRecords.length,
    blankLineCount: rawRecords.filter(
      (record) => record.disposition === "blank",
    ).length,
    nonEmptyLineCount: rawRecords.filter(
      (record) => record.disposition !== "blank",
    ).length,
    acceptedEventCount: events.length,
    invalidLineCount: rawRecords.filter(
      (record) =>
        record.disposition === "invalid_json" ||
        record.disposition === "invalid_event",
    ).length,
    duplicateOccurrenceCount: rawRecords.filter(
      (record) =>
        record.disposition === "identical_duplicate" ||
        record.disposition === "conflicting_duplicate",
    ).length,
    repeatedEventIdCount: repeatedEventIds.size,
    identicalDuplicateCount: rawRecords.filter(
      (record) => record.disposition === "identical_duplicate",
    ).length,
    conflictingDuplicateCount: rawRecords.filter(
      (record) => record.disposition === "conflicting_duplicate",
    ).length,
    firstOccurredAt: events.at(0)?.occurredAt ?? null,
    lastOccurredAt: events.at(-1)?.occurredAt ?? null,
    eventTypeCounts,
    coverage: coverageFor(events),
  };
}

export function jsonLinesFromText(value: string): string[] {
  const lines = value.split(/\r?\n/);

  if (lines.at(-1) === "") {
    lines.pop();
  }

  return lines;
}

export async function ingestManufacturingEvents(
  lines: JsonLineSource,
): Promise<IngestionResult> {
  const acceptedById = new Map<string, AcceptedEntry>();
  const repeatedEventIds = new Set<string>();
  const rawRecords: RawEventRecord[] = [];
  const issues: ImportIssue[] = [];
  let lineNumber = 0;

  for await (const rawLine of lines) {
    lineNumber += 1;

    if (rawLine.trim().length === 0) {
      rawRecords.push({
        lineNumber,
        rawLine,
        disposition: "blank",
      });
      continue;
    }

    let rawPayload: unknown;

    try {
      rawPayload = JSON.parse(rawLine) as unknown;
    } catch {
      const issue: ImportIssue = {
        code: "invalid_json",
        lineNumber,
        message: "Line is not valid JSON.",
      };

      rawRecords.push({
        lineNumber,
        rawLine,
        disposition: issue.code,
      });
      issues.push(issue);
      continue;
    }

    const eventId = eventIdFrom(rawPayload);
    const payloadFingerprint = fingerprintJson(rawPayload);
    const parsed = manufacturingEventSchema.safeParse(rawPayload);

    if (!parsed.success) {
      const issue: ImportIssue = {
        code: "invalid_event",
        lineNumber,
        ...(eventId && { eventId }),
        message: "Event does not match its event-specific schema.",
        details: validationDetails(parsed.error.issues),
      };

      rawRecords.push({
        lineNumber,
        rawLine,
        rawPayload,
        ...(eventId && { eventId }),
        payloadFingerprint,
        disposition: issue.code,
      });
      issues.push(issue);
      continue;
    }

    const canonicalPayload = canonicalizeJson(rawPayload);
    const existing = acceptedById.get(parsed.data.event_id);

    if (existing) {
      repeatedEventIds.add(parsed.data.event_id);
      const identical = existing.canonicalPayload === canonicalPayload;
      const code = identical ? "identical_duplicate" : "conflicting_duplicate";
      const issue: ImportIssue = {
        code,
        lineNumber,
        eventId: parsed.data.event_id,
        message: identical
          ? `Event duplicates the accepted payload from line ${existing.event.sourceLine}.`
          : `Event conflicts with the accepted payload from line ${existing.event.sourceLine}; the first valid occurrence remains accepted.`,
      };

      rawRecords.push({
        lineNumber,
        rawLine,
        rawPayload,
        eventId: parsed.data.event_id,
        payloadFingerprint,
        disposition: code,
      });
      issues.push(issue);
      continue;
    }

    const event = normalizeEvent(parsed.data, lineNumber, payloadFingerprint);
    acceptedById.set(event.eventId, { canonicalPayload, event });
    rawRecords.push({
      lineNumber,
      rawLine,
      rawPayload,
      eventId: event.eventId,
      payloadFingerprint,
      disposition: "accepted",
    });
  }

  const events = [...acceptedById.values()]
    .map(({ event }) => event)
    .sort(
      (left, right) =>
        Date.parse(left.occurredAt) - Date.parse(right.occurredAt) ||
        left.sourceLine - right.sourceLine,
    );

  return {
    events,
    rawRecords,
    issues,
    report: buildReport(events, rawRecords, repeatedEventIds),
  };
}
