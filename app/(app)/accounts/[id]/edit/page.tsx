import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountForm } from "@/components/forms/account-form";
import { getAccount } from "@/lib/accounting/queries";

export const metadata = { title: "Edit account" };

export default async function EditAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const account = await getAccount(id);

  if (!account) notFound();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Edit account
          </h1>
          <p className="text-sm text-muted-foreground">
            {account.code} — {account.name}
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/accounts/${account.id}`}>
            <ArrowLeft className="size-4" />
            Back to account
          </Link>
        </Button>
      </div>

      <AccountForm
        mode="edit"
        account={{
          id: account.id,
          code: account.code,
          name: account.name,
          type: account.type,
          normalBalance: account.normalBalance,
          isActive: account.isActive,
          parent: account.parent
            ? { code: account.parent.code, name: account.parent.name }
            : null,
        }}
      />
    </div>
  );
}
