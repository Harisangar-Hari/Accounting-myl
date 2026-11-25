# Ledger — Construction Accounting · Project Handoff

> **Snapshot:** Phases 1 → 3 complete (General Ledger, Jobs/Sites, Customers, AR/AP).
> `tsc`, ESLint and `next build` pass; 20/20 accounting verification checks passed.
> Nothing is committed yet (only the original CRA commit exists in git history).
> Dev server runs at `http://localhost:3000`.

---

## 1. What this project is

A double-entry accounting system for a construction company, built as a server-rendered
Next.js app on PostgreSQL. It is intentionally **not** a generic ERP: the ledger is
the core, and business documents (invoices, bills, receipts, payments) are thin,
immutable records whose only job is to post a correct, balanced journal entry and
keep a document-level subledger for AR/AP.

### Delivered scope

| Phase | Delivered |
| --- | --- |
| 1 | Auth (credentials + JWT), chart of accounts, journal entries (draft/post), general journal form, expense form, dashboard |
| 1.5 | Chart-of-accounts editing (create / edit / deactivate / reactivate), account detail with recent lines |
| 2 | Jobs and sites (CRUD + active flags), job/site tags on journal lines |
| 2.5 | Customers (CRUD), job → customer link, read-only parent context on child forms |
| 3 | Suppliers, customer invoices + receipts, supplier bills + payments, allocations, AR/AP aging, customer/supplier balance reports |

### Deliberately out of scope (not bugs)

- No credit notes, no document amendment, no void/reversal UI — posted documents are immutable.
- No drafts for AR/AP documents (journal entries can be drafts; documents cannot).
- No unallocated customer credit / prepayments (every receipt must be fully allocated).
- No per-customer or per-supplier ledger accounts (`JournalLine` has no `customerId`).
- No period close, no retained-earnings account (computed on the fly), no bank reconciliation.
- No CSV/PDF export; printing uses the browser dialog.
- No audit log, no multi-company, no approvals workflow.

---

## 2. Stack & environment

| Concern | Choice |
| --- | --- |
| Framework | Next.js **16.4.6** App Router (note: `middleware.ts` is now `proxy.ts`) |
| Language | TypeScript (strict) |
| UI | Tailwind CSS v4, shadcn/ui components, lucide-react, sonner |
| Forms | React Hook Form + Zod |
| Data | Prisma 6.19 + PostgreSQL |
| Auth | Auth.js / NextAuth v5 beta, Credentials provider, JWT sessions (8 h) |
| Mutations | Server Actions (only one route handler: `api/auth/[...nextauth]`) |
| Email | Nodemailer, stub when SMTP unset (password-reset OTP plumbing only) |

### Environment variables (`.env`)

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/accounting_myl?schema=public"
NEXTAUTH_SECRET="<openssl rand -base64 32>"
NEXTAUTH_URL="http://localhost:3000"
# optional: AUTH_SECRET / AUTH_URL (same value as NEXTAUTH_*)
# optional SMTP_* for OTP email; blank = console stub
```

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `npm start` | Production build / server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:migrate` / `db:deploy` | Prisma migrate dev / deploy |
| `npm run db:seed` | Seed (idempotent) |
| `npm run db:reset` | Drop + migrate + seed |
| `npm run db:studio` | Prisma Studio |

**Local DB on this machine:** PostgreSQL at `localhost`, database `accounting_myl`,
user `postgres`, no password. CLI:
`/c/pgsql/bin/psql -U postgres -h localhost -d accounting_myl`.

**Seeded login:** `admin@example.com` / `admin123`.

### Windows gotchas

- Stop the dev server before `prisma migrate` / `next build` — the running server holds
  files in `.next` and Prisma's client DLL, producing `EPERM`/lock errors.
- The dev server writes `.dev-server.log` in the project root when started this way.
- Use exactly the origin in `NEXTAUTH_URL` (`http://localhost:3000`). Browsing via
  `127.0.0.1` on this setup triggers Next's dev cross-origin guard and breaks hydration
  (the login form then submits as a native GET).

---

## 3. Core accounting invariants

These rules are the contract for every future change.

