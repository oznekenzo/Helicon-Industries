import { createHmac, timingSafeEqual } from "node:crypto";

export const AUTH_SESSION_COOKIE = "helicon_auth_session";

export type BasicAuthCredentials = {
  username: string;
  password: string;
};

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function parseBasicAuthorization(
  authorization: string | null,
): BasicAuthCredentials | null {
  const match = authorization?.match(/^Basic\s+([^\s]+)$/i);

  if (!match) {
    return null;
  }

  const decoded = Buffer.from(match[1], "base64").toString("utf8");
  const separatorIndex = decoded.indexOf(":");

  if (separatorIndex < 0) {
    return null;
  }

  return {
    username: decoded.slice(0, separatorIndex),
    password: decoded.slice(separatorIndex + 1),
  };
}

export function hasValidBasicAuthorization(
  authorization: string | null,
  expected: BasicAuthCredentials,
): boolean {
  const provided = parseBasicAuthorization(authorization);

  return provided !== null && hasValidCredentials(provided, expected);
}

export function hasValidCredentials(
  provided: BasicAuthCredentials,
  expected: BasicAuthCredentials,
): boolean {
  return (
    safeEqual(provided.username, expected.username) &&
    safeEqual(provided.password, expected.password)
  );
}

export function getBasicAuthCredentials(): BasicAuthCredentials | null {
  const username = process.env.BASIC_AUTH_USERNAME;
  const password = process.env.BASIC_AUTH_PASSWORD;

  return username && password ? { username, password } : null;
}

export function createAuthSessionToken({
  username,
  password,
}: BasicAuthCredentials): string {
  return createHmac("sha256", password)
    .update(`helicon-auth-session:${username}`)
    .digest("base64url");
}

export function hasValidAuthSession(
  token: string | undefined,
  expected: BasicAuthCredentials,
): boolean {
  return (
    token !== undefined && safeEqual(token, createAuthSessionToken(expected))
  );
}
