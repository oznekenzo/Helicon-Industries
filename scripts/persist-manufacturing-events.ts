import { basename, resolve } from "node:path";

import "dotenv/config";

import { createDatabase } from "@db/client";

import {
  ingestManufacturingEvents,
  persistIngestion,
  readJsonLinesFromFile,
  verifyPersistedImport,
} from "@/features/manufacturing-events";

async function main() {
  const sourcePath = process.argv.at(2);
  const connectionString =
    process.env.MIGRATION_DATABASE_URL ??
    process.env.DIRECT_DATABASE_URL ??
    process.env.DATABASE_URL;

  if (!sourcePath) {
    throw new Error(
      "Usage: pnpm events:persist <path-to-manufacturing-events.jsonl>",
    );
  }

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL, DIRECT_DATABASE_URL, or MIGRATION_DATABASE_URL is required.",
    );
  }

  const absolutePath = resolve(sourcePath);
  const ingestion = await ingestManufacturingEvents(
    readJsonLinesFromFile(absolutePath),
  );
  const { client, db } = createDatabase(connectionString);

  try {
    const persisted = await persistIngestion({
      db,
      sourceName: basename(absolutePath),
      result: ingestion,
    });
    const verification = await verifyPersistedImport(db, persisted.importId);

    process.stdout.write(
      `${JSON.stringify({ persisted, verification }, null, 2)}\n`,
    );
  } finally {
    await client.end();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  process.stderr.write(`Failed to persist manufacturing events: ${message}\n`);
  process.exitCode = 1;
});
