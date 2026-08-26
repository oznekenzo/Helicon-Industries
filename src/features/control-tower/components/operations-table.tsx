"use client";

import {
  IconAlertTriangleFilled,
  IconClock,
  IconClockExclamation,
  IconPlayerPlay,
} from "@tabler/icons-react";
import type { ReactNode } from "react";

import {
  AssignmentMenu,
  PriorityBadge,
  SeverityIndicator,
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
  OperationsViewKey,
  Responder,
} from "@/features/control-tower/types";

type ColumnKey =
  | "priority"
  | "job"
  | "condition"
  | "target-due"
  | "progress"
  | "customer"
  | "part-material"
  | "asset"
  | "operator"
  | "recommended-action"
  | "assignment";

type ColumnContext = {
  asOf: string;
  responders: Responder[];
  assigningIssueKey: string | null;
  onAssign: (issue: ControlTowerIssue, responderId: string) => void;
};

type ColumnDefinition = {
  label: string;
  width: number;
  className?: string;
  render: (job: ControlTowerJob, context: ColumnContext) => ReactNode;
};

const STANDARD_COLUMNS: ColumnKey[] = [
  "priority",
  "job",
  "condition",
  "target-due",
  "progress",
  "customer",
  "part-material",
  "asset",
  "operator",
  "assignment",
];

const NEEDS_ASSIGNMENT_COLUMNS: ColumnKey[] = [
  ...STANDARD_COLUMNS.slice(0, -1),
  "recommended-action",
  "assignment",
];

const TABLE_CAPTIONS: Record<OperationsViewKey, string> = {
  "needs-assignment": "Jobs with operational issues that need assignment",
  "not-started": "Not started jobs",
  "active-wip": "Active work in progress",
  "due-next-24h": "Jobs due in the next 24 hours",
  "blocked-held": "Blocked or held jobs",
  "past-due-wip": "Past due work in progress",
};

function ConditionCell({ job, asOf }: { job: ControlTowerJob; asOf: string }) {
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
    <span className="operations-condition">
      {job.currentIssue ? (
        <SeverityIndicator severity={job.currentIssue.severity} />
      ) : null}
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
        {job.currentIssue ? (
          <span className="condition-cell__reason">
            · {formatAge(job.currentIssue.detectedAt, asOf)} old
          </span>
        ) : null}
      </span>
    </span>
  );
}

function TargetDueCell({
  targetDueAt,
  asOf,
}: {
  targetDueAt: string;
  asOf: string;
}) {
  const overdue = Date.parse(targetDueAt) < Date.parse(asOf);

  return (
    <span className="operations-cell-value">
      <span>{formatShortTimestamp(targetDueAt)}</span>
      {overdue ? (
        <span className="operations-cell-detail critical-cell">
          {formatAge(targetDueAt, asOf)} overdue
        </span>
      ) : null}
    </span>
  );
}

function ProgressCell({ job }: { job: ControlTowerJob }) {
  return (
    <span className="operations-cell-value">
      <span>
        {formatInteger(job.producedQuantity)} /{" "}
        {formatInteger(job.targetQuantity)}
      </span>
      <span className="operations-cell-detail">
        {formatInteger(job.remainingQuantity)} remaining
      </span>
    </span>
  );
}

function AssignmentCell({
  job,
  responders,
  assigningIssueKey,
  onAssign,
}: {
  job: ControlTowerJob;
} & Pick<ColumnContext, "responders" | "assigningIssueKey" | "onAssign">) {
  const issue = job.currentIssue;

  if (!issue) return <span className="muted-cell">—</span>;

  return (
    <AssignmentMenu
      assigneeName={issue.assignee?.displayName}
      disabled={assigningIssueKey === issue.issueKey}
      onAssign={(responderId) => onAssign(issue, responderId)}
      responders={responders}
    />
  );
}

const COLUMN_DEFINITIONS: Record<ColumnKey, ColumnDefinition> = {
  priority: {
    label: "Priority",
    width: 104,
    render: (job) => <PriorityBadge priority={job.priority} />,
  },
  job: {
    label: "Job",
    width: 112,
    className: "mono-cell",
    render: (job) => job.jobId,
  },
  condition: {
    label: "Condition",
    width: 260,
    render: (job, { asOf }) => <ConditionCell asOf={asOf} job={job} />,
  },
  "target-due": {
    label: "Target due",
    width: 180,
    render: (job, { asOf }) => (
      <TargetDueCell asOf={asOf} targetDueAt={job.targetDueAt} />
    ),
  },
  progress: {
    label: "Progress",
    width: 150,
    render: (job) => <ProgressCell job={job} />,
  },
  customer: {
    label: "Customer",
    width: 136,
    className: "mono-cell muted-cell",
    render: (job) => job.customerId,
  },
  "part-material": {
    label: "Part · Material",
    width: 220,
    className: "mono-cell muted-cell",
    render: (job) => `${job.partId} · ${job.material}`,
  },
  asset: {
    label: "Asset",
    width: 144,
    className: "mono-cell muted-cell",
    render: (job) => job.machineId ?? job.toolId ?? "Not reported",
  },
  operator: {
    label: "Operator",
    width: 144,
    className: "mono-cell muted-cell",
    render: (job) => job.operatorId ?? "Not reported",
  },
  "recommended-action": {
    label: "Recommended action",
    width: 240,
    className: "truncate-cell",
    render: (job) => job.currentIssue?.recommendedAction ?? "—",
  },
  assignment: {
    label: "Assignment",
    width: 168,
    render: (job, context) => <AssignmentCell job={job} {...context} />,
  },
};

export function OperationsTable({
  view,
  jobs,
  asOf,
  responders,
  selectedJobId,
  assigningIssueKey,
  onOpenJob,
  onAssign,
}: {
  view: OperationsViewKey;
  jobs: ControlTowerJob[];
  asOf: string;
  responders: Responder[];
  selectedJobId: string | null;
  assigningIssueKey: string | null;
  onOpenJob: (jobId: string) => void;
  onAssign: (issue: ControlTowerIssue, responderId: string) => void;
}) {
  const columnKeys =
    view === "needs-assignment" ? NEEDS_ASSIGNMENT_COLUMNS : STANDARD_COLUMNS;
  const columns = columnKeys.map((key) => ({
    key,
    ...COLUMN_DEFINITIONS[key],
  }));
  const minWidth = columns.reduce((total, column) => total + column.width, 0);
  const context: ColumnContext = {
    asOf,
    responders,
    assigningIssueKey,
    onAssign,
  };

  return (
    <table className="operations-table" style={{ minWidth }}>
      <caption className="sr-only">{TABLE_CAPTIONS[view]}</caption>
      <colgroup>
        {columns.map((column) => (
          <col
            data-column={column.key}
            key={column.key}
            style={{ width: column.width }}
          />
        ))}
      </colgroup>
      <thead>
        <tr>
          {columns.map((column) => (
            <th data-column={column.key} key={column.key} scope="col">
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {jobs.map((job) => (
          <tr
            aria-selected={selectedJobId === job.jobId}
            key={job.jobId}
            onClick={() => onOpenJob(job.jobId)}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpenJob(job.jobId);
              }
            }}
            tabIndex={0}
          >
            {columns.map((column) => (
              <td
                className={column.className}
                data-column={column.key}
                key={column.key}
              >
                {column.render(job, context)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
