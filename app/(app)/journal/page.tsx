import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreatedToast } from "@/components/entries/created-toast";
import { EntryFilters } from "@/components/entries/entry-filters";
import { EntryTable } from "@/components/entries/entry-table";
import { Money } from "@/components/money";
import { listJournalEntries } from "@/lib/accounting/queries";
import { parseOptionalDateParam } from "@/lib/dates";
import { sumCents } from "@/lib/money";

export const metadata = { title: "Journal" };

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    from?: string;
    to?: string;
    created?: string;
  }>;
}) {
  const params = await searchParams;
  const status =
    params.status === "DRAFT" || params.status === "POSTED"
      ? params.status
      : undefined;
  const from = parseOptionalDateParam(params.from);
  const to = parseOptionalDateParam(params.to);

  const entries = await listJournalEntries({ status, from, to });
  const totalCents = sumCents(entries.map((entry) => entry.totalCents));

  return (
    <div className="space-y-5">
      <CreatedToast entryNo={params.created} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Journal
          </h1>
          <p className="text-sm text-muted-foreground">
            All journal entries. {entries.length} entr
            {entries.length === 1 ? "y" : "ies"} ·{" "}
            <Money cents={totalCents} className="text-foreground" />
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/journal/new">
            <Plus className="size-4" />
            General entry
          </Link>
        </Button>
      </div>

      <EntryFilters
        basePath="/journal"
        status={params.status ?? "ALL"}
        from={params.from ?? ""}
        to={params.to ?? ""}
      />

      <EntryTable
        entries={entries}
        emptyMessage="No journal entries match these filters."
      />
    </div>
  );
}