1. **Money is integer cents** (`Int` columns). Never `Float`/`Decimal`. `lib/money.ts` is
   the only parser/formatter: `toCents()` rejects negatives, >2 decimals, exponents,
   empty strings and out-of-Int32-range values; `formatCents()` uses integer math.
2. **Balance is asserted inside the transaction**, immediately before insert:
   `assertBalanced(lines)` requires ≥2 lines, one and only one of debit/credit > 0 per
   line (XOR), non-negative integer amounts, and total debits === total credits > 0.
3. **One write path**: `writeEntry(tx, header, lines)` in `lib/accounting/journal.ts`
   allocates the entry number and creates header + lines atomically in the caller's
   transaction. AR/AP code never touches `prisma.journalEntry.create` directly.
4. **Numbering is atomic**: `generateEntryNo(tx, year)` and `generateDocNo(tx, prefix, year)`
   use a single `INSERT … ON CONFLICT DO UPDATE … RETURNING` on `EntrySequence` /
   `DocSequence`, so concurrent submissions cannot share a number.
   `JE-YYYY-0000` (4 digits), documents `INV|BILL|RCPT|PAY-YYYY-0001`.
5. **Posted = immutable.** `assertEntryMutable()` throws for any mutation of a POSTED
   entry; there is no update/delete action for entries or for AR/AP documents.
   Posting uses `updateMany({ where: { status: "DRAFT" } })` so two concurrent posts
   cannot both win.
6. **Date convention:** all accounting dates are calendar dates stored as UTC midnight.
   Reports filter by `JournalEntry.entryDate` (`gte`/`lte`, inclusive `toDate`), never by
   `postedAt` and never by the year inside the entry number.
7. **Overdue is computed, never stored.** Stored status is only OPEN / PARTIALLY_PAID /
   PAID (CANCELLED reserved). Overdue = `dueDate < today` and status not PAID/CANCELLED
   (`lib/accounting/documents.ts`).
8. **Documents are the AR/AP subledger.** Each document row and its journal entry commit
   together or not at all, linked by unique `journalEntryId`.
9. **The reconciliation invariant:** Balance-Sheet 1100 = AR Aging total (documents) and
   Balance-Sheet 2000 = AP Aging total. Both are computed independently on purpose; the
   aging pages show ledger balance, document total and the difference plus a badge.
10. **Account codes are wiring, not user input.** AR (1100), AP (2000), Output VAT (2200),
    Input VAT (1400), Cash (1000) and Bank (1010) are resolved by `Account.code` inside
    the transaction (`requireAccountByCode`). A missing/inactive account blocks the document.

---

## 4. Data model (`prisma/schema.prisma`)

### Master data

| Model | Key fields | Notes |
| --- | --- | --- |
| `User` | email, passwordHash (bcrypt), name | JWT sessions; single seeded admin |
| `Account` | code (unique), name, type, normalBalance, isActive, parentId | 21 seeded accounts 1000–5900; optional parent/child tree |
| `Customer` | code (unique, immutable), name, email/phone/address/taxId, isActive | No ledger account; tracking is document-level |
| `Supplier` | code, name, contact fields, isActive | Same pattern as customers |
| `Job` | code, name, isActive, customerId? | Tags journal lines and document lines |
| `Site` | code (unique per job), name, jobId, isActive | Validated against the selected job |

### Ledger

| Model | Notes |
| --- | --- |
| `JournalEntry` | entryNo, entryDate, description, reference, status (DRAFT/POSTED), entryType (GENERAL/EXPENSE), postedAt, createdById; inverse 1:1 relations to the four document types |
| `JournalLine` | accountId, debitCents, creditCents, description, jobId?, siteId?, lineNo; cascade delete with the entry |
| `EntrySequence` | per-year `lastNo` for `JE-` numbers |
| `DocSequence` | keyed `PREFIX-year`, `lastNo` for document numbers |

### AR documents

