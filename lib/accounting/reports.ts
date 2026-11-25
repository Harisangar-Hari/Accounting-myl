/**
 * Reporting layer — READ-ONLY aggregations over posted journal lines.
 *
 * Kept separate from `queries.ts`: that file serves transactional screens
 * (lists, detail views), this one serves financial statements. Nothing here
 * writes, and no page performs its own aggregation.
 *
 * Conventions (non-negotiable):
 *  - Only entries with status = POSTED are included. DRAFT entries never appear
 *    in any report.
 *  - The period filters on JournalEntry.entryDate, never on postedAt and never
 *    on the entry-number year. (`generateEntryNo` numbers an entry with the
 *    year of its entryDate, but a back-dated entry is still reported in the
 *    period it is dated, which is why reports group by entryDate.)
 *  - Dates are calendar dates stored as UTC midnight, so `gte`/`lte` on
 *    entryDate compares date-to-date and the `toDate` day is inclusive.
 *  - All money stays in integer cents; formatting happens in the UI only.
 */
import type { AccountType, NormalBalance, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseDateInput, todayDateInput } from "@/lib/dates";
import { sumCents } from "@/lib/money";
import { todayUtc } from "./documents";

export interface ReportPeriod {
  fromDate: Date;
  toDate: Date;
}

/* -------------------------------------------------------------------------
 * Period helpers (shared by the report pages)
 * ---------------------------------------------------------------------- */

/** Today in the server's local calendar, as UTC midnight. */
function today(): Date {
  const parsed = parseDateInput(todayDateInput());
  if (!parsed) throw new Error("Could not resolve today's date.");
  return parsed;
}

/**
 * Resolves report period params. Defaults to the first day of the current
 * month through today; invalid or missing params fall back to the default.
 * A reversed range is normalised rather than rejected.
 */
export function resolveReportPeriod(params: {
  fromDate?: string;
  toDate?: string;
}): ReportPeriod {
  const end = today();
  const defaultFrom = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

  let fromDate = parseDateInput(params.fromDate ?? "") ?? defaultFrom;
  let toDate = parseDateInput(params.toDate ?? "") ?? end;

  if (fromDate.getTime() > toDate.getTime()) {
    [fromDate, toDate] = [toDate, fromDate];
  }

  return { fromDate, toDate };
}

/** Resolves the single "as of" date a balance sheet uses. Defaults to today. */
export function resolveAsOfDate(params: { toDate?: string }): Date {
  return parseDateInput(params.toDate ?? "") ?? today();
}

/* -------------------------------------------------------------------------
 * Shared internals
 * ---------------------------------------------------------------------- */

interface AccountMeta {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
}

/** Posted lines dated inside the period. */
function postedLineWhere({ fromDate, toDate }: ReportPeriod): Prisma.JournalLineWhereInput {
  return {
    journalEntry: {
      status: "POSTED",
      entryDate: { gte: fromDate, lte: toDate },
    },
  };
}

/** Posted lines dated on or before the as-of date. */
function postedLinesToDate(toDate: Date): Prisma.JournalLineWhereInput {
  return {
    journalEntry: {
      status: "POSTED",
      entryDate: { lte: toDate },
    },
  };
}

/**
 * Loads account metadata for a set of ids in one query. Missing accounts mean
 * the database is inconsistent (a line pointing at no account), so we fail
 * loudly instead of silently dropping money from a statement.
 */
async function loadAccounts(ids: string[]): Promise<Map<string, AccountMeta>> {
  if (ids.length === 0) return new Map();

  const accounts = await prisma.account.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      normalBalance: true,
    },
  });

  if (accounts.length !== ids.length) {
    throw new Error(
      "Report failed: journal lines reference accounts that no longer exist.",
    );
  }

  return new Map(accounts.map((account) => [account.id, account]));
}

