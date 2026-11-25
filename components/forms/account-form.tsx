"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import type { AccountType, NormalBalance } from "@prisma/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  createAccountAction,
  updateAccountAction,
} from "@/lib/actions/accounts";
import {
  accountFormSchema,
  deriveNormalBalance,
  type AccountFormValues,
} from "@/lib/validators/accounts";

/** Form state (schema input) vs submitted values (schema output). */
type AccountFormInput = z.input<typeof accountFormSchema>;
import type { AccountOption } from "@/lib/accounting/queries";

const TYPE_OPTIONS: Array<{ value: AccountType; label: string }> = [
  { value: "ASSET", label: "Asset" },
  { value: "LIABILITY", label: "Liability" },
  { value: "EQUITY", label: "Equity" },
  { value: "REVENUE", label: "Revenue" },
  { value: "EXPENSE", label: "Expense" },
];

const NONE = "none";

export interface AccountFormAccount {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  isActive: boolean;
  parent: { code: string; name: string } | null;
}

interface AccountFormProps {
  mode: "create" | "edit";
  /** Active accounts grouped by type, for the create-mode parent dropdown. */
  parents?: Record<string, AccountOption[]>;
  account?: AccountFormAccount;
}

const EMPTY_VALUES: AccountFormValues = {
  code: "",
  name: "",
  type: "ASSET",
  parentId: null,
  isActive: true,
};

function parentLabel(option: AccountOption): string {
  return `${option.code} — ${option.name}`;
}

export function AccountForm({ mode, parents, account }: AccountFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const form = useForm<AccountFormInput, unknown, AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues:
      mode === "edit" && account
        ? {
            code: account.code,
            name: account.name,
            type: account.type,
            parentId: null,
            isActive: account.isActive,
          }
        : EMPTY_VALUES,
  });

  const selectedType = useWatch({ control: form.control, name: "type" });
  const normalBalance =
    mode === "edit" && account
      ? account.normalBalance
      : deriveNormalBalance(selectedType ?? "ASSET");
  const parentOptions = parents?.[selectedType ?? "ASSET"] ?? [];

  async function onSubmit(values: AccountFormValues): Promise<void> {
    setServerError(null);
    setPending(true);

    const result =
      mode === "create"
        ? await createAccountAction(values)
        : await updateAccountAction(account?.id ?? "", {
            name: values.name,
            isActive: values.isActive,
          });

    if (!result.ok) {
      setServerError(result.error);
      toast.error(result.error);
      if (result.fieldErrors) {
        for (const [path, messages] of Object.entries(result.fieldErrors)) {
          form.setError(path as Parameters<typeof form.setError>[0], {
            type: "server",
            message: messages[0],
          });
        }
      }
      setPending(false);
      return;
    }

    if (mode === "create") {
      router.push(`/accounts?created=${encodeURIComponent(values.code)}`);
      return;
    }

    toast.success(result.message ?? "Account updated.");
    router.push(`/accounts/${account?.id ?? ""}`);
  }

  const isEdit = mode === "edit";
  const cancelHref = isEdit ? `/accounts/${account?.id ?? ""}` : "/accounts";

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-5"
        noValidate
      >
        {serverError ? (
          <div
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {serverError}
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Account details</CardTitle>
            <CardDescription>
              {isEdit
                ? "Only the name and active status can change after creation."
                : "Accounts use numeric codes by convention, unique across the chart."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account code</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="5010"
                      autoComplete="off"
                      inputMode="numeric"
                      className="font-mono"
                      {...field}
                      readOnly={isEdit}
                      disabled={isEdit}
                      onChange={(event) =>
                        field.onChange(
                          event.target.value.replace(/[^0-9]/g, ""),
                        )
                      }
                    />
                  </FormControl>
                  {isEdit ? (
                    <FormDescription>
                      Code cannot be changed after creation.
                    </FormDescription>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Materials – Timber" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  {isEdit ? (
                    <FormControl>
                      <Input
                        value={
                          TYPE_OPTIONS.find(
                            (option) => option.value === account?.type,
                          )?.label ?? ""
                        }
                        readOnly
                        disabled
                      />
                    </FormControl>
                  ) : (
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        // A parent must be the same type, so reset it.
                        form.setValue("parentId", null);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {isEdit ? (
                    <FormDescription>
                      Type cannot be changed after creation.
                    </FormDescription>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <p className="text-sm font-medium">Normal balance</p>
              <div className="flex h-8 items-center rounded-lg border bg-muted/40 px-2.5 font-mono text-sm">
                {normalBalance === "DEBIT" ? "DR" : "CR"}
              </div>
              <p className="text-xs text-muted-foreground">
                Derived automatically from the account type and cannot be set
                manually.
              </p>
            </div>

            {isEdit ? (
              <div className="space-y-2 md:col-span-2">
                <p className="text-sm font-medium">Parent account</p>
                <div className="flex h-8 items-center rounded-lg border bg-muted/40 px-2.5 text-sm">
                  {account?.parent
                    ? `${account.parent.code} — ${account.parent.name}`
                    : "—"}
                </div>
                <p className="text-xs text-muted-foreground">
                  The parent cannot be changed after creation.
                </p>
              </div>
            ) : (
              <FormField
                control={form.control}
                name="parentId"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Parent account (optional)</FormLabel>
                    <Select
                      value={field.value ?? NONE}
                      onValueChange={(value) =>
                        field.onChange(value === NONE ? null : value)
                      }
                      disabled={parentOptions.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="No parent" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>No parent</SelectItem>
                        {parentOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {parentLabel(option)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Only active accounts of the same type can be a parent.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between gap-3 rounded-lg border p-3 md:col-span-2">
                  <div className="space-y-1">
                    <FormLabel>Active</FormLabel>
                    <FormDescription>
                      Inactive accounts are hidden from new entries. Existing
                      journal lines are never affected.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value ?? true}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button asChild variant="outline" disabled={pending}>
            <Link href={cancelHref}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {isEdit ? "Save changes" : "Create Account"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
