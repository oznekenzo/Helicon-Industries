# Helicon Industries

A manufacturing control tower prototype built on a synthetic event log.

## Table of contents

- [Project brief](#project-brief)
- [Access](#access)
- [Stack](#stack)
- [Architecture decisions](#architecture-decisions)
- [Prototype versus production](#prototype-versus-production)
- [Assumptions](#assumptions)
- [Changes and additions to the supplied data](#changes-and-additions-to-the-supplied-data)
- [Development](#development)
- [Database and ingestion](#database-and-ingestion)
- [Deployment](#deployment)
- [Process](#process)
- [What's next](#whats-next)
- [Domain language](./CONTEXT.md)
- [Control Tower scope](./docs/control-tower-scope.md)
- [Manufacturing Event data contract](./docs/data-contract.md)

## Project brief

```yaml
Attached is a ~20k-row synthetic manufacturing event log. I'll share password to access 1 hour before your slot.
Goal: Build the most useful product you can on top of it in no more than 4 hours. Full freedom to manipulate schema + data + anything else.
Deliverables:
- deployed URL + basic auth password
- repo access (commit history)
- short README: stack, decisions made
- optional: anything else used during the process (sketches, notes)
Full path is fine: ingest → model → API → UI → deploy.
```

## Access

- URL: [https://helicon-industries.vercel.app](https://helicon-industries.vercel.app)
- Username: `helicon`
- Password: provided separately with the submission; never committed to the repository

Open the URL and sign in to reach `/dashboard`. Unauthenticated browser requests to protected HTML routes redirect to the sign-in page; unauthenticated API-style requests return `401`.

## Stack

- Next.js 16, React 19, and TypeScript
- Supabase Postgres with Drizzle ORM and generated migrations
- Zod for event validation
- Tailwind CSS 4, plus shared CSS in the current UI implementation
- Radix UI and Tabler Icons
- Vercel for Preview and Production deployments
- Vitest, Testing Library, ESLint, jsx-a11y, and Prettier
- Server-side HTTP Basic Auth credentials with an HTTP-only session cookie for browser sign-in

## Architecture decisions

- Preserve every raw line, then store a validated canonical event set for queries and auditability.
- Reconstruct Jobs, operational views, issues, and KPIs in TypeScript at an explicit `asOf` timestamp.
- Keep database access server-side: pooled Supabase connections at runtime and a direct connection for migrations.
- Keep Responder assignments separate from immutable manufacturing Source Facts.

## Prototype versus production

| Prototype                      | Production                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| Historical JSONL file import   | Continuous MES and machine integrations through a queue or event broker                 |
| Runtime TypeScript projections | Incremental read models, caching, and background processing                             |
| One Supabase Postgres database | Partitioning, retention, backups, monitoring, and separate analytical storage as needed |
| Shared Basic Auth credential   | SSO, individual users, RBAC, and facility-level authorization                           |
| One Next.js deployment         | Separately scalable ingestion, API, and web workloads when volume requires it           |

Next.js, Postgres, TypeScript, and Drizzle could remain; production mainly adds continuous ingestion, precomputation, security, and operational controls.

## Assumptions

- The file is a historical snapshot, not a live stream.
- The latest accepted facility event is the default `asOf` timestamp.
- The first valid occurrence of an `event_id` wins; later duplicates are recorded.
- The first Job completion is terminal.
- Blocks end on unblock or completion; holds end on completion because no release event exists.
- Cycle quantities represent produced units; completion metadata supplies good and scrap units.
- Missing optional values remain missing.
- Operational views, severity, ranking, and Recommended Actions are deterministic Derived Signals.
- Assignments belong to a specific issue episode and do not transfer to a later episode.

## Changes and additions to the supplied data

- Raw lines and payloads are preserved with fingerprints and validation results.
- Valid events are normalized into typed, queryable Postgres columns.
- Identical and conflicting duplicate IDs are recorded; conflicting later payloads do not replace the first valid event.
- Job state, operational views, issues, and facility metrics are derived at runtime and are not written back as source facts.
- Six prototype Responders and issue assignments were added as separate application-owned workflow data.
- The supplied event payloads were not edited or supplemented with invented values.

## Development

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Run all checks with `pnpm check`.

## Database and ingestion

```bash
# Inspect the source without writing
pnpm events:inspect /path/to/manufacturing_events.jsonl

# Apply committed migrations, then ingest
pnpm db:migrate
pnpm events:persist /path/to/manufacturing_events.jsonl

# After a structural schema change
pnpm db:generate
pnpm db:migrate
```

## Deployment

The Vercel project requires pooled `DATABASE_URL`, `BASIC_AUTH_USERNAME`, and `BASIC_AUTH_PASSWORD` in Preview and Production. `DIRECT_DATABASE_URL` is only for local migrations and is not deployed.

## Process

- context
- understand data
- user journey
- user goals
- figure out priorities
- understand domains and stack
- understand layout and visual hierarchy
- first design pass - adjust & refine
- share design with code ai
- find middle ground - some features were easily buildable and worth it
- lock in design
- update code to match worth-it design features
- build backend
- build frontend
- test + performance
- add documentation

## What's next

- kpi against target - compare top level factory stats against declared company wide north star performance targets
- tool insights analytics - create insights of low performing tools creating higher than normal scrap parts
- motion pass - a little goes a long way
- accessibility pass
- strict design system
- more comprehensive testing
- convert to tailwind
