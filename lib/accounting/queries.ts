import type {
  AccountType,
  EntryStatus,
  EntryType,
  NormalBalance,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { sumCents } from "@/lib/money";

export interface EntryFilters {
  status?: EntryStatus;
  entryType?: EntryType;
  from?: Date | null;
  to?: Date | null;
  limit?: number;
}

export interface EntryListItem {
  id: string;
  entryNo: string;
  entryDate: Date;
  description: string;
  reference: string | null;
  entryType: EntryType;
  status: EntryStatus;
  totalCents: number;
  lineCount: number;
}

/** Lists entries with the entry total (sum of debit cents — entries balance). */
export async function listJournalEntries(
  filters: EntryFilters = {},
): Promise<EntryListItem[]> {
  const where: Prisma.JournalEntryWhereInput = {};

  if (filters.status) where.status = filters.status;
  if (filters.entryType) where.entryType = filters.entryType;
  if (filters.from || filters.to) {
    where.entryDate = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }

  const entries = await prisma.journalEntry.findMany({
    where,
    orderBy: [{ entryDate: "desc" }, { entryNo: "desc" }],
    take: filters.limit ?? 200,
    select: {
      id: true,
      entryNo: true,
      entryDate: true,
      description: true,
      reference: true,
      entryType: true,
      status: true,
      lines: { select: { debitCents: true } },
    },
  });

  return entries.map((entry) => ({
    id: entry.id,
    entryNo: entry.entryNo,
    entryDate: entry.entryDate,
    description: entry.description,
    reference: entry.reference,
    entryType: entry.entryType,
    status: entry.status,
    totalCents: sumCents(entry.lines.map((line) => line.debitCents)),
    lineCount: entry.lines.length,
  }));
}

export async function getJournalEntry(id: string) {
  return prisma.journalEntry.findUnique({
    where: { id },
    select: {
      id: true,
      entryNo: true,
      entryDate: true,
      description: true,
      reference: true,
      status: true,
      entryType: true,
      postedAt: true,
      createdAt: true,
      createdBy: { select: { name: true, email: true } },
      lines: {
        orderBy: { lineNo: "asc" },
        select: {
          id: true,
          lineNo: true,
          debitCents: true,
          creditCents: true,
          description: true,
          account: { select: { code: true, name: true, type: true } },
          job: { select: { code: true, name: true } },
          site: { select: { code: true, name: true } },
        },
      },
    },
  });
}

export interface AccountListFilters {
  type?: AccountType;
  /** Defaults to false: new-entry dropdowns and callers get active accounts. */
  includeInactive?: boolean;
}

export interface AccountListItem {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  isActive: boolean;
  parentId: string | null;
  parentCode: string | null;
  parentName: string | null;
  journalLineCount: number;
}

/**
 * Accounts ordered by code. Active-only by default; the management UI passes
 * { includeInactive: true } explicitly.
 */
export async function listAccounts(
  filters: AccountListFilters = {},
): Promise<AccountListItem[]> {
  const accounts = await prisma.account.findMany({
    where: {
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.includeInactive ? {} : { isActive: true }),
    },
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      normalBalance: true,
      isActive: true,
      parentId: true,
      parent: { select: { code: true, name: true } },
      _count: { select: { journalLines: true } },
    },
  });

  return accounts.map(({ _count, parent, ...account }) => ({
    ...account,
    parentCode: parent?.code ?? null,
    parentName: parent?.name ?? null,
    journalLineCount: _count.journalLines,
  }));
}

/** One account with its parent, children and journal-line count, or null. */
export async function getAccount(id: string) {
  return prisma.account.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      normalBalance: true,
      isActive: true,
      parentId: true,
      createdAt: true,
      parent: {
        select: { id: true, code: true, name: true, type: true },
      },
      children: {
        orderBy: { code: "asc" },
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          isActive: true,
        },
      },
      _count: { select: { journalLines: true } },
    },
  });
}

export interface AccountLineItem {
  id: string;
  lineNo: number;
  debitCents: number;
  creditCents: number;
  description: string | null;
  entryId: string;
  entryNo: string;
  entryDate: Date;
  entryDescription: string;
}

