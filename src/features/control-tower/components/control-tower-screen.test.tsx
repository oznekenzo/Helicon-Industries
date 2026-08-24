// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ControlTowerPageData,
  JobDetail,
} from "@/features/control-tower/types";

const actionMocks = vi.hoisted(() => ({
  assign: vi.fn(),
  loadDetail: vi.fn(),
}));

vi.mock("@/features/control-tower/actions", () => ({
  assignIssueAction: actionMocks.assign,
  loadJobDetailAction: actionMocks.loadDetail,
}));

import { ControlTowerScreen } from "./control-tower-screen";

const job = {
  jobId: "job_0001",
  priority: "high" as const,
  condition: "blocked" as const,
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
};

const issue = {
  issueKey: "blocked:job_0001:event_blocked",
  jobId: job.jobId,
  severity: "critical" as const,
  condition: "blocked" as const,
  conditionReason: "missing_tool",
  detectedAt: job.conditionSince,
  affectedUnits: 80,
  recommendedAction: "Locate and stage tool_01",
  jobPriority: "high" as const,
};

const pageData: ControlTowerPageData = {
  facility: "la_01",
  asOf: "2026-08-13T23:06:00.000Z",
  performance: {
    "7d": {
      key: "7d",
      label: "TRAILING 7 DAYS",
      onTimeCompletion: {
        value: 0.7,
        priorValue: 0.8,
        delta: -10,
        deltaUnit: "percentage-points",
        numerator: 7,
        denominator: 10,
      },
      goodUnitsProduced: {
        value: 700,
        priorValue: 800,
        delta: -12.5,
        deltaUnit: "percent",
        dailyValues: [100, 100, 100, 100, 100, 100, 100],
      },
      productionYield: {
        value: 0.9,
        priorValue: 0.91,
        delta: -1,
        deltaUnit: "percentage-points",
        goodUnits: 700,
        scrapUnits: 78,
      },
    },
    "14d": {
      key: "14d",
      label: "TRAILING 14 DAYS",
      onTimeCompletion: {
        value: 0.75,
        priorValue: 0.7,
        delta: 5,
        deltaUnit: "percentage-points",
        numerator: 15,
        denominator: 20,
      },
      goodUnitsProduced: {
        value: 1500,
        priorValue: 1400,
        delta: 7.1,
        deltaUnit: "percent",
        dailyValues: Array(14).fill(100),
      },
      productionYield: {
        value: 0.92,
        priorValue: 0.9,
        delta: 2,
        deltaUnit: "percentage-points",
        goodUnits: 1500,
        scrapUnits: 130,
      },
    },
    all: {
      key: "all",
      label: "ALL RECORDED HISTORY",
      onTimeCompletion: {
        value: null,
        priorValue: null,
        delta: null,
        deltaUnit: "percentage-points",
      },
      goodUnitsProduced: {
        value: null,
        priorValue: null,
        delta: null,
        deltaUnit: "percent",
        dailyValues: [],
      },
      productionYield: {
        value: null,
        priorValue: null,
        delta: null,
        deltaUnit: "percentage-points",
      },
    },
  },
  counts: {
    "needs-assignment": 1,
    "not-started": 0,
    "active-wip": 1,
    "due-next-24h": 0,
    "blocked-held": 1,
    "past-due-wip": 1,
  },
  views: {
    "needs-assignment": [issue],
    "not-started": [],
    "active-wip": [{ ...job, currentIssue: issue }],
    "due-next-24h": [],
    "blocked-held": [{ ...job, currentIssue: issue }],
    "past-due-wip": [{ ...job, currentIssue: issue }],
  },
  currentIssues: [issue],
  responders: [
    { id: "tech_01", displayName: "Maya Chen", role: "Maintenance tech" },
  ],
  importQuality: null,
};

