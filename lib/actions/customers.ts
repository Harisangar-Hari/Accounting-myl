"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import {
  customerFormSchema,
  updateCustomerSchema,
} from "@/lib/validators/customers";
import {
  firstIssueMessage,
  toFieldErrors,
  type ActionResult,
} from "./result";

/**
 * Customers are metadata: the job list and job detail pages display them, and
 * the job form's dropdown is built from active customers only, so both job
 * paths are revalidated whenever a customer changes.
 */
function revalidateCustomerPaths(customerId?: string): void {
  revalidatePath("/customers");
  if (customerId) revalidatePath(`/customers/${customerId}`);
  revalidatePath("/jobs");
  revalidatePath("/jobs/new");
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

function duplicateCodeError(code: string): ActionResult {
  return {
    ok: false,
    error: `Customer code ${code} is already in use.`,
    fieldErrors: { code: ["This customer code is already in use."] },
  };
}

/** Empty optional text is stored as null so the database has one "unset" value. */
function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Creates a customer. Codes are stored uppercase, so uniqueness is exact. */
export async function createCustomerAction(
  input: unknown,
): Promise<ActionResult> {
  await requireAuth();

  const parsed = customerFormSchema.safeParse(input);
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

  const existing = await prisma.customer.findUnique({
    where: { code: data.code },
    select: { id: true },
  });
  if (existing) return duplicateCodeError(data.code);

  try {
    await prisma.customer.create({
      data: {
        code: data.code,
        name: data.name,
        email: blankToNull(data.email),
        phone: blankToNull(data.phone),
        address: blankToNull(data.address),
        taxId: blankToNull(data.taxId),
        notes: blankToNull(data.notes),
        isActive: data.isActive,
      },
    });
  } catch (error) {
    // P2002 is the fallback guard for a concurrent create.
    if (isUniqueViolation(error)) return duplicateCodeError(data.code);
    throw error;
  }

  revalidateCustomerPaths();
  return { ok: true, message: `Customer ${data.code} created.` };
}

/** Updates the editable fields. The code is never part of this schema. */
export async function updateCustomerAction(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  await requireAuth();

  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "Missing customer id." };
  }

  const parsed = updateCustomerSchema.safeParse(input);
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

  const customer = await prisma.customer.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!customer) return { ok: false, error: "Customer not found." };

  try {
    await prisma.customer.update({
      where: { id },
      data: {
        name: data.name,
        email: blankToNull(data.email),
        phone: blankToNull(data.phone),
        address: blankToNull(data.address),
        taxId: blankToNull(data.taxId),
        notes: blankToNull(data.notes),
        isActive: data.isActive,
      },
    });
  } catch (error) {
    if (isMissingRecord(error)) {
      return { ok: false, error: "Customer not found." };
    }
    throw error;
  }

  revalidateCustomerPaths(id);
  return { ok: true, message: "Customer updated." };
}

/**
 * Deactivates a customer (never deletes). Its jobs keep their customerId; the
 * customer only disappears from the job form's dropdown. The job count is
 * returned so the UI can warn that existing jobs stay linked.
 */
export async function deactivateCustomerAction(
  id: string,
): Promise<ActionResult> {
  await requireAuth();

  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "Missing customer id." };
  }

  const customer = await prisma.customer.findUnique({
    where: { id },
    select: { id: true, code: true },
  });
  if (!customer) return { ok: false, error: "Customer not found." };

  const jobCount = await prisma.job.count({ where: { customerId: id } });

  await prisma.customer.update({ where: { id }, data: { isActive: false } });

  revalidateCustomerPaths(id);

  return {
    ok: true,
    message:
      jobCount > 0
        ? `Customer ${customer.code} deactivated. ${jobCount} job${jobCount === 1 ? "" : "s"} remain linked.`
        : `Customer ${customer.code} deactivated.`,
    jobCount,
  };
}

/** Reactivates a customer so it appears in the job form's dropdown again. */
export async function reactivateCustomerAction(
  id: string,
): Promise<ActionResult> {
  await requireAuth();

  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "Missing customer id." };
  }

  const customer = await prisma.customer.findUnique({
    where: { id },
    select: { id: true, code: true },
  });
  if (!customer) return { ok: false, error: "Customer not found." };

  await prisma.customer.update({ where: { id }, data: { isActive: true } });

  revalidateCustomerPaths(id);
  return { ok: true, message: `Customer ${customer.code} reactivated.` };
}
