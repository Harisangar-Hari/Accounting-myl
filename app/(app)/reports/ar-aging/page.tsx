import Link from "next/link";
import { PrintHeader } from "@/components/reports/print-header";
import { ReportPeriodPicker } from "@/components/reports/report-period-picker";
import { ReconcilesBadge } from "@/components/reports/report-status";
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
import { AR_ACCOUNT_CODE } from "@/lib/accounting/ar";
import {
  getAccountBalanceByCode,
  getArAging,
  resolveAgingAsOfDate,
} from "@/lib/accounting/reports";
import { formatDateDisplay, formatDateInput } from "@/lib/dates";
import { formatCents } from "@/lib/money";

export const metadata = { title: "AR Aging" };

export default async function ArAgingPage({
  searchParams,
}: {
  searchParams: Promise<{ asOfDate?: string }>;
}) {
  const params = await searchParams;
  const asOfDate = resolveAgingAsOfDate(params);
  const [report, ledgerCents] = await Promise.all([
    getArAging(asOfDate),
    getAccountBalanceByCode(AR_ACCOUNT_CODE, asOfDate),
  ]);

  const reconciles = ledgerCents !== null && ledgerCents === report.totals.totalCents;
  const asOfLabel = formatDateDisplay(asOfDate);

  return (
    <div className="space-y-5">
      <PrintHeader title="AR Aging" period={`As of ${asOfLabel}`} />

      <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            AR Aging
          </h1>
          <p className="text-sm text-muted-foreground">
            Unpaid customer invoices as of {asOfLabel}, bucketed by days past
            due. Overdue is computed, never stored.
          </p>
        </div>
        <ReconcilesBadge
          ok={reconciles}
          label="AR ledger agrees"
          failLabel="AR ledger differs"
        />
      </div>

      <ReportPeriodPicker
        mode="asOf"
        defaultFromDate={formatDateInput(asOfDate)}
        defaultToDate={formatDateInput(asOfDate)}
      />

      <Card>
        <CardContent className="space-y-3">
          <div className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">
                Outstanding per invoices
              </p>
              <p className="font-mono text-lg font-semibold tabular-nums">
                {formatCents(report.totals.totalCents)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Ledger balance, 1100 Accounts Receivable
              </p>
              <p className="font-mono text-lg font-semibold tabular-nums">
                {ledgerCents === null ? "Missing account" : formatCents(ledgerCents)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Difference</p>
              <p className="font-mono text-lg font-semibold tabular-nums">
                {ledgerCents === null
                  ? "—"
                  : formatCents(ledgerCents - report.totals.totalCents)}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            These are two independent computations — invoice documents versus
            posted journal lines. They must be equal; a difference means an
            invoice or receipt did not post its entry, or a manual general
            journal entry touched 1100 (allowed by the system, but AR should be
            driven by the invoice and receipt forms).{" "}
            <Link
              href={`/reports/balance-sheet?toDate=${formatDateInput(asOfDate)}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Open the Balance Sheet
            </Link>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Table className="print:text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">1–30</TableHead>
                <TableHead className="text-right">31–60</TableHead>
                <TableHead className="text-right">61–90</TableHead>
                <TableHead className="text-right">90+</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-6 text-center text-muted-foreground"
                  >
                    No unpaid invoices as of this date.
                  </TableCell>
                </TableRow>
              ) : (
                report.rows.map((row) => (
                  <TableRow key={row.customerId}>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">
                        {row.customerCode}
                      </span>
                      <span className="ml-2 font-medium">{row.customerName}</span>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {row.currentCents === 0 ? "" : formatCents(row.currentCents)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {row.days1To30Cents === 0
                        ? ""
                        : formatCents(row.days1To30Cents)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {row.days31To60Cents === 0
                        ? ""
                        : formatCents(row.days31To60Cents)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {row.days61To90Cents === 0
                        ? ""
                        : formatCents(row.days61To90Cents)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {row.days90PlusCents === 0
                        ? ""
                        : formatCents(row.days90PlusCents)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium tabular-nums">
                      {formatCents(row.totalCents)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Totals</TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatCents(report.totals.currentCents)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatCents(report.totals.days1To30Cents)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatCents(report.totals.days31To60Cents)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatCents(report.totals.days61To90Cents)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatCents(report.totals.days90PlusCents)}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold tabular-nums">
                  {formatCents(report.totals.totalCents)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
