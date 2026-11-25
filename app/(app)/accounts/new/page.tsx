import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountForm } from "@/components/forms/account-form";
import {
  listAccounts,
  type AccountOption,
} from "@/lib/accounting/queries";
import { ACCOUNT_TYPES } from "@/lib/validators/accounts";

export const metadata = { title: "New account" };

export default async function NewAccountPage() {
  const activeAccounts = await listAccounts();

  const parents = ACCOUNT_TYPES.reduce(
    (grouped, type) => {
      grouped[type] = activeAccounts
        .filter((account) => account.type === type)
        .map<AccountOption>((account) => ({
          id: account.id,
          code: account.code,
          name: account.name,
        }));
      return grouped;
    },
    {} as Record<string, AccountOption[]>,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            New account
          </h1>
          <p className="text-sm text-muted-foreground">
            Add an account to the chart. The normal balance follows from the
            type you choose.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/accounts">
            <ArrowLeft className="size-4" />
            Back to accounts
          </Link>
        </Button>
      </div>

      <AccountForm mode="create" parents={parents} />
    </div>
  );
}
