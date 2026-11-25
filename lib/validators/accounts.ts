import { z } from "zod";
import type { AccountType, NormalBalance } from "@prisma/client";

/**
 * Codes are numeric by convention (1000, 5000, 5050), 3–6 digits, stored as a
 * string so leading zeroes survive. Uniqueness is checked in the action.
 */
export const ACCOUNT_CODE_PATTERN = /^[0-9]{3,6}$/;

export const accountCodeSchema = z
  .string()
  .transform((value) => value.trim().toUpperCase())
  .pipe(
    z
      .string()
      .regex(
        ACCOUNT_CODE_PATTERN,
        "Use 3 to 6 digits only (for example 5010)",
      ),
  );

export const accountNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(200, "Name must be 200 characters or fewer");

export const ACCOUNT_TYPES = [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "REVENUE",
  "EXPENSE",
] as const satisfies readonly AccountType[];

export const accountTypeSchema = z.enum(ACCOUNT_TYPES);

/**
 * SINGLE SOURCE OF TRUTH for normal balances.
 *
 * normalBalance is derived from type and is never accepted from the client: a
 * wrong normal balance produces a silently incorrect P&L with no error, so the
 * form has no normalBalance field at all and the server always derives it.
 * Contra-accounts (an ASSET with a CREDIT balance) are deferred to Phase 5 and
 * would need an explicit, audited exception here.
 */
export const NORMAL_BALANCE_BY_TYPE: Record<AccountType, NormalBalance> = {
  ASSET: "DEBIT",
  EXPENSE: "DEBIT",
  LIABILITY: "CREDIT",
  EQUITY: "CREDIT",
  REVENUE: "CREDIT",
};

export function deriveNormalBalance(type: AccountType): NormalBalance {
  return NORMAL_BALANCE_BY_TYPE[type];
}

/**
 * parentId is optional. An empty string from the form means "no parent"; the
 * action re-checks existence, active status and same-type before saving.
 */
export const accountParentIdSchema = z
  .string()
  .nullable()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  });

/** Create schema. There is deliberately no normalBalance field. */
export const accountFormSchema = z.object({
  code: accountCodeSchema,
  name: accountNameSchema,
  type: accountTypeSchema,
  parentId: accountParentIdSchema,
  isActive: z.boolean().default(true),
});

export type AccountFormValues = z.infer<typeof accountFormSchema>;

/**
 * Only name and isActive are editable after creation. Code, type,
 * normalBalance and parentId are immutable, and the action strips any extra
 * keys before the update.
 */
export const updateAccountSchema = z.object({
  name: accountNameSchema,
  isActive: z.boolean(),
});

export type UpdateAccountValues = z.infer<typeof updateAccountSchema>;
