import Link from "next/link";
import { BookOpen, CheckCircle2, FileEdit, ListTree, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EntryTable } from "@/components/entries/entry-table";
import { listJournalEntries } from "@/lib/accounting/queries";
import { prisma } from "@/lib/db";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [draftCount, postedCount, accountCount, recent] = await Promise.all([
    prisma.journalEntry.count({ where: { status: "DRAFT" } }),
    prisma.journalEntry.count({ where: { status: "POSTED" } }),
    prisma.account.count({ where: { isActive: true } }),
    listJournalEntries({ limit: 6 }),
  ]);

  const stats = [
    {
      label: "Draft entries",
      value: draftCount,
      hint: "Editable, not in the ledger",
      icon: FileEdit,
    },
    {
      label: "Posted entries",
      value: postedCount,
      hint: "Immutable, counted in the ledger",
      icon: CheckCircle2,
    },
    {
      label: "Active accounts",
      value: accountCount,
      hint: "Chart of accounts",
      icon: ListTree,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            General ledger overview for construction operations.
          </p>
        </div>
        <Button asChild>
          <Link href="/expenses/new">
            <Plus className="size-4" />
            Record expense
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {stat.label}
                  </p>
                  <p className="font-heading text-2xl font-semibold tabular-nums">
                    {stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{stat.hint}</p>
                </div>
                <span className="rounded-md bg-muted p-2 text-muted-foreground">
                  <Icon className="size-4" />
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="size-4 text-muted-foreground" />
              Recent journal entries
            </CardTitle>
            <CardDescription>
              Latest activity across expenses and general journals.
            </CardDescription>
          </div>
          <Badge variant="secondary">{recent.length} shown</Badge>
        </CardHeader>
        <CardContent>
          <EntryTable
            entries={recent}
            emptyMessage="No journal entries yet. Record your first expense to get started."
          />
          <div className="mt-3 flex justify-end">
            <Button asChild variant="ghost" size="sm">
              <Link href="/journal">View all entries</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
