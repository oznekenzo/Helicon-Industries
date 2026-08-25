// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import DashboardError from "./error";

afterEach(cleanup);

describe("dashboard error boundary", () => {
  it("explains the failure without exposing the underlying error", () => {
    render(
      <DashboardError
        error={Object.assign(new Error("DATABASE_URL=secret"), {
          digest: "122222686",
        })}
        reset={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Control Tower couldn’t load" }),
    ).toBeTruthy();
    expect(screen.getByText("Reference: 122222686")).toBeTruthy();
    expect(screen.queryByText(/DATABASE_URL/)).toBeNull();
  });

  it("retries the failed dashboard segment", async () => {
    const reset = vi.fn();
    const user = userEvent.setup();

    render(<DashboardError error={new Error("unavailable")} reset={reset} />);
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(reset).toHaveBeenCalledOnce();
  });
});
