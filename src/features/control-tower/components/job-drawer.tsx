"use client";

import {
  IconAlertTriangleFilled,
  IconCircleFilled,
  IconClockExclamation,
  IconLoader2,
} from "@tabler/icons-react";

import {
  AssignmentMenu,
  PriorityBadge,
  SeverityIndicator,
  SideDrawer,
  StatusBadge,
} from "@/components/ui/control-tower-primitives";
import {
  formatAge,
  formatInteger,
  formatShortTimestamp,
  humanize,
} from "@/features/control-tower/format";
import type {
  ControlTowerIssue,
  JobDetail,
  Responder,
  TimelineEvent,
} from "@/features/control-tower/types";

function eventLabel(event: TimelineEvent) {
  switch (event.eventType) {
    case "job_created":
      return "Job created";
    case "tool_ready":
      return `Tool ready${event.toolId ? ` · ${event.toolId}` : ""}`;
    case "job_started":
      return `Job started${event.operatorId ? ` · ${event.operatorId}` : ""}`;
    case "cycle_completed":
      return `Cycle completed · ${formatInteger(event.quantity)} units`;
    case "inspection_passed":
      return `Inspection passed · ${formatInteger(event.quantity)} units`;
    case "inspection_failed":
      return `Inspection failed · ${formatInteger(event.quantity)} units${event.defectCode ? ` · ${humanize(event.defectCode)}` : ""}`;
    case "job_blocked":
      return `Job blocked${event.reason ? ` · ${humanize(event.reason)}` : ""}`;
    case "job_unblocked":
      return "Job unblocked";
    case "job_hold":
      return "Job placed on hold";
    case "job_completed":
      return "Job completed";
    case "maintenance_ping":
      return "Maintenance signal";
    case "material_lot_scan":
      return "Material lot scanned";
    case "sensor_glitch":
      return "Sensor anomaly recorded";
    case "shift_handoff":
      return "Shift handoff";
  }
}

function toneForCondition(condition: JobDetail["job"]["condition"]) {
  if (condition === "blocked" || condition === "held") return "warning";
  if (condition === "past-due") return "critical";
  if (condition === "active") return "healthy";
  return "neutral";
}

