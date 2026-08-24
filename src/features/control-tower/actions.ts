"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import { FACILITIES } from "@/features/manufacturing-events/types";
import { getRuntimeDatabase, runDatabaseRead } from "@/lib/runtime-database";

import { assignControlTowerIssue, getControlTowerJobDetail } from "./data";
import type { AssignmentResult } from "./types";

const detailInput = z.object({
  facility: z.enum(FACILITIES),
  jobId: z.string().min(1),
});

const assignmentInput = z.object({
  facility: z.enum(FACILITIES),
  issueKey: z.string().min(1),
  jobId: z.string().min(1),
  responderId: z.string().min(1),
});

export async function loadJobDetailAction(input: unknown) {
  const parsed = detailInput.parse(input);
  return runDatabaseRead((db) =>
    getControlTowerJobDetail(db, parsed.facility, parsed.jobId),
  );
}

export async function assignIssueAction(
  input: unknown,
): Promise<AssignmentResult> {
  const parsed = assignmentInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "The assignment request was invalid." };
  }

  const db = getRuntimeDatabase();
  try {
    const result = await assignControlTowerIssue(db, parsed.data);
    revalidateTag("control-tower", { expire: 0 });
    revalidatePath("/");
    return {
      ok: true,
      issueKey: result.issueKey,
      assignment: result.assignment,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Assignment failed.",
    };
  }
}
