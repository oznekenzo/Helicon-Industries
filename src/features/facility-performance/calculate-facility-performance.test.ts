import { describe, expect, it } from "vitest";

import type {
  Facility,
  NormalizedManufacturingEvent,
} from "@/features/manufacturing-events";

import { calculateFacilityPerformance } from "./calculate-facility-performance";

const FACILITY: Facility = "la_01";
const AS_OF = "2026-08-15T00:00:00Z";
let sourceLine = 1;

function created(
  jobId: string,
  dueAt: string,
  options: {
    occurredAt?: string;
    facility?: Facility;
  } = {},
): NormalizedManufacturingEvent {
  return {
    eventId: `${jobId}_created`,
    occurredAt: options.occurredAt ?? "2026-07-30T00:00:00Z",
    eventType: "job_created",
    jobId,
    partId: `part_${jobId}`,
    customerId: "cust_test",
    machineId: null,
    material: "carbon_epoxy",
    quantity: 100,
    metadata: {
      facility: options.facility ?? FACILITY,
      priority: "normal",
      targetDueAt: dueAt,
      targetQuantity: 100,
    },
    sourceLine: sourceLine++,
    payloadFingerprint: "a".repeat(64),
  };
}

function completed(
  jobId: string,
  occurredAt: string,
  goodUnits: number,
  scrapUnits: number,
  facility: Facility = FACILITY,
): NormalizedManufacturingEvent {
  return {
    eventId: `${jobId}_completed_${sourceLine}`,
    occurredAt,
    eventType: "job_completed",
    jobId,
    partId: `part_${jobId}`,
    customerId: "cust_test",
    machineId: "press_01",
    material: "carbon_epoxy",
    quantity: goodUnits + scrapUnits,
    metadata: {
      facility,
      goodQuantity: goodUnits,
      scrapQuantity: scrapUnits,
    },
    sourceLine: sourceLine++,
    payloadFingerprint: "b".repeat(64),
  };
}

