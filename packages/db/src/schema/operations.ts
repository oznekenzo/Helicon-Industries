import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const responders = pgTable(
  "responders",
  {
    id: text("id").primaryKey(),
    displayName: text("display_name").notNull(),
    role: text("role").notNull(),
    active: boolean("active").notNull().default(true),
  },
  (table) => [
    check("responders_id_check", sql`length(${table.id}) > 0`),
    check(
      "responders_display_name_check",
      sql`length(${table.displayName}) > 0`,
    ),
    check("responders_role_check", sql`length(${table.role}) > 0`),
  ],
).enableRLS();

export const operationalIssueAssignments = pgTable(
  "operational_issue_assignments",
  {
    issueKey: text("issue_key").primaryKey(),
    jobId: text("job_id").notNull(),
    responderId: text("responder_id")
      .notNull()
      .references(() => responders.id, { onDelete: "restrict" }),
    assignedAt: timestamp("assigned_at", {
      withTimezone: true,
      mode: "string",
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "operational_issue_assignments_issue_key_check",
      sql`length(${table.issueKey}) > 0`,
    ),
    check(
      "operational_issue_assignments_job_id_check",
      sql`length(${table.jobId}) > 0`,
    ),
    index("operational_issue_assignments_responder_idx").on(table.responderId),
  ],
).enableRLS();
