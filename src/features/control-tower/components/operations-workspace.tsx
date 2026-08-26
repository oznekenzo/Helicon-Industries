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
  EmptyState,
  SegmentedControl,
  priorityOptions,
} from "@/components/ui/control-tower-primitives";
import { formatShortTimestamp } from "@/features/control-tower/format";
import type {
  ControlTowerIssue,
  ControlTowerPageData,
  OperationsViewKey,
  PriorityFilter,
} from "@/features/control-tower/types";
import { classNames } from "@/lib/class-names";

import { OperationsTable } from "./operations-table";

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
  const jobs = data.views[view].filter(
    (job) => priority === "all" || job.priority === priority,
  );
  const count = jobs.length;
  const empty = emptyCopy(view);

  return (
    <section
      aria-labelledby="operations-heading"
      className="operations-section"
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
          ) : (
            <OperationsTable
              asOf={data.asOf}
              assigningIssueKey={assigningIssueKey}
              jobs={jobs}
              onAssign={onAssign}
              onOpenJob={onOpenJob}
              responders={data.responders}
              selectedJobId={selectedJobId}
              view={view}
            />
          )}
        </div>
      </div>
    </section>
  );
}
