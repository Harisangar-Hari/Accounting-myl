import type { BillStatus, PaymentMethod, Prisma } from "@prisma/client";
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

/** Fixed chart-of-accounts codes used by AP documents. */
export const AP_ACCOUNT_CODE = "2000";
export const INPUT_VAT_ACCOUNT_CODE = "1400";
export const CASH_ACCOUNT_CODE = "1000";
export const BANK_ACCOUNT_CODE = "1010";

export interface SupplierBillLineInput {
  description: string;
  expenseAccountId: string;
  /** Integer cents, net of tax. */
  amountCents: number;
  /** Integer cents, may be 0. */
  taxCents: number;
  jobId?: string | null;
  siteId?: string | null;
}

export interface CreateSupplierBillInput {
  supplierId: string;
  billDate: Date;
  dueDate: Date;
  description?: string | null;
  supplierRef?: string | null;
  lines: readonly SupplierBillLineInput[];
  createdById: string;
}

export interface CreatedSupplierBill {
  id: string;
  billNo: string;
  journalEntryId: string;
  totalCents: number;
}

/**
 * Creates a supplier bill and its journal entry in the caller's transaction:
 *
 *   DEBIT  each line's expense account   line.amount
 *   DEBIT  1400 Input VAT Receivable     tax (only when tax > 0)
 *   CREDIT 2000 Accounts Payable         total
 */
