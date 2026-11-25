/**
 * Accounts Receivable document queries — READ-ONLY.
 *
 * These power the invoice and receipt screens. They read the business
 * documents, not the ledger; the ledger view of AR is produced by the reports
 * layer. Overdue is computed from dueDate on every read, never stored.
 */
import type { InvoiceStatus, PaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  isDocumentOverdue,
  todayUtc,
  type DocumentStatusFilter,
} from "./documents";

export interface InvoiceListItem {
  id: string;
  invoiceNo: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  invoiceDate: Date;
  dueDate: Date;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  paidCents: number;
  outstandingCents: number;
  status: InvoiceStatus;
  isOverdue: boolean;
}

interface InvoiceListRow {
  id: string;
  invoiceNo: string;
  invoiceDate: Date;
  dueDate: Date;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  paidCents: number;
  status: InvoiceStatus;
  customer: { id: string; code: string; name: string };
}

const INVOICE_LIST_SELECT = {
  id: true,
  invoiceNo: true,
  invoiceDate: true,
  dueDate: true,
  subtotalCents: true,
  taxCents: true,
  totalCents: true,
  paidCents: true,
  status: true,
  customer: { select: { id: true, code: true, name: true } },
} satisfies Prisma.CustomerInvoiceSelect;

function mapInvoiceRow(row: InvoiceListRow, asOf: Date): InvoiceListItem {
  return {
    id: row.id,
    invoiceNo: row.invoiceNo,
    customerId: row.customer.id,
    customerCode: row.customer.code,
    customerName: row.customer.name,
    invoiceDate: row.invoiceDate,
    dueDate: row.dueDate,
    subtotalCents: row.subtotalCents,
    taxCents: row.taxCents,
    totalCents: row.totalCents,
    paidCents: row.paidCents,
    outstandingCents: row.totalCents - row.paidCents,
    status: row.status,
    isOverdue: isDocumentOverdue(row.status, row.dueDate, asOf),
  };
}

function invoiceStatusWhere(
  status: DocumentStatusFilter,
  asOf: Date,
): Prisma.CustomerInvoiceWhereInput {
  switch (status) {
    case "open":
      return { status: "OPEN" };
    case "partially_paid":
      return { status: "PARTIALLY_PAID" };
    case "paid":
      return { status: "PAID" };
    case "overdue":
      return {
        dueDate: { lt: asOf },
        status: { notIn: ["PAID", "CANCELLED"] },
      };
    default:
      return {};
  }
}

export interface InvoiceFilters {
  customerId?: string;
  status?: DocumentStatusFilter;
  fromDate?: Date | null;
  toDate?: Date | null;
  search?: string;
  limit?: number;
}

