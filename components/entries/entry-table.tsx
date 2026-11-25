import Link from "next/link";
import type { EntryListItem } from "@/lib/accounting/queries";
import { formatDateDisplay } from "@/lib/dates";
import { Money } from "@/components/money";
import { EntryTypeBadge, StatusBadge } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface EntryTableProps {
  entries: EntryListItem[];
  showType?: boolean;
  emptyMessage?: string;
}

export function EntryTable({
  entries,
  showType = true,
  emptyMessage = "No journal entries found.",
}: EntryTableProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-background/60 px-6 py-12 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="pl-3">Entry #</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            {showType ? <TableHead>Type</TableHead> : null}
            <TableHead>Status</TableHead>
            <TableHead className="pr-3 text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id} className="relative odd:bg-muted/25">
              <TableCell className="pl-3 font-mono text-xs font-medium">
                <Link
                  href={`/journal/${entry.id}`}
                  className="after:absolute after:inset-0 after:content-[''] hover:underline"
                >
                  {entry.entryNo}
                </Link>
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {formatDateDisplay(entry.entryDate)}
              </TableCell>
              <TableCell className="max-w-[26rem]">
                <span className="block truncate">{entry.description}</span>
                {entry.reference ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    Ref: {entry.reference}
                  </span>
                ) : null}
              </TableCell>
              {showType ? (
                <TableCell>
                  <EntryTypeBadge entryType={entry.entryType} />
                </TableCell>
              ) : null}
              <TableCell>
                <StatusBadge status={entry.status} />
              </TableCell>
              <TableCell className="pr-3 text-right">
                <Money cents={entry.totalCents} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
