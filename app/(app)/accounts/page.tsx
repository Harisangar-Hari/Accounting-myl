import Link from "next/link";
import { Plus } from "lucide-react";
import type { AccountType } from "@prisma/client";
import { AccountStatusButton } from "@/components/accounts/account-status-button";
import { SavedToast } from "@/components/saved-toast";
import { ActiveBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listAccounts } from "@/lib/accounting/queries";

export const metadata = { title: "Chart of accounts" };

type AccountFilter = "all" | "inactive" | Lowercase<AccountType>;

const FILTERS: Array<{ value: AccountFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "asset", label: "Asset" },
  { value: "liability", label: "Liability" },
  { value: "equity", label: "Equity" },
  { value: "revenue", label: "Revenue" },
  { value: "expense", label: "Expense" },
  { value: "inactive", label: "Inactive" },
];

const TYPE_LABELS: Record<AccountType, string> = {
  ASSET: "Asset",
  LIABILITY: "Liability",
  EQUITY: "Equity",
  REVENUE: "Revenue",
  EXPENSE: "Expense",
};

function parseFilter(value: string | undefined): AccountFilter {
  return FILTERS.some((filter) => filter.value === value)
    ? (value as AccountFilter)
    : "all";
}

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; created?: string }>;
}) {
  const params = await searchParams;
  const filter = parseFilter(params.filter);
  const accounts = await listAccounts({ includeInactive: true });

  const visible =
    filter === "all"
      ? accounts
      : filter === "inactive"
        ? accounts.filter((account) => !account.isActive)
        : accounts.filter(
            (account) => account.type.toLowerCase() === filter,
          );

  return (
    <div className="space-y-5">
      <SavedToast
        message={
          params.created ? `Account ${params.created} created.` : undefined
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Chart of Accounts
          </h1>
          <p className="text-sm text-muted-foreground">
            {accounts.length} account{accounts.length === 1 ? "" : "s"} in the
            chart. Normal balances are derived from account type.
          </p>
        </div>
        <Button asChild>
          <Link href="/accounts/new">
            <Plus className="size-4" />
            New Account
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((tab) => {
          const active = tab.value === filter;
          return (
            <Button
              key={tab.value}
              asChild
              size="sm"
              variant={active ? "default" : "outline"}
            >
              <Link
                href={
                  tab.value === "all" ? "/accounts" : `/accounts?filter=${tab.value}`
                }
                aria-current={active ? "page" : undefined}
              >
                {tab.label}
              </Link>
            </Button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-background/60 px-6 py-12 text-center text-sm text-muted-foreground">
          No accounts match this filter.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-3">Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Normal Balance</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-3 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((account) => (
                <TableRow key={account.id} className="relative odd:bg-muted/25">
                  <TableCell className="pl-3 font-mono text-xs font-medium">
                    <Link
                      href={`/accounts/${account.id}`}
                      className="after:absolute after:inset-0 after:content-[''] hover:underline"
                    >
                      {account.code}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">{account.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-normal">
                      {TYPE_LABELS[account.type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {account.normalBalance === "DEBIT" ? "DR" : "CR"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {account.parentCode
                      ? `${account.parentCode} — ${account.parentName}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <ActiveBadge active={account.isActive} />
                  </TableCell>
                  <TableCell className="pr-3">
                    <div className="relative z-10 flex items-center justify-end gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/accounts/${account.id}/edit`}>Edit</Link>
                      </Button>
                      <AccountStatusButton
                        accountId={account.id}
                        accountCode={account.code}
                        isActive={account.isActive}
                        journalLineCount={account.journalLineCount}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