/** Recent POSTED journal lines for an account (newest first). */
export async function getRecentAccountLines(
  accountId: string,
  limit = 20,
): Promise<AccountLineItem[]> {
  const lines = await prisma.journalLine.findMany({
    where: { accountId, journalEntry: { status: "POSTED" } },
    orderBy: [
      { journalEntry: { entryDate: "desc" } },
      { journalEntry: { entryNo: "desc" } },
      { lineNo: "asc" },
    ],
    take: limit,
    select: {
      id: true,
      lineNo: true,
      debitCents: true,
      creditCents: true,
      description: true,
      journalEntry: {
        select: {
          id: true,
          entryNo: true,
          entryDate: true,
          description: true,
        },
      },
    },
  });

  return lines.map(({ journalEntry, ...line }) => ({
    ...line,
    entryId: journalEntry.id,
    entryNo: journalEntry.entryNo,
    entryDate: journalEntry.entryDate,
    entryDescription: journalEntry.description,
  }));
}

export interface AccountOption {
  id: string;
  code: string;
  name: string;
}

export interface SiteOption {
  id: string;
  code: string;
  name: string;
}

export interface JobOption {
  id: string;
  code: string;
  name: string;
  sites: SiteOption[];
}

/** Options for the expense entry form (active accounts and jobs only). */
export async function getEntryFormOptions(): Promise<{
  paymentAccounts: AccountOption[];
  expenseAccounts: AccountOption[];
  jobs: JobOption[];
}> {
  const [accounts, jobs] = await Promise.all([
    prisma.account.findMany({
      where: { isActive: true, type: { in: ["ASSET", "EXPENSE"] } },
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
          // Inactive sites must not appear under an active job's dropdown.
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
    paymentAccounts: accounts
      .filter((account) => account.type === "ASSET")
      .map(toOption),
    expenseAccounts: accounts
      .filter((account) => account.type === "EXPENSE")
      .map(toOption),
    jobs,
  };
}

/** Options for the general journal entry form (all active accounts). */
export async function getGeneralEntryOptions(): Promise<{
  accounts: (AccountOption & { type: AccountType })[];
  jobs: JobOption[];
}> {
  const [accounts, jobs] = await Promise.all([
    prisma.account.findMany({
      where: { isActive: true },
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
          orderBy: { code: "asc" },
          select: { id: true, code: true, name: true },
        },
      },
    }),
  ]);

  return { accounts, jobs };
}

/* -------------------------------------------------------------------------
 * Jobs and sites (Phase 1.5 management UI)
 * ---------------------------------------------------------------------- */

export interface JobListItem {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  customerId: string | null;
  customerCode: string | null;
  customerName: string | null;
  siteCount: number;
  journalLineCount: number;
}

/** Jobs ordered by code, with site and journal-line counts for the list UI. */
export async function listJobs(
  options: { includeInactive?: boolean } = {},
): Promise<JobListItem[]> {
  const jobs = await prisma.job.findMany({
    where: options.includeInactive ? undefined : { isActive: true },
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      isActive: true,
      customer: { select: { id: true, code: true, name: true } },
      _count: { select: { sites: true, lines: true } },
    },
  });

  return jobs.map(({ _count, customer, ...job }) => ({
    ...job,
    customerId: customer?.id ?? null,
    customerCode: customer?.code ?? null,
    customerName: customer?.name ?? null,
    siteCount: _count.sites,
    journalLineCount: _count.lines,
  }));
}

/** A job with its sites (ordered by code) and counts, or null. */
export async function getJob(id: string) {
  return prisma.job.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      name: true,
      isActive: true,
      createdAt: true,
      customer: {
        select: {
          id: true,
          code: true,
          name: true,
          email: true,
          phone: true,
          address: true,
          isActive: true,
        },
      },
      sites: {
        orderBy: { code: "asc" },
        select: {
          id: true,
          code: true,
          name: true,
          isActive: true,
          _count: { select: { lines: true } },
        },
      },
      _count: { select: { sites: true, lines: true } },
    },
  });
}

/** Sites for one job, ordered by code. */
export async function listSitesForJob(
  jobId: string,
  options: { includeInactive?: boolean } = {},
) {
  return prisma.site.findMany({
    where: {
      jobId,
      ...(options.includeInactive ? {} : { isActive: true }),
    },
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      isActive: true,
      jobId: true,
    },
  });
}