function requireAccount(
  accounts: Map<string, AccountMeta>,
  accountId: string,
): AccountMeta {
  const account = accounts.get(accountId);
  if (!account) {
    throw new Error(`Report failed: missing account ${accountId}.`);
  }
  return account;
}

function byAccountCode<T extends { accountCode: string }>(a: T, b: T): number {
  return a.accountCode.localeCompare(b.accountCode);
}

/* -------------------------------------------------------------------------
 * Trial balance
 * ---------------------------------------------------------------------- */

export interface TrialBalanceRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  normalBalance: NormalBalance;
  debitCents: number;
  creditCents: number;
  /** debit − credit; negative means a credit balance for the period. */
  netDebitCents: number;
}

export interface TrialBalanceReport {
  rows: TrialBalanceRow[];
  totalDebitCents: number;
  totalCreditCents: number;
}

/**
 * Every account with posted activity in the period (zero-net accounts
 * included), sorted by code. Accounts with no activity are omitted.
 */
export async function getTrialBalance(
  period: ReportPeriod,
): Promise<TrialBalanceReport> {
  const groups = await prisma.journalLine.groupBy({
    by: ["accountId"],
    where: postedLineWhere(period),
    _sum: { debitCents: true, creditCents: true },
  });

  const accounts = await loadAccounts(groups.map((group) => group.accountId));

  const rows = groups
    .map((group) => {
      const account = requireAccount(accounts, group.accountId);
      const debitCents = group._sum.debitCents ?? 0;
      const creditCents = group._sum.creditCents ?? 0;

      return {
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        accountType: account.type,
        normalBalance: account.normalBalance,
        debitCents,
        creditCents,
        netDebitCents: debitCents - creditCents,
      };
    })
    .sort(byAccountCode);

  const totalDebitCents = sumCents(rows.map((row) => row.debitCents));
  const totalCreditCents = sumCents(rows.map((row) => row.creditCents));

  if (totalDebitCents !== totalCreditCents) {
    throw new Error(
      "Trial balance is out of balance: posted debits do not equal posted credits. The ledger is inconsistent.",
    );
  }

  return { rows, totalDebitCents, totalCreditCents };
}

/* -------------------------------------------------------------------------
 * Profit & loss
 * ---------------------------------------------------------------------- */

export interface ProfitAndLossLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  debitCents: number;
  creditCents: number;
  /** Revenue: credit − debit. Expense: debit − credit. */
  netCents: number;
}

export interface ProfitAndLossReport {
  revenueLines: ProfitAndLossLine[];
  totalRevenueCents: number;
  expenseLines: ProfitAndLossLine[];
  totalExpenseCents: number;
  /** totalRevenue − totalExpense; negative is a loss. */
  netProfitCents: number;
}

/** Revenue and expense accounts with activity in the period. */
export async function getProfitAndLoss(
  period: ReportPeriod,
): Promise<ProfitAndLossReport> {
  const groups = await prisma.journalLine.groupBy({
    by: ["accountId"],
    where: {
      ...postedLineWhere(period),
      account: { type: { in: ["REVENUE", "EXPENSE"] } },
    },
    _sum: { debitCents: true, creditCents: true },
  });

  const accounts = await loadAccounts(groups.map((group) => group.accountId));

  const revenueLines: ProfitAndLossLine[] = [];
  const expenseLines: ProfitAndLossLine[] = [];

  for (const group of groups) {
    const account = requireAccount(accounts, group.accountId);
    const debitCents = group._sum.debitCents ?? 0;
    const creditCents = group._sum.creditCents ?? 0;

    const line: ProfitAndLossLine = {
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
      debitCents,
      creditCents,
      netCents: 0,
    };

    if (account.type === "REVENUE") {
      revenueLines.push({ ...line, netCents: creditCents - debitCents });
    } else {
      expenseLines.push({ ...line, netCents: debitCents - creditCents });
    }
  }

  revenueLines.sort(byAccountCode);
  expenseLines.sort(byAccountCode);

  const totalRevenueCents = sumCents(revenueLines.map((line) => line.netCents));
  const totalExpenseCents = sumCents(expenseLines.map((line) => line.netCents));

  return {
    revenueLines,
    totalRevenueCents,
    expenseLines,
    totalExpenseCents,
    netProfitCents: totalRevenueCents - totalExpenseCents,
  };
}

