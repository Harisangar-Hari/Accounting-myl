import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AccountingError } from "./errors";
import { generateEntryNo } from "./entry-number";
import { assertEntryMutable } from "./immutability";
import { assertBalanced, type JournalLineInput } from "./validate";

export interface JournalEntryHeader {
  entryDate: Date;
  description: string;
  reference?: string | null;
  entryType: "GENERAL" | "EXPENSE";
  status: "DRAFT" | "POSTED";
  createdById: string;
}

export interface CreatedEntry {
  id: string;
  entryNo: string;
  status: "DRAFT" | "POSTED";
  totalCents: number;
}

/**
 * Writes a balanced entry using the caller's transaction. The entry number is
 * allocated and the balance asserted inside the same transaction, immediately
 * before the insert, so an unbalanced entry can never be committed.
 */
export async function writeEntry(
  tx: Prisma.TransactionClient,
  header: JournalEntryHeader,
  lines: readonly JournalLineInput[],
): Promise<CreatedEntry> {
  if (!Number.isFinite(header.entryDate.getTime())) {
    throw new AccountingError("INVALID_DATE", "A valid entry date is required.");
  }

  const description = header.description.trim();
  if (description.length === 0) {
    throw new AccountingError("INVALID_LINE", "A description is required.");
  }

  // Re-assert immediately before the write; never trust an earlier check.
  const totals = assertBalanced(lines);

  const year = header.entryDate.getUTCFullYear();
  const entryNo = await generateEntryNo(tx, year);

  const created = await tx.journalEntry.create({
    data: {
      entryNo,
      entryDate: header.entryDate,
      description,
      reference: header.reference?.trim() || null,
      status: header.status,
      entryType: header.entryType,
      createdById: header.createdById,
      postedAt: header.status === "POSTED" ? new Date() : null,
      lines: {
        create: lines.map((line, index) => ({
          accountId: line.accountId,
          debitCents: line.debitCents,
          creditCents: line.creditCents,
          description: line.description?.trim() || null,
          jobId: line.jobId || null,
          siteId: line.siteId || null,
          lineNo: index + 1,
        })),
      },
    },
    select: { id: true, entryNo: true, status: true },
  });

  return { ...created, totalCents: totals.debitCents };
}

/**
 * Creates a general journal entry in its own transaction.
 * Callers are Server Actions that have already called requireAuth().
 */
export async function createJournalEntry(
  header: JournalEntryHeader,
  lines: readonly JournalLineInput[],
): Promise<CreatedEntry> {
  assertBalanced(lines);

  return prisma.$transaction((tx) => writeEntry(tx, header, lines));
}

/**
 * Posts a DRAFT entry. POSTED entries throw — they are immutable.
 * The status guard is repeated in the UPDATE so two concurrent post requests
 * cannot both succeed.
 */
export async function postJournalEntry(
  entryId: string,
): Promise<{ id: string; entryNo: string }> {
  return prisma.$transaction(async (tx) => {
    const entry = await tx.journalEntry.findUnique({
      where: { id: entryId },
      select: {
        id: true,
        entryNo: true,
        status: true,
        lines: {
          select: {
            accountId: true,
            debitCents: true,
            creditCents: true,
            description: true,
            jobId: true,
            siteId: true,
          },
        },
      },
    });

    if (!entry) {
      throw new AccountingError("ENTRY_NOT_FOUND", "Journal entry not found.");
    }

    assertEntryMutable(entry);

    if (entry.lines.length === 0) {
      throw new AccountingError(
        "EMPTY_ENTRY",
        `Entry ${entry.entryNo} has no lines and cannot be posted.`,
      );
    }

    assertBalanced(entry.lines);

    const posted = await tx.journalEntry.updateMany({
      where: { id: entry.id, status: "DRAFT" },
      data: { status: "POSTED", postedAt: new Date() },
    });

    if (posted.count !== 1) {
      throw new AccountingError(
        "IMMUTABLE_ENTRY",
        `Entry ${entry.entryNo} was posted by another request. Refresh and try again.`,
      );
    }

    return { id: entry.id, entryNo: entry.entryNo };
  });
}
