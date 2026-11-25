import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sumCents } from "@/lib/money";
import { AccountingError } from "./errors";
import { writeEntry, type CreatedEntry } from "./journal";
import { assertBalanced, type JournalLineInput } from "./validate";

export interface ExpenseLineDraft {
  expenseAccountId: string;
  /** Integer cents, already parsed from the form amount string. */
  amountCents: number;
  description?: string | null;
  jobId?: string | null;
  siteId?: string | null;
}

export interface CreateExpenseEntryInput {
  entryDate: Date;
  description: string;
  reference?: string | null;
  paymentAccountId: string;
  status: "DRAFT" | "POSTED";
  createdById: string;
  lines: readonly ExpenseLineDraft[];
}

/**
 * Creates an expense entry: one DEBIT line per expense line, and a single
 * balancing CREDIT line to the payment (asset) account.
 *
 * Reference integrity (account types, active flags, site-belongs-to-job) is
 * validated inside the same transaction that writes the entry, so a stale
 * dropdown selection can never produce an invalid ledger entry.
 */
export async function createExpenseEntry(
  input: CreateExpenseEntryInput,
): Promise<CreatedEntry> {
  if (input.lines.length === 0) {
    throw new AccountingError(
      "EMPTY_ENTRY",
      "An expense entry needs at least one expense line.",
    );
  }

  return prisma.$transaction(async (tx) => {
    const lines = await buildExpenseLines(tx, input);

    return writeEntry(
      tx,
      {
        entryDate: input.entryDate,
        description: input.description,
        reference: input.reference,
        entryType: "EXPENSE",
        status: input.status,
        createdById: input.createdById,
      },
      lines,
    );
  });
}

async function buildExpenseLines(
  tx: Prisma.TransactionClient,
  input: CreateExpenseEntryInput,
): Promise<JournalLineInput[]> {
  const accountIds = [
    ...new Set([
      input.paymentAccountId,
      ...input.lines.map((line) => line.expenseAccountId),
    ]),
  ];

  const accounts = await tx.account.findMany({
    where: { id: { in: accountIds } },
    select: { id: true, code: true, name: true, type: true, isActive: true },
  });
  const accountById = new Map(accounts.map((account) => [account.id, account]));

  const paymentAccount = accountById.get(input.paymentAccountId);
  if (!paymentAccount) {
    throw new AccountingError(
      "INVALID_ACCOUNT",
      "The selected payment account no longer exists.",
    );
  }
  if (paymentAccount.type !== "ASSET") {
    throw new AccountingError(
      "INVALID_ACCOUNT",
      `Payment account ${paymentAccount.code} must be an ASSET account.`,
    );
  }
  if (!paymentAccount.isActive) {
    throw new AccountingError(
      "INVALID_ACCOUNT",
      `Payment account ${paymentAccount.code} ${paymentAccount.name} is inactive.`,
    );
  }

  const jobIds = [
    ...new Set(
      input.lines
        .map((line) => line.jobId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const siteIds = [
    ...new Set(
      input.lines
        .map((line) => line.siteId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [jobs, sites] = await Promise.all([
    jobIds.length > 0
      ? tx.job.findMany({
          where: { id: { in: jobIds } },
          select: { id: true, code: true, isActive: true },
        })
      : Promise.resolve([]),
    siteIds.length > 0
      ? tx.site.findMany({
          where: { id: { in: siteIds } },
          select: { id: true, code: true, jobId: true },
        })
      : Promise.resolve([]),
  ]);

  const jobById = new Map(jobs.map((job) => [job.id, job]));
  const siteById = new Map(sites.map((site) => [site.id, site]));

  const lines: JournalLineInput[] = [];
  let totalCents = 0;

  input.lines.forEach((line, index) => {
    const label = `Line ${index + 1}`;

    const account = accountById.get(line.expenseAccountId);
    if (!account) {
      throw new AccountingError(
        "INVALID_ACCOUNT",
        `${label}: the selected expense account no longer exists.`,
      );
    }
    if (account.type !== "EXPENSE") {
      throw new AccountingError(
        "INVALID_ACCOUNT",
        `${label}: account ${account.code} is not an EXPENSE account.`,
      );
    }
    if (!account.isActive) {
      throw new AccountingError(
        "INVALID_ACCOUNT",
        `${label}: account ${account.code} ${account.name} is inactive.`,
      );
    }

    if (!Number.isInteger(line.amountCents) || line.amountCents <= 0) {
      throw new AccountingError(
        "INVALID_AMOUNT",
        `${label}: amount must be greater than zero.`,
      );
    }

    if (line.jobId) {
      const job = jobById.get(line.jobId);
      if (!job) {
        throw new AccountingError(
          "INVALID_JOB",
          `${label}: the selected job no longer exists.`,
        );
      }
      if (!job.isActive) {
        throw new AccountingError(
          "INVALID_JOB",
          `${label}: job ${job.code} is inactive.`,
        );
      }
    }

    if (line.siteId) {
      const site = siteById.get(line.siteId);
      if (!site) {
        throw new AccountingError(
          "INVALID_SITE",
          `${label}: the selected site no longer exists.`,
        );
      }
      if (!line.jobId) {
        throw new AccountingError(
          "INVALID_SITE",
          `${label}: select a job before selecting a site.`,
        );
      }
      if (site.jobId !== line.jobId) {
        throw new AccountingError(
          "INVALID_SITE",
          `${label}: site ${site.code} does not belong to the selected job.`,
        );
      }
    }

    totalCents = sumCents([totalCents, line.amountCents]);

    lines.push({
      accountId: account.id,
      debitCents: line.amountCents,
      creditCents: 0,
      description: line.description ?? null,
      jobId: line.jobId ?? null,
      siteId: line.siteId ?? null,
    });
  });

  // The balancing credit line — one payment for the total of all expense lines.
  lines.push({
    accountId: paymentAccount.id,
    debitCents: 0,
    creditCents: totalCents,
    description: `Payment — ${paymentAccount.name}`,
    jobId: null,
    siteId: null,
  });

  assertBalanced(lines);
  return lines;
}
