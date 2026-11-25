import { formatDateDisplay, parseDateInput, todayDateInput } from "@/lib/dates";

/**
 * Print-only report letterhead: company, report title, period and generation
 * date. Hidden on screen (the page heading covers that) and shown by the
 * browser's print stylesheet.
 */
export function PrintHeader({
  title,
  period,
}: {
  title: string;
  period: string;
}) {
  const generatedDate = parseDateInput(todayDateInput());
  const generated = generatedDate
    ? formatDateDisplay(generatedDate)
    : todayDateInput();
  const company = process.env.COMPANY_NAME ?? "Construction Company";

  return (
    <div className="hidden print:block">
      <div className="border-b pb-2">
        <p className="text-xs tracking-wide uppercase">{company}</p>
        <h1 className="font-heading text-lg font-semibold">{title}</h1>
        <p className="text-xs">{period}</p>
        <p className="text-xs text-muted-foreground">Generated {generated}</p>
      </div>
    </div>
  );
}
