// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  ControlTowerIssue,
  ControlTowerJob,
  OperationsViewKey,
} from "@/features/control-tower/types";

import { OperationsTable } from "./operations-table";

const AS_OF = "2026-08-13T23:06:00.000Z";

const issue: ControlTowerIssue = {
  issueKey: "blocked:job_0001:event_blocked",
  jobId: "job_0001",
  severity: "critical",
  condition: "blocked",
  conditionReason: "missing_tool",
  detectedAt: "2026-08-13T18:00:00.000Z",
  affectedUnits: 80,
  recommendedAction: "Locate and stage tool_01",
};

const job: ControlTowerJob = {
  jobId: "job_0001",
  priority: "high",
  condition: "blocked",
  conditionReason: "missing_tool",
  conditionSince: "2026-08-13T18:00:00.000Z",
  createdAt: "2026-08-12T08:00:00.000Z",
  startedAt: "2026-08-12T10:00:00.000Z",
  customerId: "cust_alpha",
  partId: "part_1001",
  material: "carbon_epoxy",
  targetQuantity: 100,
  producedQuantity: 20,
  remainingQuantity: 80,
  targetDueAt: "2026-08-13T22:00:00.000Z",
  machineId: "press_01",
  toolId: "tool_01",
  operatorId: "operator_01",
  currentIssue: issue,
};

const responders = [
  { id: "tech_01", displayName: "Maya Chen", role: "Maintenance tech" },
];

const STANDARD_HEADERS = [
  "Priority",
  "Job",
  "Condition",
  "Target due",
  "Progress",
  "Customer",
  "Part · Material",
  "Asset",
  "Operator",
  "Assignment",
];

function renderTable(
  view: OperationsViewKey,
  row: ControlTowerJob = job,
  options: {
    selectedJobId?: string | null;
    onOpenJob?: (jobId: string) => void;
    onAssign?: (issue: ControlTowerIssue, responderId: string) => void;
  } = {},
) {
  const onOpenJob = options.onOpenJob ?? vi.fn();
  const onAssign = options.onAssign ?? vi.fn();

  render(
    <OperationsTable
      asOf={AS_OF}
      assigningIssueKey={null}
      jobs={[row]}
      onAssign={onAssign}
      onOpenJob={onOpenJob}
      responders={responders}
      selectedJobId={options.selectedJobId ?? null}
      view={view}
    />,
  );

  return { onAssign, onOpenJob };
}

afterEach(cleanup);

describe("OperationsTable", () => {
  it.each<OperationsViewKey>([
    "not-started",
    "active-wip",
    "due-next-24h",
    "blocked-held",
    "past-due-wip",
  ])("uses the standard column order for %s", (view) => {
    renderTable(view);

    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual(STANDARD_HEADERS);
  });

  it("adds only Recommended action before Assignment for Needs assignment", () => {
    renderTable("needs-assignment");

    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual([
      ...STANDARD_HEADERS.slice(0, -1),
      "Recommended action",
      "Assignment",
    ]);
  });

  it("renders issue context through the shared job cells", () => {
    renderTable("needs-assignment");
    const row = screen.getByRole("row", { name: /job_0001/i });

    expect(within(row).getByText("Critical")).toBeTruthy();
    expect(within(row).getByText("Blocked")).toBeTruthy();
    expect(within(row).getByText("· Missing Tool")).toBeTruthy();
    expect(within(row).getByText("· 5h 6m old")).toBeTruthy();
    expect(within(row).getByText("13 Aug 22:00")).toBeTruthy();
    expect(within(row).getByText("1h 6m overdue")).toBeTruthy();
    expect(within(row).getByText("20 / 100")).toBeTruthy();
    expect(within(row).getByText("80 remaining")).toBeTruthy();
    expect(within(row).getByText("press_01")).toBeTruthy();
    expect(within(row).getByText("Locate and stage tool_01")).toBeTruthy();
  });

  it("falls back from Machine to Tool and preserves missing source facts", () => {
    renderTable("not-started", {
      ...job,
      condition: "not-started",
      conditionReason: undefined,
      machineId: undefined,
      operatorId: undefined,
      currentIssue: undefined,
    });

    expect(screen.getByText("tool_01")).toBeTruthy();
    expect(screen.getByText("Not reported")).toBeTruthy();
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("opens rows with pointer and keyboard input and exposes selection", async () => {
    const user = userEvent.setup();
    const onOpenJob = vi.fn();
    renderTable("active-wip", job, {
      onOpenJob,
      selectedJobId: job.jobId,
    });
    const row = screen.getByRole("row", { name: /job_0001/i });

    expect(row.getAttribute("aria-selected")).toBe("true");
    await user.click(within(row).getByText(job.jobId));
    fireEvent.keyDown(row, { key: "Enter" });
    fireEvent.keyDown(row, { key: " " });

    expect(onOpenJob).toHaveBeenCalledTimes(3);
    expect(onOpenJob).toHaveBeenCalledWith(job.jobId);
  });

  it("assigns the row's current issue without opening the job", async () => {
    const user = userEvent.setup();
    const onAssign = vi.fn();
    const onOpenJob = vi.fn();
    renderTable("needs-assignment", job, { onAssign, onOpenJob });

    await user.click(screen.getByRole("button", { name: "Assign" }));
    await user.click(await screen.findByText("Maya Chen"));

    expect(onAssign).toHaveBeenCalledWith(issue, "tech_01");
    expect(onOpenJob).not.toHaveBeenCalled();
  });
});
