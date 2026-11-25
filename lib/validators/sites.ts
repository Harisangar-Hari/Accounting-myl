import { z } from "zod";

/** Site codes follow the same rules as job codes. */
export const SITE_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]*$/;

export const siteCodeSchema = z
  .string()
  .transform((value) => value.trim().toUpperCase())
  .pipe(
    z
      .string()
      .min(1, "Code is required")
      .max(50, "Code must be 50 characters or fewer")
      .regex(
        SITE_CODE_PATTERN,
        "Use letters, digits and hyphens only, starting with a letter or digit",
      ),
  );

export const siteNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(200, "Name must be 200 characters or fewer");

/**
 * jobId is intentionally NOT part of the form schema: it comes from the URL and
 * is validated in the Server Action. Unknown keys (such as jobId) are stripped.
 */
export const siteFormSchema = z.object({
  code: siteCodeSchema,
  name: siteNameSchema,
});

export type SiteFormValues = z.infer<typeof siteFormSchema>;

/** Same shape as the create schema; the action excludes the record itself. */
export const UpdateSiteSchema = siteFormSchema;
export type UpdateSiteValues = SiteFormValues;
