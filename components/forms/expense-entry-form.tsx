"use client";

import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { AccountOption, JobOption } from "@/lib/accounting/queries";
import { createExpenseEntryAction } from "@/lib/actions/entries";
import { formatCents, toCents } from "@/lib/money";
import {
  expenseEntryFormSchema,
  type ExpenseEntryFormValues,
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

const NONE = "__none";

const EMPTY_LINE: ExpenseEntryFormValues["lines"][number] = {
  expenseAccountId: "",
  amount: "",
  jobId: "",
  siteId: "",
  description: "",
};

interface ExpenseEntryFormProps {
  paymentAccounts: AccountOption[];
  expenseAccounts: AccountOption[];
  jobs: JobOption[];
  today: string;
}

export function ExpenseEntryForm({
  paymentAccounts,
  expenseAccounts,
  jobs,
  today,
}: ExpenseEntryFormProps) {
  const form = useForm<ExpenseEntryFormValues>({
    resolver: zodResolver(expenseEntryFormSchema),
    defaultValues: {
      entryDate: today,
      description: "",
      reference: "",
      paymentAccountId: "",
      lines: [{ ...EMPTY_LINE }],
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

  const totalCents = (watchedLines ?? []).reduce((sum, line) => {
    try {
      return sum + toCents(line?.amount?.trim() ? line.amount : "0");
    } catch {
      return sum;
    }
  }, 0);

  async function submit(
    values: ExpenseEntryFormValues,
    intent: "DRAFT" | "POSTED",
  ) {
    setServerError(null);
    setPendingIntent(intent);
    const result = await createExpenseEntryAction({ ...values, intent });

    // Success redirects to /expenses (Next handles the redirect); only
    // validation or accounting failures return a result.
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
            <CardTitle>Expense details</CardTitle>
            <CardDescription>
              One payment account is credited for the total of all expense
              lines.
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
                      placeholder="Supplier invoice no."
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
                      placeholder="e.g. Cement purchase for Site A"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="paymentAccountId"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Paid from</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={paymentAccounts.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select cash / bank account" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {paymentAccounts.map((account) => (
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Expense lines</CardTitle>
              <CardDescription>
                Debits to expense accounts. Amounts are entered with at most 2
                decimals.
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
            {fields.map((field, index) => {
              const jobId = watchedLines?.[index]?.jobId ?? "";
              const sites =
                jobs.find((job) => job.id === jobId)?.sites ?? [];

              return (
                <div
                  key={field.id}
                  className="rounded-lg border bg-background p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Line {index + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                      aria-label={`Remove line ${index + 1}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-12">
                    <div className="md:col-span-5">
                      <FormField
                        control={form.control}
                        name={`lines.${index}.expenseAccountId`}
                        render={({ field: lineField }) => (
                          <FormItem>
                            <FormLabel>Expense account</FormLabel>
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
                                {expenseAccounts.map((account) => (
                                  <SelectItem
                                    key={account.id}
                                    value={account.id}
                                  >
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

                    <div className="md:col-span-3">
                      <FormField
                        control={form.control}
                        name={`lines.${index}.amount`}
                        render={({ field: lineField }) => (
                          <FormItem>
                            <FormLabel>Amount</FormLabel>
                            <FormControl>
                              <Input
                                inputMode="decimal"
                                autoComplete="off"
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

                    <div className="md:col-span-4">
                      <FormField
                        control={form.control}
                        name={`lines.${index}.jobId`}
                        render={({ field: lineField }) => (
                          <FormItem>
                            <FormLabel>Job (optional)</FormLabel>
                            <Select
                              value={lineField.value || NONE}
                              onValueChange={(value) => {
                                lineField.onChange(value === NONE ? "" : value);
                                form.setValue(`lines.${index}.siteId`, "");
                              }}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="No job" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value={NONE}>No job</SelectItem>
                                {jobs.map((job) => (
                                  <SelectItem key={job.id} value={job.id}>
                                    {job.code} — {job.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="md:col-span-4">
                      <FormField
                        control={form.control}
                        name={`lines.${index}.siteId`}
                        render={({ field: lineField }) => (
                          <FormItem>
                            <FormLabel>Site (optional)</FormLabel>
                            <Select
                              value={lineField.value || NONE}
                              onValueChange={(value) =>
                                lineField.onChange(value === NONE ? "" : value)
                              }
                              disabled={!jobId || sites.length === 0}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full">
                                  <SelectValue
                                    placeholder={
                                      jobId ? "No site" : "Select a job first"
                                    }
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value={NONE}>No site</SelectItem>
                                {sites.map((site) => (
                                  <SelectItem key={site.id} value={site.id}>
                                    {site.code} — {site.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="md:col-span-8">
                      <FormField
                        control={form.control}
                        name={`lines.${index}.description`}
                        render={({ field: lineField }) => (
                          <FormItem>
                            <FormLabel>Line note (optional)</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g. 250 tonnes OPC"
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
              );
            })}

            {form.formState.errors.lines?.root ? (
              <p className="text-xs font-medium text-destructive">
                {form.formState.errors.lines.root.message}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <div className="sticky bottom-0 z-30 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="font-mono text-xl font-semibold tabular-nums">
                  {formatCents(totalCents)}
                </p>
              </div>
              {totalCents > 0 ? (
                <Badge
                  variant="outline"
                  className="border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                >
                  Balanced ✓
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  No amounts yet
                </Badge>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={form.handleSubmit((values) =>
                  submit(values, "DRAFT"),
                )}
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