/* -------------------------------------------------------------------------
 * Balance sheet
 * ---------------------------------------------------------------------- */

export interface BalanceSheetAssetRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  /** debit − credit. */
  netDebitCents: number;
}

export interface BalanceSheetCreditRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  /** credit − debit. */
  netCreditCents: number;
}

export interface BalanceSheetReport {
  asOfDate: Date;
  assets: BalanceSheetAssetRow[];
  totalAssetsCents: number;
  liabilities: BalanceSheetCreditRow[];
  totalLiabilitiesCents: number;
  equity: BalanceSheetCreditRow[];
  totalEquityCents: number;
  /** Cumulative revenue − expenses to the as-of date (see note below). */
  retainedEarningsCents: number;
  totalLiabilitiesAndEquityCents: number;
  isBalanced: boolean;
}

/**
 * Balance sheet as of `toDate` (a point in time, not a period).
 *
 * Retained earnings are computed on the fly as all-time cumulative net profit.
 * Phase 1 has no period-closing mechanism that transfers P&L balances into
 * equity, so a balance sheet can only balance if cumulative profit is added to
 * equity here. This is a deliberate simplification, not an oversight: when
 * closing entries are introduced, this line becomes a real equity account.
 */
export async function getBalanceSheet({
  toDate,
}: {
  toDate: Date;
}): Promise<BalanceSheetReport> {
  // One grouping covers every account type: assets, liabilities, equity and
  // the revenue/expense balances that make up retained earnings.
  const groups = await prisma.journalLine.groupBy({
    by: ["accountId"],
    where: postedLinesToDate(toDate),
    _sum: { debitCents: true, creditCents: true },
  });

  const accounts = await loadAccounts(groups.map((group) => group.accountId));

  const assets: BalanceSheetAssetRow[] = [];
  const liabilities: BalanceSheetCreditRow[] = [];
  const equity: BalanceSheetCreditRow[] = [];
  let revenueCents = 0;
  let expenseCents = 0;

  for (const group of groups) {
    const account = requireAccount(accounts, group.accountId);
    const debitCents = group._sum.debitCents ?? 0;
    const creditCents = group._sum.creditCents ?? 0;
    const netDebit = debitCents - creditCents;
    const netCredit = creditCents - debitCents;

    const base = {
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
    };

    switch (account.type) {
      case "ASSET":
        assets.push({ ...base, netDebitCents: netDebit });
        break;
      case "LIABILITY":
        liabilities.push({ ...base, netCreditCents: netCredit });
        break;
      case "EQUITY":
        equity.push({ ...base, netCreditCents: netCredit });
        break;
      case "REVENUE":
        revenueCents += netCredit;
        break;
      case "EXPENSE":
        expenseCents += netDebit;
        break;
    }
  }

  assets.sort(byAccountCode);
  liabilities.sort(byAccountCode);
  equity.sort(byAccountCode);

  const totalAssetsCents = sumCents(assets.map((row) => row.netDebitCents));
  const totalLiabilitiesCents = sumCents(
    liabilities.map((row) => row.netCreditCents),
  );
  const totalEquityCents = sumCents(equity.map((row) => row.netCreditCents));
  const retainedEarningsCents = revenueCents - expenseCents;
  const totalLiabilitiesAndEquityCents =
    totalLiabilitiesCents + totalEquityCents + retainedEarningsCents;

  return {
    asOfDate: toDate,
    assets,
    totalAssetsCents,
    liabilities,
    totalLiabilitiesCents,
    equity,
    totalEquityCents,
    retainedEarningsCents,
    totalLiabilitiesAndEquityCents,
    isBalanced: totalAssetsCents === totalLiabilitiesAndEquityCents,
  };
}

