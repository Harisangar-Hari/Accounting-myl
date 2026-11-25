import { z } from "zod";

/**
 * Job codes are stored uppercase. Letters, digits and hyphens only; the code
 * must start with a letter or digit (no leading hyphen, no spaces).
 */
export const JOB_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]*$/;

/**
 * Trims and uppercases the input before validating, so "job-2025-001" and
 * "JOB-2025-001" are the same code (uniqueness is checked on the stored value).
 */
export const jobCodeSchema = z
  .string()
  .transform((value) => value.trim().toUpperCase())
  .pipe(
    z
      .string()
      .min(1, "Code is required")
      .max(50, "Code must be 50 characters or fewer")
      .regex(
        JOB_CODE_PATTERN,
        "Use letters, digits and hyphens only, starting with a letter or digit",
      ),
  );

export const jobNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(200, "Name must be 200 characters or fewer");

export const jobFormSchema = z.object({
  code: jobCodeSchema,
  name: jobNameSchema,
  // "" from the form is sent as null; both mean "no customer".
  customerId: z.string().nullish(),
  // The form defaults this to true; Prisma also defaults new rows to active.
  isActive: z.boolean(),
});

export type JobFormValues = z.infer<typeof jobFormSchema>;

/** Same shape as the create schema; the action excludes the record itself. */
export const UpdateJobSchema = jobFormSchema;
export type UpdateJobValues = JobFormValues;
