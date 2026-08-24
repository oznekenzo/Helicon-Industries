import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import type {
  ImportReport,
  ValidationDetail,
} from "../../../../src/features/manufacturing-events/types";
import {
  BLOCK_REASONS,
  DEFECT_CODES,
  EVENT_TYPES,
  FACILITIES,
  PRIORITIES,
  RESOLVED_BLOCK_REASONS,
  SENSOR_SIGNALS,
} from "../../../../src/features/manufacturing-events/types";

const IMPORT_STATUSES = ["processing", "completed"] as const;
const RAW_RECORD_DISPOSITIONS = [
  "blank",
  "accepted",
  "invalid_json",
  "invalid_event",
  "identical_duplicate",
  "conflicting_duplicate",
] as const;
const IMPORT_ISSUE_CODES = [
  "invalid_json",
  "invalid_event",
  "identical_duplicate",
  "conflicting_duplicate",
] as const;
const BLOCK_AND_RESOLUTION_REASONS = [
  ...BLOCK_REASONS,
  ...RESOLVED_BLOCK_REASONS,
] as const;

export const eventImports = pgTable(
  "event_imports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceName: text("source_name").notNull(),
    sourceFingerprint: text("source_fingerprint").notNull().unique(),
    status: text("status", { enum: IMPORT_STATUSES })
      .notNull()
      .default("processing"),
    totalLineCount: integer("total_line_count").notNull().default(0),
    acceptedEventCount: integer("accepted_event_count").notNull().default(0),
    invalidLineCount: integer("invalid_line_count").notNull().default(0),
    identicalDuplicateCount: integer("identical_duplicate_count")
      .notNull()
      .default(0),
    conflictingDuplicateCount: integer("conflicting_duplicate_count")
      .notNull()
      .default(0),
    report: jsonb("report").$type<ImportReport>(),
    startedAt: timestamp("started_at", {
      withTimezone: true,
      mode: "string",
    })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (table) => [
    check(
      "event_imports_source_fingerprint_check",
      sql`${table.sourceFingerprint} ~ '^[a-f0-9]{64}$'`,
    ),
    check(
      "event_imports_status_check",
      sql`${table.status} in ('processing', 'completed')`,
    ),
    check(
      "event_imports_total_line_count_check",
      sql`${table.totalLineCount} >= 0`,
    ),
    check(
      "event_imports_accepted_event_count_check",
      sql`${table.acceptedEventCount} >= 0`,
    ),
    check(
      "event_imports_invalid_line_count_check",
      sql`${table.invalidLineCount} >= 0`,
    ),
    check(
      "event_imports_identical_duplicate_count_check",
      sql`${table.identicalDuplicateCount} >= 0`,
    ),
    check(
      "event_imports_conflicting_duplicate_count_check",
      sql`${table.conflictingDuplicateCount} >= 0`,
    ),
  ],
).enableRLS();

export const rawEventRecords = pgTable(
  "raw_event_records",
  {
    importId: uuid("import_id")
      .notNull()
      .references(() => eventImports.id, { onDelete: "cascade" }),
    lineNumber: integer("line_number").notNull(),
    rawLine: text("raw_line").notNull(),
    rawPayload: jsonb("raw_payload").$type<unknown>(),
    eventId: text("event_id"),
    payloadFingerprint: text("payload_fingerprint"),
    disposition: text("disposition", {
      enum: RAW_RECORD_DISPOSITIONS,
    }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.importId, table.lineNumber] }),
    check("raw_event_records_line_number_check", sql`${table.lineNumber} > 0`),
    check(
      "raw_event_records_payload_fingerprint_check",
      sql`${table.payloadFingerprint} is null or ${table.payloadFingerprint} ~ '^[a-f0-9]{64}$'`,
    ),
    check(
      "raw_event_records_disposition_check",
      sql`${table.disposition} in ('blank', 'accepted', 'invalid_json', 'invalid_event', 'identical_duplicate', 'conflicting_duplicate')`,
    ),
    index("raw_event_records_event_id_idx")
      .on(table.eventId)
      .where(sql`${table.eventId} is not null`),
  ],
).enableRLS();

