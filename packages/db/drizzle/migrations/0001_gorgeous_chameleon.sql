CREATE TABLE "operational_issue_assignments" (
	"issue_key" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"responder_id" text NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operational_issue_assignments_issue_key_check" CHECK (length("operational_issue_assignments"."issue_key") > 0),
	CONSTRAINT "operational_issue_assignments_job_id_check" CHECK (length("operational_issue_assignments"."job_id") > 0)
);
--> statement-breakpoint
ALTER TABLE "operational_issue_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "responders" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"role" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "responders_id_check" CHECK (length("responders"."id") > 0),
	CONSTRAINT "responders_display_name_check" CHECK (length("responders"."display_name") > 0),
	CONSTRAINT "responders_role_check" CHECK (length("responders"."role") > 0)
);
--> statement-breakpoint
ALTER TABLE "responders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "operational_issue_assignments" ADD CONSTRAINT "operational_issue_assignments_responder_id_responders_id_fk" FOREIGN KEY ("responder_id") REFERENCES "public"."responders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "operational_issue_assignments_responder_idx" ON "operational_issue_assignments" USING btree ("responder_id");--> statement-breakpoint
INSERT INTO "responders" ("id", "display_name", "role", "active") VALUES
	('tech_01', 'Maya Chen', 'Tooling technician', true),
	('tech_02', 'Luis Reyes', 'Maintenance technician', true),
	('tech_03', 'Priya Shah', 'Quality engineer', true),
	('tech_04', 'Jordan Brooks', 'Process engineer', true),
	('tech_05', 'Sam Okafor', 'Material coordinator', true),
	('tech_06', 'Avery Kim', 'Shift supervisor', true)
ON CONFLICT ("id") DO UPDATE SET
	"display_name" = EXCLUDED."display_name",
	"role" = EXCLUDED."role",
	"active" = EXCLUDED."active";--> statement-breakpoint
REVOKE ALL ON TABLE "responders" FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL ON TABLE "operational_issue_assignments" FROM anon, authenticated;--> statement-breakpoint
GRANT ALL ON TABLE "responders" TO service_role;--> statement-breakpoint
GRANT ALL ON TABLE "operational_issue_assignments" TO service_role;
