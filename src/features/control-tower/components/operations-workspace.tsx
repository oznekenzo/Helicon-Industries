"use client";

import {
  IconAlertTriangleFilled,
  IconBriefcase,
  IconClock,
  IconClockExclamation,
  IconPlayerPlay,
  IconUserQuestion,
  type Icon,
} from "@tabler/icons-react";

import {
  AssignmentMenu,
  EmptyState,
  PriorityBadge,
  SegmentedControl,
  SeverityIndicator,
  priorityOptions,
} from "@/components/ui/control-tower-primitives";
import {
  formatAge,
  formatInteger,
  formatShortTimestamp,
  humanize,
} from "@/features/control-tower/format";
import type {
  ControlTowerIssue,
  ControlTowerJob,
  ControlTowerPageData,
  OperationsViewKey,
  PriorityFilter,
} from "@/features/control-tower/types";
import { classNames } from "@/lib/class-names";

const viewDefinitions: Array<{
  key: OperationsViewKey;
  label: string;
  sublabel: string;
  tone?: "warning" | "critical";
  icon?: Icon;
}> = [
  {
    key: "needs-assignment",
    label: "Needs assignment",
    sublabel: "Unassigned jobs",
  },
  { key: "active-wip", label: "Active WIP", sublabel: "Jobs" },
  { key: "due-next-24h", label: "Due next 24h", sublabel: "Jobs" },
  {
    key: "blocked-held",
    label: "Blocked / Held",
    sublabel: "Jobs",
    tone: "warning",
    icon: IconAlertTriangleFilled,
  },
  {
    key: "past-due-wip",
    label: "Past due WIP",
    sublabel: "Jobs",
    tone: "critical",
    icon: IconClockExclamation,
  },
  { key: "not-started", label: "Not started", sublabel: "Jobs" },
];

const viewDetails: Record<
  OperationsViewKey,
  { countLabel: string; ordering: string }
> = {
  "needs-assignment": {
    countLabel: "UNASSIGNED ISSUES",
    ordering: "SEVERITY, THEN OPERATIONAL IMPACT",
  },
  "not-started": {
    countLabel: "JOBS",
    ordering: "EARLIEST DUE, THEN PRIORITY",
  },
  "active-wip": {
    countLabel: "JOBS",
    ordering: "PRIORITY, THEN EARLIEST DUE",
  },
  "due-next-24h": {
    countLabel: "JOBS",
    ordering: "EARLIEST DUE, THEN PRIORITY",
  },
  "blocked-held": {
    countLabel: "JOBS",
    ordering: "PRIORITY, THEN LONGEST CONDITION AGE",
  },
  "past-due-wip": {
    countLabel: "JOBS",
    ordering: "PRIORITY, THEN TIME OVERDUE",
  },
};

function Condition({ job, asOf }: { job: ControlTowerJob; asOf: string }) {
  const overdueNotStarted =
    job.condition === "not-started" &&
    Date.parse(job.targetDueAt) < Date.parse(asOf);
  const warning = job.condition === "blocked" || job.condition === "held";
  const critical = job.condition === "past-due" || overdueNotStarted;
  const IconComponent = warning
    ? IconAlertTriangleFilled
    : critical
      ? IconClockExclamation
      : job.condition === "not-started"
        ? IconClock
        : IconPlayerPlay;
  return (
    <span className="condition-cell">
      <IconComponent
        aria-hidden="true"
        className={critical ? "is-critical" : warning ? "is-warning" : ""}
        size={warning ? 10 : 13}
        stroke={warning ? 0 : 1.7}
      />
      <span>{overdueNotStarted ? "Past due" : humanize(job.condition)}</span>
      {overdueNotStarted ? (
        <span className="condition-cell__reason">· Not started</span>
      ) : null}
      {job.conditionReason ? (
        <span className="condition-cell__reason">
          · {humanize(job.conditionReason)}
        </span>
      ) : null}
    </span>
  );
}

function JobRow({
  children,
  jobId,
  selected,
  onOpen,
}: {
  children: React.ReactNode;
  jobId: string;
  selected: boolean;
  onOpen: (jobId: string) => void;
}) {
  return (
    <tr
      aria-selected={selected}
      onClick={() => onOpen(jobId)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(jobId);
        }
      }}
      tabIndex={0}
    >
      {children}
    </tr>
  );
}

