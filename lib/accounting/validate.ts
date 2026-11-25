import { AccountingError } from "./errors";
import { MAX_CENTS } from "@/lib/money";

/**
 * A journal line before it is written. Amounts are integer cents and both
 * sides are always present (0 when unused), so double-entry is unambiguous.
 */
export interface JournalLineInput {
  accountId: string;
  debitCents: number;
  creditCents: number;
  description?: string | null;
  jobId?: string | null;
  siteId?: string | null;
}

export interface BalancedTotals {
  debitCents: number;
  creditCents: number;
}

/**
 * Enforces the double-entry invariants. Throws `AccountingError` on the first
 * violation. Callers must run this before writing an entry, and again inside
 * the transaction immediately before commit.
 *
 * Rules:
 *  - at least two lines
 *  - every amount is a non-negative integer within Int32 range
 *  - each line has EXACTLY ONE of debit/credit greater than zero (XOR)
 *  - total debits === total credits
 *  - the entry total is greater than zero
 */
export function assertBalanced(
  lines: readonly JournalLineInput[],
): BalancedTotals {
  if (lines.length === 0) {
    throw new AccountingError(
      "EMPTY_ENTRY",
      "A journal entry must have at least one debit and one credit line.",
    );
  }
  if (lines.length < 2) {
    throw new AccountingError(
      "EMPTY_ENTRY",
      "A journal entry must have at least two lines (one debit and one credit).",
    );
  }

  let debitCents = 0;
  let creditCents = 0;

  lines.forEach((line, index) => {
    const label = `Line ${index + 1}`;

    if (!line.accountId || line.accountId.trim() === "") {
      throw new AccountingError(
        "INVALID_LINE",
        `${label}: an account is required.`,
      );
    }

    assertLineAmount(line.debitCents, `${label} debit`);
    assertLineAmount(line.creditCents, `${label} credit`);

    const hasDebit = line.debitCents > 0;
    const hasCredit = line.creditCents > 0;

    if (hasDebit && hasCredit) {
      throw new AccountingError(
        "INVALID_LINE",
        `${label}: a line cannot have both a debit and a credit amount.`,
      );
    }
    if (!hasDebit && !hasCredit) {
      throw new AccountingError(
        "INVALID_LINE",
        `${label}: a line must have either a debit or a credit amount.`,
      );
    }

    debitCents += line.debitCents;
    creditCents += line.creditCents;

    if (debitCents > Number.MAX_SAFE_INTEGER || creditCents > Number.MAX_SAFE_INTEGER) {
      throw new AccountingError(
        "INVALID_AMOUNT",
        "Entry total is too large to process.",
      );
    }
  });

  if (debitCents !== creditCents) {
    throw new AccountingError(
      "UNBALANCED_ENTRY",
      `Entry is not balanced: debits ${formatForError(debitCents)} ≠ credits ${formatForError(creditCents)}.`,
    );
  }

  if (debitCents === 0) {
    throw new AccountingError(
      "EMPTY_ENTRY",
      "Entry total cannot be zero.",
    );
  }

  return { debitCents, creditCents };
}

function assertLineAmount(value: number, label: string): void {
  if (!Number.isInteger(value)) {
    throw new AccountingError(
      "INVALID_AMOUNT",
      `${label} must be an integer number of cents.`,
    );
  }
  if (value < 0) {
    throw new AccountingError(
      "INVALID_AMOUNT",
      `${label} cannot be negative.`,
    );
  }
  if (value > MAX_CENTS) {
    throw new AccountingError(
      "INVALID_AMOUNT",
      `${label} exceeds the maximum supported amount.`,
    );
  }
}

function formatForError(cents: number): string {
  const whole = Math.floor(cents / 100).toString();
  const fraction = (cents % 100).toString().padStart(2, "0");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`;
}
