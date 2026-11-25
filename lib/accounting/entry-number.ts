import type { Prisma } from "@prisma/client";
import { AccountingError } from "./errors";

/**
 * Allocates the next entry number for a calendar year.
 *
 * MUST be called inside a Prisma transaction with the transaction client.
 * The single `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` statement takes
 * a row lock on the sequence row, so concurrent submissions are serialized and
 * two entries can never receive the same number.
 *
 * Returns e.g. "JE-2026-0001".
 */
export async function generateEntryNo(
  tx: Prisma.TransactionClient,
  year: number,
): Promise<string> {
  if (!Number.isInteger(year) || year < 1900 || year > 9999) {
    throw new AccountingError(
      "INVALID_YEAR",
      `Cannot generate an entry number for year "${year}".`,
    );
  }

  const rows = await tx.$queryRaw<Array<{ lastNo: number }>>`
    INSERT INTO "EntrySequence" ("year", "lastNo")
    VALUES (${year}, 1)
    ON CONFLICT ("year") DO UPDATE
      SET "lastNo" = "EntrySequence"."lastNo" + 1
    RETURNING "lastNo"
  `;

  const lastNo = rows[0]?.lastNo;

  if (typeof lastNo !== "number" || !Number.isInteger(lastNo) || lastNo < 1) {
    throw new AccountingError(
      "SEQUENCE_FAILURE",
      "Failed to allocate a journal entry number. Please retry.",
    );
  }

  return `JE-${year}-${String(lastNo).padStart(4, "0")}`;
}
