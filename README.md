database migration part 
pg_dump -Fc -v -d "postgresql://postgres:admin@localhost:5432/accounting_myl" -f local_backup.bak   =>will take backup from the local 
pg_restore -v -d "postgresql://neondb_owner:npg_ekx6cahGHC0A@ep-long-wildflower-be6tqnup-pooler.c-9.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require" --no-owner --no-acl local_backup.bak       =>will restore the backup to neon cloud

# Ledger — Construction Accounting (Phase 1)

General Ledger foundation for a construction company. This is the double-entry core
that AR, AP, bank reconciliation and financial reports will later be built on.

**Phase 1 scope:** chart of accounts (read-only), journal entries (list/view/post),
expense entry form, seeded admin user. Nothing else — no reports, no AP/AR
subledgers, no reversals, no period closing, no audit log, no COA editor.

## Stack

| Concern    | Choice |
| ---------- | ------ |
| Framework  | Next.js 16 (App Router) + TypeScript strict |
| UI         | Tailwind CSS v4 + shadcn/ui |
| Data       | Prisma 6 + PostgreSQL |
| Auth       | Auth.js (NextAuth v5) Credentials provider, JWT sessions |
| Forms      | React Hook Form + Zod |
| Mutations  | Server Actions (one Route Handler for the Auth.js endpoints) |
| Email      | Nodemailer (SMTP) — password-reset OTP only, stubbed when SMTP is unset |

> Next.js 16 renamed `middleware.ts` to `proxy.ts`; route protection lives in
> `proxy.ts`.

## Setup

```bash
# 1. Install
npm install

# 2. Configure environment
cp .env.example .env
#    Set DATABASE_URL, NEXTAUTH_SECRET (openssl rand -base64 32), NEXTAUTH_URL

# 3. Create the database, run migrations, seed
npx prisma migrate dev
npx prisma db seed

# 4. Run
npm run dev
```

Open <http://localhost:3000> — you are redirected to `/login`.

**Seed login:** `admin@example.com` / `admin123`

### Scripts

