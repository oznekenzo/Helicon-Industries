# Control Tower Scope

## Goal

Help a production manager or shift supervisor understand whether a facility is producing usable output on time, identify the Jobs that require intervention, inspect the supporting evidence, and assign a Responder.

## Primary user

The primary user is responsible for facility-wide production outcomes and operational response. The product supports these operating questions:

1. Is the facility producing usable output on time?
2. What is happening in production now?
3. Which Jobs require intervention?
4. What evidence explains the condition?
5. Which Operational Issues still need a Responder?

## Facility outcomes

The facility-level outcomes are:

- On-time completion
- Good units produced
- Production yield

These measures describe delivery, usable volume, and production quality respectively.

## Current operating conditions

The current operating conditions are:

- Operational Issues that Need Assignment
- Not Started Jobs
- Active WIP
- Jobs due within 24 hours
- Blocked or held Jobs
- Past Due WIP

The conditions may overlap and are not additive categories.

## Supported workflow

The product scope includes:

- ingesting the supplied Manufacturing Event log
- preserving Source Facts and disclosing data-quality problems
- reconstructing current Job state from chronological events
- calculating facility outcomes and current operating conditions
- deriving evidence-backed Operational Issues
- ranking Needs Assignment issues by severity and operational impact
- showing a condition-specific Recommended Action instead of a generic status
- assigning or reassigning a Responder
- recording the current assignment time for each Operational Issue episode
- inspecting Job, Machine, Tool, Inspection, and event evidence supported by the source

## Truth boundaries

Every product value belongs to one of three layers:

1. **Source Fact** — present in a Manufacturing Event.
2. **Derived Signal** — reproducibly calculated from Source Facts.
3. **Workflow Fact** — explicitly recorded by the application during assignment.

Source Facts remain distinguishable from Derived Signals and Workflow Facts.

## Prototype responder roster

The event log contains Operator and Inspector IDs but no technician roster. The prototype adds these Responders for Operational Issue assignment:

| ID        | Display name  | Role                   |
| --------- | ------------- | ---------------------- |
| `tech_01` | Maya Chen     | Tooling technician     |
| `tech_02` | Luis Reyes    | Maintenance technician |
| `tech_03` | Priya Shah    | Quality engineer       |
| `tech_04` | Jordan Brooks | Process engineer       |
| `tech_05` | Sam Okafor    | Material coordinator   |
| `tech_06` | Avery Kim     | Shift supervisor       |

The roster is application seed data rather than source manufacturing data.

## Authentication and access

The deployed prototype uses one shared credential. Unauthenticated browser requests to protected pages redirect to the sign-in page; unauthenticated API-style requests receive `401`. User management and role-based permissions are outside the prototype scope.

## Excluded capabilities

The supplied data does not support:

- OEE
- Machine uptime or utilization
- continuous sensor telemetry
- predictive maintenance
- maintenance schedules or work orders
- safety incidents
- energy consumption
- inventory balances
- technician schedules, availability, or location
- messaging, notifications, or paging
- acknowledgments, comments, response updates, or response history
- customer names beyond the supplied customer IDs
- geographic analysis
- causal claims about Tools, Machines, Materials, Operators, or Inspectors
- a claim that the static event file is a live stream

Absent values remain absent rather than being fabricated.
