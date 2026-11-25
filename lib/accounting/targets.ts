import type { Prisma } from "@prisma/client";
import { AccountingError } from "./errors";

/** A job/site pair a document line is tagged to. */
export interface LineTarget {
  jobId?: string | null;
  siteId?: string | null;
}

/**
 * Re-validates the job/site tags of document lines inside the transaction that
 * writes the entry, so a stale dropdown selection can never produce an
 * invalid ledger entry. Sites must belong to the selected job, and both must be
 * active. Validation is deferred until every id is loaded: one query for jobs,
 * one for sites, regardless of the number of lines.
 */
export async function assertLineTargets(
  tx: Prisma.TransactionClient,
  targets: readonly LineTarget[],
): Promise<void> {
  const jobIds = [
    ...new Set(
      targets
        .map((target) => target.jobId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const siteIds = [
    ...new Set(
      targets
        .map((target) => target.siteId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [jobs, sites] = await Promise.all([
    jobIds.length > 0
      ? tx.job.findMany({
          where: { id: { in: jobIds } },
          select: { id: true, code: true, isActive: true },
        })
      : Promise.resolve([]),
    siteIds.length > 0
      ? tx.site.findMany({
          where: { id: { in: siteIds } },
          select: { id: true, code: true, jobId: true, isActive: true },
        })
      : Promise.resolve([]),
  ]);

  const jobById = new Map(jobs.map((job) => [job.id, job]));
  const siteById = new Map(sites.map((site) => [site.id, site]));

  targets.forEach((target, index) => {
    const label = `Line ${index + 1}`;

    if (target.jobId) {
      const job = jobById.get(target.jobId);
      if (!job) {
        throw new AccountingError(
          "INVALID_JOB",
          `${label}: the selected job no longer exists.`,
        );
      }
      if (!job.isActive) {
        throw new AccountingError(
          "INVALID_JOB",
          `${label}: job ${job.code} is inactive.`,
        );
      }
    }

    if (target.siteId) {
      const site = siteById.get(target.siteId);
      if (!site) {
        throw new AccountingError(
          "INVALID_SITE",
          `${label}: the selected site no longer exists.`,
        );
      }
      if (!site.isActive) {
        throw new AccountingError(
          "INVALID_SITE",
          `${label}: site ${site.code} is inactive.`,
        );
      }
      if (!target.jobId) {
        throw new AccountingError(
          "INVALID_SITE",
          `${label}: select a job before selecting a site.`,
        );
      }
      if (site.jobId !== target.jobId) {
        throw new AccountingError(
          "INVALID_SITE",
          `${label}: site ${site.code} does not belong to the selected job.`,
        );
      }
    }
  });
}

/** Asserts a date is a real Date and the due date is not before the document date. */
export function assertDocumentDates(
  documentDate: Date,
  dueDate: Date,
  labels: { document: string; due: string },
): void {
  if (!Number.isFinite(documentDate.getTime())) {
    throw new AccountingError("INVALID_DATE", `Enter a valid ${labels.document}.`);
  }
  if (!Number.isFinite(dueDate.getTime())) {
    throw new AccountingError("INVALID_DATE", `Enter a valid ${labels.due}.`);
  }
  if (dueDate.getTime() < documentDate.getTime()) {
    throw new AccountingError(
      "INVALID_DATE",
      `The ${labels.due} cannot be before the ${labels.document}.`,
    );
  }
}

/**
 * Loads an account by code inside the transaction, optionally asserting its
 * type. Business documents never take AR/AP/bank account ids from the browser:
 * the codes are fixed by the chart of accounts.
 */
export async function requireAccountByCode(
  tx: Prisma.TransactionClient,
  code: string,
  options: { label: string; type?: "ASSET" | "LIABILITY" | "REVENUE" | "EXPENSE" },
) {
  const account = await tx.account.findUnique({
    where: { code },
    select: { id: true, code: true, name: true, type: true, isActive: true },
  });

  if (!account) {
    throw new AccountingError(
      "ACCOUNT_NOT_FOUND",
      `${options.label} account (${code}) does not exist. Add it to the chart of accounts first.`,
    );
  }
  if (!account.isActive) {
    throw new AccountingError(
      "INVALID_ACCOUNT",
      `${options.label} account ${account.code} ${account.name} is inactive.`,
    );
  }
  if (options.type && account.type !== options.type) {
    throw new AccountingError(
      "INVALID_ACCOUNT",
      `${options.label} account ${account.code} must be a ${options.type} account.`,
    );
  }

  return account;
}
