"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { siteFormSchema } from "@/lib/validators/sites";
import {
  firstIssueMessage,
  toFieldErrors,
  type ActionResult,
} from "./result";

function revalidateSitePaths(jobId?: string): void {
  revalidatePath("/jobs");
  if (jobId) revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/sites");
  // The expense form's site dropdown is built from active sites.
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

const DUPLICATE_CODE_MESSAGE =
  "A site with this code already exists under this job.";

function duplicateCodeError(): ActionResult {
  return {
    ok: false,
    error: DUPLICATE_CODE_MESSAGE,
    fieldErrors: { code: [DUPLICATE_CODE_MESSAGE] },
  };
}

/**
 * Creates a site under a job. The job must exist and be active. Codes are
 * unique per job (never globally) and stored uppercase.
 */
export async function createSiteAction(
  jobId: string,
  input: unknown,
): Promise<ActionResult> {
  await requireAuth();

  if (typeof jobId !== "string" || jobId.length === 0) {
    return { ok: false, error: "Missing job id." };
  }

  const parsed = siteFormSchema.safeParse(input);
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
    where: { id: jobId },
    select: { id: true, isActive: true },
  });
  if (!job) return { ok: false, error: "Job not found." };
  if (!job.isActive) {
    return {
      ok: false,
      error: "Sites can only be added to an active job.",
    };
  }

  const existing = await prisma.site.findFirst({
    where: { jobId, code: data.code },
    select: { id: true },
  });
  if (existing) return duplicateCodeError();

  try {
    await prisma.site.create({
      data: { jobId, code: data.code, name: data.name },
    });
  } catch (error) {
    // P2002 on @@unique([jobId, code]) is the concurrent-create fallback.
    if (isUniqueViolation(error)) return duplicateCodeError();
    throw error;
  }

  revalidateSitePaths(jobId);
  return { ok: true, message: `Site ${data.code} created.` };
}

/**
 * Updates a site's code and name. A site's jobId is immutable after creation:
 * jobId is not in the schema and is ignored even if supplied.
 */
export async function updateSiteAction(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  await requireAuth();

  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "Missing site id." };
  }

  const parsed = siteFormSchema.safeParse(input);
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

  const site = await prisma.site.findUnique({
    where: { id },
    select: { id: true, jobId: true },
  });
  if (!site) return { ok: false, error: "Site not found." };

  const conflict = await prisma.site.findFirst({
    where: { jobId: site.jobId, code: data.code, NOT: { id } },
    select: { id: true },
  });
  if (conflict) return duplicateCodeError();

  try {
    await prisma.site.update({
      where: { id },
      data: { code: data.code, name: data.name },
    });
  } catch (error) {
    if (isUniqueViolation(error)) return duplicateCodeError();
    if (isMissingRecord(error)) {
      return { ok: false, error: "Site not found." };
    }
    throw error;
  }

  revalidateSitePaths(site.jobId);
  return { ok: true, message: `Site ${data.code} updated.` };
}

/**
 * Deactivates a site (never deletes). Journal lines that reference it are
 * untouched; the site just disappears from new-entry dropdowns.
 */
export async function deactivateSiteAction(id: string): Promise<ActionResult> {
  await requireAuth();

  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "Missing site id." };
  }

  const site = await prisma.site.findUnique({
    where: { id },
    select: { id: true, code: true, jobId: true },
  });
  if (!site) return { ok: false, error: "Site not found." };

  await prisma.site.update({ where: { id }, data: { isActive: false } });

  revalidateSitePaths(site.jobId);
  return { ok: true, message: `Site ${site.code} deactivated.` };
}

/** Reactivates a site so it appears in new-entry dropdowns again. */
export async function reactivateSiteAction(id: string): Promise<ActionResult> {
  await requireAuth();

  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "Missing site id." };
  }

  const site = await prisma.site.findUnique({
    where: { id },
    select: { id: true, code: true, jobId: true },
  });
  if (!site) return { ok: false, error: "Site not found." };

  await prisma.site.update({ where: { id }, data: { isActive: true } });

  revalidateSitePaths(site.jobId);
  return { ok: true, message: `Site ${site.code} reactivated.` };
}