/* -------------------------------------------------------------------------
 * Expenses by job / site
 * ---------------------------------------------------------------------- */

export interface ExpenseGroupRow {
  jobId: string | null;
  jobCode: string | null;
  jobName: string | null;
  siteId: string | null;
  siteCode: string | null;
  siteName: string | null;
  /** For site rows: the job the site belongs to. Null in job mode. */
  parentJobCode: string | null;
  parentJobName: string | null;
  /**
   * Net expense charged to this grouping (expense-account debits less any
   * expense-account credits), so the rows sum to the P&L total expense.
   */
  totalDebitCents: number;
  lineCount: number;
  untagged: boolean;
}

export interface ExpensesByGroupReport {
  rows: ExpenseGroupRow[];
  grandTotalCents: number;
}

interface GroupSums {
  key: string | null;
  totalDebitCents: number;
  lineCount: number;
}

function toGroupSums(
  key: string | null,
  sums: { debitCents: number | null; creditCents: number | null },
  lineCount: number,
): GroupSums {
  const debitCents = sums.debitCents ?? 0;
  const creditCents = sums.creditCents ?? 0;
  return { key, totalDebitCents: debitCents - creditCents, lineCount };
}

/**
 * Expense-account activity for the period grouped by job or by site. Lines
 * without a job (or without a site, in site mode) collapse into one
 * "unallocated" row that is always returned last.
 *
 * `grandTotalCents` is asserted against an independent aggregate of the same
 * expense lines; a mismatch means the grouping dropped or duplicated rows.
 */
export async function getExpensesByJobSite(
  period: ReportPeriod,
  groupBy: "job" | "site",
): Promise<ExpensesByGroupReport> {
  const where: Prisma.JournalLineWhereInput = {
    ...postedLineWhere(period),
    account: { type: "EXPENSE" },
  };

  const groups: GroupSums[] =
    groupBy === "job"
      ? (
          await prisma.journalLine.groupBy({
            by: ["jobId"],
            where,
            _sum: { debitCents: true, creditCents: true },
            _count: { _all: true },
          })
        ).map((group) => toGroupSums(group.jobId, group._sum, group._count._all))
      : (
          await prisma.journalLine.groupBy({
            by: ["siteId"],
            where,
            _sum: { debitCents: true, creditCents: true },
            _count: { _all: true },
          })
        ).map((group) => toGroupSums(group.siteId, group._sum, group._count._all));

  const tagged = groups.filter(
    (group): group is GroupSums & { key: string } => group.key !== null,
  );
  const unallocated = groups.filter((group) => group.key === null);

  const taggedIds = tagged.map((group) => group.key);

  const rows: ExpenseGroupRow[] =
    groupBy === "job"
      ? await buildJobRows(tagged, taggedIds)
      : await buildSiteRows(tagged, taggedIds);

  for (const group of unallocated) {
    rows.push({
      jobId: null,
      jobCode: null,
      jobName: null,
      siteId: null,
      siteCode: null,
      siteName: null,
      parentJobCode: null,
      parentJobName: null,
      totalDebitCents: group.totalDebitCents,
      lineCount: group.lineCount,
      untagged: true,
    });
  }

  const grandTotalCents = sumCents(rows.map((row) => row.totalDebitCents));

  const totals = await prisma.journalLine.aggregate({
    where,
    _sum: { debitCents: true, creditCents: true },
  });
  const expectedTotalCents =
    (totals._sum.debitCents ?? 0) - (totals._sum.creditCents ?? 0);

  if (grandTotalCents !== expectedTotalCents) {
    throw new Error(
      "Expenses by job/site do not reconcile with total expense for the period.",
    );
  }

  return { rows, grandTotalCents };
}

