/**
 * Accounts Payable document queries — READ-ONLY.
 * Mirrors lib/accounting/ar-queries.ts for suppliers, bills and payments.
 */
import type { BillStatus, PaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sumCents } from "@/lib/money";
import {
  isDocumentOverdue,
  todayUtc,
  type DocumentStatusFilter,
} from "./documents";

export interface SupplierListItem {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  billCount: number;
  outstandingCents: number;
}

export async function listSuppliers(
  options: { includeInactive?: boolean; search?: string } = {},
): Promise<SupplierListItem[]> {
  const search = options.search?.trim();

  const suppliers = await prisma.supplier.findMany({
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
      _count: { select: { bills: true } },
      bills: {
        where: { status: { in: ["OPEN", "PARTIALLY_PAID", "OVERDUE"] } },
        select: { totalCents: true, paidCents: true },
      },
    },
  });

  return suppliers.map(({ _count, bills, ...supplier }) => ({
    ...supplier,
    billCount: _count.bills,
    outstandingCents: sumCents(
      bills.map((bill) => bill.totalCents - bill.paidCents),
    ),
  }));
}

/** A supplier with its bills/payments (recent 10 each) and open balance. */
export async function getSupplier(id: string) {
  const supplier = await prisma.supplier.findUnique({
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
      bills: {
        orderBy: [{ billDate: "desc" }, { billNo: "desc" }],
        take: 10,
        select: {
          id: true,
          billNo: true,
          billDate: true,
          dueDate: true,
          totalCents: true,
          paidCents: true,
          status: true,
        },
      },
      payments: {
        orderBy: [{ paymentDate: "desc" }, { paymentNo: "desc" }],
        take: 10,
        select: {
          id: true,
          paymentNo: true,
          paymentDate: true,
          amountCents: true,
          method: true,
        },
      },
      _count: { select: { bills: true, payments: true } },
    },
  });

  if (!supplier) return null;

  const outstanding = await prisma.supplierBill.aggregate({
    where: {
      supplierId: id,
      status: { in: ["OPEN", "PARTIALLY_PAID", "OVERDUE"] },
    },
    _sum: { totalCents: true, paidCents: true },
  });

  return {
    ...supplier,
    outstandingCents:
      (outstanding._sum.totalCents ?? 0) - (outstanding._sum.paidCents ?? 0),
  };
}

export interface SupplierOption {
  id: string;
  code: string;
  name: string;
}

export async function listSupplierOptions(): Promise<SupplierOption[]> {
  return prisma.supplier.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });
}

export interface BillListItem {
  id: string;
  billNo: string;
  supplierRef: string | null;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  billDate: Date;
  dueDate: Date;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  paidCents: number;
  outstandingCents: number;
  status: BillStatus;
  isOverdue: boolean;
}