export async function createSupplierBill(
  tx: Prisma.TransactionClient,
  input: CreateSupplierBillInput,
): Promise<CreatedSupplierBill> {
  const supplier = await tx.supplier.findUnique({
    where: { id: input.supplierId },
    select: { id: true, code: true, name: true, isActive: true },
  });
  if (!supplier) {
    throw new AccountingError("INVALID_PARTY", "Supplier not found.");
  }
  if (!supplier.isActive) {
    throw new AccountingError(
      "INVALID_PARTY",
      `Supplier ${supplier.code} ${supplier.name} is inactive and cannot receive new bills.`,
    );
  }

  assertDocumentDates(input.billDate, input.dueDate, {
    document: "bill date",
    due: "due date",
  });

  if (input.lines.length === 0) {
    throw new AccountingError(
      "INVALID_DOCUMENT",
      "A bill needs at least one line.",
    );
  }

  const accountIds = [
    ...new Set(input.lines.map((line) => line.expenseAccountId)),
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

    const account = accountById.get(line.expenseAccountId);
    if (!account) {
      throw new AccountingError(
        "INVALID_ACCOUNT",
        `${label}: the selected expense account no longer exists.`,
      );
    }
    if (account.type !== "EXPENSE") {
      throw new AccountingError(
        "INVALID_ACCOUNT",
        `${label}: account ${account.code} is not an EXPENSE account.`,
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
      "The bill total must be greater than zero.",
    );
  }

  const apAccount = await requireAccountByCode(tx, AP_ACCOUNT_CODE, {
    label: "Accounts Payable",
    type: "LIABILITY",
  });
  const vatAccount =
    taxCents > 0
      ? await requireAccountByCode(tx, INPUT_VAT_ACCOUNT_CODE, {
          label: "Input VAT Receivable",
          type: "ASSET",
        })
      : null;

  const billNo = await generateDocNo(tx, "BILL", input.billDate.getUTCFullYear());

  const journalLines: JournalLineInput[] = input.lines.map((line) => ({
    accountId: line.expenseAccountId,
    debitCents: line.amountCents,
    creditCents: 0,
    description: line.description,
    jobId: line.jobId ?? null,
    siteId: line.siteId ?? null,
  }));
  if (vatAccount) {
    journalLines.push({
      accountId: vatAccount.id,
      debitCents: taxCents,
      creditCents: 0,
      description: `Input VAT — ${billNo}`,
      jobId: null,
      siteId: null,
    });
  }
  journalLines.push({
    accountId: apAccount.id,
    debitCents: 0,
    creditCents: totalCents,
    description: `Bill ${billNo} — ${supplier.name}`,
    jobId: null,
    siteId: null,
  });

  const entry = await writeEntry(
    tx,
    {
      entryDate: input.billDate,
      description: `Bill ${billNo} - ${supplier.name}`,
      reference: input.supplierRef?.trim() || billNo,
      entryType: "GENERAL",
      status: "POSTED",
      createdById: input.createdById,
    },
    journalLines,
  );

  const bill = await tx.supplierBill.create({
    data: {
      billNo,
      supplierRef: input.supplierRef?.trim() || null,
      supplierId: supplier.id,
      billDate: input.billDate,
      dueDate: input.dueDate,
      description: input.description?.trim() || null,
      subtotalCents,
      taxCents,
      totalCents,
      journalEntryId: entry.id,
      lines: {
        create: input.lines.map((line, index) => ({
          description: line.description.trim(),
          expenseAccountId: line.expenseAccountId,
          amountCents: line.amountCents,
          taxCents: line.taxCents,
          jobId: line.jobId ?? null,
          siteId: line.siteId ?? null,
          lineNo: index + 1,
        })),
      },
    },
    select: { id: true, billNo: true, journalEntryId: true, totalCents: true },
  });

  return bill;
}

export interface SupplierPaymentAllocationInput {
  billId: string;
  amountCents: number;
}

export interface CreateSupplierPaymentInput {
  supplierId: string;
  paymentDate: Date;
  amountCents: number;
  method: PaymentMethod;
  reference?: string | null;
  notes?: string | null;
  allocations: readonly SupplierPaymentAllocationInput[];
  createdById: string;
}

export interface CreatedSupplierPayment {
  id: string;
  paymentNo: string;
  journalEntryId: string;
  amountCents: number;
}

/**
 * Creates a supplier payment, its allocations and its journal entry in the
 * caller's transaction:
 *
 *   DEBIT  2000 Accounts Payable     amount
 *   CREDIT cash / bank account       amount
 */
export async function createSupplierPayment(
  tx: Prisma.TransactionClient,
  input: CreateSupplierPaymentInput,
): Promise<CreatedSupplierPayment> {
  const supplier = await tx.supplier.findUnique({
    where: { id: input.supplierId },
    select: { id: true, code: true, name: true, isActive: true },
  });
  if (!supplier) {
    throw new AccountingError("INVALID_PARTY", "Supplier not found.");
  }
  if (!supplier.isActive) {
    throw new AccountingError(
      "INVALID_PARTY",
      `Supplier ${supplier.code} ${supplier.name} is inactive and cannot receive new payments.`,
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
      "AP_ALLOCATION_MISMATCH",
      "Allocate the payment to at least one bill.",
    );
  }

  const billIds = input.allocations.map((allocation) => allocation.billId);
  if (new Set(billIds).size !== billIds.length) {
    throw new AccountingError(
      "DUPLICATE_ALLOCATION",
      "Each bill can only be allocated once per payment.",
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
      "AP_ALLOCATION_MISMATCH",
      `Allocated ${formatCents(allocatedCents)} does not equal the payment amount ${formatCents(input.amountCents)}. Allocate the full amount.`,
    );
  }

  const bills = await tx.supplierBill.findMany({
    where: { id: { in: billIds } },
    select: {
      id: true,
      billNo: true,
      supplierId: true,
      totalCents: true,
      paidCents: true,
      status: true,
    },
  });
  const billById = new Map(bills.map((bill) => [bill.id, bill]));

  for (const allocation of input.allocations) {
    const bill = billById.get(allocation.billId);
    if (!bill) {
      throw new AccountingError(
        "DOCUMENT_NOT_FOUND",
        "One of the selected bills no longer exists.",
      );
    }
    if (bill.supplierId !== supplier.id) {
      throw new AccountingError(
        "INVALID_PARTY",
        `Bill ${bill.billNo} belongs to a different supplier.`,
      );
    }
    if (bill.status === "CANCELLED") {
      throw new AccountingError(
        "INVALID_DOCUMENT",
        `Bill ${bill.billNo} is cancelled and cannot receive payments.`,
      );
    }

    const remainingCents = bill.totalCents - bill.paidCents;
    if (allocation.amountCents > remainingCents) {
      throw new AccountingError(
        "ALLOCATION_EXCEEDS_BALANCE",
        `Bill ${bill.billNo}: allocation ${formatCents(allocation.amountCents)} exceeds the remaining balance ${formatCents(remainingCents)}.`,
      );
    }
  }

  const apAccount = await requireAccountByCode(tx, AP_ACCOUNT_CODE, {
    label: "Accounts Payable",
    type: "LIABILITY",
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
    "PAY",
    input.paymentDate.getUTCFullYear(),
  );

  const entry = await writeEntry(
    tx,
    {
      entryDate: input.paymentDate,
      description: `Payment ${paymentNo} - ${supplier.name}`,
      reference: paymentNo,
      entryType: "GENERAL",
      status: "POSTED",
      createdById: input.createdById,
    },
    [
      {
        accountId: apAccount.id,
        debitCents: input.amountCents,
        creditCents: 0,
        description: `Payment ${paymentNo} — ${supplier.name}`,
        jobId: null,
        siteId: null,
      },
      {
        accountId: cashAccount.id,
        debitCents: 0,
        creditCents: input.amountCents,
        description: `Payment ${paymentNo} — ${supplier.name}`,
        jobId: null,
        siteId: null,
      },
    ],
  );

  const payment = await tx.supplierPayment.create({
    data: {
      paymentNo,
      supplierId: supplier.id,
      paymentDate: input.paymentDate,
      amountCents: input.amountCents,
      method: input.method,
      reference: input.reference?.trim() || null,
      notes: input.notes?.trim() || null,
      journalEntryId: entry.id,
      allocations: {
        create: input.allocations.map((allocation) => ({
          billId: allocation.billId,
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
    const bill = billById.get(allocation.billId);
    if (!bill) continue;

    const paidCents = bill.paidCents + allocation.amountCents;
    const status: BillStatus =
      paidCents >= bill.totalCents
        ? "PAID"
        : paidCents > 0
          ? "PARTIALLY_PAID"
          : "OPEN";

    const updated = await tx.supplierBill.updateMany({
      where: {
        id: bill.id,
        paidCents: bill.paidCents,
        status: { not: "CANCELLED" },
      },
      data: { paidCents, status },
    });

    if (updated.count !== 1) {
      throw new AccountingError(
        "ALLOCATION_EXCEEDS_BALANCE",
        `Bill ${bill.billNo} changed while the payment was being saved. Refresh and try again.`,
      );
    }
  }

  return payment;
}
