"use client";

import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { AccountOption } from "@/lib/accounting/queries";
import { createGeneralEntryAction } from "@/lib/actions/entries";
import { formatCents, toCents } from "@/lib/money";
import {
  generalEntryFormSchema,
  type GeneralEntryFormValues,
} from "@/lib/validators/journal";
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
  Form,
  FormControl,
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

const EMPTY_LINE: GeneralEntryFormValues["lines"][number] = {
  accountId: "",
  debit: "",
  credit: "",
  description: "",
};

interface GeneralEntryFormProps {
  accounts: (AccountOption & { type: string })[];
  today: string;
}

function sumField(
  lines: GeneralEntryFormValues["lines"] | undefined,
  key: "debit" | "credit",
): number {
  return (lines ?? []).reduce((sum, line) => {
    try {
      return sum + toCents(line?.[key]?.trim() ? line[key] : "0");
    } catch {
      return sum;
    }
  }, 0);
}

export function GeneralEntryForm({ accounts, today }: GeneralEntryFormProps) {
  const form = useForm<GeneralEntryFormValues>({
    resolver: zodResolver(generalEntryFormSchema),
    defaultValues: {
      entryDate: today,
      description: "",
      reference: "",
      lines: [{ ...EMPTY_LINE }, { ...EMPTY_LINE }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  const watchedLines = useWatch({ control: form.control, name: "lines" });
  const [serverError, setServerError] = useState<string | null>(null);
  const [pendingIntent, setPendingIntent] = useState<"DRAFT" | "POSTED" | null>(
    null,
  );

  const debitTotal = sumField(watchedLines, "debit");
  const creditTotal = sumField(watchedLines, "credit");
  const balanced = debitTotal > 0 && debitTotal === creditTotal;

  async function submit(
    values: GeneralEntryFormValues,
    intent: "DRAFT" | "POSTED",
  ) {
    setServerError(null);
    setPendingIntent(intent);
    const result = await createGeneralEntryAction({ ...values, intent });
    if (!result.ok) {
      setServerError(result.error);
      toast.error(result.error);
      setPendingIntent(null);
    }
  }

  const pending = pendingIntent !== null;

  return (
    <Form {...form}>
      <form
        onSubmit={(event) => event.preventDefault()}
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
            <CardTitle>Entry details</CardTitle>
            <CardDescription>
              General journal entry. Debits must equal credits before it can be
              saved.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="entryDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Entry date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference (optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Source document no."
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Owner capital contribution"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Lines</CardTitle>
              <CardDescription>
                Each line takes either a debit or a credit, never both.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ ...EMPTY_LINE })}
              disabled={fields.length >= 50}
            >
              <Plus className="size-4" />
              Add line
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="rounded-lg border bg-background p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Line {index + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => remove(index)}
                    disabled={fields.length <= 2}
                    aria-label={`Remove line ${index + 1}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-12">
                  <div className="md:col-span-5">
                    <FormField
                      control={form.control}
                      name={`lines.${index}.accountId`}
                      render={({ field: lineField }) => (
                        <FormItem>
                          <FormLabel>Account</FormLabel>
                          <Select
                            value={lineField.value}
                            onValueChange={lineField.onChange}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select account" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {accounts.map((account) => (
                                <SelectItem key={account.id} value={account.id}>
                                  {account.code} — {account.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <FormField
                      control={form.control}
                      name={`lines.${index}.debit`}
                      render={({ field: lineField }) => (
                        <FormItem>
                          <FormLabel>Debit</FormLabel>
                          <FormControl>
                            <Input
                              inputMode="decimal"
                              placeholder="0.00"
                              className="text-right font-mono"
                              {...lineField}
                              value={lineField.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <FormField
                      control={form.control}
                      name={`lines.${index}.credit`}
                      render={({ field: lineField }) => (
                        <FormItem>
                          <FormLabel>Credit</FormLabel>
                          <FormControl>
                            <Input
                              inputMode="decimal"
                              placeholder="0.00"
                              className="text-right font-mono"
                              {...lineField}
                              value={lineField.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="md:col-span-3">
                    <FormField
                      control={form.control}
                      name={`lines.${index}.description`}
                      render={({ field: lineField }) => (
                        <FormItem>
                          <FormLabel>Note (optional)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Line note"
                              {...lineField}
                              value={lineField.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="sticky bottom-0 z-30 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Debits</p>
                <p className="font-mono font-semibold tabular-nums">
                  {formatCents(debitTotal)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Credits</p>
                <p className="font-mono font-semibold tabular-nums">
                  {formatCents(creditTotal)}
                </p>
              </div>
              {balanced ? (
                <Badge
                  variant="outline"
                  className="border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                >
                  Balanced ✓
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  {debitTotal === 0 && creditTotal === 0
                    ? "No amounts yet"
                    : "Not balanced"}
                </Badge>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={form.handleSubmit((values) => submit(values, "DRAFT"))}
              >
                {pendingIntent === "DRAFT" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Save as Draft
              </Button>
              <Button
                type="button"
                disabled={pending}
                onClick={form.handleSubmit((values) =>
                  submit(values, "POSTED"),
                )}
              >
                {pendingIntent === "POSTED" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Save &amp; Post
              </Button>
            </div>
          </div>
        </div>
      </form>
    </Form>
  );
}
