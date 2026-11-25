"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { jobFormSchema } from "@/lib/validators/jobs";
import {
  firstIssueMessage,
  toFieldErrors,
  type ActionResult,
} from "./result";

function revalidateJobPaths(jobId?: string): void {
  revalidatePath("/jobs");
  if (jobId) revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/sites");
  // Customer detail pages list their jobs.
  revalidatePath("/customers");
  // The expense form's job/site dropdowns are built from active records.
  revalidatePath("/expenses/new");
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function isMissingRecord(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
}

/**
 * Jobs may only be linked to an existing, active customer. A deactivated
 * customer keeps its existing job links but cannot be selected again.
 */
async function resolveCustomerId(
  customerId: string | null | undefined,
): Promise<{ ok: true; customerId: string | null } | { ok: false }> {
  const id = typeof customerId === "string" ? customerId.trim() : "";
  if (!id) return { ok: true, customerId: null };

  const customer = await prisma.customer.findUnique({
    where: { id },
    select: { id: true, isActive: true },
  });
  if (!customer || !customer.isActive) return { ok: false };

  return { ok: true, customerId: customer.id };
}

function customerFieldError(): ActionResult {
  return {
    ok: false,
    error: "Customer not found or inactive.",
    fieldErrors: { customerId: ["Customer not found or inactive."] },
  };
}

function duplicateCodeError(code: string): ActionResult {
  return {
    ok: false,
    error: `Job code ${code} is already in use.`,
    fieldErrors: { code: ["This job code is already in use."] },
  };
}

/** Creates a job. Codes are stored uppercase, so the uniqueness check is exact. */
export async function createJobAction(input: unknown): Promise<ActionResult> {
  await requireAuth();

  const parsed = jobFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: firstIssueMessage(
        parsed.error,
        "Please fix the highlighted fields.",
      ),
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const data = parsed.data;

  const existing = await prisma.job.findUnique({
    where: { code: data.code },
    select: { id: true },
  });
  if (existing) return duplicateCodeError(data.code);

  const customer = await resolveCustomerId(data.customerId);
  if (!customer.ok) return customerFieldError();

  try {
    await prisma.job.create({
      data: {
        code: data.code,
        name: data.name,
        customerId: customer.customerId,
        isActive: data.isActive,
      },
    });
  } catch (error) {
    // P2002 is the fallback guard for a concurrent create.
    if (isUniqueViolation(error)) return duplicateCodeError(data.code);
    throw error;
  }

  revalidateJobPaths();
  return { ok: true, message: `Job ${data.code} created.` };
}

/** Updates a job, excluding its own id from the code uniqueness check. */
export async function updateJobAction(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  await requireAuth();

  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "Missing job id." };
  }

  const parsed = jobFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: firstIssueMessage(
        parsed.error,
        "Please fix the highlighted fields.",
      ),
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const data = parsed.data;

  const job = await prisma.job.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!job) return { ok: false, error: "Job not found." };

  const conflict = await prisma.job.findFirst({
    where: { code: data.code, NOT: { id } },
    select: { id: true },
  });
  if (conflict) return duplicateCodeError(data.code);

  const customer = await resolveCustomerId(data.customerId);
  if (!customer.ok) return customerFieldError();

  try {
    await prisma.job.update({
      where: { id },
      data: {
        code: data.code,
        name: data.name,
        customerId: customer.customerId,
        isActive: data.isActive,
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) return duplicateCodeError(data.code);
    if (isMissingRecord(error)) {
      return { ok: false, error: "Job not found." };
    }
    throw error;
  }

  revalidateJobPaths(id);
  return { ok: true, message: `Job ${data.code} updated.` };
}

/**
 * Deactivates a job (never deletes). Journal lines are counted first and
 * returned so the UI can confirm that historical data is preserved.
 * Its sites are intentionally left untouched.
 */
export async function deactivateJobAction(id: string): Promise<ActionResult> {
  await requireAuth();

  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "Missing job id." };
  }

  const job = await prisma.job.findUnique({
    where: { id },
    select: { id: true, code: true, isActive: true },
  });
  if (!job) return { ok: false, error: "Job not found." };

  const journalLineCount = await prisma.journalLine.count({
    where: { jobId: id },
  });

  await prisma.job.update({ where: { id }, data: { isActive: false } });

  revalidateJobPaths(id);

  return {
    ok: true,
    message:
      journalLineCount > 0
        ? `Job ${job.code} deactivated. ${journalLineCount} journal line${journalLineCount === 1 ? "" : "s"} preserved.`
        : `Job ${job.code} deactivated.`,
    journalLineCount,
  };
}

/** Reactivates a job so it appears in new-entry dropdowns again. */
export async function reactivateJobAction(id: string): Promise<ActionResult> {
  await requireAuth();

  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "Missing job id." };
  }

  const job = await prisma.job.findUnique({
    where: { id },
    select: { id: true, code: true },
  });
  if (!job) return { ok: false, error: "Job not found." };

  await prisma.job.update({ where: { id }, data: { isActive: true } });

  revalidateJobPaths(id);
  return { ok: true, message: `Job ${job.code} reactivated.` };
}
