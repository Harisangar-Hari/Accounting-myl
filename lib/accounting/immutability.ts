import type { EntryStatus } from "@prisma/client";
import { AccountingError } from "./errors";

interface MutableEntry {
  entryNo: string;
  status: EntryStatus;
}

/**
 * POSTED entries are immutable: no update, no delete, no re-post.
 * Every mutation path must call this before touching an existing entry.
 */
export function assertEntryMutable(entry: MutableEntry): void {
  if (entry.status === "POSTED") {
    throw new AccountingError(
      "IMMUTABLE_ENTRY",
      `Entry ${entry.entryNo} is POSTED and is immutable. Posted entries cannot be edited or deleted.`,
    );
  }
}
