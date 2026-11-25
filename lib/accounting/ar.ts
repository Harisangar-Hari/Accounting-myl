import type {
  InvoiceStatus,
  PaymentMethod,
  Prisma,
} from "@prisma/client";
import { formatCents, sumCents } from "@/lib/money";
import { generateDocNo } from "./doc-number";
import { AccountingError } from "./errors";
import { writeEntry } from "./journal";
import {
  assertDocumentDates,
  assertLineTargets,
  requireAccountByCode,
} from "./targets";
import type { JournalLineInput } from "./validate";

/** Fixed chart-of-accounts codes used by AR documents. */
export const AR_ACCOUNT_CODE = "1100";
export const OUTPUT_VAT_ACCOUNT_CODE = "2200";
export const CASH_ACCOUNT_CODE = "1000";
export const BANK_ACCOUNT_CODE = "1010";

export interface CustomerInvoiceLineInput {
  description: string;
  revenueAccountId: string;
  /** Integer cents, net of tax. */
  amountCents: number;
  /** Integer cents, may be 0. */
  taxCents: number;
  jobId?: string | null;
  siteId?: string | null;
}

export interface CreateCustomerInvoiceInput {
  customerId: string;
  invoiceDate: Date;
  dueDate: Date;
  description?: string | null;
  lines: readonly CustomerInvoiceLineInput[];
  createdById: string;
}

export interface CreatedCustomerInvoice {
  id: string;
  invoiceNo: string;
  journalEntryId: string;
  totalCents: number;
}

/**
 * Creates a customer invoice and its journal entry in the caller's
 * transaction:
 *
 *   DEBIT  1100 Accounts Receivable          total
 *   CREDIT each line's revenue account       line.amount
 *   CREDIT 2200 Output VAT Payable           tax (only when tax > 0)
 *
 * The invoice row and the posted entry commit together or not at all.
 */
export async function createCustomerInvoice(
  tx: Prisma.TransactionClient,
  input: CreateCustomerInvoiceInput,
): Promise<CreatedCustomerInvoice> {
  const customer = await tx.customer.findUnique({
    where: { id: input.customerId },
    select: { id: true, code: true, name: true, isActive: true },
  });
  if (!customer) {
    throw new AccountingError("INVALID_PARTY", "Customer not found.");
  }
  if (!customer.isActive) {
    throw new AccountingError(
      "INVALID_PARTY",
      `Customer ${customer.code} ${customer.name} is inactive and cannot receive new invoices.`,
    );
  }

  assertDocumentDates(input.invoiceDate, input.dueDate, {
    document: "invoice date",
    due: "due date",
  });

  if (input.lines.length === 0) {
    throw new AccountingError(
      "INVALID_DOCUMENT",
      "An invoice needs at least one line.",
    );
  }

  const accountIds = [
    ...new Set(input.lines.map((line) => line.revenueAccountId)),
  ];
  const accounts = await tx.account.findMany({
    where: { id: { in: accountIds } },
    select: { id: true, code: true, name: true, type: true, isActive: true },
  });
  const accountById = new Map(accounts.map((account) => [account.id, account]));

  input.lines.forEach((line, index) => {
    const label = `Line ${index + 1}`;

    if (!line.description.trim()) {
      throw new AccountingError(
        "INVALID_DOCUMENT",
        `${label}: a description is required.`,
      );
    }

    const account = accountById.get(line.revenueAccountId);
    if (!account) {
      throw new AccountingError(
        "INVALID_ACCOUNT",
        `${label}: the selected revenue account no longer exists.`,
      );
    }
    if (account.type !== "REVENUE") {
      throw new AccountingError(
        "INVALID_ACCOUNT",
        `${label}: account ${account.code} is not a REVENUE account.`,
      );
    }
    if (!account.isActive) {
      throw new AccountingError(
        "INVALID_ACCOUNT",
        `${label}: account ${account.code} ${account.name} is inactive.`,
      );
    }

    if (!Number.isInteger(line.amountCents) || line.amountCents <= 0) {
      throw new AccountingError(
        "INVALID_AMOUNT",
        `${label}: amount must be greater than zero.`,
      );
    }
    if (!Number.isInteger(line.taxCents) || line.taxCents < 0) {
      throw new AccountingError(
        "INVALID_AMOUNT",
        `${label}: tax must be zero or greater.`,
      );
    }
  });

  await assertLineTargets(tx, input.lines);

  const subtotalCents = sumCents(input.lines.map((line) => line.amountCents));
  const taxCents = sumCents(input.lines.map((line) => line.taxCents));
  const totalCents = sumCents([subtotalCents, taxCents]);

  if (totalCents <= 0) {
    throw new AccountingError(
      "INVALID_AMOUNT",
      "The invoice total must be greater than zero.",
    );
  }

  const arAccount = await requireAccountByCode(tx, AR_ACCOUNT_CODE, {
    label: "Accounts Receivable",
    type: "ASSET",
  });
  const vatAccount =
    taxCents > 0
      ? await requireAccountByCode(tx, OUTPUT_VAT_ACCOUNT_CODE, {
          label: "Output VAT Payable",
          type: "LIABILITY",
        })
      : null;

  const invoiceNo = await generateDocNo(
    tx,
    "INV",
    input.invoiceDate.getUTCFullYear(),
  );

  const journalLines: JournalLineInput[] = [
    {
      accountId: arAccount.id,
      debitCents: totalCents,
      creditCents: 0,
      description: `Invoice ${invoiceNo} — ${customer.name}`,
      jobId: null,
      siteId: null,
    },
    ...input.lines.map((line) => ({
      accountId: line.revenueAccountId,
      debitCents: 0,
      creditCents: line.amountCents,
      description: line.description,
      jobId: line.jobId ?? null,
      siteId: line.siteId ?? null,
    })),
  ];
  if (vatAccount) {
    journalLines.push({
      accountId: vatAccount.id,
      debitCents: 0,
      creditCents: taxCents,
      description: `Output VAT — ${invoiceNo}`,
      jobId: null,
      siteId: null,
    });
  }

  const entry = await writeEntry(
    tx,
    {
      entryDate: input.invoiceDate,
      description: `Invoice ${invoiceNo} - ${customer.name}`,
      reference: invoiceNo,
      entryType: "GENERAL",
      status: "POSTED",
      createdById: input.createdById,
    },
    journalLines,
  );

  const invoice = await tx.customerInvoice.create({
    data: {
      invoiceNo,
      customerId: customer.id,
      invoiceDate: input.invoiceDate,
      dueDate: input.dueDate,
      description: input.description?.trim() || null,
      subtotalCents,
      taxCents,
      totalCents,
      journalEntryId: entry.id,
      lines: {
        create: input.lines.map((line, index) => ({
          description: line.description.trim(),
          revenueAccountId: line.revenueAccountId,
          amountCents: line.amountCents,
          taxCents: line.taxCents,
          jobId: line.jobId ?? null,
          siteId: line.siteId ?? null,
          lineNo: index + 1,
        })),
      },
    },
    select: { id: true, invoiceNo: true, journalEntryId: true, totalCents: true },
  });

  return invoice;
}