/** Invoices newest first, optionally scoped to a customer and filtered. */
export async function listCustomerInvoices(
  filters: InvoiceFilters = {},
): Promise<InvoiceListItem[]> {
  const asOf = todayUtc();
  const search = filters.search?.trim();

  const where: Prisma.CustomerInvoiceWhereInput = {
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
    ...invoiceStatusWhere(filters.status ?? "all", asOf),
    ...(filters.fromDate || filters.toDate
      ? {
          invoiceDate: {
            ...(filters.fromDate ? { gte: filters.fromDate } : {}),
            ...(filters.toDate ? { lte: filters.toDate } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { invoiceNo: { contains: search, mode: "insensitive" as const } },
            {
              customer: {
                name: { contains: search, mode: "insensitive" as const },
              },
            },
            {
              customer: {
                code: { contains: search, mode: "insensitive" as const },
              },
            },
          ],
        }
      : {}),
  };

  const invoices = await prisma.customerInvoice.findMany({
    where,
    orderBy: [{ invoiceDate: "desc" }, { invoiceNo: "desc" }],
    take: filters.limit ?? 200,
    select: INVOICE_LIST_SELECT,
  });

  return invoices.map((invoice) => mapInvoiceRow(invoice, asOf));
}

/** One invoice with its lines, journal entry and applied payments, or null. */
export async function getCustomerInvoice(id: string) {
  const invoice = await prisma.customerInvoice.findUnique({
    where: { id },
    select: {
      id: true,
      invoiceNo: true,
      invoiceDate: true,
      dueDate: true,
      description: true,
      subtotalCents: true,
      taxCents: true,
      totalCents: true,
      paidCents: true,
      status: true,
      createdAt: true,
      customer: {
        select: {
          id: true,
          code: true,
          name: true,
          email: true,
          phone: true,
          address: true,
          taxId: true,
          isActive: true,
        },
      },
      journalEntry: {
        select: { id: true, entryNo: true, entryDate: true, status: true },
      },
      lines: {
        orderBy: { lineNo: "asc" },
        select: {
          id: true,
          lineNo: true,
          description: true,
          amountCents: true,
          taxCents: true,
          revenueAccount: { select: { code: true, name: true } },
          job: { select: { id: true, code: true, name: true } },
          site: { select: { id: true, code: true, name: true } },
        },
      },
      allocations: {
        select: {
          id: true,
          amountCents: true,
          payment: {
            select: {
              id: true,
              paymentNo: true,
              paymentDate: true,
              method: true,
            },
          },
        },
      },
    },
  });

  if (!invoice) return null;

  return {
    ...invoice,
    outstandingCents: invoice.totalCents - invoice.paidCents,
    isOverdue: isDocumentOverdue(invoice.status, invoice.dueDate),
  };
}

/** Open invoices for the payment allocation UI, with their remaining balance. */
export async function listOpenInvoicesForCustomer(customerId: string) {
  const invoices = await prisma.customerInvoice.findMany({
    where: {
      customerId,
      status: { in: ["OPEN", "PARTIALLY_PAID"] },
    },
    orderBy: [{ dueDate: "asc" }, { invoiceNo: "asc" }],
    select: {
      id: true,
      invoiceNo: true,
      invoiceDate: true,
      dueDate: true,
      totalCents: true,
      paidCents: true,
      status: true,
    },
  });

  return invoices.map((invoice) => ({
    ...invoice,
    remainingCents: invoice.totalCents - invoice.paidCents,
  }));
}

export interface CustomerPaymentListItem {
  id: string;
  paymentNo: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  paymentDate: Date;
  amountCents: number;
  method: PaymentMethod;
  reference: string | null;
  allocationCount: number;
}

export interface CustomerPaymentFilters {
  customerId?: string;
  fromDate?: Date | null;
  toDate?: Date | null;
  search?: string;
  limit?: number;
}

/** Customer receipts newest first. */
export async function listCustomerPayments(
  filters: CustomerPaymentFilters = {},
): Promise<CustomerPaymentListItem[]> {
  const search = filters.search?.trim();

  const payments = await prisma.customerPayment.findMany({
    where: {
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      ...(filters.fromDate || filters.toDate
        ? {
            paymentDate: {
              ...(filters.fromDate ? { gte: filters.fromDate } : {}),
              ...(filters.toDate ? { lte: filters.toDate } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { paymentNo: { contains: search, mode: "insensitive" as const } },
              {
                customer: {
                  name: { contains: search, mode: "insensitive" as const },
                },
              },
              {
                customer: {
                  code: { contains: search, mode: "insensitive" as const },
                },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ paymentDate: "desc" }, { paymentNo: "desc" }],
    take: filters.limit ?? 200,
    select: {
      id: true,
      paymentNo: true,
      paymentDate: true,
      amountCents: true,
      method: true,
      reference: true,
      customer: { select: { id: true, code: true, name: true } },
      _count: { select: { allocations: true } },
    },
  });

  return payments.map(({ customer, _count, ...payment }) => ({
    ...payment,
    customerId: customer.id,
    customerCode: customer.code,
    customerName: customer.name,
    allocationCount: _count.allocations,
  }));
}

/** One receipt with its allocations and journal entry, or null. */
export async function getCustomerPayment(id: string) {
  return prisma.customerPayment.findUnique({
    where: { id },
    select: {
      id: true,
      paymentNo: true,
      paymentDate: true,
      amountCents: true,
      method: true,
      reference: true,
      notes: true,
      createdAt: true,
      customer: {
        select: { id: true, code: true, name: true, isActive: true },
      },
      journalEntry: {
        select: { id: true, entryNo: true, entryDate: true, status: true },
      },
      allocations: {
        select: {
          id: true,
          amountCents: true,
          invoice: {
            select: {
              id: true,
              invoiceNo: true,
              invoiceDate: true,
              dueDate: true,
              totalCents: true,
              paidCents: true,
              status: true,
            },
          },
        },
      },
    },
  });
}
