"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import {
  createCustomerInvoice,
  createCustomerPayment,
} from "@/lib/accounting/ar";
import { AccountingError } from "@/lib/accounting/errors";
import { parseDateInput } from "@/lib/dates";
import { MoneyError, toCents } from "@/lib/money";
import {
  createCustomerPaymentFormSchema,
  createInvoiceFormSchema,
} from "@/lib/validators/ar";
import {
  firstIssueMessage,
  toFieldErrors,
  type ActionResult,
} from "./result";

/**
 * AR documents post straight into the ledger, so every affected view (lists,
 * customer detail, journal, AR reports) is revalidated after a write.
 */
function revalidateArPaths(customerId: string): void {
  revalidatePath("/invoices");
  revalidatePath("/payments");
  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  revalidatePath(`/customers/${customerId}/invoices`);
  revalidatePath(`/customers/${customerId}/payments`);
  revalidatePath("/journal");
  revalidatePath("/dashboard");
  revalidatePath("/reports/ar-aging");
  revalidatePath("/reports/customer-balances");
}

/**
 * Creates a customer invoice: the document and its POSTED journal entry are
 * written in one transaction by `createCustomerInvoice`.
 */
export async function createCustomerInvoiceAction(
  input: unknown,
): Promise<ActionResult> {
  const user = await requireAuth();

  const parsed = createInvoiceFormSchema.safeParse(input);
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
  const invoiceDate = parseDateInput(data.invoiceDate);
  const dueDate = parseDateInput(data.dueDate);
  if (!invoiceDate || !dueDate) {
    return { ok: false, error: "Enter valid invoice and due dates." };
  }

  try {
    const invoice = await prisma.$transaction((tx) =>
      createCustomerInvoice(tx, {
        customerId: data.customerId,
        invoiceDate,
        dueDate,
        description: data.description || null,
        lines: data.lines.map((line) => ({
          description: line.description,
          revenueAccountId: line.revenueAccountId,
          amountCents: toCents(line.amount),
          taxCents: line.taxAmount?.trim() ? toCents(line.taxAmount) : 0,
          jobId: line.jobId || null,
          siteId: line.siteId || null,
        })),
        createdById: user.id,
      }),
    );

    revalidateArPaths(data.customerId);
    return {
      ok: true,
      message: `Invoice ${invoice.invoiceNo} created.`,
      documentNo: invoice.invoiceNo,
      documentId: invoice.id,
    };
  } catch (error) {
    if (error instanceof MoneyError || error instanceof AccountingError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

/**
 * Records a customer receipt. Allocations must equal the receipt amount; the
 * receipt, its allocations, the invoice status updates and the journal entry
 * commit in one transaction.
 */
export async function createCustomerPaymentAction(
  input: unknown,
): Promise<ActionResult> {
  const user = await requireAuth();

  const parsed = createCustomerPaymentFormSchema.safeParse(input);
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
      createCustomerPayment(tx, {
        customerId: data.customerId,
        paymentDate,
        amountCents: toCents(data.amount),
        method: data.method,
        reference: data.reference || null,
        notes: data.notes || null,
        allocations: data.allocations.map((allocation) => ({
          invoiceId: allocation.invoiceId,
          amountCents: toCents(allocation.amount),
        })),
        createdById: user.id,
      }),
    );

    revalidateArPaths(data.customerId);
    return {
      ok: true,
      message: `Receipt ${payment.paymentNo} recorded.`,
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
