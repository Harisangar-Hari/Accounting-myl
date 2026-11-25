"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AccountingError } from "@/lib/accounting/errors";
import { createExpenseEntry } from "@/lib/accounting/expenses";
import { createGeneralEntry } from "@/lib/accounting/general";
import { postJournalEntry } from "@/lib/accounting/journal";
import { requireAuth } from "@/lib/auth";
import { parseDateInput } from "@/lib/dates";
import { MoneyError, toCents } from "@/lib/money";
import {
  expenseEntrySubmitSchema,
  generalEntrySubmitSchema,
} from "@/lib/validators/journal";
import {
  firstIssueMessage,
  toFieldErrors,
  type ActionResult,
} from "./result";

function revalidateLedger(): void {
  revalidatePath("/dashboard");
  revalidatePath("/journal");
  revalidatePath("/expenses");
}

/**
 * Creates an expense entry (one debit per expense line, one credit to the
 * payment account) as DRAFT or POSTED.
 */
export async function createExpenseEntryAction(
  input: unknown,
): Promise<ActionResult> {
  const user = await requireAuth();

  const parsed = expenseEntrySubmitSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: firstIssueMessage(parsed.error, "Please fix the highlighted fields."),
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const data = parsed.data;
  const entryDate = parseDateInput(data.entryDate);
  if (!entryDate) {
    return { ok: false, error: "Enter a valid entry date." };
  }

  let entryNo: string;
  try {
    const entry = await createExpenseEntry({
      entryDate,
      description: data.description,
      reference: data.reference || null,
      paymentAccountId: data.paymentAccountId,
      status: data.intent,
      createdById: user.id,
      lines: data.lines.map((line) => ({
        expenseAccountId: line.expenseAccountId,
        amountCents: toCents(line.amount),
        description: line.description || null,
        jobId: line.jobId || null,
        siteId: line.siteId || null,
      })),
    });
    entryNo = entry.entryNo;
  } catch (error) {
    if (error instanceof MoneyError || error instanceof AccountingError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  revalidateLedger();
  redirect(`/expenses?created=${encodeURIComponent(entryNo)}`);
}

/** Creates a general (non-expense) journal entry. */
export async function createGeneralEntryAction(
  input: unknown,
): Promise<ActionResult> {
  const user = await requireAuth();

  const parsed = generalEntrySubmitSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: firstIssueMessage(parsed.error, "Please fix the highlighted fields."),
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const data = parsed.data;
  const entryDate = parseDateInput(data.entryDate);
  if (!entryDate) {
    return { ok: false, error: "Enter a valid entry date." };
  }

  let lines;
  try {
    lines = data.lines.map((line, index) => ({
      accountId: line.accountId,
      debitCents: line.debit?.trim() ? toCents(line.debit) : 0,
      creditCents: line.credit?.trim() ? toCents(line.credit) : 0,
      description: line.description || `Line ${index + 1}`,
      jobId: line.jobId || null,
      siteId: line.siteId || null,
    }));
  } catch (error) {
    if (error instanceof MoneyError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  let entryNo: string;
  try {
    const entry = await createGeneralEntry({
      entryDate,
      description: data.description,
      reference: data.reference || null,
      status: data.intent,
      createdById: user.id,
      lines,
    });
    entryNo = entry.entryNo;
  } catch (error) {
    if (error instanceof AccountingError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  revalidateLedger();
  redirect(`/journal?created=${encodeURIComponent(entryNo)}`);
}

/**
 * Posts a DRAFT entry. POSTED entries are immutable and throw an
 * AccountingError from postJournalEntry().
 */
export async function postEntryAction(entryId: string): Promise<ActionResult> {
  await requireAuth();

  if (typeof entryId !== "string" || entryId.length === 0) {
    return { ok: false, error: "Missing journal entry id." };
  }

  try {
    const posted = await postJournalEntry(entryId);
    revalidateLedger();
    revalidatePath(`/journal/${entryId}`);
    return { ok: true, message: `Entry ${posted.entryNo} posted.` };
  } catch (error) {
    if (error instanceof AccountingError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}
