import { prisma } from "@/lib/db";
import type { AccountOption, JobOption } from "./queries";

/**
 * Options for the invoice and bill forms: active revenue accounts, active
 * expense accounts and active jobs with their active sites.
 */
export async function getDocumentFormOptions(): Promise<{
  revenueAccounts: AccountOption[];
  expenseAccounts: AccountOption[];
  jobs: JobOption[];
}> {
  const [accounts, jobs] = await Promise.all([
    prisma.account.findMany({
      where: { isActive: true, type: { in: ["REVENUE", "EXPENSE"] } },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, type: true },
    }),
    prisma.job.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        sites: {
          where: { isActive: true },
          orderBy: { code: "asc" },
          select: { id: true, code: true, name: true },
        },
      },
    }),
  ]);

  const toOption = (account: { id: string; code: string; name: string }) => ({
    id: account.id,
    code: account.code,
    name: account.name,
  });

  return {
    revenueAccounts: accounts
      .filter((account) => account.type === "REVENUE")
      .map(toOption),
    expenseAccounts: accounts
      .filter((account) => account.type === "EXPENSE")
      .map(toOption),
    jobs,
  };
}
