import { timingSafeEqual } from "node:crypto";

type BasicAuthCredentials = {
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

  return (
    provided !== null &&
    safeEqual(provided.username, expected.username) &&
    safeEqual(provided.password, expected.password)
  );
}
