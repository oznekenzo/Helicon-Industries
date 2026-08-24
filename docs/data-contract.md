# Manufacturing Event Data Contract

## Source

The supplied source is `manufacturing_events.jsonl`, a synthetic JSON Lines event log.

| Property              |                  Value |
| --------------------- | ---------------------: |
| Rows                  |                 19,519 |
| Unique event IDs      |                 19,500 |
| First timestamp       | `2026-07-03T13:41:56Z` |
| Last timestamp        | `2026-08-13T23:06:33Z` |
| Jobs                  |                    312 |
| Parts                 |                     25 |
| Customers             |                     16 |
| Machines and stations |                     10 |
| Tools                 |                     25 |
| Materials             |                      8 |
| Operators             |                     24 |
| Inspectors            |                     12 |
| Facilities            |                      2 |

## Raw event

```ts
type ManufacturingEvent = {
  event_id: string;
  timestamp: string;
  event_type: EventType;
  job_id: string;
  part_id: string;
  customer_id: string;
  machine_id: string | null;
  material: string;
  quantity: number;
  metadata: EventMetadata;
};

type EventType =
  | "job_created"
  | "tool_ready"
  | "job_started"
  | "cycle_completed"
  | "inspection_passed"
  | "inspection_failed"
  | "job_blocked"
  | "job_unblocked"
  | "job_hold"
  | "job_completed"
  | "maintenance_ping"
  | "material_lot_scan"
  | "sensor_glitch"
  | "shift_handoff";

type EventMetadata = {
  facility: "la_01" | "la_02";
  priority?: "low" | "normal" | "high";
  target_due_at?: string;
  target_quantity?: number;
  unit_price_estimate?: number;
  tool_id?: string;
  operator_id?: string;
  cycle_time_seconds?: number;
  defect_code?: DefectCode;
  inspector_id?: string;
  reason?: BlockReason | ResolvedBlockReason;
  good_quantity?: number;
  scrap_quantity?: number;
  lot_id?: string;
  signal?: "temp" | "pressure" | "platen";
};

type DefectCode =
  "voids" | "delamination" | "dimensional" | "surface" | "resin_rich" | "other";

type BlockReason =
  | "missing_tool"
  | "material_wait"
  | "engineering_hold"
  | "awaiting_qc"
  | "machine_fault";

type ResolvedBlockReason =
  | "resolved_missing_tool"
  | "resolved_material_wait"
  | "resolved_engineering_hold"
  | "resolved_awaiting_qc"
  | "resolved_machine_fault";
```

Timestamps are ISO-8601 UTC strings. `event_type` is an enum; cycle completion, Job completion, and Inspection results are not boolean fields on every event.

`quantity` is event-specific. It is a target quantity on Job creation, a produced quantity on cycle completion, an inspected quantity on Inspection events, a completed quantity on Job completion, and zero on state-transition events.

## Event-specific metadata

| Event type          |  Count | Relevant metadata                                                                                 |
| ------------------- | -----: | ------------------------------------------------------------------------------------------------- |
| `job_created`       |    312 | facility, priority, target due time, target quantity, optional Tool, optional unit price estimate |
| `tool_ready`        |    302 | facility, optional Tool                                                                           |
| `job_started`       |    302 | facility, optional Tool, optional Operator                                                        |
| `cycle_completed`   | 12,965 | facility, cycle time, optional Tool                                                               |
| `inspection_passed` |  2,765 | facility, optional Inspector                                                                      |
| `inspection_failed` |  2,388 | facility, defect code, optional Inspector                                                         |
| `job_blocked`       |     68 | facility, block reason                                                                            |
| `job_unblocked`     |     59 | facility, optional resolved reason                                                                |
| `job_hold`          |     13 | facility                                                                                          |
| `job_completed`     |    282 | facility, good quantity, scrap quantity                                                           |
| `maintenance_ping`  |     16 | facility                                                                                          |
| `material_lot_scan` |     14 | facility, lot ID                                                                                  |
| `sensor_glitch`     |     16 | facility, signal category                                                                         |
| `shift_handoff`     |     17 | facility                                                                                          |

For `tool_ready`, `machine_id` identifies a Tooling Station such as `tooling_02`; `metadata.tool_id` identifies the physical Tool such as `tool_20`.

`maintenance_ping`, `sensor_glitch`, and `shift_handoff` are sparse markers. They do not contain maintenance descriptions, continuous telemetry, handoff notes, or personnel details.

## Source entities

### Facilities

- `la_01`
- `la_02`

### Machines and stations

- `press_01` through `press_06`
- `qc_01`
- `qc_02`
- `tooling_01`
- `tooling_02`

### People

- Operators: `op_01` through `op_24`
- Inspectors: `insp_01` through `insp_12`

Operator and Inspector identity is limited to the supplied IDs.

## Ingestion contract

Ingestion must:

1. parse one JSON object per non-empty line
2. validate the top-level event and event-specific metadata
3. preserve the raw payload for auditability
4. treat `event_id` as the source identity
5. detect repeated IDs before normalization
6. distinguish identical duplicates from conflicting payloads
7. apply one deterministic conflict-resolution rule to the normalized event set
8. record validation and coverage problems
9. order each Job's accepted events by timestamp before state reconstruction

