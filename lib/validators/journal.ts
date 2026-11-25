import { z } from "zod";
import { parseDateInput } from "@/lib/dates";
import { AMOUNT_INPUT_PATTERN, toCents } from "@/lib/money";

/**
 * Form amounts arrive as strings. They are validated for at most 2 decimals
 * and converted to integer cents with `toCents` before reaching the database.
 */
export const amountInputSchema = z
  .string()
  .trim()
  .min(1, "Amount is required")
  .regex(
    AMOUNT_INPUT_PATTERN,
    "Enter digits with at most 2 decimal places (e.g. 1250.50)",
  )
  .refine((value) => {
    try {
      return toCents(value) > 0;
    } catch {
      return false;
    }
  }, "Amount must be greater than 0");

const optionalText = (max: number, message: string) =>
  z.string().trim().max(max, message).optional();

const optionalId = z.string().trim().optional();

export const expenseLineSchema = z.object({
  expenseAccountId: z.string().min(1, "Select an expense account"),
  amount: amountInputSchema,
  jobId: optionalId,
  siteId: optionalId,
  description: optionalText(200, "Max 200 characters"),
});

export const expenseEntryFormSchema = z.object({
  entryDate: z
    .string()
    .refine((value) => parseDateInput(value) !== null, "Enter a valid date"),
  description: z
    .string()
    .trim()
    .min(3, "Description must be at least 3 characters")
    .max(200, "Max 200 characters"),
  reference: optionalText(64, "Max 64 characters"),
  paymentAccountId: z.string().min(1, "Select a payment account"),
  lines: z
    .array(expenseLineSchema)
    .min(1, "Add at least one expense line")
    .max(50, "An entry cannot have more than 50 expense lines"),
});

export type ExpenseEntryFormValues = z.infer<typeof expenseEntryFormSchema>;

export const expenseEntrySubmitSchema = expenseEntryFormSchema.extend({
  intent: z.enum(["DRAFT", "POSTED"]),
});

export type ExpenseEntrySubmitValues = z.infer<typeof expenseEntrySubmitSchema>;

export const generalLineSchema = z.object({
  accountId: z.string().min(1, "Select an account"),
  debit: z.string().trim().optional(),
  credit: z.string().trim().optional(),
  jobId: optionalId,
  siteId: optionalId,
  description: optionalText(200, "Max 200 characters"),
});

export const generalEntryFormSchema = z.object({
  entryDate: z
    .string()
    .refine((value) => parseDateInput(value) !== null, "Enter a valid date"),
  description: z
    .string()
    .trim()
    .min(3, "Description must be at least 3 characters")
    .max(200, "Max 200 characters"),
  reference: optionalText(64, "Max 64 characters"),
  lines: z
    .array(generalLineSchema)
    .min(2, "A journal entry needs at least two lines")
    .max(50, "An entry cannot have more than 50 lines"),
});

export type GeneralEntryFormValues = z.infer<typeof generalEntryFormSchema>;

export const generalEntrySubmitSchema = generalEntryFormSchema.extend({
  intent: z.enum(["DRAFT", "POSTED"]),
});

export type GeneralEntrySubmitValues = z.infer<typeof generalEntrySubmitSchema>;