| Model | Notes |
| --- | --- |
| `CustomerInvoice` | invoiceNo, customerId, invoiceDate, dueDate, subtotal/tax/total/paid cents, status, journalEntryId |
| `CustomerInvoiceLine` | description, revenueAccountId (must be REVENUE), amount, tax, jobId?, siteId?, lineNo |
| `CustomerPayment` | paymentNo, customerId, paymentDate, amount, method (CASH/BANK/CHEQUE), reference, notes, journalEntryId |
| `CustomerPaymentAllocation` | paymentId + invoiceId (unique pair), amount — must sum exactly to the payment |

### AP documents

| Model | Notes |
| --- | --- |
| `SupplierBill` | billNo, supplierRef?, supplierId, billDate, dueDate, subtotal/tax/total/paid, status, journalEntryId |
| `SupplierBillLine` | description, expenseAccountId (must be EXPENSE), amount, tax, job/site tags |
| `SupplierPayment` | paymentNo, supplierId, paymentDate, amount, method, reference, notes, journalEntryId |
| `SupplierPaymentAllocation` | paymentId + billId (unique pair), amount |

### Enums

`AccountType` (ASSET/LIABILITY/EQUITY/REVENUE/EXPENSE), `NormalBalance` (DEBIT/CREDIT),
`EntryStatus` (DRAFT/POSTED), `EntryType` (GENERAL/EXPENSE), `InvoiceStatus` and
`BillStatus` (OPEN/PARTIALLY_PAID/PAID/OVERDUE/CANCELLED), `PaymentMethod` (CASH/BANK/CHEQUE).

### Migrations (in order)

1. `20261123050458_init`
2. `20261123100335_add_site_is_active`
3. `20261124074303_add_customers`
4. `20261124095126_add_ar_ap`

---

## 5. Feature inventory & workflows

Every Server Action begins with `requireAuth()` (except `loginAction`), validates with Zod,
calls an accounting/library function, revalidates affected paths, and redirects with a
`?created=<number>` or `?saved=…` query parameter that the page turns into a toast.

### 5.1 Authentication

- Routes: `/login` (public), all app routes protected.
- `proxy.ts` (Next 16 middleware) runs the edge-safe `authConfig`; logged-out users are
  redirected to `/login`, logged-in users are bounced off `/login`.
- `PROTECTED_PATHS` in `lib/auth.config.ts` lists every protected prefix:
  `/dashboard`, `/accounts`, `/journal`, `/expenses`, `/jobs`, `/sites`, `/customers`,
  `/suppliers`, `/invoices`, `/bills`, `/payments`, `/supplier-payments`, `/reports`.
- JWT session, 8-hour lifetime, `trustHost: true`, bcrypt password hashes.
- The proxy is a routing guard only — authorization is always re-checked in the action/page.

### 5.2 Chart of accounts

- Routes: `/accounts`, `/accounts/new`, `/accounts/[id]`, `/accounts/[id]/edit`.
- Workflow: create account (code/name/type/normal balance/parent) → edit metadata →
  deactivate/reactivate from the detail page.
- Deactivation is soft (`isActive=false`); posted history remains. Inactive accounts are
  rejected by every posting path (expense lines, revenue/expense document lines, cash/bank).
- Account detail shows the account, its status and recent journal lines.

### 5.3 Journal (general entries)

- Routes: `/journal` (filterable list), `/journal/new` (general journal form),
  `/journal/[id]` (detail with lines, status, post action).
- Workflow: build ≥2 lines (account, debit or credit, optional job/site/description) →
  save as DRAFT or POST → posting stamps `postedAt` and makes it immutable.
- `createGeneralEntry` → `writeEntry` in one transaction; `postJournalEntry` flips DRAFT→POSTED.
- Drafts appear on the dashboard but are excluded from every report.

### 5.4 Expenses

- Routes: `/expenses`, `/expenses/new`.
- Workflow: date, description, reference → one or more expense lines (expense account,
  amount, job/site, description) → one payment line (cash or bank account) →
  Debit expense accounts, Credit cash/bank. Posts immediately (POSTED, `entryType=EXPENSE`).
- All account/job/site references are re-validated inside the transaction.

### 5.5 Jobs

