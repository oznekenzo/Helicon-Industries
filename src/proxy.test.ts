import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { AUTH_SESSION_COOKIE, createAuthSessionToken } from "./lib/basic-auth";
import { proxy } from "./proxy";

function request({
  accept,
  authorization,
  cookie,
  path = "/dashboard",
}: {
  accept?: string;
  authorization?: string;
  cookie?: string;
  path?: string;
} = {}): NextRequest {
  return new NextRequest(`https://helicon-industries.example${path}`, {
    headers: {
      ...(accept ? { accept } : {}),
      ...(authorization ? { authorization } : {}),
      ...(cookie ? { cookie } : {}),
    },
  });
}

function basicAuthorization(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("proxy", () => {
  it("fails closed when authentication is not configured", () => {
    vi.stubEnv("BASIC_AUTH_USERNAME", "");
    vi.stubEnv("BASIC_AUTH_PASSWORD", "");

    const response = proxy(request({ path: "/" }));

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it.each([
    ["missing credentials", undefined],
    ["a malformed header", "Bearer token"],
    ["invalid base64 credentials", "Basic not-base64"],
    ["an incorrect username", basicAuthorization("other", "secret")],
    ["an incorrect password", basicAuthorization("helicon", "wrong")],
  ])("rejects %s", (_label, authorization) => {
    vi.stubEnv("BASIC_AUTH_USERNAME", "helicon");
    vi.stubEnv("BASIC_AUTH_PASSWORD", "secret");

    const response = proxy(request({ authorization }));

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe(
      'Basic realm="Helicon Industries", charset="UTF-8"',
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("allows valid credentials", () => {
    vi.stubEnv("BASIC_AUTH_USERNAME", "helicon");
    vi.stubEnv("BASIC_AUTH_PASSWORD", "secret");

    const response = proxy(
      request({ authorization: basicAuthorization("helicon", "secret") }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("allows a password containing separators", () => {
    vi.stubEnv("BASIC_AUTH_USERNAME", "helicon");
    vi.stubEnv("BASIC_AUTH_PASSWORD", "part:part:part");

    const response = proxy(
      request({
        authorization: basicAuthorization("helicon", "part:part:part"),
      }),
    );

    expect(response.status).toBe(200);
  });

  it("serves the public landing page without credentials", () => {
    vi.stubEnv("BASIC_AUTH_USERNAME", "helicon");
    vi.stubEnv("BASIC_AUTH_PASSWORD", "secret");

    const response = proxy(request({ accept: "text/html", path: "/" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("redirects unauthenticated browser navigation to the landing page", () => {
    vi.stubEnv("BASIC_AUTH_USERNAME", "helicon");
    vi.stubEnv("BASIC_AUTH_PASSWORD", "secret");

    const response = proxy(request({ accept: "text/html" }));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://helicon-industries.example/",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("allows the session cookie created by the HTML sign-in", () => {
    vi.stubEnv("BASIC_AUTH_USERNAME", "helicon");
    vi.stubEnv("BASIC_AUTH_PASSWORD", "secret");
    const token = createAuthSessionToken({
      username: "helicon",
      password: "secret",
    });

    const response = proxy(
      request({ cookie: `${AUTH_SESSION_COOKIE}=${token}` }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("redirects an authenticated browser away from the landing page", () => {
    vi.stubEnv("BASIC_AUTH_USERNAME", "helicon");
    vi.stubEnv("BASIC_AUTH_PASSWORD", "secret");
    const token = createAuthSessionToken({
      username: "helicon",
      password: "secret",
    });

    const response = proxy(
      request({
        accept: "text/html",
        cookie: `${AUTH_SESSION_COOKIE}=${token}`,
        path: "/",
      }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://helicon-industries.example/dashboard",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