describe("calculateFacilityPerformance", () => {
  it("calculates current and prior on-time completion, good output, yield, and comparisons", () => {
    const events = [
      created("job_current_on_time", "2026-08-11T00:00:00Z"),
      completed("job_current_on_time", "2026-08-10T00:00:00Z", 90, 10),
      created("job_current_late", "2026-08-11T00:00:00Z"),
      completed("job_current_late", "2026-08-12T00:00:00Z", 50, 50),
      created("job_prior", "2026-08-06T00:00:00Z"),
      completed("job_prior", "2026-08-05T00:00:00Z", 100, 0),
    ];

    const snapshot = calculateFacilityPerformance(events, {
      facility: FACILITY,
      asOf: AS_OF,
    });
    const window = snapshot.windows["7d"];

    expect(window.current.onTimeCompletion).toEqual({
      onTimeJobs: 1,
      completedJobs: 2,
      rate: 0.5,
    });
    expect(window.current.goodUnitsProduced.units).toBe(140);
    expect(window.current.productionYield).toEqual({
      goodUnits: 140,
      scrapUnits: 60,
      rate: 0.7,
    });
    expect(window.prior?.onTimeCompletion.rate).toBe(1);
    expect(window.prior?.goodUnitsProduced.units).toBe(100);
    expect(window.prior?.productionYield.rate).toBe(1);
    expect(window.comparison.onTimeCompletionPercentagePoints).toBe(-50);
    expect(window.comparison.goodUnitsProducedPercent).toBe(40);
    expect(window.comparison.productionYieldPercentagePoints).toBeCloseTo(-30);
    expect(window.current.dailyGoodUnits).toHaveLength(7);
    expect(
      window.current.dailyGoodUnits.reduce(
        (sum, bucket) => sum + bucket.goodUnits,
        0,
      ),
    ).toBe(140);
  });

  it("uses left-open, right-closed windows and keeps the first completion terminal", () => {
    const boundaryJob = "job_boundary";
    const throughJob = "job_through";
    const futureJob = "job_future";
    const events = [
      created(boundaryJob, "2026-08-09T00:00:00Z"),
      completed(boundaryJob, "2026-08-08T00:00:00Z", 10, 0),
      completed(boundaryJob, "2026-08-10T00:00:00Z", 999, 1),
      created(throughJob, AS_OF),
      completed(throughJob, AS_OF, 20, 0),
      created(futureJob, "2026-08-17T00:00:00Z"),
      completed(futureJob, "2026-08-16T00:00:00Z", 30, 0),
    ];

    const snapshot = calculateFacilityPerformance(events, {
      facility: FACILITY,
      asOf: AS_OF,
    });
    const window = snapshot.windows["7d"];

    expect(window.current.goodUnitsProduced.units).toBe(20);
    expect(window.current.onTimeCompletion.completedJobs).toBe(1);
    expect(window.prior?.goodUnitsProduced.units).toBe(10);
    expect(window.prior?.onTimeCompletion.completedJobs).toBe(1);
  });

  it("returns honest empty states and zero-filled rolling buckets", () => {
    const snapshot = calculateFacilityPerformance(
      [created("job_incomplete", "2026-08-20T00:00:00Z")],
      { facility: FACILITY, asOf: AS_OF },
    );
    const sevenDays = snapshot.windows["7d"];

    expect(sevenDays.current.onTimeCompletion).toEqual({
      onTimeJobs: 0,
      completedJobs: 0,
      rate: null,
    });
    expect(sevenDays.current.goodUnitsProduced.units).toBe(0);
    expect(sevenDays.current.productionYield).toEqual({
      goodUnits: 0,
      scrapUnits: 0,
      rate: null,
    });
    expect(sevenDays.comparison).toEqual({
      onTimeCompletionPercentagePoints: null,
      goodUnitsProducedPercent: null,
      productionYieldPercentagePoints: null,
    });
    expect(sevenDays.current.dailyGoodUnits).toHaveLength(7);
    expect(
      sevenDays.current.dailyGoodUnits.every((day) => day.goodUnits === 0),
    ).toBe(true);
    expect(snapshot.windows.all.current.dailyGoodUnits).toEqual([]);
  });

  it("provides all-time metrics without a fabricated prior comparison", () => {
    const events = [
      created("job_first", "2026-08-02T00:00:00Z"),
      completed("job_first", "2026-08-01T00:00:00Z", 80, 20),
      created("job_second", "2026-08-12T00:00:00Z"),
      completed("job_second", "2026-08-13T00:00:00Z", 90, 10),
    ];

    const allTime = calculateFacilityPerformance(events, {
      facility: FACILITY,
      asOf: AS_OF,
    }).windows.all;

    expect(allTime.current.onTimeCompletion).toEqual({
      onTimeJobs: 1,
      completedJobs: 2,
      rate: 0.5,
    });
    expect(allTime.current.goodUnitsProduced.units).toBe(170);
    expect(allTime.current.productionYield.rate).toBe(0.85);
    expect(allTime.prior).toBeNull();
    expect(allTime.comparison).toEqual({
      onTimeCompletionPercentagePoints: null,
      goodUnitsProducedPercent: null,
      productionYieldPercentagePoints: null,
    });
    expect(
      allTime.current.dailyGoodUnits.reduce(
        (sum, bucket) => sum + bucket.goodUnits,
        0,
      ),
    ).toBe(170);
  });

  it("filters facility and historical as-of state", () => {
    const localJob = "job_local";
    const otherJob = "job_other";
    const futureJob = "job_local_future";
    const events = [
      created(localJob, "2026-08-11T00:00:00Z"),
      completed(localJob, "2026-08-10T00:00:00Z", 40, 10),
      created(otherJob, "2026-08-11T00:00:00Z", { facility: "la_02" }),
      completed(otherJob, "2026-08-10T00:00:00Z", 100, 0, "la_02"),
      created(futureJob, "2026-08-20T00:00:00Z"),
      completed(futureJob, "2026-08-16T00:00:00Z", 100, 0),
    ];

    const snapshot = calculateFacilityPerformance(events, {
      facility: FACILITY,
      asOf: AS_OF,
    });

    expect(snapshot.windows.all.current.goodUnitsProduced.units).toBe(40);
    expect(snapshot.windows.all.current.onTimeCompletion.completedJobs).toBe(1);
  });

  it("rejects a completion that has no preceding creation evidence", () => {
    expect(() =>
      calculateFacilityPerformance(
        [completed("job_orphan", "2026-08-10T00:00:00Z", 10, 0)],
        { facility: FACILITY, asOf: AS_OF },
      ),
    ).toThrow("missing a preceding job_created event");
  });
});
