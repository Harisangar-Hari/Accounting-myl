import { PrismaClient, type AccountType, type NormalBalance } from "@prisma/client";
import { hash } from "bcryptjs";
import { generateEntryNo } from "../lib/accounting/entry-number";

const prisma = new PrismaClient();

interface SeedAccount {
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
}

const ACCOUNTS: SeedAccount[] = [
  // ASSETS (DEBIT)
  { code: "1000", name: "Cash on Hand", type: "ASSET", normalBalance: "DEBIT" },
  { code: "1010", name: "Bank – Main", type: "ASSET", normalBalance: "DEBIT" },
  {
    code: "1100",
    name: "Accounts Receivable",
    type: "ASSET",
    normalBalance: "DEBIT",
  },
  // Phase 3 (AR/AP) — input VAT recovered on purchases.
  {
    code: "1400",
    name: "Input VAT Receivable",
    type: "ASSET",
    normalBalance: "DEBIT",
  },

  // LIABILITIES (CREDIT)
  {
    code: "2000",
    name: "Accounts Payable",
    type: "LIABILITY",
    normalBalance: "CREDIT",
  },
  {
    code: "2100",
    name: "Accrued Expenses",
    type: "LIABILITY",
    normalBalance: "CREDIT",
  },
  // Phase 3 (AR/AP) — output VAT collected on sales. 2200 rather than 2100
  // because 2100 is already Accrued Expenses.
  {
    code: "2200",
    name: "Output VAT Payable",
    type: "LIABILITY",
    normalBalance: "CREDIT",
  },

  // EQUITY (CREDIT)
  {
    code: "3000",
    name: "Owner's Equity",
    type: "EQUITY",
    normalBalance: "CREDIT",
  },
  {
    code: "3100",
    name: "Retained Earnings",
    type: "EQUITY",
    normalBalance: "CREDIT",
  },

  // REVENUE (CREDIT)
  { code: "4000", name: "Contract Revenue", type: "REVENUE", normalBalance: "CREDIT" },
  {
    code: "4100",
    name: "Variation Revenue",
    type: "REVENUE",
    normalBalance: "CREDIT",
  },

  // EXPENSES (DEBIT)
  {
    code: "5000",
    name: "Materials – Cement",
    type: "EXPENSE",
    normalBalance: "DEBIT",
  },
  {
    code: "5010",
    name: "Materials – Steel",
    type: "EXPENSE",
    normalBalance: "DEBIT",
  },
  {
    code: "5020",
    name: "Materials – Aggregate",
    type: "EXPENSE",
    normalBalance: "DEBIT",
  },
  {
    code: "5100",
    name: "Labour – Direct",
    type: "EXPENSE",
    normalBalance: "DEBIT",
  },
  {
    code: "5200",
    name: "Labour – Subcontract",
    type: "EXPENSE",
    normalBalance: "DEBIT",
  },
  {
    code: "5300",
    name: "Equipment Hire",
    type: "EXPENSE",
    normalBalance: "DEBIT",
  },
  {
    code: "5400",
    name: "Site Utilities",
    type: "EXPENSE",
    normalBalance: "DEBIT",
  },
  {
    code: "5500",
    name: "Fuel & Transport",
    type: "EXPENSE",
    normalBalance: "DEBIT",
  },
  {
    code: "5600",
    name: "Site Overheads",
    type: "EXPENSE",
    normalBalance: "DEBIT",
  },
  {
    code: "5900",
    name: "General Admin Expense",
    type: "EXPENSE",
    normalBalance: "DEBIT",
  },
];

const JOBS = [
  {
    code: "JOB-2025-001",
    name: "Highway Extension",
    sites: [
      { code: "HWY-A", name: "Section A – Chainage 0+000" },
      { code: "HWY-B", name: "Section B – Chainage 5+000" },
    ],
  },
  {
    code: "JOB-2025-002",
    name: "Building Complex",
    sites: [
      { code: "BLD-1", name: "Block A" },
      { code: "BLD-2", name: "Block B" },
    ],
  },
];

interface SeedLine {
  accountCode: string;
  /** Integer cents. */
  debitCents?: number;
  creditCents?: number;
  description?: string;
  jobCode?: string;
  siteCode?: string;
}

interface SeedEntry {
  date: string;
  description: string;
  reference: string;
  status: "DRAFT" | "POSTED";
  lines: SeedLine[];
}

