import { z } from "zod";
import { parseDateInput } from "@/lib/dates";
import { AMOUNT_INPUT_PATTERN } from "@/lib/money";
import { amountInputSchema } from "./journal";

const optionalText = (max: number, message: string) =>
  z.string().trim().max(max, message).optional();

const optionalId = z.string().trim().optional();

/** Optional tax input: empty means 0, otherwise the same grammar as amounts. */
const optionalTaxSchema = z
  .string()
  .trim()
  .max(20, "Max 20 characters")
  .refine(
    (value) => value === "" || AMOUNT_INPUT_PATTERN.test(value),
    "Enter digits with at most 2 decimal places (e.g. 18.00)",
  )
  .optional();

const dateSchema = (message: string) =>
  z.string().refine((value) => parseDateInput(value) !== null, message);

export const invoiceLineSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "Description is required")
    .max(200, "Max 200 characters"),
  revenueAccountId: z.string().min(1, "Select a revenue account"),
  amount: amountInputSchema,
  taxAmount: optionalTaxSchema,
  jobId: optionalId,
  siteId: optionalId,
});

export const createInvoiceFormSchema = z
  .object({
    customerId: z.string().min(1, "Select a customer"),
    invoiceDate: dateSchema("Enter a valid invoice date"),
    dueDate: dateSchema("Enter a valid due date"),
    description: optionalText(500, "Max 500 characters"),
    lines: z
      .array(invoiceLineSchema)
      .min(1, "Add at least one invoice line")
      .max(50, "An invoice cannot have more than 50 lines"),
  })
  .superRefine((value, ctx) => {
    const invoiceDate = parseDateInput(value.invoiceDate);
    const dueDate = parseDateInput(value.dueDate);
    if (invoiceDate && dueDate && dueDate.getTime() < invoiceDate.getTime()) {
      ctx.addIssue({
        code: "custom",
        path: ["dueDate"],
        message: "Due date cannot be before the invoice date",
      });
    }
  });

export type CreateInvoiceFormValues = z.infer<typeof createInvoiceFormSchema>;

export const customerPaymentAllocationSchema = z.object({
  invoiceId: z.string().min(1, "Select an invoice"),
  amount: amountInputSchema,
});

export const createCustomerPaymentFormSchema = z.object({
  customerId: z.string().min(1, "Select a customer"),
  paymentDate: dateSchema("Enter a valid payment date"),
  amount: amountInputSchema,
  method: z.enum(["CASH", "BANK", "CHEQUE"]),
  reference: optionalText(64, "Max 64 characters"),
  notes: optionalText(500, "Max 500 characters"),
  allocations: z
    .array(customerPaymentAllocationSchema)
    .min(1, "Allocate the payment to at least one invoice")
    .max(100, "A payment cannot cover more than 100 invoices"),
});

export type CreateCustomerPaymentFormValues = z.infer<
  typeof createCustomerPaymentFormSchema
>;
