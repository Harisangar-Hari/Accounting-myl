import { z } from "zod";

/**
 * Customer codes are stored uppercase. Letters, digits and hyphens only; the
 * code must start with a letter or digit (no leading hyphen, no spaces).
 * Immutable after creation, like job, site and account codes.
 */
export const CUSTOMER_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]*$/;

/**
 * Trims and uppercases before validating, so "cust-001" and "CUST-001" are the
 * same code (uniqueness is checked on the stored uppercase value).
 */
export const customerCodeSchema = z
  .string()
  .transform((value) => value.trim().toUpperCase())
  .pipe(
    z
      .string()
      .min(1, "Code is required")
      .max(30, "Code must be 30 characters or fewer")
      .regex(
        CUSTOMER_CODE_PATTERN,
        "Use letters, digits and hyphens only, starting with a letter or digit",
      ),
  );

export const customerNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(200, "Name must be 200 characters or fewer");

/** Optional free-text field; empty strings are allowed and stored as null. */
function optionalText(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer`)
    .optional();
}

export const customerEmailSchema = z
  .string()
  .trim()
  .max(254, "Email must be 254 characters or fewer")
  .refine(
    (value) => value === "" || z.email().safeParse(value).success,
    "Enter a valid email address",
  )
  .optional();

export const customerFormSchema = z.object({
  code: customerCodeSchema,
  name: customerNameSchema,
  email: customerEmailSchema,
  phone: optionalText(50, "Phone"),
  address: optionalText(500, "Address"),
  taxId: optionalText(50, "Tax ID"),
  notes: optionalText(2000, "Notes"),
  // The form defaults this to true; Prisma also defaults new rows to active.
  isActive: z.boolean(),
});

export type CustomerFormValues = z.infer<typeof customerFormSchema>;

/** Code is immutable after creation, so the update schema omits it. */
export const updateCustomerSchema = customerFormSchema.omit({ code: true });
export type UpdateCustomerValues = z.infer<typeof updateCustomerSchema>;