const ENTRIES: SeedEntry[] = [
  {
    date: "2026-02-10",
    description: "Cement purchase for Site A",
    reference: "SEED-SUP-1042",
    status: "POSTED",
    lines: [
      {
        accountCode: "5000",
        debitCents: 12_500_000,
        jobCode: "JOB-2025-001",
        siteCode: "HWY-A",
        description: "Cement 250 tonnes",
      },
      { accountCode: "1010", creditCents: 12_500_000 },
    ],
  },
  {
    date: "2026-03-05",
    description: "Steel reinforcement and crane hire — Highway Extension",
    reference: "SEED-SUP-1103",
    status: "POSTED",
    lines: [
      {
        accountCode: "5010",
        debitCents: 35_000_000,
        jobCode: "JOB-2025-001",
        siteCode: "HWY-B",
        description: "Rebar tonnes 40",
      },
      {
        accountCode: "5300",
        debitCents: 2_500_000,
        jobCode: "JOB-2025-001",
        siteCode: "HWY-B",
        description: "Crane hire 2 days",
      },
      { accountCode: "1010", creditCents: 37_500_000 },
    ],
  },
  {
    date: "2026-04-18",
    description: "Subcontract labour — Building Complex",
    reference: "SEED-SUB-2201",
    status: "POSTED",
    lines: [
      {
        accountCode: "5200",
        debitCents: 21_000_000,
        jobCode: "JOB-2025-002",
        siteCode: "BLD-1",
        description: "Concrete frame subcontract",
      },
      { accountCode: "1010", creditCents: 21_000_000 },
    ],
  },
  {
    date: "2026-05-02",
    description: "Aggregate delivery — Building Complex",
    reference: "SEED-SUP-1188",
    status: "DRAFT",
    lines: [
      {
        accountCode: "5020",
        debitCents: 8_725_050,
        jobCode: "JOB-2025-002",
        siteCode: "BLD-2",
        description: "Crushed stone 320 tonnes",
      },
      { accountCode: "1010", creditCents: 8_725_050 },
    ],
  },
  {
    date: "2026-05-09",
    description: "Site utilities — March",
    reference: "SEED-UTIL-0301",
    status: "DRAFT",
    lines: [
      {
        accountCode: "5400",
        debitCents: 1_240_000,
        jobCode: "JOB-2025-001",
        siteCode: "HWY-A",
        description: "Power and water",
      },
      { accountCode: "1000", creditCents: 1_240_000 },
    ],
  },
];

async function main() {
  const passwordHash = await hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: { passwordHash, name: "Admin" },
    create: {
      email: "admin@example.com",
      passwordHash,
      name: "Admin",
    },
  });

  const accountIdByCode = new Map<string, string>();
  for (const account of ACCOUNTS) {
    const record = await prisma.account.upsert({
      where: { code: account.code },
      update: {
        name: account.name,
        type: account.type,
        normalBalance: account.normalBalance,
      },
      create: account,
    });
    accountIdByCode.set(record.code, record.id);
  }

  const jobIdByCode = new Map<string, string>();
  const siteIdByKey = new Map<string, string>();

  for (const job of JOBS) {
    const record = await prisma.job.upsert({
      where: { code: job.code },
      update: { name: job.name },
      create: { code: job.code, name: job.name },
    });
    jobIdByCode.set(record.code, record.id);

    for (const site of job.sites) {
      const siteRecord = await prisma.site.upsert({
        where: { jobId_code: { jobId: record.id, code: site.code } },
        update: { name: site.name },
        create: { jobId: record.id, code: site.code, name: site.name },
      });
      siteIdByKey.set(`${job.code}:${site.code}`, siteRecord.id);
    }
  }

  // Idempotent: replace only the seed's own entries.
  await prisma.journalEntry.deleteMany({
    where: { reference: { startsWith: "SEED-" } },
  });

  for (const entry of ENTRIES) {
    const entryDate = new Date(`${entry.date}T00:00:00.000Z`);

    const debitTotal = entry.lines.reduce(
      (sum, line) => sum + (line.debitCents ?? 0),
      0,
    );
    const creditTotal = entry.lines.reduce(
      (sum, line) => sum + (line.creditCents ?? 0),
      0,
    );
    if (debitTotal !== creditTotal || debitTotal === 0) {
      throw new Error(`Seed entry "${entry.description}" is not balanced.`);
    }

    await prisma.$transaction(async (tx) => {
      const entryNo = await generateEntryNo(tx, entryDate.getUTCFullYear());

      await tx.journalEntry.create({
        data: {
          entryNo,
          entryDate,
          description: entry.description,
          reference: entry.reference,
          status: entry.status,
          entryType: "EXPENSE",
          createdById: admin.id,
          postedAt:
            entry.status === "POSTED"
              ? new Date(`${entry.date}T09:00:00.000Z`)
              : null,
          lines: {
            create: entry.lines.map((line, index) => {
              const accountId = accountIdByCode.get(line.accountCode);
              if (!accountId) {
                throw new Error(
                  `Unknown account code in seed: ${line.accountCode}`,
                );
              }
              const jobId = line.jobCode
                ? jobIdByCode.get(line.jobCode)
                : undefined;
              if (line.jobCode && !jobId) {
                throw new Error(`Unknown job code in seed: ${line.jobCode}`);
              }
              const siteId =
                line.jobCode && line.siteCode
                  ? siteIdByKey.get(`${line.jobCode}:${line.siteCode}`)
                  : undefined;

              return {
                accountId,
                debitCents: line.debitCents ?? 0,
                creditCents: line.creditCents ?? 0,
                description: line.description ?? null,
                jobId: jobId ?? null,
                siteId: siteId ?? null,
                lineNo: index + 1,
              };
            }),
          },
        },
      });
    });
  }

  console.info(
    `Seed complete: 1 user, ${ACCOUNTS.length} accounts, ${JOBS.length} jobs, ${ENTRIES.length} journal entries.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
