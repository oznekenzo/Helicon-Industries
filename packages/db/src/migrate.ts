import { resolve } from "node:path";

import "dotenv/config";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { createDatabase } from "./client";

async function main() {
  const connectionString =
    process.env.MIGRATION_DATABASE_URL ?? process.env.DIRECT_DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DIRECT_DATABASE_URL or MIGRATION_DATABASE_URL is required for migrations.",
    );
  }

  const { client, db } = createDatabase(connectionString);

  try {
    await migrate(db, {
      migrationsFolder: resolve(
        process.cwd(),
        "packages/db/drizzle/migrations",
      ),
    });
  } finally {
    await client.end();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  process.stderr.write(`Database migration failed: ${message}\n`);
  process.exitCode = 1;
});
