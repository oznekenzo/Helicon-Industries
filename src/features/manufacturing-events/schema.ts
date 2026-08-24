import { z } from "zod";

import {
  BLOCK_REASONS,
  DEFECT_CODES,
  FACILITIES,
  PRIORITIES,
  RESOLVED_BLOCK_REASONS,
  SENSOR_SIGNALS,
} from "./types";

const identifier = z.string().min(1);
const quantity = z.number().int().nonnegative();
const facility = z.enum(FACILITIES);

const eventShape = {
  event_id: identifier,
  timestamp: z.iso.datetime({ offset: true }),
  job_id: identifier,
  part_id: identifier,
  customer_id: identifier,
  machine_id: identifier.nullable(),
  material: identifier,
  quantity,
};

const facilityMetadataShape = {
  facility,
};

const jobCreated = z.strictObject({
  ...eventShape,
  event_type: z.literal("job_created"),
  metadata: z.strictObject({
    ...facilityMetadataShape,
    priority: z.enum(PRIORITIES),
    target_due_at: z.iso.datetime({ offset: true }),
    target_quantity: z.number().int().positive(),
    tool_id: identifier.optional(),
    unit_price_estimate: z.number().nonnegative().optional(),
  }),
});

const toolReady = z.strictObject({
  ...eventShape,
  event_type: z.literal("tool_ready"),
  metadata: z.strictObject({
    ...facilityMetadataShape,
    tool_id: identifier.optional(),
  }),
});

const jobStarted = z.strictObject({
  ...eventShape,
  event_type: z.literal("job_started"),
  metadata: z.strictObject({
    ...facilityMetadataShape,
    tool_id: identifier.optional(),
    operator_id: identifier.optional(),
  }),
});

const cycleCompleted = z.strictObject({
  ...eventShape,
  event_type: z.literal("cycle_completed"),
  metadata: z.strictObject({
    ...facilityMetadataShape,
    cycle_time_seconds: z.number().positive(),
    tool_id: identifier.optional(),
  }),
});

const inspectionPassed = z.strictObject({
  ...eventShape,
  event_type: z.literal("inspection_passed"),
  metadata: z.strictObject({
    ...facilityMetadataShape,
    inspector_id: identifier.optional(),
  }),
});

const inspectionFailed = z.strictObject({
  ...eventShape,
  event_type: z.literal("inspection_failed"),
  metadata: z.strictObject({
    ...facilityMetadataShape,
    defect_code: z.enum(DEFECT_CODES),
    inspector_id: identifier.optional(),
  }),
});

const jobBlocked = z.strictObject({
  ...eventShape,
  event_type: z.literal("job_blocked"),
  metadata: z.strictObject({
    ...facilityMetadataShape,
    reason: z.enum(BLOCK_REASONS),
  }),
});

const jobUnblocked = z.strictObject({
  ...eventShape,
  event_type: z.literal("job_unblocked"),
  metadata: z.strictObject({
    ...facilityMetadataShape,
    reason: z.enum(RESOLVED_BLOCK_REASONS).optional(),
  }),
});

const jobHold = z.strictObject({
  ...eventShape,
  event_type: z.literal("job_hold"),
  metadata: z.strictObject(facilityMetadataShape),
});

const jobCompleted = z.strictObject({
  ...eventShape,
  event_type: z.literal("job_completed"),
  metadata: z.strictObject({
    ...facilityMetadataShape,
    good_quantity: quantity,
    scrap_quantity: quantity,
  }),
});

const maintenancePing = z.strictObject({
  ...eventShape,
  event_type: z.literal("maintenance_ping"),
  metadata: z.strictObject(facilityMetadataShape),
});

const materialLotScan = z.strictObject({
  ...eventShape,
  event_type: z.literal("material_lot_scan"),
  metadata: z.strictObject({
    ...facilityMetadataShape,
    lot_id: identifier,
  }),
});

const sensorGlitch = z.strictObject({
  ...eventShape,
  event_type: z.literal("sensor_glitch"),
  metadata: z.strictObject({
    ...facilityMetadataShape,
    signal: z.enum(SENSOR_SIGNALS),
  }),
});

const shiftHandoff = z.strictObject({
  ...eventShape,
  event_type: z.literal("shift_handoff"),
  metadata: z.strictObject(facilityMetadataShape),
});

export const manufacturingEventSchema = z.discriminatedUnion("event_type", [
  jobCreated,
  toolReady,
  jobStarted,
  cycleCompleted,
  inspectionPassed,
  inspectionFailed,
  jobBlocked,
  jobUnblocked,
  jobHold,
  jobCompleted,
  maintenancePing,
  materialLotScan,
  sensorGlitch,
  shiftHandoff,
]);

export type ValidatedManufacturingEvent = z.infer<
  typeof manufacturingEventSchema
>;