async function buildJobRows(
  groups: GroupSums[],
  jobIds: string[],
): Promise<ExpenseGroupRow[]> {
  const jobs = await prisma.job.findMany({
    where: { id: { in: jobIds } },
    select: { id: true, code: true, name: true },
  });
  const jobById = new Map(jobs.map((job) => [job.id, job]));

  return groups
    .map((group) => {
      const job = group.key ? jobById.get(group.key) : undefined;
      if (!job) {
        throw new Error("Expenses by job: journal line references a missing job.");
      }

      return {
        jobId: job.id,
        jobCode: job.code,
        jobName: job.name,
        siteId: null,
        siteCode: null,
        siteName: null,
        parentJobCode: null,
        parentJobName: null,
        totalDebitCents: group.totalDebitCents,
        lineCount: group.lineCount,
        untagged: false,
      };
    })
    .sort((a, b) => (a.jobCode ?? "").localeCompare(b.jobCode ?? ""));
}

async function buildSiteRows(
  groups: GroupSums[],
  siteIds: string[],
): Promise<ExpenseGroupRow[]> {
  const sites = await prisma.site.findMany({
    where: { id: { in: siteIds } },
    select: {
      id: true,
      code: true,
      name: true,
      job: { select: { code: true, name: true } },
    },
  });
  const siteById = new Map(sites.map((site) => [site.id, site]));

  return groups
    .map((group) => {
      const site = group.key ? siteById.get(group.key) : undefined;
      if (!site) {
        throw new Error("Expenses by site: journal line references a missing site.");
      }

      return {
        jobId: null,
        jobCode: null,
        jobName: null,
        siteId: site.id,
        siteCode: site.code,
        siteName: site.name,
        parentJobCode: site.job.code,
        parentJobName: site.job.name,
        totalDebitCents: group.totalDebitCents,
        lineCount: group.lineCount,
        untagged: false,
      };
    })
    .sort(
      (a, b) =>
        (a.parentJobCode ?? "").localeCompare(b.parentJobCode ?? "") ||
        (a.siteCode ?? "").localeCompare(b.siteCode ?? ""),
    );
}

/* -------------------------------------------------------------------------
 * AR / AP aging and party balances (document-side reports)
 *
 * These read the business documents, not the ledger, which is exactly why
 * they are the independent check on the ledger: the total of unpaid invoices
 * must equal the AR balance on the Balance Sheet (and AP likewise).
 * ---------------------------------------------------------------------- */

export interface AgingBuckets {
  /** Not yet due (or due today). */
  currentCents: number;
  days1To30Cents: number;
  days31To60Cents: number;
  days61To90Cents: number;
  days90PlusCents: number;
  totalCents: number;
}

