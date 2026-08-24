# Manufacturing Control Tower

This context defines the production conditions, operational issues, and response facts used by Helicon Industries.

## Production

**Facility**:
A physical production site identified by `facility`, currently `la_01` or `la_02`.
_Avoid_: Plant when referring to the identifier

**Manufacturing Event**:
An immutable, timestamped fact about a Job, such as creation, start, cycle completion, inspection, blockage, or completion.
_Avoid_: Boolean flag, mutable Job state

**Job**:
A customer production order for a target quantity of one Part in one Material by a target due time. Its current condition is reconstructed from its Manufacturing Events.
_Avoid_: Task, ticket

**Part**:
The manufactured item definition referenced by a Job.
_Avoid_: Product when referring to `part_id`

**Machine**:
A production or inspection station identified by `machine_id`; the supplied data contains presses and QC stations.
_Avoid_: Tool

**Tooling Station**:
A station such as `tooling_01` or `tooling_02` that prepares a physical Tool.
_Avoid_: Tool

**Tool**:
A physical production tool identified by `metadata.tool_id` and used by Jobs and Cycles.
_Avoid_: Machine, Tooling Station

**Cycle**:
One `cycle_completed` production event with a produced quantity and cycle duration.
_Avoid_: Job completion

**Inspection**:
An `inspection_passed` or `inspection_failed` event for a quantity of units; failed Inspections include a defect code.
_Avoid_: Yield

**Good Unit**:
A completed unit reported as usable in `job_completed.metadata.good_quantity`.
_Avoid_: Produced unit

**Scrap Unit**:
A completed unit reported as unusable in `job_completed.metadata.scrap_quantity`.
_Avoid_: Failed Inspection

**Active WIP**:
A Job that has started and has no completion event as of the selected operational timestamp.
_Avoid_: All created Jobs, current Jobs

**Blocked Job**:
An incomplete Job whose latest relevant Manufacturing Event is `job_blocked`; a later `job_unblocked` event ends the blockage.
_Avoid_: Active blockage

**Held Job**:
An incomplete Job whose latest relevant Manufacturing Event is `job_hold`.
_Avoid_: Blocked Job

## Operations

**Operational Issue**:
An evidence-backed current condition that deserves monitoring or intervention.
_Avoid_: Source event, generic Task, Exception

**Attention**:
The complete set of unresolved Operational Issues worth monitoring.
_Avoid_: Action Required

**Action Required**:
An Operational Issue that a deterministic triage rule identifies as requiring intervention now.
_Avoid_: Open, In progress

**Priority Worklist**:
Operational Issues ordered by action requirement, severity, due-time urgency, affected units, and age.
_Avoid_: Notification feed

**Required Action**:
A concise, condition-specific intervention such as locating a Tool, inspecting a Machine, reviewing failed Inspections, or replanning a late Job.
_Avoid_: In progress, Handle issue

**Delivery Risk**:
A derived signal that a Job may not meet its target due time, based only on supported due-date, progress, and blockage evidence.
_Avoid_: Guaranteed late delivery, predictive model

**Responder**:
A prototype team member who can own the response to an Operational Issue. Responders are application seed data, not identities supplied by the Manufacturing Event log.
_Avoid_: Operator when describing issue ownership

**Owner**:
The Responder accountable for the Required Action; an Operational Issue without one Needs Owner.
_Avoid_: Job Operator

**Response Record**:
Application-created facts describing ownership, assignment, acknowledgment, the latest update, and resolution of an Operational Issue.
_Avoid_: Open status, In-progress status

## Truth

**Source Fact**:
A value present in a supplied Manufacturing Event.
_Avoid_: Inference

**Derived Signal**:
A reproducible calculation or classification made from Source Facts, such as Active WIP, Delivery Risk, or Action Required.
_Avoid_: Source Fact

**Workflow Fact**:
An explicit application action or timestamp recorded during the response to an Operational Issue.
_Avoid_: Manufacturing Event, generic status
