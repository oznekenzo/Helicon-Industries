import type { NormalizedManufacturingEvent } from "@/features/manufacturing-events";

import type {
  CalculateFacilityPerformanceInput,
  DailyGoodUnitsBucket,
  FacilityPerformanceComparison,
  FacilityPerformancePeriod,
  FacilityPerformanceSnapshot,
  FacilityPerformanceWindow,
  FacilityPerformanceWindowKey,
  MeasurementRange,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1_000;

type CanonicalCompletion = {
  jobId: string;
  completedAt: string;
  completedAtMs: number;
  targetDueAtMs: number;
  goodUnits: number;
  scrapUnits: number;
};

function parseTimestamp(value: string, label: string) {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    throw new Error(`${label} must be a valid ISO-8601 timestamp.`);
  }

  return timestamp;
}

function normalizedTimestamp(timestamp: number) {
  return new Date(timestamp).toISOString();
}

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

function canonicalCompletions(
  events: NormalizedManufacturingEvent[],
  input: CalculateFacilityPerformanceInput,
) {
  const asOfMs = parseTimestamp(input.asOf, "asOf");
  const targetDueByJob = new Map<string, number>();
  const completionByJob = new Map<string, CanonicalCompletion>();
  const relevantEvents = events
    .filter(
      (event) =>
        event.metadata.facility === input.facility &&
        parseTimestamp(event.occurredAt, `Event ${event.eventId} timestamp`) <=
          asOfMs &&
        (event.eventType === "job_created" ||
          event.eventType === "job_completed"),
    )
    .sort(compareEvents);

  for (const event of relevantEvents) {
    if (event.eventType === "job_created") {
      if (!targetDueByJob.has(event.jobId)) {
        const targetDueAt = event.metadata.targetDueAt;

        if (!targetDueAt) {
          throw new Error(
            `Job ${event.jobId} is missing target_due_at on job_created.`,
          );
        }

        targetDueByJob.set(
          event.jobId,
          parseTimestamp(targetDueAt, `Job ${event.jobId} target due time`),
        );
      }

      continue;
    }

    if (completionByJob.has(event.jobId)) {
      continue;
    }

    const targetDueAtMs = targetDueByJob.get(event.jobId);

    if (targetDueAtMs === undefined) {
      throw new Error(
        `Completed job ${event.jobId} is missing a preceding job_created event.`,
      );
    }

    if (
      event.metadata.goodQuantity === undefined ||
      event.metadata.scrapQuantity === undefined
    ) {
      throw new Error(
        `Job ${event.jobId} is missing completion good or scrap quantity.`,
      );
    }

    completionByJob.set(event.jobId, {
      jobId: event.jobId,
      completedAt: event.occurredAt,
      completedAtMs: parseTimestamp(
        event.occurredAt,
        `Job ${event.jobId} completion time`,
      ),
      targetDueAtMs,
      goodUnits: event.metadata.goodQuantity,
      scrapUnits: event.metadata.scrapQuantity,
    });
  }

  return [...completionByJob.values()];
}

function completionsInRange(
  completions: CanonicalCompletion[],
  range: MeasurementRange,
) {
  const throughInclusive = Date.parse(range.throughInclusive);
  const fromExclusive =
    range.fromExclusive === null ? null : Date.parse(range.fromExclusive);

  return completions.filter(
    (completion) =>
      completion.completedAtMs <= throughInclusive &&
      (fromExclusive === null || completion.completedAtMs > fromExclusive),
  );
}

function dailyBuckets(
  completions: CanonicalCompletion[],
  range: MeasurementRange,
  fixedBucketCount?: number,
): DailyGoodUnitsBucket[] {
  const throughInclusive = Date.parse(range.throughInclusive);
  let bucketCount = fixedBucketCount;

  if (bucketCount === undefined) {
    const earliestCompletion = completions.reduce<number | undefined>(
      (earliest, completion) =>
        earliest === undefined
          ? completion.completedAtMs
          : Math.min(earliest, completion.completedAtMs),
      undefined,
    );

    if (earliestCompletion === undefined) {
      return [];
    }

    bucketCount =
      Math.floor((throughInclusive - earliestCompletion) / DAY_MS) + 1;
  }

  const firstBoundary = throughInclusive - bucketCount * DAY_MS;

  return Array.from({ length: bucketCount }, (_, index) => {
    const fromExclusive = firstBoundary + index * DAY_MS;
    const bucketThroughInclusive = fromExclusive + DAY_MS;
    const goodUnits = completions
      .filter(
        (completion) =>
          completion.completedAtMs > fromExclusive &&
          completion.completedAtMs <= bucketThroughInclusive,
      )
      .reduce((sum, completion) => sum + completion.goodUnits, 0);

    return {
      fromExclusive: normalizedTimestamp(fromExclusive),
      throughInclusive: normalizedTimestamp(bucketThroughInclusive),
      goodUnits,
    };
  });
}

