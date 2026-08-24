// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/actions", () => ({
  signIn: vi.fn(),
}));

import HomePage from "./page";

afterEach(cleanup);

describe("credential landing page", () => {
  it("renders an accessible username and password form", async () => {
    render(await HomePage({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByRole("heading", { name: "Helicon Control Tower" }),
    ).toBeTruthy();
    expect(screen.getByLabelText("Username")).toHaveProperty("type", "text");
    expect(screen.getByLabelText("Password")).toHaveProperty(
      "type",
      "password",
    );
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(
      screen.getByRole("checkbox", {
        name: "Keep me signed in on this station",
      }),
    ).toHaveProperty("checked", true);
  });

  it("reveals and hides the password", async () => {
    const user = userEvent.setup();
    render(await HomePage({ searchParams: Promise.resolve({}) }));
    const password = screen.getByLabelText("Password");

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveProperty("type", "text");

    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password).toHaveProperty("type", "password");
  });

  it("announces invalid credentials without disclosing which field failed", async () => {
    render(
      await HomePage({
        searchParams: Promise.resolve({ error: "invalid" }),
      }),
    );

    expect(screen.getByRole("alert").textContent).toBe(
      "Username or password not recognised. Check the station you signed in from.",
    );
  });
});