- Routes: `/jobs`, `/jobs/new`, `/jobs/[id]`, `/jobs/[id]/edit`.
- Workflow: create with code/name/optional customer → edit → deactivate/reactivate.
- Job detail lists its sites and shows the linked customer; status changes are soft.
- Jobs tag journal lines and document lines for job-cost reporting.

### 5.6 Sites

- Routes: `/sites` (all sites), `/jobs/[id]/sites/new`, `/jobs/[id]/sites/[siteId]/edit`.
- Workflow: create under a job; the form shows the job (and its customer, read-only) as
  parent context, never editable fields. Site code is unique per job, not globally.
- Site must belong to the selected job — enforced in the UI (site select disabled until a
  job is chosen) **and** re-checked server-side (`INVALID_SITE`).

### 5.7 Customers

- Routes: `/customers`, `/customers/new`, `/customers/[id]`, `/customers/[id]/edit`.
- List columns: code, name, email, phone, jobs, **outstanding**, status, actions.
- Detail page: contact block, outstanding card (open balances across invoices/receipts),
  recent invoices, recent receipts, linked jobs, timestamps, plus **New Invoice** and
  **Record Payment** buttons.
- Workflow: create → edit contact data → attach jobs → deactivate/reactivate (soft).
- Code is immutable after creation; inactive customers cannot receive new invoices or
  receipts.

### 5.8 Suppliers

- Routes: `/suppliers`, `/suppliers/new`, `/suppliers/[id]`, `/suppliers/[id]/edit`.
- Mirrors customers: list with bills + outstanding, detail with contact block, outstanding,
  recent bills, recent payments, **New Bill** and **Record Payment** actions, soft status.

### 5.9 Customer invoices (AR)

- Routes: `/invoices` (global, status tabs + search), `/customers/[id]/invoices` (scoped),
  `/customers/[id]/invoices/new`, `/customers/[id]/invoices/[invoiceId]`.
- Create workflow (`InvoiceForm` → `createCustomerInvoiceAction`):
  1. Customer (read-only, from the route), invoice date, due date (default +30 days), description.
  2. One or more lines: description, **revenue account**, amount, tax, optional job/site.
  3. Live subtotal / tax / total preview.
  4. Server: transaction → re-fetch active customer, dates, lines, accounts (REVENUE + active),
     job/site targets → totals → `generateDocNo(tx,"INV",year)` → `writeEntry` →
     invoice row with `journalEntryId`.
  5. Journal: **Debit 1100 AR (total)**; **Credit each line's revenue account (amount)**;
     **Credit 2200 Output VAT (total tax)** only when tax > 0.
  6. Redirect to the detail page, which shows lines, totals, journal entry link and
     immutable notice.
- Detail shows invoice header, lines, subtotal/tax/total, outstanding, the generated
  journal entry, and (when payments exist) allocations.
- No edit or delete route exists by design.

### 5.10 Customer receipts

- Routes: `/payments` (global), `/customers/[id]/payments` (scoped),
  `/customers/[id]/payments/new`, `/customers/[id]/payments/[paymentId]`.
- Create workflow (`CustomerPaymentForm`):
  1. Payment date, amount, method (CASH→1000, BANK/CHEQUE→1010), reference, notes.
  2. The form lists the customer's open invoices with due date and remaining balance;
     allocations are held in local state. The submit button is disabled until
     allocated === received (a "Fully allocated ✓" indicator shows the state).
  3. Server re-validates: amount > 0, invoice belongs to this customer, invoice not
     PAID/CANCELLED, allocation ≤ remaining, sum === amount, no duplicate invoice rows,
     all in one transaction with a `paidCents` guard so concurrent payments cannot clobber.
  4. Journal: **Debit 1000/1010**; **Credit 1100 AR (amount)**.
  5. Invoice status recomputed: PAID when `paidCents = totalCents`, else PARTIALLY_PAID.
  6. Redirect to the receipt detail (allocations + journal entry).

### 5.11 Supplier bills (AP)

- Routes: `/bills` (global), `/suppliers/[id]/bills`, `/suppliers/[id]/bills/new`,
  `/suppliers/[id]/bills/[billId]`.
- Workflow (`BillForm`): supplier (read-only), bill date, due date, optional supplier
  reference, description, lines (description, **expense account**, amount, tax, job/site).
