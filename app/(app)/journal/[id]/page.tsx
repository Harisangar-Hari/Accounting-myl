import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PostEntryButton } from "@/components/entries/post-entry-button";
import { Money } from "@/components/money";
import { EntryTypeBadge, StatusBadge } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getJournalEntry } from "@/lib/accounting/queries";
import { formatDateDisplay } from "@/lib/dates";
import { sumCents } from "@/lib/money";

export const metadata = { title: "Journal entry" };

export default async function JournalEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const entry = await getJournalEntry(id);

  if (!entry) notFound();

  const debitTotalCents = sumCents(
    entry.lines.map((line) => line.debitCents),
  );
  const creditTotalCents = sumCents(
    entry.lines.map((line) => line.creditCents),
  );
  const balanced = debitTotalCents === creditTotalCents;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/journal">
            <ArrowLeft className="size-4" />
            Back to journal
          </Link>
        </Button>
        {entry.status === "DRAFT" ? (
          <PostEntryButton entryId={entry.id} />
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="font-mono text-base">
              {entry.entryNo}
            </CardTitle>
            <EntryTypeBadge entryType={entry.entryType} />
            <StatusBadge status={entry.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Entry date</p>
              <p className="font-medium">{formatDateDisplay(entry.entryDate)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Reference</p>
              <p className="font-medium">{entry.reference ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Created by</p>
              <p className="font-medium">
                {entry.createdBy.name ?? entry.createdBy.email}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Posted at</p>
              <p className="font-medium">
                {entry.postedAt
                  ? `${formatDateDisplay(entry.postedAt)} · ${entry.postedAt.toISOString().slice(11, 16)} UTC`
                  : "Not posted"}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Description</p>
            <p className="font-medium">{entry.description}</p>
          </div>

          {entry.status === "POSTED" ? (
            <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <Lock className="mt-0.5 size-3.5 shrink-0" />
              <span>
                This entry is POSTED and immutable — it cannot be edited or
                deleted.
              </span>
            </div>
          ) : (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              This entry is a DRAFT and is not yet reflected in the ledger. Post
              it to make it final.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="py-0">
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-12 pl-3">#</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Line note</TableHead>
                <TableHead>Job / Site</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="pr-3 text-right">Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entry.lines.map((line) => (
                <TableRow key={line.id} className="odd:bg-muted/25">
                  <TableCell className="pl-3 text-xs text-muted-foreground">
                    {line.lineNo}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">
                      {line.account.code}
                    </span>
                    <span className="ml-2 font-medium">{line.account.name}</span>
                  </TableCell>
                  <TableCell className="max-w-[18rem] truncate text-muted-foreground">
                    {line.description ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {line.job ? (
                      <span>
                        {line.job.code}
                        {line.site ? ` · ${line.site.code}` : ""}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {line.debitCents > 0 ? (
                      <Money cents={line.debitCents} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-3 text-right">
                    {line.creditCents > 0 ? (
                      <Money cents={line.creditCents} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="pl-3 font-medium">
                  Totals
                </TableCell>
                <TableCell className="text-right">
                  <Money cents={debitTotalCents} className="font-semibold" />
                </TableCell>
                <TableCell className="pr-3 text-right">
                  <Money cents={creditTotalCents} className="font-semibold" />
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
        {balanced ? (
          <Badge
            variant="outline"
            className="border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
          >
            Balanced ✓
          </Badge>
        ) : (
          <Badge variant="destructive">Out of balance</Badge>
        )}
        <span>
          Debits must equal credits for an entry to exist in this ledger.
        </span>
      </div>
    </div>
  );
}
