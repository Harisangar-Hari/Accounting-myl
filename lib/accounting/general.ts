import { prisma } from "@/lib/db";
import { AccountingError } from "./errors";
import { writeEntry, type CreatedEntry } from "./journal";
import { assertBalanced, type JournalLineInput } from "./validate";

export interface GeneralLineDraft {
  accountId: string;
  debitCents: number;
  creditCents: number;
  description?: string | null;
  jobId?: string | null;
  siteId?: string | null;
}

export interface CreateGeneralEntryInput {
  entryDate: Date;
  description: string;
  reference?: string | null;
  status: "DRAFT" | "POSTED";
  createdById: string;
  lines: readonly GeneralLineDraft[];
}

/**
 * Creates a general journal entry. Account ids are verified (exist and are
 * active) inside the same transaction that writes the entry.
 */
export async function createGeneralEntry(
  input: CreateGeneralEntryInput,
): Promise<CreatedEntry> {
  const draftLines: JournalLineInput[] = input.lines.map((line) => ({
    accountId: line.accountId,
    debitCents: line.debitCents,
    creditCents: line.creditCents,
    description: line.description ?? null,
    jobId: line.jobId ?? null,
    siteId: line.siteId ?? null,
  }));

  assertBalanced(draftLines);

  return prisma.$transaction(async (tx) => {
    const accountIds = [...new Set(draftLines.map((line) => line.accountId))];
    const accounts = await tx.account.findMany({
      where: { id: { in: accountIds } },
      select: { id: true, code: true, isActive: true },
    });
    const byId = new Map(accounts.map((account) => [account.id, account]));

    draftLines.forEach((line, index) => {
      const account = byId.get(line.accountId);
      if (!account) {
        throw new AccountingError(
          "INVALID_ACCOUNT",
          `Line ${index + 1}: the selected account no longer exists.`,
        );
      }
      if (!account.isActive) {
        throw new AccountingError(
          "INVALID_ACCOUNT",
          `Line ${index + 1}: account ${account.code} is inactive.`,
        );
      }
    });

    return writeEntry(
      tx,
      {
        entryDate: input.entryDate,
        description: input.description,
        reference: input.reference,
        entryType: "GENERAL",
        status: input.status,
        createdById: input.createdById,
      },
      draftLines,
    );
  });
}
