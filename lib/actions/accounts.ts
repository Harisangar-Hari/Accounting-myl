"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  accountFormSchema,
  deriveNormalBalance,
  updateAccountSchema,
} from "@/lib/validators/accounts";
import {
  firstIssueMessage,
  toFieldErrors,
  type ActionResult,
} from "./result";

function revalidateAccountPaths(accountId?: string): void {
  revalidatePath("/accounts");
  if (accountId) revalidatePath(`/accounts/${accountId}`);
  // New-entry dropdowns and account-based reports read these lists.
  revalidatePath("/expenses/new");
  revalidatePath("/journal/new");
  revalidatePath("/reports/trial-balance");
  revalidatePath("/reports/profit-and-loss");
  revalidatePath("/reports/balance-sheet");
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function duplicateCodeError(code: string): ActionResult {
  return {
    ok: false,
    error: `Account code ${code} is already in use.`,
    fieldErrors: { code: ["This account code is already in use."] },
  };
}

/**
 * Creates an account.
 *
 * normalBalance is derived from type — anything the client sends for it is
 * ignored (the schema has no such field). parentId is validated server-side:
 * the parent must exist, be active, and be of the same type.
 */
export async function createAccountAction(input: unknown): Promise<ActionResult> {
  await requireAuth();

  const parsed = accountFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: firstIssueMessage(
        parsed.error,
        "Please fix the highlighted fields.",
      ),
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const data = parsed.data;
  const normalBalance = deriveNormalBalance(data.type);

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.account.findUnique({
        where: { code: data.code },
        select: { id: true },
      });
      if (existing) throw new DuplicateAccountCode(data.code);

      if (data.parentId) {
        const parent = await tx.account.findUnique({
          where: { id: data.parentId },
          select: { id: true, type: true, isActive: true },
        });
        if (!parent) throw new InvalidParent("Parent account not found.");
        if (!parent.isActive) {
          throw new InvalidParent("The parent account is inactive.");
        }
        if (parent.type !== data.type) {
          throw new InvalidParent(
            "The parent account must have the same type as this account.",
          );
        }
      }

      await tx.account.create({
        data: {
          code: data.code,
          name: data.name,
          type: data.type,
          normalBalance,
          isActive: data.isActive,
          parentId: data.parentId ?? null,
        },
      });
    });
  } catch (error) {
    if (error instanceof DuplicateAccountCode) {
      return duplicateCodeError(error.code);
    }
    if (error instanceof InvalidParent) {
      return {
        ok: false,
        error: error.message,
        fieldErrors: { parentId: [error.message] },
      };
    }
    // Fallback guard for a concurrent create racing the uniqueness check.
    if (isUniqueViolation(error)) return duplicateCodeError(data.code);
    throw error;
  }

  revalidateAccountPaths();
  return { ok: true, message: `Account ${data.code} created.` };
}

/**
 * Updates only name and isActive. Code, type, normalBalance and parentId are
 * immutable, so any extra keys in the input are stripped by the schema before
 * the update.
 */
export async function updateAccountAction(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  await requireAuth();

  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "Missing account id." };
  }

  const parsed = updateAccountSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: firstIssueMessage(
        parsed.error,
        "Please fix the highlighted fields.",
      ),
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const account = await prisma.account.findUnique({
    where: { id },
    select: { id: true, code: true },
  });
  if (!account) return { ok: false, error: "Account not found." };

  const data = parsed.data;

  await prisma.account.update({
    where: { id },
    data: { name: data.name, isActive: data.isActive },
  });

  revalidateAccountPaths(id);
  return { ok: true, message: `Account ${account.code} updated.` };
}

/**
 * Deactivates an account (never deletes). Journal lines are counted first and
 * returned so the UI can show how much history is preserved. Children are
 * intentionally left active: the parent relationship is display hierarchy, not
 * a permission.
 */
export async function deactivateAccountAction(
  id: string,
): Promise<ActionResult> {
  await requireAuth();

  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "Missing account id." };
  }

  const account = await prisma.account.findUnique({
    where: { id },
    select: { id: true, code: true },
  });
  if (!account) return { ok: false, error: "Account not found." };

  const journalLineCount = await prisma.journalLine.count({
    where: { accountId: id },
  });

  await prisma.account.update({
    where: { id },
    data: { isActive: false },
  });

  revalidateAccountPaths(id);

  return {
    ok: true,
    message:
      journalLineCount > 0
        ? `Account ${account.code} deactivated. It has ${journalLineCount} journal line${journalLineCount === 1 ? "" : "s"}; historical reports are unaffected and it is hidden from new entries.`
        : `Account ${account.code} deactivated.`,
    journalLineCount,
  };
}

/** Reactivates an account so it appears in new-entry dropdowns again. */
export async function reactivateAccountAction(
  id: string,
): Promise<ActionResult> {
  await requireAuth();

  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "Missing account id." };
  }

  const account = await prisma.account.findUnique({
    where: { id },
    select: { id: true, code: true },
  });
  if (!account) return { ok: false, error: "Account not found." };

  await prisma.account.update({
    where: { id },
    data: { isActive: true },
  });

  revalidateAccountPaths(id);
  return { ok: true, message: `Account ${account.code} reactivated.` };
}

class DuplicateAccountCode extends Error {
  constructor(readonly code: string) {
    super(`Account code ${code} is already in use.`);
  }
}

class InvalidParent extends Error {}