The source contains 19 repeated event IDs. Fourteen are identical duplicates and five have conflicting payloads.

## Reconstructed Job

```ts
type ReconstructedJob = {
  jobId: string;
  facility: "la_01" | "la_02";
  customerId: string;
  partId: string;
  material: string;
  priority: "low" | "normal" | "high";
  targetQuantity: number;
  targetDueAt: string;
  state: "created" | "started" | "blocked" | "held" | "completed";
  machineId?: string;
  toolId?: string;
  operatorId?: string;
  goodQuantity?: number;
  scrapQuantity?: number;
  sourceEventIds: string[];
};
```

The latest accepted state-transition event determines the reconstructed state. Job completion is terminal for the snapshot. Missing optional fields remain absent.

## Facility measures

Facility measures use the first accepted `job_completed` event for each Job at or before the selected as-of timestamp. Job completion is terminal, so later completion events for the same Job do not add output twice.

The 7-day and 14-day windows are equal rolling periods. The current period is `(as_of - duration, as_of]`; the prior period is the immediately preceding period of the same duration. Daily production values use consecutive 24-hour buckets aligned to the as-of timestamp. All-time measures include every canonical completion through the as-of timestamp and have no fabricated prior comparison.

### On-time completion

```text
Jobs completed at or before target_due_at
─────────────────────────────────────────
Jobs completed in the measurement period
```

### Good units produced

```text
sum(canonical job_completed.metadata.good_quantity)
```

The sum includes Jobs whose canonical completion occurred in the measurement period.

### Production yield

```text
sum(good_quantity)
─────────────────────────────────────
sum(good_quantity + scrap_quantity)
```

The calculation uses canonical completion events in the measurement period. On-time completion and Production Yield are absent when their denominators are zero. Percentage change in Good Units Produced is absent when the prior period is zero.

## Current operating conditions

All current conditions are evaluated at an explicit as-of timestamp.

### Active WIP

A Job with a `job_started` event and no accepted `job_completed` event at the as-of timestamp.

### Due within 24 hours

An Active WIP Job whose `target_due_at` is after the as-of timestamp and no more than 24 hours later.

### Blocked or held

An incomplete Job whose latest accepted relevant state event is `job_blocked` or `job_hold`.

### Past Due WIP

An Active WIP Job whose `target_due_at` is earlier than the as-of timestamp. This is a deterministic lateness condition, not predictive risk scoring.

### Needs Owner

An Action Required Operational Issue whose current issue episode has no Assignment Record.

### Action Required

An Operational Issue classified by a deterministic triage rule as requiring intervention now. The initial rules include:

- a currently blocked or held Job
- an Active WIP Job already past `target_due_at`

When conditions overlap, a current blocked or held condition takes precedence over Past Due WIP so the Priority Worklist contains one Operational Issue per Job. Quality, cycle-time, Tool, Material, Machine, and sensor patterns require separately defined thresholds before they can be classified as Action Required.

## Operational issue

```ts
type OperationalIssue = {
  issueKey: string;
  jobId: string;
  condition: "blocked" | "held" | "past_due";
  severity: "critical" | "high" | "medium" | "low";
  recommendedAction: string;
  detectedAt: string;
  evidenceEventIds: string[];
  affectedUnits: number;
  dueAt: string;
};

type AssignmentRecord = {
  issueKey: string;
  jobId: string;
  responderId: string;
  assignedAt: string;
};
```

Every Operational Issue references Source Fact evidence. Condition, severity, Recommended Action, Action Required, and Past Due WIP are Derived Signals. An Assignment Record contains only explicit application-created Workflow Facts. There is no generic `open` or `in_progress` status, acknowledgment, latest response, or response history.

Issue keys identify a specific condition episode:

- `blocked:<job_id>:<job_blocked_event_id>`
- `held:<job_id>:<job_hold_event_id>`
- `past_due:<job_id>:<target_due_at>`

Assignments do not silently transfer when a new condition episode begins. Resolved assignments remain stored but do not appear in current operating views.

Severity is deterministic. Blocked or held Jobs map source priority `high` to Critical, `normal` to High, and `low` to Medium. Past Due WIP maps source priority `high` to High, `normal` to Medium, and `low` to Low.

The Priority Worklist ranks by severity, remaining units, due time, condition age, and Job ID. Remaining units are `max(target_quantity - sum(cycle_completed.quantity), 0)` at the selected timestamp.

## Data-quality observations

| Observation                                |          Count |
| ------------------------------------------ | -------------: |
| Repeated event IDs                         |             19 |
| Repeated IDs with conflicting payloads     |              5 |
| `job_started` events missing `operator_id` |      59 of 302 |
| Inspection events missing `inspector_id`   | 1,391 of 5,153 |
| Cycles missing `tool_id`                   |   81 of 12,965 |
| Cycles missing `machine_id`                |   98 of 12,965 |
| Jobs missing `unit_price_estimate`         |     162 of 312 |

These observations are disclosed rather than replaced with fabricated values or an arbitrary confidence score.
