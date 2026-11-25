/** Domain errors for accounting rules. These are safe to surface to users. */

export type AccountingErrorCode =
  | "UNBALANCED_ENTRY"
  | "INVALID_LINE"
  | "INVALID_AMOUNT"
  | "EMPTY_ENTRY"
  | "INVALID_DATE"
  | "INVALID_YEAR"
  | "INVALID_ACCOUNT"
  | "INVALID_JOB"
  | "INVALID_SITE"
  | "IMMUTABLE_ENTRY"
  | "ENTRY_NOT_FOUND"
  | "SEQUENCE_FAILURE"
  // Accounts Receivable / Accounts Payable (Phase 3)
  | "ACCOUNT_NOT_FOUND"
  | "DOCUMENT_NOT_FOUND"
  | "INVALID_DOCUMENT"
  | "INVALID_PARTY"
  | "AR_ALLOCATION_MISMATCH"
  | "AP_ALLOCATION_MISMATCH"
  | "ALLOCATION_EXCEEDS_BALANCE"
  | "DUPLICATE_ALLOCATION";

export class AccountingError extends Error {
  readonly code: AccountingErrorCode;

  constructor(code: AccountingErrorCode, message: string) {
    super(message);
    this.name = "AccountingError";
    this.code = code;
  }
}