export const manufacturingEvents = pgTable(
  "manufacturing_events",
  {
    eventId: text("event_id").primaryKey(),
    occurredAt: timestamp("occurred_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    eventType: text("event_type", { enum: EVENT_TYPES }).notNull(),
    jobId: text("job_id").notNull(),
    partId: text("part_id").notNull(),
    customerId: text("customer_id").notNull(),
    machineId: text("machine_id"),
    material: text("material").notNull(),
    quantity: integer("quantity").notNull(),
    facility: text("facility", { enum: FACILITIES }).notNull(),
    priority: text("priority", { enum: PRIORITIES }),
    targetDueAt: timestamp("target_due_at", {
      withTimezone: true,
      mode: "string",
    }),
    targetQuantity: integer("target_quantity"),
    unitPriceEstimate: numeric("unit_price_estimate", { mode: "number" }),
    toolId: text("tool_id"),
    operatorId: text("operator_id"),
    cycleTimeSeconds: numeric("cycle_time_seconds", { mode: "number" }),
    defectCode: text("defect_code", { enum: DEFECT_CODES }),
    inspectorId: text("inspector_id"),
    reason: text("reason", { enum: BLOCK_AND_RESOLUTION_REASONS }),
    goodQuantity: integer("good_quantity"),
    scrapQuantity: integer("scrap_quantity"),
    lotId: text("lot_id"),
    signal: text("signal", { enum: SENSOR_SIGNALS }),
    payloadFingerprint: text("payload_fingerprint").notNull(),
    sourceImportId: uuid("source_import_id").notNull(),
    sourceLine: integer("source_line").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.sourceImportId, table.sourceLine],
      foreignColumns: [rawEventRecords.importId, rawEventRecords.lineNumber],
      name: "manufacturing_events_source_record_fk",
    }).onDelete("cascade"),
    check(
      "manufacturing_events_event_type_check",
      sql`${table.eventType} in ('job_created', 'tool_ready', 'job_started', 'cycle_completed', 'inspection_passed', 'inspection_failed', 'job_blocked', 'job_unblocked', 'job_hold', 'job_completed', 'maintenance_ping', 'material_lot_scan', 'sensor_glitch', 'shift_handoff')`,
    ),
    check("manufacturing_events_quantity_check", sql`${table.quantity} >= 0`),
    check(
      "manufacturing_events_facility_check",
      sql`${table.facility} in ('la_01', 'la_02')`,
    ),
    check(
      "manufacturing_events_priority_check",
      sql`${table.priority} is null or ${table.priority} in ('low', 'normal', 'high')`,
    ),
    check(
      "manufacturing_events_target_quantity_check",
      sql`${table.targetQuantity} is null or ${table.targetQuantity} > 0`,
    ),
    check(
      "manufacturing_events_unit_price_estimate_check",
      sql`${table.unitPriceEstimate} is null or ${table.unitPriceEstimate} >= 0`,
    ),
    check(
      "manufacturing_events_cycle_time_seconds_check",
      sql`${table.cycleTimeSeconds} is null or ${table.cycleTimeSeconds} > 0`,
    ),
    check(
      "manufacturing_events_defect_code_check",
      sql`${table.defectCode} is null or ${table.defectCode} in ('voids', 'delamination', 'dimensional', 'surface', 'resin_rich', 'other')`,
    ),
    check(
      "manufacturing_events_reason_check",
      sql`${table.reason} is null or ${table.reason} in ('missing_tool', 'material_wait', 'engineering_hold', 'awaiting_qc', 'machine_fault', 'resolved_missing_tool', 'resolved_material_wait', 'resolved_engineering_hold', 'resolved_awaiting_qc', 'resolved_machine_fault')`,
    ),
    check(
      "manufacturing_events_good_quantity_check",
      sql`${table.goodQuantity} is null or ${table.goodQuantity} >= 0`,
    ),
    check(
      "manufacturing_events_scrap_quantity_check",
      sql`${table.scrapQuantity} is null or ${table.scrapQuantity} >= 0`,
    ),
    check(
      "manufacturing_events_signal_check",
      sql`${table.signal} is null or ${table.signal} in ('temp', 'pressure', 'platen')`,
    ),
    check(
      "manufacturing_events_payload_fingerprint_check",
      sql`${table.payloadFingerprint} ~ '^[a-f0-9]{64}$'`,
    ),
    index("manufacturing_events_occurred_at_idx").on(table.occurredAt),
    index("manufacturing_events_job_timeline_idx").on(
      table.jobId,
      table.occurredAt,
      table.sourceLine,
    ),
    index("manufacturing_events_facility_type_idx").on(
      table.facility,
      table.eventType,
    ),
    index("manufacturing_events_machine_idx")
      .on(table.machineId)
      .where(sql`${table.machineId} is not null`),
    index("manufacturing_events_tool_idx")
      .on(table.toolId)
      .where(sql`${table.toolId} is not null`),
  ],
).enableRLS();

export const eventImportIssues = pgTable(
  "event_import_issues",
  {
    importId: uuid("import_id").notNull(),
    lineNumber: integer("line_number").notNull(),
    code: text("code", { enum: IMPORT_ISSUE_CODES }).notNull(),
    eventId: text("event_id"),
    message: text("message").notNull(),
    details: jsonb("details").$type<ValidationDetail[]>(),
  },
  (table) => [
    primaryKey({ columns: [table.importId, table.lineNumber, table.code] }),
    foreignKey({
      columns: [table.importId, table.lineNumber],
      foreignColumns: [rawEventRecords.importId, rawEventRecords.lineNumber],
      name: "event_import_issues_source_record_fk",
    }).onDelete("cascade"),
    check(
      "event_import_issues_code_check",
      sql`${table.code} in ('invalid_json', 'invalid_event', 'identical_duplicate', 'conflicting_duplicate')`,
    ),
    index("event_import_issues_code_idx").on(table.code),
  ],
).enableRLS();
