import type { Facility } from "@/features/manufacturing-events";

export type FacilityPerformanceWindowKey = "7d" | "14d" | "all";

export type MeasurementRange = {
  fromExclusive: string | null;
  throughInclusive: string;
};

export type DailyGoodUnitsBucket = MeasurementRange & {
  goodUnits: number;
};

export type OnTimeCompletionMetric = {
  onTimeJobs: number;
  completedJobs: number;
  rate: number | null;
};

export type GoodUnitsProducedMetric = {
  units: number;
};

export type ProductionYieldMetric = {
  goodUnits: number;
  scrapUnits: number;
  rate: number | null;
};

export type FacilityPerformancePeriod = {
  range: MeasurementRange;
  onTimeCompletion: OnTimeCompletionMetric;
  goodUnitsProduced: GoodUnitsProducedMetric;
  productionYield: ProductionYieldMetric;
  dailyGoodUnits: DailyGoodUnitsBucket[];
};

export type FacilityPerformanceComparison = {
  onTimeCompletionPercentagePoints: number | null;
  goodUnitsProducedPercent: number | null;
  productionYieldPercentagePoints: number | null;
};

export type FacilityPerformanceWindow = {
  key: FacilityPerformanceWindowKey;
  current: FacilityPerformancePeriod;
  prior: FacilityPerformancePeriod | null;
  comparison: FacilityPerformanceComparison;
};

export type FacilityPerformanceSnapshot = {
  facility: Facility;
  asOf: string;
  windows: Record<FacilityPerformanceWindowKey, FacilityPerformanceWindow>;
};

export type CalculateFacilityPerformanceInput = {
  facility: Facility;
  asOf: string;
};
