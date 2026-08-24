import { createHash } from "node:crypto";

import type { HeliconDatabase } from "@db/client";
import {
  eventImportIssues,
  eventImports,
  manufacturingEvents,
  rawEventRecords,
} from "@db/schema";
import { count, eq, inArray } from "drizzle-orm";

import type {
  ImportIssue,
  IngestionResult,
  NormalizedManufacturingEvent,
  RawEventRecord,
} from "./types";

const WRITE_BATCH_SIZE = 500;

type PersistIngestionOptions = {
  db: HeliconDatabase;
  sourceName: string;
  result: IngestionResult;
};

export type PersistIngestionResult = {
  importId: string;
  reusedExistingImport: boolean;
  insertedEventCount: number;
  existingEventCount: number;
};

export type PersistedImportVerification = {
  importId: string;
  status: string;
  rawRecordCount: number;
  normalizedEventCount: number;
  issueCount: number;
  identicalDuplicateCount: number;
  conflictingDuplicateCount: number;
};

function sourceFingerprint(records: RawEventRecord[]): string {
  const hash = createHash("sha256");

  for (const record of records) {
    hash.update(record.rawLine);
    hash.update("\n");
  }

  return hash.digest("hex");
}

function batches<T>(items: T[]): T[][] {
  const result: T[][] = [];

  for (let index = 0; index < items.length; index += WRITE_BATCH_SIZE) {
    result.push(items.slice(index, index + WRITE_BATCH_SIZE));
  }

  return result;
}

function rawRecordRow(importId: string, record: RawEventRecord) {
  return {
    importId,
    lineNumber: record.lineNumber,
    rawLine: record.rawLine,
    rawPayload: record.rawPayload ?? null,
    eventId: record.eventId ?? null,
    payloadFingerprint: record.payloadFingerprint ?? null,
    disposition: record.disposition,
  };
}

function eventRow(importId: string, event: NormalizedManufacturingEvent) {
  return {
    eventId: event.eventId,
    occurredAt: event.occurredAt,
    eventType: event.eventType,
    jobId: event.jobId,
    partId: event.partId,
    customerId: event.customerId,
    machineId: event.machineId,
    material: event.material,
    quantity: event.quantity,
    facility: event.metadata.facility,
    priority: event.metadata.priority ?? null,
    targetDueAt: event.metadata.targetDueAt ?? null,
    targetQuantity: event.metadata.targetQuantity ?? null,
    unitPriceEstimate: event.metadata.unitPriceEstimate ?? null,
    toolId: event.metadata.toolId ?? null,
    operatorId: event.metadata.operatorId ?? null,
    cycleTimeSeconds: event.metadata.cycleTimeSeconds ?? null,
    defectCode: event.metadata.defectCode ?? null,
    inspectorId: event.metadata.inspectorId ?? null,
    reason: event.metadata.reason ?? null,
    goodQuantity: event.metadata.goodQuantity ?? null,
    scrapQuantity: event.metadata.scrapQuantity ?? null,
    lotId: event.metadata.lotId ?? null,
    signal: event.metadata.signal ?? null,
    payloadFingerprint: event.payloadFingerprint,
    sourceImportId: importId,
    sourceLine: event.sourceLine,
  };
}

function issueRow(importId: string, issue: ImportIssue) {
  return {
    importId,
    lineNumber: issue.lineNumber,
    code: issue.code,
    eventId: issue.eventId ?? null,
    message: issue.message,
    details: issue.details ?? null,
  };
}