function emptyBuckets(): AgingBuckets {
  return {
    currentCents: 0,
    days1To30Cents: 0,
    days31To60Cents: 0,
    days61To90Cents: 0,
    days90PlusCents: 0,
    totalCents: 0,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Adds an outstanding amount to the bucket implied by its due date. */
function addToBuckets(
  buckets: AgingBuckets,
  dueDate: Date,
  outstandingCents: number,
  asOfDate: Date,
): void {
  if (outstandingCents <= 0) return;

  const daysPastDue = Math.floor(
    (asOfDate.getTime() - dueDate.getTime()) / DAY_MS,
  );

  if (daysPastDue <= 0) buckets.currentCents += outstandingCents;
  else if (daysPastDue <= 30) buckets.days1To30Cents += outstandingCents;
  else if (daysPastDue <= 60) buckets.days31To60Cents += outstandingCents;
  else if (daysPastDue <= 90) buckets.days61To90Cents += outstandingCents;
  else buckets.days90PlusCents += outstandingCents;

  buckets.totalCents += outstandingCents;
}

export interface ArAgingRow extends AgingBuckets {
  customerId: string;
  customerCode: string;
  customerName: string;
}

export interface ApAgingRow extends AgingBuckets {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
}

export interface AgingReport<Row> {
  asOfDate: Date;
  rows: Row[];
  totals: AgingBuckets;
}

function sumBuckets(rows: AgingBuckets[]): AgingBuckets {
  const totals = emptyBuckets();
  for (const row of rows) {
    totals.currentCents += row.currentCents;
    totals.days1To30Cents += row.days1To30Cents;
    totals.days31To60Cents += row.days31To60Cents;
    totals.days61To90Cents += row.days61To90Cents;
    totals.days90PlusCents += row.days90PlusCents;
    totals.totalCents += row.totalCents;
  }
  return totals;
}

/** Customer × aging bucket for open invoices as of a date. */
export async function getArAging(asOfDate: Date): Promise<AgingReport<ArAgingRow>> {
  const invoices = await prisma.customerInvoice.findMany({
    where: {
      invoiceDate: { lte: asOfDate },
      status: { notIn: ["PAID", "CANCELLED"] },
    },
    select: {
      totalCents: true,
      paidCents: true,
      dueDate: true,
      customer: { select: { id: true, code: true, name: true } },
    },
  });

  const byCustomer = new Map<string, ArAgingRow>();

  for (const invoice of invoices) {
    const customer = invoice.customer;
    let row = byCustomer.get(customer.id);
    if (!row) {
      row = {
        customerId: customer.id,
        customerCode: customer.code,
        customerName: customer.name,
        ...emptyBuckets(),
      };
      byCustomer.set(customer.id, row);
    }
    addToBuckets(
      row,
      invoice.dueDate,
      invoice.totalCents - invoice.paidCents,
      asOfDate,
    );
  }

  const rows = [...byCustomer.values()]
    .filter((row) => row.totalCents > 0)
    .sort(
      (a, b) =>
        b.totalCents - a.totalCents ||
        a.customerCode.localeCompare(b.customerCode),
    );

  return { asOfDate, rows, totals: sumBuckets(rows) };
}

/** Supplier × aging bucket for open bills as of a date. */
export async function getApAging(asOfDate: Date): Promise<AgingReport<ApAgingRow>> {
  const bills = await prisma.supplierBill.findMany({
    where: {
      billDate: { lte: asOfDate },
      status: { notIn: ["PAID", "CANCELLED"] },
    },
    select: {
      totalCents: true,
      paidCents: true,
      dueDate: true,
      supplier: { select: { id: true, code: true, name: true } },
    },
  });

  const bySupplier = new Map<string, ApAgingRow>();

  for (const bill of bills) {
    const supplier = bill.supplier;
    let row = bySupplier.get(supplier.id);
    if (!row) {
      row = {
        supplierId: supplier.id,
        supplierCode: supplier.code,
        supplierName: supplier.name,
        ...emptyBuckets(),
      };
      bySupplier.set(supplier.id, row);
    }
    addToBuckets(
      row,
      bill.dueDate,
      bill.totalCents - bill.paidCents,
      asOfDate,
    );
  }

  const rows = [...bySupplier.values()]
    .filter((row) => row.totalCents > 0)
    .sort(
      (a, b) =>
        b.totalCents - a.totalCents ||
        a.supplierCode.localeCompare(b.supplierCode),
    );

  return { asOfDate, rows, totals: sumBuckets(rows) };
}

export interface PartyBalanceRow {
  id: string;
  code: string;
  name: string;
  invoicedCents: number;
  paidCents: number;
  outstandingCents: number;
}

export interface PartyBalanceReport {
  asOfDate: Date;
  rows: PartyBalanceRow[];
  totalInvoicedCents: number;
  totalPaidCents: number;
  totalOutstandingCents: number;
}

/** Invoiced / paid / outstanding per customer, highest outstanding first. */
export async function getCustomerBalances(
  asOfDate: Date,
): Promise<PartyBalanceReport> {
  const invoices = await prisma.customerInvoice.findMany({
    where: {
      invoiceDate: { lte: asOfDate },
      status: { not: "CANCELLED" },
    },
    select: {
      totalCents: true,
      paidCents: true,
      status: true,
      customer: { select: { id: true, code: true, name: true } },
    },
  });

  const byCustomer = new Map<string, PartyBalanceRow>();

  for (const invoice of invoices) {
    const customer = invoice.customer;
    let row = byCustomer.get(customer.id);
    if (!row) {
      row = {
        id: customer.id,
        code: customer.code,
        name: customer.name,
        invoicedCents: 0,
        paidCents: 0,
        outstandingCents: 0,
      };
      byCustomer.set(customer.id, row);
    }
    row.invoicedCents += invoice.totalCents;
    row.paidCents += invoice.paidCents;
    if (invoice.status !== "PAID") {
      row.outstandingCents += invoice.totalCents - invoice.paidCents;
    }
  }

  const rows = [...byCustomer.values()].sort(
    (a, b) =>
      b.outstandingCents - a.outstandingCents ||
      a.code.localeCompare(b.code),
  );

  return {
    asOfDate,
    rows,
    totalInvoicedCents: sumCents(rows.map((row) => row.invoicedCents)),
    totalPaidCents: sumCents(rows.map((row) => row.paidCents)),
    totalOutstandingCents: sumCents(rows.map((row) => row.outstandingCents)),
  };
}

/** Billed / paid / outstanding per supplier, highest outstanding first. */
export async function getSupplierBalances(
  asOfDate: Date,
): Promise<PartyBalanceReport> {
  const bills = await prisma.supplierBill.findMany({
    where: {
      billDate: { lte: asOfDate },
      status: { not: "CANCELLED" },
    },
    select: {
      totalCents: true,
      paidCents: true,
      status: true,
      supplier: { select: { id: true, code: true, name: true } },
    },
  });

  const bySupplier = new Map<string, PartyBalanceRow>();

  for (const bill of bills) {
    const supplier = bill.supplier;
    let row = bySupplier.get(supplier.id);
    if (!row) {
      row = {
        id: supplier.id,
        code: supplier.code,
        name: supplier.name,
        invoicedCents: 0,
        paidCents: 0,
        outstandingCents: 0,
      };
      bySupplier.set(supplier.id, row);
    }
    row.invoicedCents += bill.totalCents;
    row.paidCents += bill.paidCents;
    if (bill.status !== "PAID") {
      row.outstandingCents += bill.totalCents - bill.paidCents;
    }
  }

  const rows = [...bySupplier.values()].sort(
    (a, b) =>
      b.outstandingCents - a.outstandingCents ||
      a.code.localeCompare(b.code),
  );

  return {
    asOfDate,
    rows,
    totalInvoicedCents: sumCents(rows.map((row) => row.invoicedCents)),
    totalPaidCents: sumCents(rows.map((row) => row.paidCents)),
    totalOutstandingCents: sumCents(rows.map((row) => row.outstandingCents)),
  };
}

/** Net balance (debits − credits) of one account from POSTED lines to a date. */
export async function getAccountBalanceByCode(
  code: string,
  asOfDate: Date,
): Promise<number | null> {
  const account = await prisma.account.findUnique({
    where: { code },
    select: { id: true },
  });
  if (!account) return null;

  const sums = await prisma.journalLine.aggregate({
    where: {
      accountId: account.id,
      journalEntry: { status: "POSTED", entryDate: { lte: asOfDate } },
    },
    _sum: { debitCents: true, creditCents: true },
  });

  return (sums._sum.debitCents ?? 0) - (sums._sum.creditCents ?? 0);
}

/** Resolves the single "as of" date an aging report uses. Defaults to today. */
export function resolveAgingAsOfDate(params: { asOfDate?: string }): Date {
  return parseDateInput(params.asOfDate ?? "") ?? todayUtc();
}
