import { describe, expect, it } from "vitest";

import {
  isTransientDatabaseReadError,
  retryTransientDatabaseRead,
} from "./runtime-database";

describe("isTransientDatabaseReadError", () => {
  it.each(["57014", "55P03", "57P01", "57P02", "57P03", "08006"])(
    "recognizes retryable PostgreSQL code %s",
    (code) => {
      expect(isTransientDatabaseReadError({ code })).toBe(true);
    },
  );

  it("finds a PostgreSQL code wrapped by Drizzle", () => {
    expect(
      isTransientDatabaseReadError(
        new Error("Failed query", { cause: { code: "57014" } }),
      ),
    ).toBe(true);
  });

  it("does not retry programming and integrity errors", () => {
    expect(isTransientDatabaseReadError({ code: "23505" })).toBe(false);
    expect(isTransientDatabaseReadError(new Error("Invalid query"))).toBe(
      false,
    );
  });
});

describe("retryTransientDatabaseRead", () => {
  it("retries one transient failure", async () => {
    let attempts = 0;
    const delays: number[] = [];

    const result = await retryTransientDatabaseRead(
      () => {
        attempts += 1;
        if (attempts === 1) return Promise.reject({ code: "57014" });
        return Promise.resolve("dashboard data");
      },
      (milliseconds) => {
        delays.push(milliseconds);
        return Promise.resolve();
      },
    );

    expect(result).toBe("dashboard data");
    expect(attempts).toBe(2);
    expect(delays).toEqual([75]);
  });

  it("does not retry a non-transient failure", async () => {
    let attempts = 0;

    await expect(
      retryTransientDatabaseRead(
        () => {
          attempts += 1;
          return Promise.reject({ code: "23505" });
        },
        () => Promise.resolve(),
      ),
    ).rejects.toEqual({ code: "23505" });

    expect(attempts).toBe(1);
  });
});
