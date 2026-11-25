/**
 * Money helpers — ALL monetary values in this application are integer cents.
 *
 * Non-negotiable rules:
 *  - Amounts are stored in Prisma `Int` columns (32-bit signed) as cents.
 *  - Amounts are never stored as Float/Decimal.
 *  - Parsing goes through `toCents`, which rejects negatives, >2 decimals,
 *    exponent notation, NaN/Infinity and values outside the Int32 range.
 */

/** Accepted user input: digits with optional up to two decimal places. */
export const AMOUNT_INPUT_PATTERN = /^(?:0|[1-9]\d{0,12})(?:\.\d{1,2})?$/;

/** Largest value a Prisma `Int` (Int32) column can hold. */
export const MAX_CENTS = 2_147_483_647;

const AMOUNT_WITH_GROUPS = /^(?:0|[1-9]\d{0,12})(?:\.(\d{1,2}))?$/;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

/**
 * Converts a form value (string or number) to integer cents.
 * Throws `MoneyError` for anything that is not an exact non-negative amount
 * with at most two decimal places.
 */
export function toCents(input: string | number): number {
  const raw = typeof input === "number" ? numberToPlainString(input) : input.trim();

  if (raw === "") {
    throw new MoneyError("Amount is required.");
  }
  if (raw.startsWith("-")) {
    throw new MoneyError("Amount cannot be negative.");
  }
  if (!AMOUNT_WITH_GROUPS.test(raw)) {
    throw new MoneyError(
      "Amount must be a plain number with at most 2 decimal places (e.g. 1250.50).",
    );
  }

  const [whole, fraction = ""] = raw.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));

  if (!Number.isSafeInteger(cents)) {
    throw new MoneyError("Amount is too large.");
  }
  if (cents > MAX_CENTS) {
    throw new MoneyError("Amount exceeds the maximum supported value.");
  }

  return cents;
}

/**
 * Formats integer cents as a plain grouped decimal string without a currency
 * symbol: 123456 -> "1,234.56". Integer math only, no floating point.
 */
export function formatCents(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new MoneyError("formatCents expects an integer number of cents.");
  }

  const negative = cents < 0;
  const absolute = Math.abs(cents);
  const whole = Math.floor(absolute / 100).toString();
  const fraction = (absolute % 100).toString().padStart(2, "0");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return `${negative ? "-" : ""}${grouped}.${fraction}`;
}

/**
 * Accounting-style signed amount for report columns: negatives are shown in
 * parentheses, e.g. -123456 -> "(1,234.56)" and 123456 -> "1,234.56".
 */
export function formatSignedCents(cents: number): string {
  return cents < 0 ? `(${formatCents(Math.abs(cents))})` : formatCents(cents);
}

/** Sums integer cents, refusing non-integer input. */
export function sumCents(values: readonly number[]): number {
  let total = 0;
  for (const value of values) {
    if (!Number.isSafeInteger(value)) {
      throw new MoneyError("sumCents expects integer numbers of cents.");
    }
    total += value;
    if (!Number.isSafeInteger(total)) {
      throw new MoneyError("Total is too large.");
    }
  }
  return total;
}

function numberToPlainString(input: number): string {
  if (!Number.isFinite(input)) {
    throw new MoneyError("Amount must be a finite number.");
  }
  const text = String(input);
  if (text.includes("e") || text.includes("E")) {
    throw new MoneyError("Amount must be written as a plain number.");
  }
  return text.trim();
}
