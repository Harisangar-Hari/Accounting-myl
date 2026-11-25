import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GeneralEntryForm } from "@/components/forms/general-entry-form";
import { getGeneralEntryOptions } from "@/lib/accounting/queries";
import { todayDateInput } from "@/lib/dates";

export const metadata = { title: "New journal entry" };

export default async function NewJournalEntryPage() {
  const { accounts } = await getGeneralEntryOptions();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            New general journal entry
          </h1>
          <p className="text-sm text-muted-foreground">
            Manual double-entry. Prefer the expense form for supplier or site
            costs.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/journal">
            <ArrowLeft className="size-4" />
            Back to journal
          </Link>
        </Button>
      </div>

      <GeneralEntryForm accounts={accounts} today={todayDateInput()} />
    </div>
  );
}
