import type { Prisma } from "@prisma/client";
import { AccountingError } from "./errors";

/**
 * Document-number prefixes. Entry numbers (JE) live in their own sequence so
 * auto-generated business documents can never collide with manual entries.
 */
export type DocPrefix = "INV" | "BILL" | "RCPT" | "PAY";

/**
 * Allocates the next number for a document prefix and calendar year.
 *
 * MUST be called inside a Prisma transaction with the transaction client.
 * The single `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` statement takes
 * a row lock on the sequence row, so concurrent submissions are serialized and
 * two documents can never receive the same number.
 *
 * Returns e.g. "INV-2026-0001".
 */
export async function generateDocNo(
  tx: Prisma.TransactionClient,
  prefix: DocPrefix,
  year: number,
): Promise<string> {
  if (!Number.isInteger(year) || year < 1900 || year > 9999) {
    throw new AccountingError(
      "INVALID_YEAR",
      `Cannot generate a document number for year "${year}".`,
    );
  }

  const key = `${prefix}-${year}`;

  const rows = await tx.$queryRaw<Array<{ lastNo: number }>>`
    INSERT INTO "DocSequence" ("key", "lastNo")
    VALUES (${key}, 1)
    ON CONFLICT ("key") DO UPDATE
      SET "lastNo" = "DocSequence"."lastNo" + 1
    RETURNING "lastNo"
  `;

  const lastNo = rows[0]?.lastNo;

  if (typeof lastNo !== "number" || !Number.isInteger(lastNo) || lastNo < 1) {
    throw new AccountingError(
      "SEQUENCE_FAILURE",
      "Failed to allocate a document number. Please retry.",
    );
  }

  return `${prefix}-${year}-${String(lastNo).padStart(4, "0")}`;
}
