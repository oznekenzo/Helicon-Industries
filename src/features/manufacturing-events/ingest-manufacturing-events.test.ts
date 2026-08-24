import { describe, expect, it } from "vitest";

import {
  ingestManufacturingEvents,
  jsonLinesFromText,
} from "./ingest-manufacturing-events";

const createdEvent = {
  event_id: "evt_created",
  timestamp: "2026-07-03T13:41:56Z",
  event_type: "job_created",
  job_id: "job_0001",
  part_id: "part_1001",
  customer_id: "cust_nimbus",
  machine_id: null,
  material: "carbon_fiber_epoxy",
  quantity: 10,
  metadata: {
    facility: "la_01",
    priority: "normal",
    target_due_at: "2026-07-10T13:41:56Z",
    target_quantity: 10,
  },
} as const;

describe("ingestManufacturingEvents", () => {
  it("validates, normalizes, and orders accepted events chronologically", async () => {
    const startedEvent = {
      ...createdEvent,
      event_id: "evt_started",
      timestamp: "2026-07-04T13:41:56Z",
      event_type: "job_started",
      machine_id: "press_01",
      quantity: 0,
      metadata: {
        facility: "la_01",
        operator_id: "op_01",
        tool_id: "tool_01",
      },
    };

    const result = await ingestManufacturingEvents([
      JSON.stringify(startedEvent),
      JSON.stringify(createdEvent),
    ]);

    expect(result.events.map((event) => event.eventId)).toEqual([
      "evt_created",
      "evt_started",
    ]);
    expect(result.events[0]).toMatchObject({
      eventId: "evt_created",
      occurredAt: "2026-07-03T13:41:56Z",
      eventType: "job_created",
      sourceLine: 2,
      metadata: {
        facility: "la_01",
        targetDueAt: "2026-07-10T13:41:56Z",
        targetQuantity: 10,
      },
    });
    expect(result.events[0]?.payloadFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(result.report).toMatchObject({
      totalLineCount: 2,
      acceptedEventCount: 2,
      invalidLineCount: 0,
      duplicateOccurrenceCount: 0,
      firstOccurredAt: "2026-07-03T13:41:56Z",
      lastOccurredAt: "2026-07-04T13:41:56Z",
    });
  });

  it("keeps the first valid occurrence and distinguishes identical and conflicting duplicates", async () => {
    const conflictingEvent = {
      ...createdEvent,
      quantity: 12,
      metadata: {
        ...createdEvent.metadata,
        target_quantity: 12,
      },
    };

    const result = await ingestManufacturingEvents([
      JSON.stringify(createdEvent),
      JSON.stringify(createdEvent),
      JSON.stringify(conflictingEvent),
    ]);

    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.quantity).toBe(10);
    expect(result.rawRecords.map((record) => record.disposition)).toEqual([
      "accepted",
      "identical_duplicate",
      "conflicting_duplicate",
    ]);
    expect(result.report).toMatchObject({
      acceptedEventCount: 1,
      duplicateOccurrenceCount: 2,
      repeatedEventIdCount: 1,
      identicalDuplicateCount: 1,
      conflictingDuplicateCount: 1,
    });
  });

  it("preserves invalid source records and reports event-specific validation errors", async () => {
    const cycleWithoutDuration = {
      ...createdEvent,
      event_id: "evt_cycle",
      event_type: "cycle_completed",
      machine_id: "press_01",
      metadata: {
        facility: "la_01",
      },
    };

    const result = await ingestManufacturingEvents([
      "",
      "{not-json}",
      JSON.stringify(cycleWithoutDuration),
    ]);

    expect(result.events).toEqual([]);
    expect(result.rawRecords.map((record) => record.disposition)).toEqual([
      "blank",
      "invalid_json",
      "invalid_event",
    ]);
    expect(result.issues).toEqual([
      expect.objectContaining({ code: "invalid_json", lineNumber: 2 }),
      expect.objectContaining({
        code: "invalid_event",
        lineNumber: 3,
        eventId: "evt_cycle",
        details: expect.arrayContaining([
          expect.objectContaining({ path: "metadata.cycle_time_seconds" }),
        ]),
      }),
    ]);
    expect(result.report).toMatchObject({
      totalLineCount: 3,
      blankLineCount: 1,
      nonEmptyLineCount: 2,
      invalidLineCount: 2,
      acceptedEventCount: 0,
    });
  });

  it("splits both Unix and Windows JSON Lines text", () => {
    expect(jsonLinesFromText("first\r\nsecond\n")).toEqual(["first", "second"]);
    expect(jsonLinesFromText("first\n\n")).toEqual(["first", ""]);
  });
});
