import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { proxy } from "./proxy";

function request(authorization?: string): NextRequest {
  return new NextRequest("https://helicon-industries.example/", {
    headers: authorization ? { authorization } : undefined,
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

    const response = proxy(request());

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

    const response = proxy(request(authorization));

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe(
      'Basic realm="Helicon Industries", charset="UTF-8"',
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("allows valid credentials", () => {
    vi.stubEnv("BASIC_AUTH_USERNAME", "helicon");
    vi.stubEnv("BASIC_AUTH_PASSWORD", "secret");

    const response = proxy(request(basicAuthorization("helicon", "secret")));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("allows a password containing separators", () => {
    vi.stubEnv("BASIC_AUTH_USERNAME", "helicon");
    vi.stubEnv("BASIC_AUTH_PASSWORD", "part:part:part");

    const response = proxy(
      request(basicAuthorization("helicon", "part:part:part")),
    );

    expect(response.status).toBe(200);
  });
});
