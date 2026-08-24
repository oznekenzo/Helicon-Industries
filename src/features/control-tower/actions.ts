"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import { FACILITIES } from "@/features/manufacturing-events/types";
import { createDatabase } from "@db/client";

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

function connectionString() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is not configured.");
  return value;
}

export async function loadJobDetailAction(input: unknown) {
  const parsed = detailInput.parse(input);
  const { client, db } = createDatabase(connectionString());
  try {
    return await getControlTowerJobDetail(db, parsed.facility, parsed.jobId);
  } finally {
    await client.end();
  }
}

export async function assignIssueAction(
  input: unknown,
): Promise<AssignmentResult> {
  const parsed = assignmentInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "The assignment request was invalid." };
  }

  const { client, db } = createDatabase(connectionString());
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
  } finally {
    await client.end();
  }
}
