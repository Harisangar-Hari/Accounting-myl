import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExpenseEntryForm } from "@/components/forms/expense-entry-form";
import { getEntryFormOptions } from "@/lib/accounting/queries";
import { todayDateInput } from "@/lib/dates";

export const metadata = { title: "New expense" };

export default async function NewExpensePage() {
  const { paymentAccounts, expenseAccounts, jobs } =
    await getEntryFormOptions();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            New expense
          </h1>
          <p className="text-sm text-muted-foreground">
            Debits expense accounts and credits the payment account for the same
            total.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/expenses">
            <ArrowLeft className="size-4" />
            Back to expenses
          </Link>
        </Button>
      </div>

      <ExpenseEntryForm
        paymentAccounts={paymentAccounts}
        expenseAccounts={expenseAccounts}
        jobs={jobs}
        today={todayDateInput()}
      />
    </div>
  );
}