const detail: JobDetail = {
  job,
  goodUnits: null,
  scrapUnits: null,
  cycleCount: 2,
  inspectedPassed: 0,
  inspectedFailed: 0,
  defectCodes: [],
  timeline: [
    {
      eventId: "event_created",
      eventType: "job_created",
      occurredAt: job.createdAt,
      quantity: 0,
    },
  ],
};

describe("ControlTowerScreen", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    actionMocks.loadDetail.mockResolvedValue(detail);
    actionMocks.assign.mockResolvedValue({
      ok: true,
      issueKey: issue.issueKey,
      assignment: {
        responderId: "tech_01",
        displayName: "Maya Chen",
        role: "Maintenance tech",
        assignedAt: "2026-08-13T23:07:00.000Z",
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("selects every focused view, keeps the URL addressable, and renders empty states", async () => {
    const user = userEvent.setup();
    render(<ControlTowerScreen initialData={pageData} />);

    expect(
      screen
        .getByRole("tab", { name: /Needs assignment/ })
        .getAttribute("aria-selected"),
    ).toBe("true");

    for (const name of [
      /Not started/,
      /Active WIP/,
      /Due next 24h/,
      /Blocked \/ Held/,
      /Past due WIP/,
    ]) {
      await user.click(screen.getByRole("tab", { name }));
      expect(
        screen.getByRole("tab", { name }).getAttribute("aria-selected"),
      ).toBe("true");
    }

    await user.click(screen.getByRole("tab", { name: /Due next 24h/ }));
    expect(screen.getByText("No jobs due in the next 24 hours")).toBeTruthy();
    expect(window.location.hash).toBe("#due-next-24h");
  });

  it("changes KPI windows and priority refinement", async () => {
    const user = userEvent.setup();
    render(<ControlTowerScreen initialData={pageData} />);

    await user.click(screen.getByRole("button", { name: "7D" }));
    expect(screen.getByText("70.0%")).toBeTruthy();
    const performanceGroup = screen.getByRole("group", {
      name: "Performance window",
    });
    await user.click(
      within(performanceGroup).getByRole("button", { name: "All" }),
    );
    expect(screen.getByText("ALL RECORDED HISTORY")).toBeTruthy();

    const priorityGroup = screen.getByRole("group", {
      name: "Filter by job priority",
    });
    await user.click(
      within(priorityGroup).getByRole("button", { name: "Low" }),
    );
    expect(screen.getByText("No issues need assignment")).toBeTruthy();
  });

  it("loads job detail on demand, preserves missing values, and closes with Escape", async () => {
    const user = userEvent.setup();
    render(<ControlTowerScreen initialData={pageData} />);

    await user.click(screen.getByText(job.jobId));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findAllByText("Not reported");
    expect(actionMocks.loadDetail).toHaveBeenCalledWith({
      facility: "la_01",
      jobId: job.jobId,
    });

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("removes a successfully assigned issue from Needs assignment", async () => {
    const user = userEvent.setup();
    render(<ControlTowerScreen initialData={pageData} />);

    await user.click(screen.getByRole("button", { name: "Assign" }));
    await user.click(await screen.findByText("Maya Chen"));

    await waitFor(() =>
      expect(screen.getByText("No issues need assignment")).toBeTruthy(),
    );
    expect(actionMocks.assign).toHaveBeenCalledWith({
      facility: "la_01",
      issueKey: issue.issueKey,
      jobId: issue.jobId,
      responderId: "tech_01",
    });
  });

  it("announces assignment failures without removing the issue", async () => {
    actionMocks.assign.mockResolvedValueOnce({
      ok: false,
      message: "The selected technician is unavailable.",
    });
    const user = userEvent.setup();
    render(<ControlTowerScreen initialData={pageData} />);

    await user.click(screen.getByRole("button", { name: "Assign" }));
    await user.click(await screen.findByText("Maya Chen"));

    expect(
      await screen.findByText(
        "Assignment failed: The selected technician is unavailable.",
      ),
    ).toBeTruthy();
    expect(screen.getByText(job.jobId)).toBeTruthy();
  });
});
