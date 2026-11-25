import { PrintHeader } from "@/components/reports/print-header";
import { ReportPeriodPicker } from "@/components/reports/report-period-picker";
import {
  OutOfBalanceBanner,
  ReconcilesBadge,
} from "@/components/reports/report-status";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getBalanceSheet, resolveAsOfDate } from "@/lib/accounting/reports";
import { formatDateDisplay, formatDateInput } from "@/lib/dates";
import { formatSignedCents } from "@/lib/money";

export const metadata = { title: "Balance Sheet" };

interface AccountAmount {
  code: string;
  name: string;
  cents: number;
}

function AmountSection({
  label,
  rows,
  totalCents,
}: {
  label: string;
  rows: AccountAmount[];
  totalCents: number;
}) {
  return (
    <div className="space-y-2">
      <h2 className="font-heading text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </h2>
      <Table className="print:text-xs">
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Account</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-muted-foreground">
                No activity.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.code}>
                <TableCell className="font-mono text-xs">{row.code}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatSignedCents(row.cents)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2}>Total {label.toLowerCase()}</TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {formatSignedCents(totalCents)}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ toDate?: string }>;
}) {
  const params = await searchParams;
  const asOfDate = resolveAsOfDate(params);
  const report = await getBalanceSheet({ toDate: asOfDate });
  const asOfLabel = formatDateDisplay(asOfDate);

  const summary: { label: string; cents: number; strong?: boolean }[] = [
    { label: "Total liabilities", cents: report.totalLiabilitiesCents },
    { label: "Total equity", cents: report.totalEquityCents },
    {
      label: "Retained earnings (cumulative profit)",
      cents: report.retainedEarningsCents,
    },
    {
      label: "Total liabilities + equity",
      cents: report.totalLiabilitiesAndEquityCents,
      strong: true,
    },
    { label: "Total assets", cents: report.totalAssetsCents, strong: true },
  ];

  return (
    <div className="space-y-5">
      <PrintHeader title="Balance Sheet" period={`As of ${asOfLabel}`} />

      <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Balance Sheet
          </h1>
          <p className="text-sm text-muted-foreground">
            Position as of {asOfLabel}. Draft entries are excluded.
          </p>
        </div>
        <ReconcilesBadge
          ok={report.isBalanced}
          label="Assets = Liabilities + Equity"
        />
      </div>

      <ReportPeriodPicker
        mode="asOf"
        defaultFromDate={formatDateInput(asOfDate)}
        defaultToDate={formatDateInput(asOfDate)}
      />

      {!report.isBalanced ? (
        <OutOfBalanceBanner message="OUT OF BALANCE — the ledger is inconsistent." />
      ) : null}

      <div className="space-y-4 print:block print:w-full">
        <Card>
          <CardContent>
            <AmountSection
              label="Assets"
              totalCents={report.totalAssetsCents}
              rows={report.assets.map((row) => ({
                code: row.accountCode,
                name: row.accountName,
                cents: row.netDebitCents,
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-6">
            <AmountSection
              label="Liabilities"
              totalCents={report.totalLiabilitiesCents}
              rows={report.liabilities.map((row) => ({
                code: row.accountCode,
                name: row.accountName,
                cents: row.netCreditCents,
              }))}
            />
            <AmountSection
              label="Equity"
              totalCents={report.totalEquityCents}
              rows={report.equity.map((row) => ({
                code: row.accountCode,
                name: row.accountName,
                cents: row.netCreditCents,
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <dl className="space-y-1.5">
              {summary.map((row) => (
                <div
                  key={row.label}
                  className={
                    row.strong
                      ? "flex items-baseline justify-between gap-4 border-t pt-1.5 font-medium first:border-t-0 first:pt-0"
                      : "flex items-baseline justify-between gap-4"
                  }
                >
                  <dt>{row.label}</dt>
                  <dd className="font-mono tabular-nums">
                    {formatSignedCents(row.cents)}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">
              Retained earnings are all-time cumulative revenue minus expenses to
              the as-of date: there is no period-close mechanism yet, so the P&amp;L
              result is included in equity here. Figures in parentheses are
              negative.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
