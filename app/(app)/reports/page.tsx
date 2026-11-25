import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Reports" };

const REPORTS = [
  {
    href: "/reports/trial-balance",
    title: "Trial Balance",
    description:
      "Debits and credits by account for a period, with the balancing check.",
  },
  {
    href: "/reports/profit-and-loss",
    title: "Profit & Loss",
    description: "Revenue and expenses for a period, and the net profit or loss.",
  },
  {
    href: "/reports/balance-sheet",
    title: "Balance Sheet",
    description:
      "Assets, liabilities and equity as of a date, including retained earnings.",
  },
  {
    href: "/reports/expenses-by-job",
    title: "Expenses by Job",
    description: "How much was spent per job, with unallocated costs separated.",
  },
  {
    href: "/reports/expenses-by-site",
    title: "Expenses by Site",
    description: "Expense totals per site within each job.",
  },
  {
    href: "/reports/ar-aging",
    title: "AR Aging",
    description:
      "Unpaid customer invoices by days past due, reconciled against the AR ledger account.",
  },
  {
    href: "/reports/ap-aging",
    title: "AP Aging",
    description:
      "Unpaid supplier bills by days past due, reconciled against the AP ledger account.",
  },
  {
    href: "/reports/customer-balances",
    title: "Customer Balances",
    description: "Invoiced, paid and outstanding per customer.",
  },
  {
    href: "/reports/supplier-balances",
    title: "Supplier Balances",
    description: "Billed, paid and outstanding per supplier.",
  },
];

export default function ReportsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Reports
        </h1>
        <p className="text-sm text-muted-foreground">
          Read-only financial statements built from posted journal entries. Draft
          entries are never included.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {REPORTS.map((report) => (
          <Link key={report.href} href={report.href} className="block">
            <Card className="h-full transition-colors hover:bg-muted/40">
              <CardHeader>
                <CardTitle>{report.title}</CardTitle>
                <CardDescription>{report.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs font-medium text-primary">Open report →</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