export function JobDrawer({
  open,
  detail,
  issue,
  responders,
  asOf,
  loading,
  error,
  assigning,
  onOpenChange,
  onAssign,
}: {
  open: boolean;
  detail: JobDetail | null;
  issue?: ControlTowerIssue;
  responders: Responder[];
  asOf: string;
  loading: boolean;
  error: string | null;
  assigning: boolean;
  onOpenChange: (open: boolean) => void;
  onAssign: (issue: ControlTowerIssue, responderId: string) => void;
}) {
  const title = detail ? `Job ${detail.job.jobId}` : "Job details";
  return (
    <SideDrawer onOpenChange={onOpenChange} open={open} title={title}>
      {loading ? (
        <div className="drawer-state" role="status">
          <IconLoader2 aria-hidden="true" className="spin" size={20} />
          Loading job details…
        </div>
      ) : error ? (
        <div className="drawer-state is-error" role="alert">
          <IconAlertTriangleFilled aria-hidden="true" size={18} stroke={0} />
          {error}
        </div>
      ) : detail ? (
        <div className="job-drawer">
          <header className="job-drawer__header">
            <span className="job-drawer__id">{detail.job.jobId}</span>
            <StatusBadge tone={toneForCondition(detail.job.condition)}>
              {humanize(detail.job.condition)}
            </StatusBadge>
          </header>
          <div className="job-drawer__scroll">
            {issue ? (
              <section className="drawer-section">
                <h2>Current issue</h2>
                <div className="issue-card">
                  <SeverityIndicator severity={issue.severity} />
                  <strong>
                    {humanize(issue.condition)}
                    {issue.conditionReason
                      ? ` · ${humanize(issue.conditionReason)}`
                      : ""}
                  </strong>
                  <span className="issue-card__meta">
                    {formatInteger(issue.affectedUnits)} units at risk ·
                    detected {formatAge(issue.detectedAt, asOf)} ago
                  </span>
                  <div className="issue-card__rule" />
                  <dl className="drawer-key-values is-compact">
                    <div>
                      <dt>Recommended action</dt>
                      <dd>{issue.recommendedAction}</dd>
                    </div>
                    <div>
                      <dt>Assigned to</dt>
                      <dd>
                        <AssignmentMenu
                          assigneeName={issue.assignee?.displayName}
                          disabled={assigning}
                          onAssign={(responderId) =>
                            onAssign(issue, responderId)
                          }
                          responders={responders}
                        />
                      </dd>
                    </div>
                  </dl>
                </div>
              </section>
            ) : null}
            <section className="drawer-section">
              <h2>Order</h2>
              <dl className="drawer-key-values">
                <div>
                  <dt>Customer</dt>
                  <dd className="mono-cell">{detail.job.customerId}</dd>
                </div>
                <div>
                  <dt>Part · Material</dt>
                  <dd className="mono-cell">
                    {detail.job.partId} · {detail.job.material}
                  </dd>
                </div>
                <div>
                  <dt>Job priority</dt>
                  <dd>
                    <PriorityBadge priority={detail.job.priority} />
                  </dd>
                </div>
                <div>
                  <dt>Target</dt>
                  <dd>{formatInteger(detail.job.targetQuantity)} units</dd>
                </div>
                <div>
                  <dt>Target due</dt>
                  <dd
                    className={
                      Date.parse(detail.job.targetDueAt) < Date.parse(asOf)
                        ? "critical-cell"
                        : ""
                    }
                  >
                    {formatShortTimestamp(detail.job.targetDueAt)} UTC
                  </dd>
                </div>
                <div>
                  <dt>Machine</dt>
                  <dd className="mono-cell">
                    {detail.job.machineId ?? "Not reported"}
                  </dd>
                </div>
                <div>
                  <dt>Tool</dt>
                  <dd className="mono-cell">
                    {detail.job.toolId ?? "Not reported"}
                  </dd>
                </div>
                {detail.toolLocation ? (
                  <div>
                    <dt>Tool location</dt>
                    <dd className="mono-cell">
                      {detail.toolLocation.locationId} ·{" "}
                      {formatShortTimestamp(detail.toolLocation.reportedAt)} UTC
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt>Source operator</dt>
                  <dd className="mono-cell">
                    {detail.job.operatorId ?? "Not reported"}
                  </dd>
                </div>
              </dl>
            </section>
            <section className="drawer-section">
              <h2>Production</h2>
              {detail.job.startedAt ? (
                <dl className="drawer-key-values">
                  <div>
                    <dt>Produced / target</dt>
                    <dd>
                      {formatInteger(detail.job.producedQuantity)} /{" "}
                      {formatInteger(detail.job.targetQuantity)}
                    </dd>
                  </div>
                  <div>
                    <dt>Cycles recorded</dt>
                    <dd>{formatInteger(detail.cycleCount)}</dd>
                  </div>
                  <div>
                    <dt>Completed good / scrap</dt>
                    <dd>
                      {detail.goodUnits === null
                        ? "Not reported"
                        : `${formatInteger(detail.goodUnits)} / ${formatInteger(detail.scrapUnits ?? 0)}`}
                    </dd>
                  </div>
                  <div>
                    <dt>Inspections</dt>
                    <dd>
                      {formatInteger(detail.inspectedPassed)} passed /{" "}
                      {formatInteger(detail.inspectedFailed)} failed
                    </dd>
                  </div>
                  {detail.defectCodes.length > 0 ? (
                    <div>
                      <dt>Defect codes</dt>
                      <dd>{detail.defectCodes.map(humanize).join(", ")}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : (
                <p className="not-reported-note">
                  No production events are reported because this job has not
                  started.
                </p>
              )}
            </section>
            <section className="drawer-section">
              <h2>Current condition</h2>
              <div className="current-condition">
                {detail.job.condition === "blocked" ||
                detail.job.condition === "held" ? (
                  <IconAlertTriangleFilled
                    aria-hidden="true"
                    className="is-warning"
                    size={11}
                    stroke={0}
                  />
                ) : detail.job.condition === "past-due" ? (
                  <IconClockExclamation
                    aria-hidden="true"
                    className="is-critical"
                    size={13}
                  />
                ) : (
                  <IconCircleFilled aria-hidden="true" size={8} stroke={0} />
                )}
                <span>
                  {humanize(detail.job.condition)}
                  {detail.job.conditionReason
                    ? ` · ${humanize(detail.job.conditionReason)}`
                    : ""}
                </span>
                <time dateTime={detail.job.conditionSince}>
                  {formatShortTimestamp(detail.job.conditionSince)}
                </time>
              </div>
            </section>
            <section className="drawer-section drawer-timeline">
              <h2>Event timeline</h2>
              <ol>
                {detail.timeline.map((event, index) => (
                  <li key={event.eventId}>
                    <span aria-hidden="true" className="timeline-dot" />
                    {index < detail.timeline.length - 1 ? (
                      <span aria-hidden="true" className="timeline-line" />
                    ) : null}
                    <strong>{eventLabel(event)}</strong>
                    <time dateTime={event.occurredAt}>
                      {formatShortTimestamp(event.occurredAt)} UTC
                    </time>
                  </li>
                ))}
              </ol>
            </section>
          </div>
          <footer className="job-drawer__footer">
            <button aria-disabled="true" type="button">
              View full details
            </button>
          </footer>
        </div>
      ) : null}
    </SideDrawer>
  );
}