function TableShell({
  label,
  columns,
  children,
}: {
  label: string;
  columns: string[];
  children: React.ReactNode;
}) {
  return (
    <table className="operations-table">
      <caption className="sr-only">{label}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function NeedsAssignmentTable({
  issues,
  jobs,
  data,
  selectedJobId,
  assigningIssueKey,
  onOpenJob,
  onAssign,
}: {
  issues: ControlTowerIssue[];
  jobs: ControlTowerJob[];
  data: ControlTowerPageData;
  selectedJobId: string | null;
  assigningIssueKey: string | null;
  onOpenJob: (jobId: string) => void;
  onAssign: (issue: ControlTowerIssue, responderId: string) => void;
}) {
  const jobById = new Map(jobs.map((job) => [job.jobId, job]));
  return (
    <TableShell
      columns={[
        "Severity",
        "Job priority",
        "Job",
        "Condition",
        "Operational impact",
        "Recommended action",
        "Assignment",
      ]}
      label="Needs assignment"
    >
      {issues.map((issue) => {
        const job = jobById.get(issue.jobId);
        return (
          <JobRow
            jobId={issue.jobId}
            key={issue.issueKey}
            onOpen={onOpenJob}
            selected={selectedJobId === issue.jobId}
          >
            <td>
              <SeverityIndicator severity={issue.severity} />
            </td>
            <td>
              <PriorityBadge priority={issue.jobPriority} />
            </td>
            <td className="mono-cell">{issue.jobId}</td>
            <td>
              {job ? (
                <Condition asOf={data.asOf} job={job} />
              ) : (
                <span>{humanize(issue.condition)}</span>
              )}
            </td>
            <td className="muted-cell">
              {formatInteger(issue.affectedUnits)} units at risk
            </td>
            <td className="truncate-cell" title={issue.recommendedAction}>
              {issue.recommendedAction}
            </td>
            <td>
              <AssignmentMenu
                disabled={assigningIssueKey === issue.issueKey}
                onAssign={(responderId) => onAssign(issue, responderId)}
                responders={data.responders}
              />
            </td>
          </JobRow>
        );
      })}
    </TableShell>
  );
}

function JobTable({
  view,
  jobs,
  data,
  selectedJobId,
  assigningIssueKey,
  onOpenJob,
  onAssign,
}: {
  view: Exclude<OperationsViewKey, "needs-assignment">;
  jobs: ControlTowerJob[];
  data: ControlTowerPageData;
  selectedJobId: string | null;
  assigningIssueKey: string | null;
  onOpenJob: (jobId: string) => void;
  onAssign: (issue: ControlTowerIssue, responderId: string) => void;
}) {
  if (view === "not-started") {
    return (
      <TableShell
        columns={[
          "Job priority",
          "Job",
          "Customer",
          "Part · Material",
          "Target",
          "Tool",
          "Target due",
        ]}
        label="Not started jobs"
      >
        {jobs.map((job) => (
          <JobRow
            jobId={job.jobId}
            key={job.jobId}
            onOpen={onOpenJob}
            selected={selectedJobId === job.jobId}
          >
            <td>
              <PriorityBadge priority={job.priority} />
            </td>
            <td className="mono-cell">{job.jobId}</td>
            <td className="mono-cell muted-cell">{job.customerId}</td>
            <td className="mono-cell muted-cell">
              {job.partId} · {job.material}
            </td>
            <td>{formatInteger(job.targetQuantity)} units</td>
            <td className="mono-cell muted-cell">
              {job.toolId ?? "Not reported"}
            </td>
            <td
              className={
                Date.parse(job.targetDueAt) < Date.parse(data.asOf)
                  ? "critical-cell"
                  : ""
              }
            >
              {formatShortTimestamp(job.targetDueAt)}
            </td>
          </JobRow>
        ))}
      </TableShell>
    );
  }

  if (view === "blocked-held") {
    return (
      <TableShell
        columns={[
          "Job priority",
          "Job",
          "Condition",
          "Condition age",
          "Target due",
          "Remaining / Target",
          "Asset",
          "Assignment",
        ]}
        label="Blocked or held jobs"
      >
        {jobs.map((job) => (
          <JobRow
            jobId={job.jobId}
            key={job.jobId}
            onOpen={onOpenJob}
            selected={selectedJobId === job.jobId}
          >
            <td>
              <PriorityBadge priority={job.priority} />
            </td>
            <td className="mono-cell">{job.jobId}</td>
            <td>
              <Condition asOf={data.asOf} job={job} />
            </td>
            <td>{formatAge(job.conditionSince, data.asOf)}</td>
            <td className="critical-cell">
              {formatShortTimestamp(job.targetDueAt)}
            </td>
            <td>
              {formatInteger(job.remainingQuantity)} /{" "}
              {formatInteger(job.targetQuantity)}
            </td>
            <td className="mono-cell muted-cell">
              {job.machineId ?? job.toolId ?? "Not reported"}
            </td>
            <td>
              {job.currentIssue ? (
                <AssignmentMenu
                  assigneeName={job.currentIssue.assignee?.displayName}
                  disabled={assigningIssueKey === job.currentIssue.issueKey}
                  onAssign={(responderId) =>
                    onAssign(job.currentIssue!, responderId)
                  }
                  responders={data.responders}
                />
              ) : (
                <span className="muted-cell">—</span>
              )}
            </td>
          </JobRow>
        ))}
      </TableShell>
    );
  }

  if (view === "past-due-wip") {
    return (
      <TableShell
        columns={[
          "Job priority",
          "Job",
          "Condition",
          "Overdue by",
          "Remaining / Target",
          "Customer",
          "Assignment",
        ]}
        label="Past due work in progress"
      >
        {jobs.map((job) => (
          <JobRow
            jobId={job.jobId}
            key={job.jobId}
            onOpen={onOpenJob}
            selected={selectedJobId === job.jobId}
          >
            <td>
              <PriorityBadge priority={job.priority} />
            </td>
            <td className="mono-cell">{job.jobId}</td>
            <td>
              <Condition asOf={data.asOf} job={job} />
            </td>
            <td className="critical-cell">
              {formatAge(job.targetDueAt, data.asOf)}
            </td>
            <td>
              {formatInteger(job.remainingQuantity)} /{" "}
              {formatInteger(job.targetQuantity)}
            </td>
            <td className="mono-cell muted-cell">{job.customerId}</td>
            <td>
              {job.currentIssue ? (
                <AssignmentMenu
                  assigneeName={job.currentIssue.assignee?.displayName}
                  disabled={assigningIssueKey === job.currentIssue.issueKey}
                  onAssign={(responderId) =>
                    onAssign(job.currentIssue!, responderId)
                  }
                  responders={data.responders}
                />
              ) : (
                <span className="muted-cell">—</span>
              )}
            </td>
          </JobRow>
        ))}
      </TableShell>
    );
  }

  return (
    <TableShell
      columns={[
        "Job priority",
        "Job",
        "Condition",
        "Customer",
        "Part · Material",
        "Asset",
        "Produced / Target",
        "Target due",
        "Operator",
      ]}
      label={
        view === "active-wip"
          ? "Active work in progress"
          : "Jobs due next 24 hours"
      }
    >
      {jobs.map((job) => (
        <JobRow
          jobId={job.jobId}
          key={job.jobId}
          onOpen={onOpenJob}
          selected={selectedJobId === job.jobId}
        >
          <td>
            <PriorityBadge priority={job.priority} />
          </td>
          <td className="mono-cell">{job.jobId}</td>
          <td>
            <Condition asOf={data.asOf} job={job} />
          </td>
          <td className="mono-cell muted-cell">{job.customerId}</td>
          <td className="mono-cell muted-cell">
            {job.partId} · {job.material}
          </td>
          <td className="mono-cell muted-cell">
            {job.machineId ?? job.toolId ?? "Not reported"}
          </td>
          <td>
            {formatInteger(job.producedQuantity)} /{" "}
            {formatInteger(job.targetQuantity)}
          </td>
          <td
            className={
              Date.parse(job.targetDueAt) < Date.parse(data.asOf)
                ? "critical-cell"
                : ""
            }
          >
            {formatShortTimestamp(job.targetDueAt)}
          </td>
          <td className="mono-cell muted-cell">
            {job.operatorId ?? "Not reported"}
          </td>
        </JobRow>
      ))}
    </TableShell>
  );
}

function emptyCopy(view: OperationsViewKey) {
  const values: Record<
    OperationsViewKey,
    { title: string; detail: string; icon: typeof IconClock }
  > = {
    "needs-assignment": {
      title: "No issues need assignment",
      detail: "Every current operational issue has an assignee.",
      icon: IconUserQuestion,
    },
    "not-started": {
      title: "No jobs are waiting to start",
      detail: "Every incomplete job has entered production.",
      icon: IconBriefcase,
    },
    "active-wip": {
      title: "No active work in progress",
      detail: "No started jobs remain incomplete at this snapshot.",
      icon: IconPlayerPlay,
    },
    "due-next-24h": {
      title: "No jobs due in the next 24 hours",
      detail: "The next-day production window is clear.",
      icon: IconClock,
    },
    "blocked-held": {
      title: "No blocked or held jobs",
      detail:
        "No incomplete jobs are currently stopped by a blocking condition.",
      icon: IconAlertTriangleFilled,
    },
    "past-due-wip": {
      title: "No past-due work in progress",
      detail: "Every incomplete job is still within its target window.",
      icon: IconClockExclamation,
    },
  };
  return values[view];
}

export function OperationsWorkspace({
  data,
  view,
  priority,
  selectedJobId,
  assigningIssueKey,
  onViewChange,
  onPriorityChange,
  onOpenJob,
  onAssign,
}: {
  data: ControlTowerPageData;
  view: OperationsViewKey;
  priority: PriorityFilter;
  selectedJobId: string | null;
  assigningIssueKey: string | null;
  onViewChange: (view: OperationsViewKey) => void;
  onPriorityChange: (priority: PriorityFilter) => void;
  onOpenJob: (jobId: string) => void;
  onAssign: (issue: ControlTowerIssue, responderId: string) => void;
}) {
  const allJobs = [...data.views["not-started"], ...data.views["active-wip"]];
  const issues = data.views["needs-assignment"].filter(
    (issue) => priority === "all" || issue.jobPriority === priority,
  );
  const jobs =
    view === "needs-assignment"
      ? []
      : data.views[view].filter(
          (job) => priority === "all" || job.priority === priority,
        );
  const count = view === "needs-assignment" ? issues.length : jobs.length;
  const empty = emptyCopy(view);

  return (
    <section
      className="operations-section"
      aria-labelledby="operations-heading"
    >
      <div className="section-heading-row">
        <h2 id="operations-heading">Current operations</h2>
        <span>
          AS OF {formatShortTimestamp(data.asOf).toUpperCase()} UTC · STATES MAY
          OVERLAP
        </span>
      </div>
      <div
        aria-label="Current operations"
        className="operations-tabs"
        role="tablist"
      >
        {viewDefinitions.map((definition) => {
          const TabIcon = definition.icon;
          return (
            <button
              aria-controls="operations-canvas"
              aria-selected={view === definition.key}
              className={classNames(
                "operations-tab",
                definition.tone && `is-${definition.tone}`,
              )}
              key={definition.key}
              onClick={() => onViewChange(definition.key)}
              role="tab"
              type="button"
            >
              <span className="operations-tab__label">
                {TabIcon ? <TabIcon aria-hidden="true" /> : null}
                {definition.label}
              </span>
              <strong>{data.counts[definition.key]}</strong>
              <span>{definition.sublabel}</span>
            </button>
          );
        })}
      </div>
      <div className="operations-canvas" id="operations-canvas" role="tabpanel">
        <div className="operations-canvas__header">
          <h3>{viewDefinitions.find((item) => item.key === view)?.label}</h3>
          <span>
            {count} {viewDetails[view].countLabel} ·{" "}
            {viewDetails[view].ordering}
          </span>
          <div className="operations-canvas__spacer" />
          <span className="priority-label">PRIORITY</span>
          <SegmentedControl
            compact
            label="Filter by job priority"
            onChange={onPriorityChange}
            options={priorityOptions}
            value={priority}
          />
        </div>
        <div className="operations-canvas__scroll">
          {count === 0 ? (
            <EmptyState
              detail={empty.detail}
              icon={empty.icon}
              title={empty.title}
            />
          ) : view === "needs-assignment" ? (
            <NeedsAssignmentTable
              assigningIssueKey={assigningIssueKey}
              data={data}
              issues={issues}
              jobs={allJobs}
              onAssign={onAssign}
              onOpenJob={onOpenJob}
              selectedJobId={selectedJobId}
            />
          ) : (
            <JobTable
              assigningIssueKey={assigningIssueKey}
              data={data}
              jobs={jobs}
              onAssign={onAssign}
              onOpenJob={onOpenJob}
              selectedJobId={selectedJobId}
              view={view}
            />
          )}
        </div>
      </div>
    </section>
  );
}
