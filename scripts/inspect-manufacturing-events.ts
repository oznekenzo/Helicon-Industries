import { resolve } from "node:path";

import {
  ingestManufacturingEvents,
  readJsonLinesFromFile,
} from "@/features/manufacturing-events";

async function main() {
  const sourcePath = process.argv.at(2);

  if (!sourcePath) {
    process.stderr.write(
      "Usage: pnpm events:inspect <path-to-manufacturing-events.jsonl>\n",
    );
    process.exitCode = 1;
    return;
  }

  const lines = readJsonLinesFromFile(resolve(sourcePath));
  const result = await ingestManufacturingEvents(lines);

  process.stdout.write(
    `${JSON.stringify(
      {
        report: result.report,
        issueSample: result.issues.slice(0, 20),
      },
      null,
      2,
    )}\n`,
  );

  if (result.report.invalidLineCount > 0) {
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  process.stderr.write(`Failed to inspect manufacturing events: ${message}\n`);
  process.exitCode = 1;
});
