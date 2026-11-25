import { z } from "zod";

/**
 * Supplier codes use the same alphabet as customer codes and are stored
 * uppercase. Immutable after creation.
 */
export const SUPPLIER_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]*$/;

export const supplierCodeSchema = z
  .string()
  .transform((value) => value.trim().toUpperCase())
  .pipe(
    z
      .string()
      .min(1, "Code is required")
      .max(30, "Code must be 30 characters or fewer")
      .regex(
        SUPPLIER_CODE_PATTERN,
        "Use letters, digits and hyphens only, starting with a letter or digit",
      ),
  );

export const supplierNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(200, "Name must be 200 characters or fewer");

function optionalText(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer`)
    .optional();
}

export const supplierEmailSchema = z
  .string()
  .trim()
  .max(254, "Email must be 254 characters or fewer")
  .refine(
    (value) => value === "" || z.email().safeParse(value).success,
    "Enter a valid email address",
  )
  .optional();

export const supplierFormSchema = z.object({
  code: supplierCodeSchema,
  name: supplierNameSchema,
  email: supplierEmailSchema,
  phone: optionalText(50, "Phone"),
  address: optionalText(500, "Address"),
  taxId: optionalText(50, "Tax ID"),
  notes: optionalText(2000, "Notes"),
  isActive: z.boolean(),
});

export type SupplierFormValues = z.infer<typeof supplierFormSchema>;

/** Code is immutable after creation, so the update schema omits it. */
export const updateSupplierSchema = supplierFormSchema.omit({ code: true });
export type UpdateSupplierValues = z.infer<typeof updateSupplierSchema>;
