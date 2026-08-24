import {
  listManufacturingEvents,
  resolveFacilityAsOf,
} from "@/features/manufacturing-events/repository";
import type { HeliconDatabase } from "@db/client";

import { calculateFacilityPerformance } from "./calculate-facility-performance";
import type {
  FacilityPerformanceQuery,
  FacilityPerformanceSnapshot,
} from "./types";

export async function getFacilityPerformance(
  db: HeliconDatabase,
  query: FacilityPerformanceQuery,
): Promise<FacilityPerformanceSnapshot> {
  const asOf = await resolveFacilityAsOf(db, query.facility, query.asOf);
  const events = await listManufacturingEvents(db, {
    facility: query.facility,
    asOf,
    eventTypes: ["job_created", "job_completed"],
  });

  return calculateFacilityPerformance(events, {
    facility: query.facility,
    asOf,
  });
}
