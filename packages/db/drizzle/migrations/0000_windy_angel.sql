CREATE TABLE "event_import_issues" (
	"import_id" uuid NOT NULL,
	"line_number" integer NOT NULL,
	"code" text NOT NULL,
	"event_id" text,
	"message" text NOT NULL,
	"details" jsonb,
	CONSTRAINT "event_import_issues_import_id_line_number_code_pk" PRIMARY KEY("import_id","line_number","code"),
	CONSTRAINT "event_import_issues_code_check" CHECK ("event_import_issues"."code" in ('invalid_json', 'invalid_event', 'identical_duplicate', 'conflicting_duplicate'))
);
--> statement-breakpoint
ALTER TABLE "event_import_issues" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "event_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_name" text NOT NULL,
	"source_fingerprint" text NOT NULL,
	"status" text DEFAULT 'processing' NOT NULL,
	"total_line_count" integer DEFAULT 0 NOT NULL,
	"accepted_event_count" integer DEFAULT 0 NOT NULL,
	"invalid_line_count" integer DEFAULT 0 NOT NULL,
	"identical_duplicate_count" integer DEFAULT 0 NOT NULL,
	"conflicting_duplicate_count" integer DEFAULT 0 NOT NULL,
	"report" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "event_imports_source_fingerprint_unique" UNIQUE("source_fingerprint"),
	CONSTRAINT "event_imports_source_fingerprint_check" CHECK ("event_imports"."source_fingerprint" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "event_imports_status_check" CHECK ("event_imports"."status" in ('processing', 'completed')),
	CONSTRAINT "event_imports_total_line_count_check" CHECK ("event_imports"."total_line_count" >= 0),
	CONSTRAINT "event_imports_accepted_event_count_check" CHECK ("event_imports"."accepted_event_count" >= 0),
	CONSTRAINT "event_imports_invalid_line_count_check" CHECK ("event_imports"."invalid_line_count" >= 0),
	CONSTRAINT "event_imports_identical_duplicate_count_check" CHECK ("event_imports"."identical_duplicate_count" >= 0),
	CONSTRAINT "event_imports_conflicting_duplicate_count_check" CHECK ("event_imports"."conflicting_duplicate_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "event_imports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "manufacturing_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"event_type" text NOT NULL,
	"job_id" text NOT NULL,
	"part_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"machine_id" text,
	"material" text NOT NULL,
	"quantity" integer NOT NULL,
	"facility" text NOT NULL,
	"priority" text,
	"target_due_at" timestamp with time zone,
	"target_quantity" integer,
	"unit_price_estimate" numeric,
	"tool_id" text,
	"operator_id" text,
	"cycle_time_seconds" numeric,
	"defect_code" text,
	"inspector_id" text,
	"reason" text,
	"good_quantity" integer,
	"scrap_quantity" integer,
	"lot_id" text,
	"signal" text,
	"payload_fingerprint" text NOT NULL,
	"source_import_id" uuid NOT NULL,
	"source_line" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manufacturing_events_event_type_check" CHECK ("manufacturing_events"."event_type" in ('job_created', 'tool_ready', 'job_started', 'cycle_completed', 'inspection_passed', 'inspection_failed', 'job_blocked', 'job_unblocked', 'job_hold', 'job_completed', 'maintenance_ping', 'material_lot_scan', 'sensor_glitch', 'shift_handoff')),
	CONSTRAINT "manufacturing_events_quantity_check" CHECK ("manufacturing_events"."quantity" >= 0),
	CONSTRAINT "manufacturing_events_facility_check" CHECK ("manufacturing_events"."facility" in ('la_01', 'la_02')),
	CONSTRAINT "manufacturing_events_priority_check" CHECK ("manufacturing_events"."priority" is null or "manufacturing_events"."priority" in ('low', 'normal', 'high')),
	CONSTRAINT "manufacturing_events_target_quantity_check" CHECK ("manufacturing_events"."target_quantity" is null or "manufacturing_events"."target_quantity" > 0),
	CONSTRAINT "manufacturing_events_unit_price_estimate_check" CHECK ("manufacturing_events"."unit_price_estimate" is null or "manufacturing_events"."unit_price_estimate" >= 0),
	CONSTRAINT "manufacturing_events_cycle_time_seconds_check" CHECK ("manufacturing_events"."cycle_time_seconds" is null or "manufacturing_events"."cycle_time_seconds" > 0),
	CONSTRAINT "manufacturing_events_defect_code_check" CHECK ("manufacturing_events"."defect_code" is null or "manufacturing_events"."defect_code" in ('voids', 'delamination', 'dimensional', 'surface', 'resin_rich', 'other')),
	CONSTRAINT "manufacturing_events_reason_check" CHECK ("manufacturing_events"."reason" is null or "manufacturing_events"."reason" in ('missing_tool', 'material_wait', 'engineering_hold', 'awaiting_qc', 'machine_fault', 'resolved_missing_tool', 'resolved_material_wait', 'resolved_engineering_hold', 'resolved_awaiting_qc', 'resolved_machine_fault')),
	CONSTRAINT "manufacturing_events_good_quantity_check" CHECK ("manufacturing_events"."good_quantity" is null or "manufacturing_events"."good_quantity" >= 0),
	CONSTRAINT "manufacturing_events_scrap_quantity_check" CHECK ("manufacturing_events"."scrap_quantity" is null or "manufacturing_events"."scrap_quantity" >= 0),
	CONSTRAINT "manufacturing_events_signal_check" CHECK ("manufacturing_events"."signal" is null or "manufacturing_events"."signal" in ('temp', 'pressure', 'platen')),
	CONSTRAINT "manufacturing_events_payload_fingerprint_check" CHECK ("manufacturing_events"."payload_fingerprint" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "manufacturing_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "raw_event_records" (
	"import_id" uuid NOT NULL,
	"line_number" integer NOT NULL,
	"raw_line" text NOT NULL,
	"raw_payload" jsonb,
	"event_id" text,
	"payload_fingerprint" text,
	"disposition" text NOT NULL,
	CONSTRAINT "raw_event_records_import_id_line_number_pk" PRIMARY KEY("import_id","line_number"),
	CONSTRAINT "raw_event_records_line_number_check" CHECK ("raw_event_records"."line_number" > 0),
	CONSTRAINT "raw_event_records_payload_fingerprint_check" CHECK ("raw_event_records"."payload_fingerprint" is null or "raw_event_records"."payload_fingerprint" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "raw_event_records_disposition_check" CHECK ("raw_event_records"."disposition" in ('blank', 'accepted', 'invalid_json', 'invalid_event', 'identical_duplicate', 'conflicting_duplicate'))
);
--> statement-breakpoint
ALTER TABLE "raw_event_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "event_import_issues" ADD CONSTRAINT "event_import_issues_source_record_fk" FOREIGN KEY ("import_id","line_number") REFERENCES "public"."raw_event_records"("import_id","line_number") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufacturing_events" ADD CONSTRAINT "manufacturing_events_source_record_fk" FOREIGN KEY ("source_import_id","source_line") REFERENCES "public"."raw_event_records"("import_id","line_number") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_event_records" ADD CONSTRAINT "raw_event_records_import_id_event_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."event_imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_import_issues_code_idx" ON "event_import_issues" USING btree ("code");--> statement-breakpoint
CREATE INDEX "manufacturing_events_occurred_at_idx" ON "manufacturing_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "manufacturing_events_job_timeline_idx" ON "manufacturing_events" USING btree ("job_id","occurred_at","source_line");--> statement-breakpoint
CREATE INDEX "manufacturing_events_facility_type_idx" ON "manufacturing_events" USING btree ("facility","event_type");--> statement-breakpoint
CREATE INDEX "manufacturing_events_machine_idx" ON "manufacturing_events" USING btree ("machine_id") WHERE "manufacturing_events"."machine_id" is not null;--> statement-breakpoint
CREATE INDEX "manufacturing_events_tool_idx" ON "manufacturing_events" USING btree ("tool_id") WHERE "manufacturing_events"."tool_id" is not null;--> statement-breakpoint
CREATE INDEX "raw_event_records_event_id_idx" ON "raw_event_records" USING btree ("event_id") WHERE "raw_event_records"."event_id" is not null;--> statement-breakpoint
REVOKE ALL ON TABLE "event_imports" FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL ON TABLE "raw_event_records" FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL ON TABLE "manufacturing_events" FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL ON TABLE "event_import_issues" FROM anon, authenticated;--> statement-breakpoint
GRANT ALL ON TABLE "event_imports" TO service_role;--> statement-breakpoint
GRANT ALL ON TABLE "raw_event_records" TO service_role;--> statement-breakpoint
GRANT ALL ON TABLE "manufacturing_events" TO service_role;--> statement-breakpoint
GRANT ALL ON TABLE "event_import_issues" TO service_role;