function periodMetrics(
  completions: CanonicalCompletion[],
  range: MeasurementRange,
  fixedBucketCount?: number,
): FacilityPerformancePeriod {
  const selectedCompletions = completionsInRange(completions, range);
  const onTimeJobs = selectedCompletions.filter(
    (completion) => completion.completedAtMs <= completion.targetDueAtMs,
  ).length;
  const goodUnits = selectedCompletions.reduce(
    (sum, completion) => sum + completion.goodUnits,
    0,
  );
  const scrapUnits = selectedCompletions.reduce(
    (sum, completion) => sum + completion.scrapUnits,
    0,
  );
  const inspectedOutput = goodUnits + scrapUnits;

  return {
    range,
    onTimeCompletion: {
      onTimeJobs,
      completedJobs: selectedCompletions.length,
      rate:
        selectedCompletions.length === 0
          ? null
          : onTimeJobs / selectedCompletions.length,
    },
    goodUnitsProduced: { units: goodUnits },
    productionYield: {
      goodUnits,
      scrapUnits,
      rate: inspectedOutput === 0 ? null : goodUnits / inspectedOutput,
    },
    dailyGoodUnits: dailyBuckets(selectedCompletions, range, fixedBucketCount),
  };
}

function percentagePointChange(current: number | null, prior: number | null) {
  return current === null || prior === null ? null : (current - prior) * 100;
}

function percentageChange(current: number, prior: number) {
  return prior === 0 ? null : ((current - prior) / prior) * 100;
}

function comparisonFor(
  current: FacilityPerformancePeriod,
  prior: FacilityPerformancePeriod | null,
): FacilityPerformanceComparison {
  if (!prior) {
    return {
      onTimeCompletionPercentagePoints: null,
      goodUnitsProducedPercent: null,
      productionYieldPercentagePoints: null,
    };
  }

  return {
    onTimeCompletionPercentagePoints: percentagePointChange(
      current.onTimeCompletion.rate,
      prior.onTimeCompletion.rate,
    ),
    goodUnitsProducedPercent: percentageChange(
      current.goodUnitsProduced.units,
      prior.goodUnitsProduced.units,
    ),
    productionYieldPercentagePoints: percentagePointChange(
      current.productionYield.rate,
      prior.productionYield.rate,
    ),
  };
}

function rollingWindow(
  key: Exclude<FacilityPerformanceWindowKey, "all">,
  completions: CanonicalCompletion[],
  asOfMs: number,
  days: number,
): FacilityPerformanceWindow {
  const currentFrom = asOfMs - days * DAY_MS;
  const priorFrom = currentFrom - days * DAY_MS;
  const currentRange: MeasurementRange = {
    fromExclusive: normalizedTimestamp(currentFrom),
    throughInclusive: normalizedTimestamp(asOfMs),
  };
  const priorRange: MeasurementRange = {
    fromExclusive: normalizedTimestamp(priorFrom),
    throughInclusive: normalizedTimestamp(currentFrom),
  };
  const current = periodMetrics(completions, currentRange, days);
  const prior = periodMetrics(completions, priorRange, days);

  return {
    key,
    current,
    prior,
    comparison: comparisonFor(current, prior),
  };
}

function allTimeWindow(
  completions: CanonicalCompletion[],
  asOfMs: number,
): FacilityPerformanceWindow {
  const current = periodMetrics(completions, {
    fromExclusive: null,
    throughInclusive: normalizedTimestamp(asOfMs),
  });

  return {
    key: "all",
    current,
    prior: null,
    comparison: comparisonFor(current, null),
  };
}

export function calculateFacilityPerformance(
  events: NormalizedManufacturingEvent[],
  input: CalculateFacilityPerformanceInput,
): FacilityPerformanceSnapshot {
  const asOfMs = parseTimestamp(input.asOf, "asOf");
  const completions = canonicalCompletions(events, input);

  return {
    facility: input.facility,
    asOf: normalizedTimestamp(asOfMs),
    windows: {
      "7d": rollingWindow("7d", completions, asOfMs, 7),
      "14d": rollingWindow("14d", completions, asOfMs, 14),
      all: allTimeWindow(completions, asOfMs),
    },
  };
}