| Command | Purpose |
| ------- | ------- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:seed` | `prisma db seed` |
| `npm run db:reset` | Drop, re-migrate and re-seed |
| `npm run db:studio` | Prisma Studio |

## Money rules (non-negotiable)

- Every financial amount is an **integer number of cents** in a Prisma `Int`
  column. No `Float`, no `Decimal` for money.
- `lib/money.ts` is the only place that parses or formats amounts:
  - `toCents("1234.56") → 123456` — rejects negatives, >2 decimals, exponent
    notation, empty values and anything outside the Int32 range.
  - `formatCents(123456) → "1,234.56"` — integer math only, no floating point.
- Zod schemas accept the amount as a **string** from the form, validate at most
  2 decimals, and the Server Action converts to cents before the DB.

## Accounting rules (`lib/accounting/`)

- `assertBalanced(lines)` — throws unless:
  - there are at least two lines,
  - every amount is a non-negative integer within range,
  - each line has **exactly one** of debit/credit > 0 (XOR),
  - total debits === total credits, and the total is > 0.
- `generateEntryNo(tx, year)` — a single atomic
  `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` on `EntrySequence`, inside the
  caller's transaction. Concurrent submissions are serialized by the row lock and
  can never share a number. Format: `JE-{year}-{0000}`.
- Balance is asserted before the write **inside** the transaction, so an
  unbalanced entry cannot be committed.
- `postJournalEntry(id)` — DRAFT → POSTED with `postedAt`, guarded by
  `updateMany({ where: { status: "DRAFT" } })` so two concurrent posts cannot both
  win.
- **POSTED entries are immutable.** `assertEntryMutable()` throws on any mutation
  of a posted entry; there is no update or delete action for entries at all.
- Reference integrity is checked inside the writing transaction: expense lines must
  be active `EXPENSE` accounts, the payment account must be an active `ASSET`
  account, jobs must be active, and a site must belong to the selected job.

## Expense entry flow

`/expenses/new` → `createExpenseEntryAction` (Server Action):

1. `requireAuth()`
2. Zod validation of the form payload (amounts as strings)
3. `toCents()` for each line
4. One Prisma `$transaction`:
   - resolve + validate accounts, jobs and sites
   - `generateEntryNo(tx, year)`
   - `assertBalanced(lines)` immediately before the insert
   - create the `JournalEntry` (`entryType=EXPENSE`, `status=DRAFT|POSTED`,
     `postedAt` when posted) with one DEBIT line per expense line and one
     balancing CREDIT line to the payment account
5. `revalidatePath("/dashboard" | "/journal" | "/expenses")` and redirect to
   `/expenses?created=JE-…` (the page shows the success toast)

## Accounts receivable & payable (Phase 3)

AR and AP are **business documents**, not separate ledgers. Every document row
and its balanced `JournalEntry` are written in **one Prisma transaction** and
linked by `journalEntryId`; if either fails, both roll back. Documents are
created already posted and are immutable — there is no edit or delete route.

| Document | Created at | Journal entry |
| --- | --- | --- |
| `CustomerInvoice` | `/customers/[id]/invoices/new` | DEBIT 1100 AR (total); CREDIT each line's revenue account; CREDIT 2200 Output VAT when tax > 0 |
| `CustomerPayment` | `/customers/[id]/payments/new` | DEBIT 1000 Cash (CASH) or 1010 Bank (BANK/CHEQUE); CREDIT 1100 AR |
| `SupplierBill` | `/suppliers/[id]/bills/new` | DEBIT each line's expense account; DEBIT 1400 Input VAT when tax > 0; CREDIT 2000 AP |
| `SupplierPayment` | `/suppliers/[id]/payments/new` | DEBIT 2000 AP; CREDIT 1000/1010 |

Rules enforced in `lib/accounting/ar.ts` and `lib/accounting/ap.ts` (inside the
transaction, on re-fetched rows, never trusting the form):

- The customer/supplier must exist and be **active**; line accounts must exist,
  be active, and be `REVENUE` (invoice) or `EXPENSE` (bill).
- Job/site tags are re-validated: both active, and a site must belong to the
  selected job.
- The AR/AP, VAT and cash/bank accounts are resolved **by account code**
  (1100, 2200, 1400, 2000, 1000, 1010) — never from browser input. A missing
  VAT account blocks the document.
- **Allocation is exact.** The sum of payment allocations must equal the payment
  amount (`AR_ALLOCATION_MISMATCH` / `AP_ALLOCATION_MISMATCH`), an allocation may
  not exceed an invoice/bill's remaining balance, and the target must belong to
  the same customer/supplier. Duplicate rows for one document are rejected.
- Paid amounts update with a `paidCents` guard in the `UPDATE` so concurrent
  payments cannot overwrite each other.
- Stored status is `OPEN` / `PARTIALLY_PAID` / `PAID` (the enum also keeps
  `CANCELLED`/`OVERDUE` values, but `OVERDUE` is never stored). **Overdue is
  computed** from `dueDate < today` and `status not in (PAID, CANCELLED)`
  (`lib/accounting/documents.ts`).

**Numbering.** `generateDocNo(tx, prefix, year)` in
`lib/accounting/doc-number.ts` mirrors `generateEntryNo`: one atomic
`INSERT … ON CONFLICT DO UPDATE … RETURNING` on `DocSequence` keyed by
`PREFIX-year`, producing `INV-YYYY-0001`, `BILL-…`, `RCPT-…`, `PAY-…`. The year
is the document's own date (UTC), and the sequences are separate from `JE-…`.

**The invariant that proves AR/AP is wired correctly:** the balance of account
1100 on the Balance Sheet must equal the total outstanding on the AR Aging
report (which reads invoice documents), and 2000 must equal the AP Aging total.
Both aging report pages display the ledger balance, the document total and the
difference, with a reconciliation badge, so the check is visible in the UI. Do
not make one of these read the other's source: the whole point is that two
independent computations agree.

Customer/supplier documents are keyed to the party, not the chart of accounts —
there is no per-customer ledger account and `JournalLine` has no `customerId`.
Customer tracking lives at the document layer (invoice → journal entry).

## Reports — period convention and design decisions

Reports live in `lib/accounting/reports.ts` (aggregations only) and are served
read-only by `/reports/*`. No reporting code writes, and no page queries the
database itself.

- **Period filtering is by `JournalEntry.entryDate`**, never by `postedAt` and
  never by the year embedded in the entry number. `generateEntryNo()` numbers an
  entry with the UTC year of its own `entryDate`, so a back-dated entry can
  carry an older-looking number while still reporting in the period it is dated.
  Every report filters `status = POSTED AND entryDate >= fromDate AND
  entryDate <= toDate`, comparing calendar dates stored as UTC midnight with
  `gte`/`lte` (`toDate` is inclusive).
- **Draft entries are excluded everywhere.** Each report function filters
  `status: "POSTED"`; there is no option to include drafts.
- **Retained earnings are computed on the fly.** Phase 1 has no period-close
  mechanism that transfers P&L balances into equity, so the balance sheet adds
  all-time cumulative net profit (revenue − expenses up to the as-of date) to
  equity. Without it the sheet could not balance. When closing entries are
  introduced, that line becomes a real equity account.
- **The period lives in the URL** (`?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD`),
  defaults to the first day of the current month through today, and is never
  stored in the database.
- **Money stays in integer cents**; `formatCents`/`formatSignedCents` are
  display-only and negative amounts print in accounting parentheses.
- **Expenses by job/site** count expense-account lines only and put lines with
  no job (or no site) in an "Unallocated" row, so the grand total always
  reconciles with the P&L's total expenses for the same period.
- **Printing** uses the browser's print dialog. The nav and period picker are
  `print:hidden`, and each report renders a print-only header with the company
  name (`COMPANY_NAME` env var, default "Construction Company"), report title,
  period and generation date. There is no PDF/CSV export.

## UI patterns

- **Parent context on child-creation forms.** When a form creates a record
  under a parent (a site under a job), the parent's details are displayed
  read-only at the top of the form — never as editable fields. The site create
  form shows the job and, when the job has one, its customer (with an
  "Inactive" badge, and "No contact details on file." when the customer has no
  email/phone/address). The customer is derived from `Job.customer` on every
  render, so changing a job's customer is reflected immediately and nothing is
  copied onto the site row. Edit forms omit this context to stay minimal.
  Customer invoices (`/customers/[id]/invoices/new`) and supplier bills
  (`/suppliers/[id]/bills/new`) follow the same pattern, showing the customer
  or supplier read-only with a link to manage it.

## Security

- All `/dashboard`, `/accounts`, `/journal`, `/expenses`, `/jobs`, `/sites`,
  `/customers`, `/suppliers`, `/invoices`, `/bills`, `/payments`,
  `/supplier-payments` and `/reports` routes are guarded in `proxy.ts`
  (unauthenticated → `/login`).
- Every Server Action calls `requireAuth()` as its first statement. The single
  exception is `loginAction`, which runs before a session exists.
- Passwords are hashed with bcrypt; only the hash is stored.
- Auth.js uses JWT sessions with an 8-hour lifetime; users re-authenticate daily.

## Structure

```
app/
  (auth)/login/
  (app)/dashboard/            (app)/accounts/
  (app)/journal/              (app)/journal/[id]/    (app)/journal/new/
  (app)/expenses/             (app)/expenses/new/
  (app)/customers/[id]/invoices/  …/payments/
  (app)/suppliers/[id]/bills/     …/payments/
  (app)/invoices/  (app)/bills/  (app)/payments/  (app)/supplier-payments/
  api/auth/[...nextauth]/route.ts
components/  ui/ (shadcn) · entries/ · forms/ · auth/
lib/
  db.ts          Prisma singleton
  auth.ts        NextAuth config + requireAuth()
  auth.config.ts edge-safe auth config used by proxy.ts
  money.ts       integer-cents helpers
  dates.ts       calendar-date (UTC midnight) helpers
  email.ts       Nodemailer OTP sender (stub when SMTP unset)
  validators/    Zod schemas
  accounting/    validate · entry-number · doc-number · journal · expenses · general
                 ar · ap · documents · queries · ar-queries · ap-queries · reports
prisma/
  schema.prisma  seed.ts  migrations/
proxy.ts         route protection (Next 16's renamed middleware)
```

## Seed data

- Admin user `admin@example.com` / `admin123`
- 21-account construction chart of accounts (1000–5900), including 1100 AR,
  1400 Input VAT Receivable, 2000 AP and 2200 Output VAT Payable
- Jobs `JOB-2025-001` Highway Extension and `JOB-2025-002` Building Complex, each
  with two sites
- 5 expense entries (3 POSTED, 2 DRAFT), including a multi-line entry

The seed is idempotent: it upserts the user/accounts/jobs and replaces only its own
entries (references starting with `SEED-`).
