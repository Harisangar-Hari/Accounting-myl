import { z } from "zod";
import { parseDateInput } from "@/lib/dates";
import { AMOUNT_INPUT_PATTERN } from "@/lib/money";
import { amountInputSchema } from "./journal";

const optionalText = (max: number, message: string) =>
  z.string().trim().max(max, message).optional();

const optionalId = z.string().trim().optional();

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

export const billLineSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "Description is required")
    .max(200, "Max 200 characters"),
  expenseAccountId: z.string().min(1, "Select an expense account"),
  amount: amountInputSchema,
  taxAmount: optionalTaxSchema,
  jobId: optionalId,
  siteId: optionalId,
});

export const createBillFormSchema = z
  .object({
    supplierId: z.string().min(1, "Select a supplier"),
    billDate: dateSchema("Enter a valid bill date"),
    dueDate: dateSchema("Enter a valid due date"),
    supplierRef: optionalText(64, "Max 64 characters"),
    description: optionalText(500, "Max 500 characters"),
    lines: z
      .array(billLineSchema)
      .min(1, "Add at least one bill line")
      .max(50, "A bill cannot have more than 50 lines"),
  })
  .superRefine((value, ctx) => {
    const billDate = parseDateInput(value.billDate);
    const dueDate = parseDateInput(value.dueDate);
    if (billDate && dueDate && dueDate.getTime() < billDate.getTime()) {
      ctx.addIssue({
        code: "custom",
        path: ["dueDate"],
        message: "Due date cannot be before the bill date",
      });
    }
  });

export type CreateBillFormValues = z.infer<typeof createBillFormSchema>;

export const supplierPaymentAllocationSchema = z.object({
  billId: z.string().min(1, "Select a bill"),
  amount: amountInputSchema,
});

export const createSupplierPaymentFormSchema = z.object({
  supplierId: z.string().min(1, "Select a supplier"),
  paymentDate: dateSchema("Enter a valid payment date"),
  amount: amountInputSchema,
  method: z.enum(["CASH", "BANK", "CHEQUE"]),
  reference: optionalText(64, "Max 64 characters"),
  notes: optionalText(500, "Max 500 characters"),
  allocations: z
    .array(supplierPaymentAllocationSchema)
    .min(1, "Allocate the payment to at least one bill")
    .max(100, "A payment cannot cover more than 100 bills"),
});

export type CreateSupplierPaymentFormValues = z.infer<
  typeof createSupplierPaymentFormSchema
>;
