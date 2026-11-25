import Link from "next/link";
import { notFound } from "next/navigation";
import type { AccountType, NormalBalance } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import { AccountStatusButton } from "@/components/accounts/account-status-button";
import { Money } from "@/components/money";
import { ActiveBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getAccount,
  getRecentAccountLines,
} from "@/lib/accounting/queries";
import { formatDateDisplay } from "@/lib/dates";

export const metadata = { title: "Account" };

const TYPE_LABELS: Record<AccountType, string> = {
  ASSET: "Asset",
  LIABILITY: "Liability",
  EQUITY: "Equity",
  REVENUE: "Revenue",
  EXPENSE: "Expense",
};

const BALANCE_LABELS: Record<NormalBalance, string> = {
  DEBIT: "Debit (DR)",
  CREDIT: "Credit (CR)",
};

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [account, lines] = await Promise.all([
    getAccount(id),
    getRecentAccountLines(id, 20),
  ]);

  if (!account) notFound();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {account.code}
            </span>
            <ActiveBadge active={account.isActive} />
            <Badge variant="secondary" className="font-normal">
              {TYPE_LABELS[account.type]}
            </Badge>
          </div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {account.name}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/accounts">
              <ArrowLeft className="size-4" />
              Back to accounts
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/accounts/${account.id}/edit`}>Edit</Link>
          </Button>
          <AccountStatusButton
            accountId={account.id}
            accountCode={account.code}
            isActive={account.isActive}
            journalLineCount={account._count.journalLines}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account info</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Code</p>
            <p className="font-mono font-medium">{account.code}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Normal balance</p>
            <p className="font-medium">
              {BALANCE_LABELS[account.normalBalance]}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Parent</p>
            <p className="font-medium">
              {account.parent ? (
                <Link
                  href={`/accounts/${account.parent.id}`}
                  className="hover:underline"
                >
                  {account.parent.code} — {account.parent.name}
                </Link>
              ) : (
                "—"
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Journal lines</p>
            <p className="font-medium tabular-nums">
              {account._count.journalLines}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Created</p>
            <p className="font-medium">
              {formatDateDisplay(account.createdAt)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Type</p>
            <p className="font-medium">{TYPE_LABELS[account.type]}</p>
          </div>
        </CardContent>
      </Card>

      {account.children.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Child accounts</CardTitle>
            <CardDescription>
              {account.children.length} account
              {account.children.length === 1 ? "" : "s"} nested under this one.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {account.children.map((child) => (
              <Button key={child.id} asChild variant="outline" size="sm">
                <Link href={`/accounts/${child.id}`}>
                  <span className="font-mono text-xs">{child.code}</span>
                  {child.name}
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Recent journal lines</CardTitle>
          <CardDescription>
            The 20 most recent posted lines on this account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {lines.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-background/60 px-6 py-10 text-center text-sm text-muted-foreground">
              No journal activity yet.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border bg-background">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="pl-3">Entry</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="pr-3 text-right">Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => (
                    <TableRow key={line.id} className="odd:bg-muted/25">
                      <TableCell className="pl-3 font-mono text-xs font-medium">
                        <Link
                          href={`/journal/${line.entryId}`}
                          className="hover:underline"
                        >
                          {line.entryNo}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDateDisplay(line.entryDate)}
                      </TableCell>
                      <TableCell>
                        {line.description ?? line.entryDescription}
                      </TableCell>
                      <TableCell className="text-right">
                        {line.debitCents > 0 ? (
                          <Money cents={line.debitCents} />
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </TableCell>
                      <TableCell className="pr-3 text-right">
                        {line.creditCents > 0 ? (
                          <Money cents={line.creditCents} />
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
