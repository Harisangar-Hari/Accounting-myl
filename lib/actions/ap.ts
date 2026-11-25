"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import {
  createSupplierBill,
  createSupplierPayment,
} from "@/lib/accounting/ap";
import { AccountingError } from "@/lib/accounting/errors";
import { parseDateInput } from "@/lib/dates";
import { MoneyError, toCents } from "@/lib/money";
import {
  createBillFormSchema,
  createSupplierPaymentFormSchema,
} from "@/lib/validators/ap";
import {
  firstIssueMessage,
  toFieldErrors,
  type ActionResult,
} from "./result";

function revalidateApPaths(supplierId: string): void {
  revalidatePath("/bills");
  revalidatePath("/supplier-payments");
  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${supplierId}`);
  revalidatePath(`/suppliers/${supplierId}/bills`);
  revalidatePath(`/suppliers/${supplierId}/payments`);
  revalidatePath("/journal");
  revalidatePath("/dashboard");
  revalidatePath("/reports/ap-aging");
  revalidatePath("/reports/supplier-balances");
}

/** Creates a supplier bill and its POSTED journal entry in one transaction. */
export async function createSupplierBillAction(
  input: unknown,
): Promise<ActionResult> {
  const user = await requireAuth();

  const parsed = createBillFormSchema.safeParse(input);
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
  const billDate = parseDateInput(data.billDate);
  const dueDate = parseDateInput(data.dueDate);
  if (!billDate || !dueDate) {
    return { ok: false, error: "Enter valid bill and due dates." };
  }

  try {
    const bill = await prisma.$transaction((tx) =>
      createSupplierBill(tx, {
        supplierId: data.supplierId,
        billDate,
        dueDate,
        description: data.description || null,
        supplierRef: data.supplierRef || null,
        lines: data.lines.map((line) => ({
          description: line.description,
          expenseAccountId: line.expenseAccountId,
          amountCents: toCents(line.amount),
          taxCents: line.taxAmount?.trim() ? toCents(line.taxAmount) : 0,
          jobId: line.jobId || null,
          siteId: line.siteId || null,
        })),
        createdById: user.id,
      }),
    );

    revalidateApPaths(data.supplierId);
    return {
      ok: true,
      message: `Bill ${bill.billNo} created.`,
      documentNo: bill.billNo,
      documentId: bill.id,
    };
  } catch (error) {
    if (error instanceof MoneyError || error instanceof AccountingError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

/** Records a supplier payment, fully allocated, with its journal entry. */
export async function createSupplierPaymentAction(
  input: unknown,
): Promise<ActionResult> {
  const user = await requireAuth();

  const parsed = createSupplierPaymentFormSchema.safeParse(input);
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
  const paymentDate = parseDateInput(data.paymentDate);
  if (!paymentDate) {
    return { ok: false, error: "Enter a valid payment date." };
  }

  try {
    const payment = await prisma.$transaction((tx) =>
      createSupplierPayment(tx, {
        supplierId: data.supplierId,
        paymentDate,
        amountCents: toCents(data.amount),
        method: data.method,
        reference: data.reference || null,
        notes: data.notes || null,
        allocations: data.allocations.map((allocation) => ({
          billId: allocation.billId,
          amountCents: toCents(allocation.amount),
        })),
        createdById: user.id,
      }),
    );

    revalidateApPaths(data.supplierId);
    return {
      ok: true,
      message: `Payment ${payment.paymentNo} recorded.`,
      documentNo: payment.paymentNo,
      documentId: payment.id,
    };
  } catch (error) {
    if (error instanceof MoneyError || error instanceof AccountingError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}
