import { sql } from "drizzle-orm";

import { createDatabase, type HeliconDatabase } from "@db/client";

const DATABASE_READ_ATTEMPTS = 2;
const DATABASE_READ_RETRY_DELAY_MS = 75;

type RuntimeDatabase = ReturnType<typeof createDatabase>;

type RuntimeDatabaseGlobal = typeof globalThis & {
  heliconRuntimeDatabase?: RuntimeDatabase;
};

function connectionString() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is not configured.");
  return value;
}

function runtimeDatabase() {
  const runtime = globalThis as RuntimeDatabaseGlobal;

  if (!runtime.heliconRuntimeDatabase) {
    runtime.heliconRuntimeDatabase = createDatabase(connectionString());
  }

  return runtime.heliconRuntimeDatabase;
}

function postgresErrorCode(error: unknown): string | undefined {
  let current = error;
  const visited = new Set<unknown>();

  while (
    current !== null &&
    typeof current === "object" &&
    !visited.has(current)
  ) {
    visited.add(current);

    if (
      "code" in current &&
      typeof (current as { code?: unknown }).code === "string"
    ) {
      return (current as { code: string }).code;
    }

    current = "cause" in current ? current.cause : undefined;
  }

  return undefined;
}

export function isTransientDatabaseReadError(error: unknown) {
  const code = postgresErrorCode(error);

  return (
    code === "57014" ||
    code === "55P03" ||
    code === "57P01" ||
    code === "57P02" ||
    code === "57P03" ||
    code?.startsWith("08") === true
  );
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function retryTransientDatabaseRead<T>(
  operation: () => Promise<T>,
  waitForRetry: (milliseconds: number) => Promise<unknown> = wait,
) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= DATABASE_READ_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (
        attempt === DATABASE_READ_ATTEMPTS ||
        !isTransientDatabaseReadError(error)
      ) {
        throw error;
      }

      await waitForRetry(DATABASE_READ_RETRY_DELAY_MS);
    }
  }

  throw lastError;
}

export async function runDatabaseRead<T>(
  operation: (db: HeliconDatabase) => Promise<T>,
): Promise<T> {
  return retryTransientDatabaseRead(async () => {
    const { db } = runtimeDatabase();

    return db.transaction(async (transaction) => {
      await transaction.execute(sql`set local statement_timeout = '8s'`);
      await transaction.execute(sql`set local lock_timeout = '2s'`);

      return operation(transaction as unknown as HeliconDatabase);
    });
  });
}

export function getRuntimeDatabase() {
  return runtimeDatabase().db;
}