export interface CustomerPaymentAllocationInput {
  invoiceId: string;
  amountCents: number;
}

export interface CreateCustomerPaymentInput {
  customerId: string;
  paymentDate: Date;
  amountCents: number;
  method: PaymentMethod;
  reference?: string | null;
  notes?: string | null;
  allocations: readonly CustomerPaymentAllocationInput[];
  createdById: string;
}

export interface CreatedCustomerPayment {
  id: string;
  paymentNo: string;
  journalEntryId: string;
  amountCents: number;
}

/**
 * Creates a customer receipt, its allocations and its journal entry in the
 * caller's transaction:
 *
 *   DEBIT  cash / bank account      amount
 *   CREDIT 1100 Accounts Receivable amount
 *
 * Allocations must equal the receipt amount exactly and may never exceed an
 * invoice's remaining balance.
 */
export async function createCustomerPayment(
  tx: Prisma.TransactionClient,
  input: CreateCustomerPaymentInput,
): Promise<CreatedCustomerPayment> {
  const customer = await tx.customer.findUnique({
    where: { id: input.customerId },
    select: { id: true, code: true, name: true, isActive: true },
  });
  if (!customer) {
    throw new AccountingError("INVALID_PARTY", "Customer not found.");
  }
  if (!customer.isActive) {
    throw new AccountingError(
      "INVALID_PARTY",
      `Customer ${customer.code} ${customer.name} is inactive and cannot receive new payments.`,
    );
  }

  if (!Number.isFinite(input.paymentDate.getTime())) {
    throw new AccountingError("INVALID_DATE", "Enter a valid payment date.");
  }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new AccountingError(
      "INVALID_AMOUNT",
      "The payment amount must be greater than zero.",
    );
  }
  if (input.allocations.length === 0) {
    throw new AccountingError(
      "AR_ALLOCATION_MISMATCH",
      "Allocate the payment to at least one invoice.",
    );
  }

  const invoiceIds = input.allocations.map((allocation) => allocation.invoiceId);
  if (new Set(invoiceIds).size !== invoiceIds.length) {
    throw new AccountingError(
      "DUPLICATE_ALLOCATION",
      "Each invoice can only be allocated once per payment.",
    );
  }

  input.allocations.forEach((allocation, index) => {
    if (!Number.isInteger(allocation.amountCents) || allocation.amountCents <= 0) {
      throw new AccountingError(
        "INVALID_AMOUNT",
        `Allocation ${index + 1}: amount must be greater than zero.`,
      );
    }
  });

  const allocatedCents = sumCents(
    input.allocations.map((allocation) => allocation.amountCents),
  );
  if (allocatedCents !== input.amountCents) {
    throw new AccountingError(
      "AR_ALLOCATION_MISMATCH",
      `Allocated ${formatCents(allocatedCents)} does not equal the payment amount ${formatCents(input.amountCents)}. Allocate the full amount.`,
    );
  }

  const invoices = await tx.customerInvoice.findMany({
    where: { id: { in: invoiceIds } },
    select: {
      id: true,
      invoiceNo: true,
      customerId: true,
      totalCents: true,
      paidCents: true,
      status: true,
    },
  });
  const invoiceById = new Map(
    invoices.map((invoice) => [invoice.id, invoice]),
  );

  for (const allocation of input.allocations) {
    const invoice = invoiceById.get(allocation.invoiceId);
    if (!invoice) {
      throw new AccountingError(
        "DOCUMENT_NOT_FOUND",
        "One of the selected invoices no longer exists.",
      );
    }
    if (invoice.customerId !== customer.id) {
      throw new AccountingError(
        "INVALID_PARTY",
        `Invoice ${invoice.invoiceNo} belongs to a different customer.`,
      );
    }
    if (invoice.status === "CANCELLED") {
      throw new AccountingError(
        "INVALID_DOCUMENT",
        `Invoice ${invoice.invoiceNo} is cancelled and cannot receive payments.`,
      );
    }

    const remainingCents = invoice.totalCents - invoice.paidCents;
    if (allocation.amountCents > remainingCents) {
      throw new AccountingError(
        "ALLOCATION_EXCEEDS_BALANCE",
        `Invoice ${invoice.invoiceNo}: allocation ${formatCents(allocation.amountCents)} exceeds the remaining balance ${formatCents(remainingCents)}.`,
      );
    }
  }

  const arAccount = await requireAccountByCode(tx, AR_ACCOUNT_CODE, {
    label: "Accounts Receivable",
    type: "ASSET",
  });
  const cashAccount = await requireAccountByCode(
    tx,
    input.method === "CASH" ? CASH_ACCOUNT_CODE : BANK_ACCOUNT_CODE,
    {
      label: input.method === "CASH" ? "Cash on Hand" : "Bank",
      type: "ASSET",
    },
  );

  const paymentNo = await generateDocNo(
    tx,
    "RCPT",
    input.paymentDate.getUTCFullYear(),
  );

  const entry = await writeEntry(
    tx,
    {
      entryDate: input.paymentDate,
      description: `Receipt ${paymentNo} - ${customer.name}`,
      reference: paymentNo,
      entryType: "GENERAL",
      status: "POSTED",
      createdById: input.createdById,
    },
    [
      {
        accountId: cashAccount.id,
        debitCents: input.amountCents,
        creditCents: 0,
        description: `Receipt ${paymentNo} — ${customer.name}`,
        jobId: null,
        siteId: null,
      },
      {
        accountId: arAccount.id,
        debitCents: 0,
        creditCents: input.amountCents,
        description: `Receipt ${paymentNo} — ${customer.name}`,
        jobId: null,
        siteId: null,
      },
    ],
  );

  const payment = await tx.customerPayment.create({
    data: {
      paymentNo,
      customerId: customer.id,
      paymentDate: input.paymentDate,
      amountCents: input.amountCents,
      method: input.method,
      reference: input.reference?.trim() || null,
      notes: input.notes?.trim() || null,
      journalEntryId: entry.id,
      allocations: {
        create: input.allocations.map((allocation) => ({
          invoiceId: allocation.invoiceId,
          amountCents: allocation.amountCents,
        })),
      },
    },
    select: {
      id: true,
      paymentNo: true,
      journalEntryId: true,
      amountCents: true,
    },
  });

  for (const allocation of input.allocations) {
    const invoice = invoiceById.get(allocation.invoiceId);
    if (!invoice) continue;

    const paidCents = invoice.paidCents + allocation.amountCents;
    const status: InvoiceStatus =
      paidCents >= invoice.totalCents
        ? "PAID"
        : paidCents > 0
          ? "PARTIALLY_PAID"
          : "OPEN";

    // The paidCents guard makes concurrent payments on the same invoice fail
    // instead of silently overwriting one another.
    const updated = await tx.customerInvoice.updateMany({
      where: {
        id: invoice.id,
        paidCents: invoice.paidCents,
        status: { not: "CANCELLED" },
      },
      data: { paidCents, status },
    });

    if (updated.count !== 1) {
      throw new AccountingError(
        "ALLOCATION_EXCEEDS_BALANCE",
        `Invoice ${invoice.invoiceNo} changed while the payment was being saved. Refresh and try again.`,
      );
    }
  }

  return payment;
}
