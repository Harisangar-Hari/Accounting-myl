/**
 * Accounting dates are calendar dates without a time zone. They are stored as
 * UTC midnight so that "2026-02-10" is the same day everywhere, and formatted
 * with timeZone: "UTC" so display never shifts the day.
 */

const DATE_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parses `YYYY-MM-DD` into UTC midnight, or returns null for invalid dates. */
export function parseDateInput(value: string): Date | null {
  const match = DATE_INPUT_PATTERN.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

/** Formats a stored date as `YYYY-MM-DD` for form inputs and URL params. */
export function formatDateInput(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Adds whole days to a `YYYY-MM-DD` input value (calendar math in UTC). */
export function addDaysInput(value: string, days: number): string {
  const parsed = parseDateInput(value);
  if (!parsed) return value;
  return formatDateInput(new Date(parsed.getTime() + days * 24 * 60 * 60 * 1000));
}

/** Today in the server's local calendar, as `YYYY-MM-DD`. */
export function todayDateInput(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

const DISPLAY_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** 2026-02-10 -> "10 Feb 2026" */
export function formatDateDisplay(date: Date): string {
  return DISPLAY_FORMATTER.format(date);
}

/** Reads an optional `YYYY-MM-DD` search param. Returns null when absent/invalid. */
export function parseOptionalDateParam(value: string | undefined): Date | null {
  if (!value) return null;
  return parseDateInput(value);
}