export async function persistIngestion({
  db,
  sourceName,
  result,
}: PersistIngestionOptions): Promise<PersistIngestionResult> {
  const fingerprint = sourceFingerprint(result.rawRecords);

  return db.transaction(async (transaction) => {
    const [existingImport] = await transaction
      .select({ id: eventImports.id, status: eventImports.status })
      .from(eventImports)
      .where(eq(eventImports.sourceFingerprint, fingerprint))
      .limit(1);

    if (existingImport?.status === "completed") {
      return {
        importId: existingImport.id,
        reusedExistingImport: true,
        insertedEventCount: 0,
        existingEventCount: result.events.length,
      };
    }

    if (existingImport) {
      throw new Error("An import of this exact source is already processing.");
    }

    const [createdImport] = await transaction
      .insert(eventImports)
      .values({
        sourceName,
        sourceFingerprint: fingerprint,
      })
      .returning({ id: eventImports.id });

    if (!createdImport) {
      throw new Error("Unable to create the import.");
    }

    const importId = createdImport.id;

    for (const batch of batches(
      result.rawRecords.map((record) => rawRecordRow(importId, record)),
    )) {
      await transaction.insert(rawEventRecords).values(batch);
    }

    const persistedFingerprints = new Map<string, string>();

    for (const batch of batches(result.events)) {
      const rows = await transaction
        .select({
          eventId: manufacturingEvents.eventId,
          payloadFingerprint: manufacturingEvents.payloadFingerprint,
        })
        .from(manufacturingEvents)
        .where(
          inArray(
            manufacturingEvents.eventId,
            batch.map((event) => event.eventId),
          ),
        );

      for (const row of rows) {
        persistedFingerprints.set(row.eventId, row.payloadFingerprint);
      }
    }

    for (const event of result.events) {
      const persistedFingerprint = persistedFingerprints.get(event.eventId);

      if (
        persistedFingerprint !== undefined &&
        persistedFingerprint !== event.payloadFingerprint
      ) {
        throw new Error(
          `Database event ${event.eventId} conflicts with the accepted import payload.`,
        );
      }
    }

    const missingEvents = result.events.filter(
      (event) => !persistedFingerprints.has(event.eventId),
    );

    for (const batch of batches(
      missingEvents.map((event) => eventRow(importId, event)),
    )) {
      await transaction.insert(manufacturingEvents).values(batch);
    }

    for (const batch of batches(
      result.issues.map((issue) => issueRow(importId, issue)),
    )) {
      await transaction.insert(eventImportIssues).values(batch);
    }

    await transaction
      .update(eventImports)
      .set({
        status: "completed",
        totalLineCount: result.report.totalLineCount,
        acceptedEventCount: result.report.acceptedEventCount,
        invalidLineCount: result.report.invalidLineCount,
        identicalDuplicateCount: result.report.identicalDuplicateCount,
        conflictingDuplicateCount: result.report.conflictingDuplicateCount,
        report: result.report,
        completedAt: new Date().toISOString(),
      })
      .where(eq(eventImports.id, importId));

    return {
      importId,
      reusedExistingImport: false,
      insertedEventCount: missingEvents.length,
      existingEventCount: persistedFingerprints.size,
    };
  });
}

async function countRows(
  db: HeliconDatabase,
  table: typeof rawEventRecords | typeof eventImportIssues,
  importId: string,
): Promise<number> {
  const [result] = await db
    .select({ value: count() })
    .from(table)
    .where(eq(table.importId, importId));

  return result?.value ?? 0;
}

export async function verifyPersistedImport(
  db: HeliconDatabase,
  importId: string,
): Promise<PersistedImportVerification> {
  const [importRun] = await db
    .select({
      status: eventImports.status,
      identicalDuplicateCount: eventImports.identicalDuplicateCount,
      conflictingDuplicateCount: eventImports.conflictingDuplicateCount,
    })
    .from(eventImports)
    .where(eq(eventImports.id, importId))
    .limit(1);

  if (!importRun) {
    throw new Error("Unable to verify the import: no row returned.");
  }

  const [rawRecordCount, normalizedEventResult, issueCount] = await Promise.all(
    [
      countRows(db, rawEventRecords, importId),
      db.select({ value: count() }).from(manufacturingEvents),
      countRows(db, eventImportIssues, importId),
    ],
  );

  return {
    importId,
    status: importRun.status,
    rawRecordCount,
    normalizedEventCount: normalizedEventResult[0]?.value ?? 0,
    issueCount,
    identicalDuplicateCount: importRun.identicalDuplicateCount,
    conflictingDuplicateCount: importRun.conflictingDuplicateCount,
  };
}