- Journal: **Debit each line's expense account**; **Debit 1400 Input VAT** (tax > 0);
  **Credit 2000 AP (total)**. Entry reference is the supplier reference when provided.
- Same immutability and numbering rules as invoices (`BILL-YYYY-0001`).

### 5.12 Supplier payments

- Routes: `/supplier-payments` (global), `/suppliers/[id]/payments`,
  `/suppliers/[id]/payments/new`, `/suppliers/[id]/payments/[paymentId]`.
- Mirrors receipts against open bills: exact allocation, same-supplier only, no overpay.
- Journal: **Debit 2000 AP**; **Credit 1000/1010**.
- Bill status progresses OPEN → PARTIALLY_PAID → PAID (`PAY-YYYY-0001`).

### 5.13 Dashboard

- Route: `/dashboard`.
- Counts for draft entries, posted entries and active accounts, plus the six most recent
  journal entries and shortcuts to record an expense / view the journal.

### 5.14 Reports (all read-only, `/reports`)

| Report | Route | Period params | Content |
| --- | --- | --- | --- |
| Trial Balance | `/reports/trial-balance` | `fromDate`, `toDate` | Debits/credits and balance per account; equality check |
| Profit & Loss | `/reports/profit-and-loss` | `fromDate`, `toDate` | Revenue, expenses, net profit |
| Balance Sheet | `/reports/balance-sheet` | `toDate` | Assets / liabilities / equity; retained earnings computed from cumulative P&L |
| Expenses by Job | `/reports/expenses-by-job` | `fromDate`, `toDate` | Expense lines grouped by job, "Unallocated" row |
| Expenses by Site | `/reports/expenses-by-site` | `fromDate`, `toDate` | Same by site |
| AR Aging | `/reports/ar-aging` | `asOfDate` | Unpaid invoice balances in Current / 1–30 / 31–60 / 61–90 / 90+ buckets by **due date**, plus ledger 1100, document total and difference |
| AP Aging | `/reports/ap-aging` | `asOfDate` | Same for bills vs ledger 2000 |
| Customer Balances | `/reports/customer-balances` | `asOfDate` | Invoiced / paid / outstanding per customer, highest first |
| Supplier Balances | `/reports/supplier-balances` | `asOfDate` | Billed / paid / outstanding per supplier |

Conventions:
- Every report filters `status = POSTED`; drafts never appear.
- Defaults: first day of the current month → today (as-of = today for aging/balances).
- All aggregation lives in `lib/accounting/reports.ts`; pages never query Prisma directly.
- Printing: nav and period picker are `print:hidden`; each report renders a print-only
  header with `COMPANY_NAME` (default "Construction Company"), title, period and generated date.
- Reconciliation badges: `ReconcilesBadge` shows "… ✓" when OK, otherwise a destructive
  badge (`failLabel`, e.g. "AR ledger differs" for aging) plus an explanatory paragraph.

---

## 6. End-to-end example (what a correct cycle looks like)

