"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import {
  supplierFormSchema,
  updateSupplierSchema,
} from "@/lib/validators/suppliers";
import {
  firstIssueMessage,
  toFieldErrors,
  type ActionResult,
} from "./result";

/**
 * Suppliers are referenced by the bill form's dropdown (active only) and by
 * the bill/payment lists, so those paths are revalidated on every change.
 */
function revalidateSupplierPaths(supplierId?: string): void {
  revalidatePath("/suppliers");
  if (supplierId) revalidatePath(`/suppliers/${supplierId}`);
  revalidatePath("/bills");
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
    error: `Supplier code ${code} is already in use.`,
    fieldErrors: { code: ["This supplier code is already in use."] },
  };
}

function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Creates a supplier. Codes are stored uppercase, so uniqueness is exact. */
export async function createSupplierAction(
  input: unknown,
): Promise<ActionResult> {
  await requireAuth();

  const parsed = supplierFormSchema.safeParse(input);
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

  const existing = await prisma.supplier.findUnique({
    where: { code: data.code },
    select: { id: true },
  });
  if (existing) return duplicateCodeError(data.code);

  try {
    await prisma.supplier.create({
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
    if (isUniqueViolation(error)) return duplicateCodeError(data.code);
    throw error;
  }

  revalidateSupplierPaths();
  return { ok: true, message: `Supplier ${data.code} created.` };
}

/** Updates the editable fields. The code is never part of this schema. */
export async function updateSupplierAction(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  await requireAuth();

  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "Missing supplier id." };
  }

  const parsed = updateSupplierSchema.safeParse(input);
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

  const supplier = await prisma.supplier.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!supplier) return { ok: false, error: "Supplier not found." };

  try {
    await prisma.supplier.update({
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
      return { ok: false, error: "Supplier not found." };
    }
    throw error;
  }

  revalidateSupplierPaths(id);
  return { ok: true, message: "Supplier updated." };
}

/**
 * Deactivates a supplier (never deletes). Existing bills keep their supplier;
 * the supplier only disappears from the bill form's dropdown.
 */
export async function deactivateSupplierAction(
  id: string,
): Promise<ActionResult> {
  await requireAuth();

  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "Missing supplier id." };
  }

  const supplier = await prisma.supplier.findUnique({
    where: { id },
    select: { id: true, code: true },
  });
  if (!supplier) return { ok: false, error: "Supplier not found." };

  const billCount = await prisma.supplierBill.count({
    where: { supplierId: id },
  });

  await prisma.supplier.update({ where: { id }, data: { isActive: false } });

  revalidateSupplierPaths(id);

  return {
    ok: true,
    message:
      billCount > 0
        ? `Supplier ${supplier.code} deactivated. ${billCount} bill${billCount === 1 ? "" : "s"} remain linked.`
        : `Supplier ${supplier.code} deactivated.`,
    jobCount: billCount,
  };
}

/** Reactivates a supplier so it appears in the bill form's dropdown again. */
export async function reactivateSupplierAction(
  id: string,
): Promise<ActionResult> {
  await requireAuth();

  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "Missing supplier id." };
  }

  const supplier = await prisma.supplier.findUnique({
    where: { id },
    select: { id: true, code: true },
  });
  if (!supplier) return { ok: false, error: "Supplier not found." };

  await prisma.supplier.update({ where: { id }, data: { isActive: true } });

  revalidateSupplierPaths(id);
  return { ok: true, message: `Supplier ${supplier.code} reactivated.` };
}