function mapBillRow(
  row: {
    id: string;
    billNo: string;
    supplierRef: string | null;
    billDate: Date;
    dueDate: Date;
    subtotalCents: number;
    taxCents: number;
    totalCents: number;
    paidCents: number;
    status: BillStatus;
    supplier: { id: string; code: string; name: string };
  },
  asOf: Date,
): BillListItem {
  return {
    id: row.id,
    billNo: row.billNo,
    supplierRef: row.supplierRef,
    supplierId: row.supplier.id,
    supplierCode: row.supplier.code,
    supplierName: row.supplier.name,
    billDate: row.billDate,
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

function billStatusWhere(
  status: DocumentStatusFilter,
  asOf: Date,
): Prisma.SupplierBillWhereInput {
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

export interface BillFilters {
  supplierId?: string;
  status?: DocumentStatusFilter;
  fromDate?: Date | null;
  toDate?: Date | null;
  search?: string;
  limit?: number;
}

export async function listSupplierBills(
  filters: BillFilters = {},
): Promise<BillListItem[]> {
  const asOf = todayUtc();
  const search = filters.search?.trim();

  const bills = await prisma.supplierBill.findMany({
    where: {
      ...(filters.supplierId ? { supplierId: filters.supplierId } : {}),
      ...billStatusWhere(filters.status ?? "all", asOf),
      ...(filters.fromDate || filters.toDate
        ? {
            billDate: {
              ...(filters.fromDate ? { gte: filters.fromDate } : {}),
              ...(filters.toDate ? { lte: filters.toDate } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { billNo: { contains: search, mode: "insensitive" as const } },
              {
                supplierRef: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                supplier: {
                  name: { contains: search, mode: "insensitive" as const },
                },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ billDate: "desc" }, { billNo: "desc" }],
    take: filters.limit ?? 200,
    select: {
      id: true,
      billNo: true,
      supplierRef: true,
      billDate: true,
      dueDate: true,
      subtotalCents: true,
      taxCents: true,
      totalCents: true,
      paidCents: true,
      status: true,
      supplier: { select: { id: true, code: true, name: true } },
    },
  });

  return bills.map((bill) => mapBillRow(bill, asOf));
}

export async function getSupplierBill(id: string) {
  const bill = await prisma.supplierBill.findUnique({
    where: { id },
    select: {
      id: true,
      billNo: true,
      supplierRef: true,
      billDate: true,
      dueDate: true,
      description: true,
      subtotalCents: true,
      taxCents: true,
      totalCents: true,
      paidCents: true,
      status: true,
      createdAt: true,
      supplier: {
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
          expenseAccount: { select: { code: true, name: true } },
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

  if (!bill) return null;

  return {
    ...bill,
    outstandingCents: bill.totalCents - bill.paidCents,
    isOverdue: isDocumentOverdue(bill.status, bill.dueDate),
  };
}

export async function listOpenBillsForSupplier(supplierId: string) {
  const bills = await prisma.supplierBill.findMany({
    where: {
      supplierId,
      status: { in: ["OPEN", "PARTIALLY_PAID"] },
    },
    orderBy: [{ dueDate: "asc" }, { billNo: "asc" }],
    select: {
      id: true,
      billNo: true,
      billDate: true,
      dueDate: true,
      totalCents: true,
      paidCents: true,
      status: true,
    },
  });

  return bills.map((bill) => ({
    ...bill,
    remainingCents: bill.totalCents - bill.paidCents,
  }));
}

export interface SupplierPaymentListItem {
  id: string;
  paymentNo: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  paymentDate: Date;
  amountCents: number;
  method: PaymentMethod;
  reference: string | null;
  allocationCount: number;
}

export interface SupplierPaymentFilters {
  supplierId?: string;
  fromDate?: Date | null;
  toDate?: Date | null;
  search?: string;
  limit?: number;
}

export async function listSupplierPayments(
  filters: SupplierPaymentFilters = {},
): Promise<SupplierPaymentListItem[]> {
  const search = filters.search?.trim();

  const payments = await prisma.supplierPayment.findMany({
    where: {
      ...(filters.supplierId ? { supplierId: filters.supplierId } : {}),
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
                supplier: {
                  name: { contains: search, mode: "insensitive" as const },
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
      supplier: { select: { id: true, code: true, name: true } },
      _count: { select: { allocations: true } },
    },
  });

  return payments.map(({ supplier, _count, ...payment }) => ({
    ...payment,
    supplierId: supplier.id,
    supplierCode: supplier.code,
    supplierName: supplier.name,
    allocationCount: _count.allocations,
  }));
}

export async function getSupplierPayment(id: string) {
  return prisma.supplierPayment.findUnique({
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
      supplier: {
        select: { id: true, code: true, name: true, isActive: true },
      },
      journalEntry: {
        select: { id: true, entryNo: true, entryDate: true, status: true },
      },
      allocations: {
        select: {
          id: true,
          amountCents: true,
          bill: {
            select: {
              id: true,
              billNo: true,
              billDate: true,
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
