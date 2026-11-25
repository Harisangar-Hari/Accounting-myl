import type { BillStatus, InvoiceStatus } from "@prisma/client";
import { parseDateInput, todayDateInput } from "@/lib/dates";

export type DocumentStatus = InvoiceStatus | BillStatus;

/** Today as UTC midnight, matching how document dates are stored. */
export function todayUtc(): Date {
  const parsed = parseDateInput(todayDateInput());
  if (!parsed) throw new Error("Could not resolve today's date.");
  return parsed;
}

/**
 * Overdue is computed, never stored: a document is overdue when its due date
 * has passed and it is neither fully paid nor cancelled. Stored status is only
 * OPEN / PARTIALLY_PAID / PAID / CANCELLED.
 */
export function isDocumentOverdue(
  status: DocumentStatus,
  dueDate: Date,
  asOf: Date = todayUtc(),
): boolean {
  if (status === "PAID" || status === "CANCELLED") return false;
  return dueDate.getTime() < asOf.getTime();
}

export function documentStatusLabel(
  status: DocumentStatus,
  overdue: boolean,
): string {
  if (overdue) return "Overdue";
  switch (status) {
    case "OPEN":
      return "Open";
    case "PARTIALLY_PAID":
      return "Partially paid";
    case "PAID":
      return "Paid";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

/** Sort priority for status tabs; also used to normalise filter params. */
export const DOCUMENT_STATUS_FILTERS = [
  "all",
  "open",
  "partially_paid",
  "paid",
  "overdue",
] as const;

export type DocumentStatusFilter = (typeof DOCUMENT_STATUS_FILTERS)[number];

export function parseDocumentStatusFilter(
  value: string | undefined,
): DocumentStatusFilter {
  return (DOCUMENT_STATUS_FILTERS as readonly string[]).includes(value ?? "")
    ? (value as DocumentStatusFilter)
    : "all";
}