Test cycle used during verification (values in the app's cents model):

1. **Invoice** INV-2026-0001 for customer A: line 100,000 + VAT 18,000 → total 118,000.
   Entry: Dr 1100 118,000 / Cr 4000 100,000 / Cr 2200 18,000.
   AR aging total = 118,000 = increase in ledger 1100.
2. **Receipt** RCPT-2026-0001 for 50,000 allocated entirely to that invoice.
   Entry: Dr 1010 50,000 / Cr 1100 50,000. Invoice → PARTIALLY_PAID, outstanding 68,000.
   AR aging and ledger delta both = 68,000.
3. **Bill** BILL-2026-0001 from supplier: line 30,000 + VAT 5,400 → total 35,400.
   Entry: Dr 5000 30,000 / Dr 1400 5,400 / Cr 2000 35,400. AP aging = 35,400.
4. **Supplier payment** PAY-2026-0001 for 35,400 allocated to that bill.
   Entry: Dr 2000 35,400 / Cr 1010 35,400. Bill → PAID, AP aging = 0.
5. **Balance Sheet** stays balanced (assets = liabilities + equity) and 1100/2000 agree
   with the two aging reports.

---

## 7. Security & authorization

- Route protection: `proxy.ts` + `PROTECTED_PATHS` (see 5.1).
- `requireAuth()` is the first statement of every Server Action except login.
- All references are re-validated inside the writing transaction (accounts active and of the
  right type, parties active, jobs/sites active and consistent) — form values are never trusted.
- Control accounts (1100/1400/2000/2200/1000/1010) come from account codes on the server.
- No document edit/delete routes; posted entries reject mutation at the domain layer.
- Passwords bcrypt-hashed; sessions are signed JWTs; no secrets in client code.

---

## 8. Code structure

```
app/
  (auth)/login/page.tsx
  (app)/layout.tsx                     AppShell + auth session
  (app)/dashboard/page.tsx
  (app)/accounts/…                     list, new, [id], [id]/edit
  (app)/journal/…                      list, new, [id]
  (app)/expenses/…                     list, new
  (app)/jobs/…                         list, new, [id], [id]/edit, [id]/sites/{new,[siteId]/edit}
  (app)/sites/page.tsx
  (app)/customers/…                    list, new, [id], [id]/edit,
                                       [id]/invoices/{,[invoiceId],new},
                                       [id]/payments/{,[paymentId],new}
  (app)/suppliers/…                    list, new, [id], [id]/edit,
                                       [id]/bills/{,[billId],new},
                                       [id]/payments/{,[paymentId],new}
  (app)/invoices/page.tsx              global invoice list
  (app)/bills/page.tsx                 global bill list
  (app)/payments/page.tsx              global receipt list
  (app)/supplier-payments/page.tsx     global supplier payment list
  (app)/reports/…                      hub + 9 reports
  api/auth/[...nextauth]/route.ts
components/
  app-shell.tsx                        header nav (11 items), account menu
  ui/                                  shadcn primitives
  forms/                               account, job, site, customer, supplier,
                                       expense, general entry, invoice, bill,
                                       customer-payment, supplier-payment
  documents/                           invoice/bill/payment tables, status badge,
                                       status tabs, search input
  entries/                             entry table, filters, post button, created toast
  reports/                             period picker, print header, reconcile badges
  accounts/ customers/ jobs/ suppliers/  status toggle buttons
lib/
  db.ts            Prisma singleton
  auth.ts          NextAuth config (Credentials) + requireAuth()
  auth.config.ts   edge-safe config + PROTECTED_PATHS
  money.ts         integer-cents parse/format
  dates.ts         UTC calendar-date helpers (incl. addDaysInput)
  email.ts         Nodemailer OTP sender (stub without SMTP)
  utils.ts         cn()
  validators/      zod schemas: auth, accounts, jobs, sites, customers, suppliers,
                   journal, ar, ap
  actions/         server actions: accounts, jobs, sites, customers, suppliers,
                   entries, ar, ap, auth, result helpers
  accounting/
    validate.ts       assertBalanced + line types
    entry-number.ts   atomic JE numbering
    doc-number.ts     atomic INV/BILL/RCPT/PAY numbering
    journal.ts        writeEntry, createJournalEntry, postJournalEntry
    immutability.ts   assertEntryMutable
    errors.ts         AccountingError + codes
    expenses.ts       createExpenseEntry
    general.ts        createGeneralEntry
    targets.ts        assertLineTargets, assertDocumentDates, requireAccountByCode
    documents.ts      overdue/status labels, status filters, todayUtc
    ar.ts             createCustomerInvoice, createCustomerPayment
    ap.ts             createSupplierBill, createSupplierPayment
    queries.ts        ledger reads: entries, accounts, jobs, sites, customers
    ar-queries.ts     invoices, receipts, open invoices
    ap-queries.ts     suppliers, bills, payments, open bills
    document-options.ts  form option lists for document forms
    reports.ts        all 9 reports + balance-by-code + as-of resolution
prisma/
  schema.prisma      models + enums
  seed.ts            idempotent seed (admin, 21 accounts, 2 jobs, 4 sites, 5 entries)
  migrations/        4 migrations
proxy.ts             Next 16 route guard (renamed middleware)
```

### Layering rule

`page.tsx` (server component) → `lib/accounting/*-queries.ts` or `reports.ts` for reads →
`components/*` for rendering. Writes go `form` → `lib/actions/*` → `lib/accounting/*` →
`writeEntry`. No page or component talks to Prisma directly except the dashboard counts
and account detail helper queries.

---

## 9. Validation & error codes

Domain errors are `AccountingError` with a code (safe to surface):

`UNBALANCED_ENTRY`, `INVALID_LINE`, `INVALID_AMOUNT`, `EMPTY_ENTRY`, `INVALID_DATE`,
`INVALID_YEAR`, `INVALID_ACCOUNT`, `INVALID_JOB`, `INVALID_SITE`, `IMMUTABLE_ENTRY`,
`ENTRY_NOT_FOUND`, `SEQUENCE_FAILURE`, `ACCOUNT_NOT_FOUND`, `DOCUMENT_NOT_FOUND`,
`INVALID_DOCUMENT`, `INVALID_PARTY`, `AR_ALLOCATION_MISMATCH`, `AP_ALLOCATION_MISMATCH`,
`ALLOCATION_EXCEEDS_BALANCE`, `DUPLICATE_ALLOCATION`.

Server Actions return `ActionResult` (`{ok:true, documentNo?, documentId?}` or
`{ok:false, message, fieldErrors?}`) and map Zod issues to per-field errors.

---

## 10. Verification record

Run during Phase 3 through a temporary route (`/api/verify-phase3`, since deleted) against
the real dev server and database. Result: **20/20 passing**, `tsc` 0, ESLint 0,
`next build` 0.

| # | Check |
| --- | --- |
| 2 | Invoice posts a balanced entry (AR 118,000 / Revenue 100,000 / VAT 18,000) |
| 2b | Invoice appears in the invoice list and the journal |
| 19 | Trial balance is balanced (debits = credits) |
| 3 | AR aging total equals the AR ledger increase (118,000) |
| 3b | Customer balance outstanding equals invoice balance |
| 5 | Receipt makes the invoice PARTIALLY_PAID and posts Bank/AR entry |
| 5b | AR aging and AR ledger delta both fall to 68,000 |
| 7 | Bill posts expense + input VAT and AP equals aging (35,400) |
| 9 | Supplier payment fully pays the bill and clears AP |
| 10 | Balance Sheet balances and reconciles with AR/AP |
| 11 | Allocation sum above the payment amount is rejected |
| 12 | Allocating another customer's invoice is rejected |
| 13 | Overpaying an invoice is rejected |
| 14 | Non-revenue account on an invoice is rejected |
| 15 | Site from another job is rejected |
| 16 | Manual entry stays in the journal and creates no document |
| 17 | All entry numbers are unique |
| 18 | No edit route exists for posted invoices |
| 19b | Every posted entry is internally balanced |
| 20 | Phase 2 reports reconcile after AR/AP postings |

**Why ledger-vs-aging uses a delta baseline:** the live database already contains two
manual entries created outside the document flows:

- `JE-2026-0013` — "Cement purchased on credit from supplier" (ref `test ref03`), credits
  2000 by 150,000.
- `JE-2026-0014` — "Invoice issued for contract milestone" (ref `test ref04`), debits 1100
  by 300,000.

These are user data and must not be deleted. They make absolute ledger-vs-aging differ by
300,000 / 150,000 with zero documents, so the checks compare the **document delta** against
a baseline captured first. The aging pages explain manual entries as a cause of differences
and label the badge "AR/AP ledger differs" (not "out of balance" — the ledger itself balances).

**Cleanup:** the verification data (parties `CUST-VERIFY-A/B`, `SUP-VERIFY`, all test
documents and their entries, the manual test entry, `DocSequence` rows) was removed and the
temporary route deleted. One cleanup bug was found and fixed: bill entries carry the
supplier's reference, not the `BILL-…` number, so reference-prefix cleanup missed them.
Cleanup now collects entries through their documents (and by document/description) and then
deletes them by id. A full re-run + cleanup left the database exactly at its pre-test state.

---

## 11. Current database state

| Table | Count |
| --- | --- |
| Users | 1 (`admin@example.com`) |
| Accounts | 21 |
| Jobs | 3 |
| Sites | 5 |
| Customers | 1 (`CUST-01`, real user data) |
| Suppliers | 0 |
| Journal entries | 13 (11 posted, 2 draft) — includes the user's manual entries above |
| Invoices / receipts / bills / payments | 0 / 0 / 0 / 0 |
| DocSequence | empty |

Account 1100 balance = 300,000 debit and 2000 = 150,000 credit, entirely from the two
manual entries, which is why the aging reports show a difference until documents or manual
entries are reconciled by the user.

---

## 12. Known gaps / sensible next steps

1. **Credit notes / corrections** — documents are immutable; there is no way to reverse one
   yet. Next phase should add credit notes (or a reversal entry + CANCELLED status with a
   paired document), keeping the one-entry-per-document invariant.
2. **Unallocated receipts / supplier prepayments** — receipts must currently be fully
   allocated. Real-world deposits need a customer-credit bucket and later allocation.
3. **Reconciliation of manual entries** — the system allows manual journal entries against
   control accounts (1100/2000) and then reports a difference. A guard or a warning on the
   general journal form would prevent accidental drift.
4. **Period close / retained earnings account** — balance sheet currently computes retained
   earnings from cumulative P&L; closing entries would make it a real equity line.
5. **Bank reconciliation, statements, CSV/PDF export, audit log, multi-user roles** — not built.
6. **Pagination** — lists cap at recent N (e.g. 10 per party); global lists rely on status
   tabs/search but have no paging.
7. **Editing drafts** — draft entries can be posted but not edited/deleted; acceptable for
   now, worth revisiting if drafts become common.
8. **Git** — the whole project is uncommitted (only the CRA initial commit). Commit before
   further work.

---

## 13. Operational notes for the next developer

- **Next 16:** route protection lives in `proxy.ts` (not `middleware.ts`); `AGENTS.md`
  contains the Next.js agent rules block that `next dev` regenerates — leave it alone.
- **Server actions all revalidate** the paths they affect (`/dashboard`, `/journal`,
  `/expenses`, party pages, `/reports`) then redirect with a `?created=`/`?saved=` flag.
- **Tailwind v4** with shadcn tokens in `app/globals.css`; fonts use CSS variables; the
  shell is responsive (desktop nav + a scrollable mobile nav row).
- **Adding a new document type** means: model + migration, sequence prefix in
  `doc-number.ts`, a create function that receives `tx` and calls `writeEntry`, a validator,
  an action, queries, a form, list/detail pages, a nav entry if global, and
  `PROTECTED_PATHS`. Never insert a `JournalEntry` directly.
- **Changing account codes** (1100/1400/2000/2200/1000/1010) means updating the constants in
  `lib/accounting/ar.ts` / `ap.ts`; they are resolved at posting time, so historical entries
  keep their account ids.
- **Seed** is idempotent and only replaces its own `SEED-` references; it will not touch
  user entries.
- **Printing** works from any report page; add `print:hidden` to any new chrome.
- **Reconciliation page wording** deliberately mentions manual entries; keep it honest if
  the data model changes.

---

## 14. Phase timeline

1. **Phase 1** — Next.js skeleton, Prisma schema, Auth.js credentials, chart of accounts,
   journal entries (draft/post), expense form, dashboard, money/date/accounting helpers.
2. **Phase 1.5** — account create/edit/deactivate and account detail.
3. **Phase 2** — jobs and sites with active flags; job/site tagging on journal lines;
   expenses-by-job/site reports.
4. **Phase 2.5** — customers CRUD, job→customer link, read-only parent context on child forms.
5. **Reporting phase** — trial balance, P&L, balance sheet, period picker, print headers,
   reconciliation badges.
6. **Phase 3** — suppliers, invoices/receipts, bills/payments, allocations, aging and balance
   reports, 20-check verification, cleanup, docs.

---

*Generated as a handoff snapshot — keep this file updated as phases land.*
