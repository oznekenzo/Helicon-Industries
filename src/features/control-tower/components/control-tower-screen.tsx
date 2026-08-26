"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

import {
  assignIssueAction,
  loadJobDetailAction,
} from "@/features/control-tower/actions";
import type {
  ControlTowerIssue,
  ControlTowerPageData,
  JobDetail,
  OperationsViewKey,
  PerformanceWindowKey,
  PriorityFilter,
} from "@/features/control-tower/types";

import { AppShell } from "./app-shell";
import { JobDrawer } from "./job-drawer";
import { OperationsWorkspace } from "./operations-workspace";
import { PerformanceBand } from "./performance-band";

const defaultView: OperationsViewKey = "needs-assignment";
const validViews = new Set<OperationsViewKey>([
  "needs-assignment",
  "not-started",
  "active-wip",
  "due-next-24h",
  "blocked-held",
  "past-due-wip",
]);

function viewFromHash(): OperationsViewKey {
  if (typeof window === "undefined") return defaultView;
  const value = window.location.hash.replace(/^#/, "") as OperationsViewKey;
  return validViews.has(value) ? value : defaultView;
}

function applyAssignment(
  data: ControlTowerPageData,
  issueKey: string,
  assignment: NonNullable<ControlTowerIssue["assignee"]>,
) {
  const updateIssue = (issue: ControlTowerIssue) =>
    issue.issueKey === issueKey ? { ...issue, assignee: assignment } : issue;
  const updateJob = <T extends { currentIssue?: ControlTowerIssue }>(job: T) =>
    job.currentIssue?.issueKey === issueKey
      ? { ...job, currentIssue: updateIssue(job.currentIssue) }
      : job;

  return {
    ...data,
    counts: {
      ...data.counts,
      "needs-assignment": Math.max(0, data.counts["needs-assignment"] - 1),
    },
    currentIssues: data.currentIssues.map(updateIssue),
    views: {
      ...data.views,
      "needs-assignment": data.views["needs-assignment"].filter(
        (job) => job.currentIssue?.issueKey !== issueKey,
      ),
      "not-started": data.views["not-started"].map(updateJob),
      "active-wip": data.views["active-wip"].map(updateJob),
      "due-next-24h": data.views["due-next-24h"].map(updateJob),
      "blocked-held": data.views["blocked-held"].map(updateJob),
      "past-due-wip": data.views["past-due-wip"].map(updateJob),
    },
  };
}

export function ControlTowerScreen({
  initialData,
}: {
  initialData: ControlTowerPageData;
}) {
  const [data, setData] = useState(initialData);
  const [view, setView] = useState<OperationsViewKey>(defaultView);
  const [windowKey, setWindowKey] = useState<PerformanceWindowKey>("14d");
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [assigningIssueKey, setAssigningIssueKey] = useState<string | null>(
    null,
  );
  const [announcement, setAnnouncement] = useState("");
  const [isDetailPending, startDetailTransition] = useTransition();

  useEffect(() => {
    const syncHash = () => setView(viewFromHash());
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  const selectView = useCallback((nextView: OperationsViewKey) => {
    setView(nextView);
    setPriority("all");
    window.history.replaceState(null, "", `#${nextView}`);
  }, []);

  const openJob = useCallback(
    (jobId: string) => {
      setSelectedJobId(jobId);
      setDetail(null);
      setDetailError(null);
      startDetailTransition(async () => {
        try {
          const result = await loadJobDetailAction({
            facility: data.facility,
            jobId,
          });
          setDetail(result);
        } catch (error) {
          setDetailError(
            error instanceof Error
              ? error.message
              : "Unable to load job details.",
          );
        }
      });
    },
    [data.facility],
  );

  const assign = useCallback(
    async (issue: ControlTowerIssue, responderId: string) => {
      setAssigningIssueKey(issue.issueKey);
      setAnnouncement("");
      const result = await assignIssueAction({
        facility: data.facility,
        issueKey: issue.issueKey,
        jobId: issue.jobId,
        responderId,
      });
      setAssigningIssueKey(null);
      if (!result.ok) {
        setAnnouncement(`Assignment failed: ${result.message}`);
        return;
      }
      setData((current) =>
        applyAssignment(current, result.issueKey, result.assignment),
      );
      setAnnouncement(
        `${issue.jobId} assigned to ${result.assignment.displayName}.`,
      );
    },
    [data.facility],
  );

  const selectedIssue = useMemo(
    () =>
      selectedJobId
        ? data.currentIssues.find((issue) => issue.jobId === selectedJobId)
        : undefined,
    [data.currentIssues, selectedJobId],
  );

  return (
    <AppShell activeView={view} data={data}>
      <PerformanceBand
        onWindowChange={setWindowKey}
        selected={windowKey}
        window={data.performance[windowKey]}
      />
      <OperationsWorkspace
        assigningIssueKey={assigningIssueKey}
        data={data}
        onAssign={assign}
        onOpenJob={openJob}
        onPriorityChange={setPriority}
        onViewChange={selectView}
        priority={priority}
        selectedJobId={selectedJobId}
        view={view}
      />
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <JobDrawer
        asOf={data.asOf}
        assigning={assigningIssueKey === selectedIssue?.issueKey}
        detail={detail}
        error={detailError}
        issue={selectedIssue}
        loading={isDetailPending}
        onAssign={assign}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedJobId(null);
            setDetail(null);
            setDetailError(null);
          }
        }}
        open={selectedJobId !== null}
        responders={data.responders}
      />
    </AppShell>
  );
}