/** A site with its job, or null. */
export async function getSite(id: string) {
  return prisma.site.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      name: true,
      isActive: true,
      jobId: true,
      job: {
        select: { id: true, code: true, name: true, isActive: true },
      },
    },
  });
}

export interface SiteListItem {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  jobId: string;
  jobCode: string;
  jobName: string;
  journalLineCount: number;
}

/** All sites across jobs, ordered by job code then site code. */
export async function listAllSites(
  options: { includeInactive?: boolean } = {},
): Promise<SiteListItem[]> {
  const sites = await prisma.site.findMany({
    where: options.includeInactive ? undefined : { isActive: true },
    orderBy: [{ job: { code: "asc" } }, { code: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      isActive: true,
      jobId: true,
      job: { select: { code: true, name: true } },
      _count: { select: { lines: true } },
    },
  });

  return sites.map(({ _count, job, ...site }) => ({
    ...site,
    jobCode: job.code,
    jobName: job.name,
    journalLineCount: _count.lines,
  }));
}

/* -------------------------------------------------------------------------
 * Reporting
 *
 * Financial statements are NOT implemented in this file. They live in
 * `lib/accounting/reports.ts` so transactional reads and aggregations stay
 * separate. Reports group by `JournalEntry.entryDate` (not by `postedAt` and
 * not by the entry-number year, which `generateEntryNo` derives from the
 * entry's own date), include POSTED entries only, and are read-only.
 * ---------------------------------------------------------------------- */

/* -------------------------------------------------------------------------
 * Customers (metadata only — the ledger never references customers)
 * ---------------------------------------------------------------------- */

export interface CustomerListItem {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  jobCount: number;
  /** Number of invoices ever raised for the customer. */
  invoiceCount: number;
  /** Open balance across OPEN / PARTIALLY_PAID / OVERDUE invoices. */
  outstandingCents: number;
}

/**
 * Customers ordered by code, with a job count for the list UI.
 * `search` matches code or name, case-insensitively.
 */
export async function listCustomers(
  options: { includeInactive?: boolean; search?: string } = {},
): Promise<CustomerListItem[]> {
  const search = options.search?.trim();

  const customers = await prisma.customer.findMany({
    where: {
      ...(options.includeInactive ? {} : { isActive: true }),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: "insensitive" as const } },
              { name: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      email: true,
      phone: true,
      isActive: true,
      _count: { select: { jobs: true, invoices: true } },
      invoices: {
        where: { status: { in: ["OPEN", "PARTIALLY_PAID", "OVERDUE"] } },
        select: { totalCents: true, paidCents: true },
      },
    },
  });

  return customers.map(({ _count, invoices, ...customer }) => ({
    ...customer,
    jobCount: _count.jobs,
    invoiceCount: _count.invoices,
    outstandingCents: sumCents(
      invoices.map((invoice) => invoice.totalCents - invoice.paidCents),
    ),
  }));
}

/**
 * A customer with its jobs and AR totals, or null. The open balance is the
 * sum of unpaid invoice balances and is the document-side figure the AR aging
 * report and the Balance Sheet's AR account must agree with.
 */
export async function getCustomer(id: string) {
  const customer = await prisma.customer.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      name: true,
      email: true,
      phone: true,
      address: true,
      taxId: true,
      notes: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      jobs: {
        orderBy: { code: "asc" },
        select: {
          id: true,
          code: true,
          name: true,
          isActive: true,
          createdAt: true,
        },
      },
      _count: { select: { invoices: true, payments: true } },
    },
  });

  if (!customer) return null;

  const outstanding = await prisma.customerInvoice.aggregate({
    where: {
      customerId: id,
      status: { in: ["OPEN", "PARTIALLY_PAID", "OVERDUE"] },
    },
    _sum: { totalCents: true, paidCents: true },
  });

  return {
    ...customer,
    outstandingCents:
      (outstanding._sum.totalCents ?? 0) - (outstanding._sum.paidCents ?? 0),
  };
}

export interface CustomerOption {
  id: string;
  code: string;
  name: string;
}

/** Active customers for the job form dropdown, ordered by code. */
export async function listCustomerOptions(): Promise<CustomerOption[]> {
  return prisma.customer.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });
}

