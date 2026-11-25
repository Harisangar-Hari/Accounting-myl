"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { AccountOption, JobOption } from "@/lib/accounting/queries";
import { createSupplierBillAction } from "@/lib/actions/ap";
import { formatCents, toCents } from "@/lib/money";
import {
  createBillFormSchema,
  type CreateBillFormValues,
} from "@/lib/validators/ap";
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

const EMPTY_LINE: CreateBillFormValues["lines"][number] = {
  description: "",
  expenseAccountId: "",
  amount: "",
  taxAmount: "",
  jobId: "",
  siteId: "",
};

export interface BillFormSupplier {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  isActive: boolean;
}

interface BillFormProps {
  supplier: BillFormSupplier;
  expenseAccounts: AccountOption[];
  jobs: JobOption[];
  today: string;
  defaultDueDate: string;
}

function safeCents(value: string | undefined): number {
  if (!value?.trim()) return 0;
  try {
    return toCents(value);
  } catch {
    return 0;
  }
}

/** Creates a supplier bill with its postable journal entry. */
export function BillForm({
  supplier,
  expenseAccounts,
  jobs,
  today,
  defaultDueDate,
}: BillFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const form = useForm<CreateBillFormValues>({
    resolver: zodResolver(createBillFormSchema),
    defaultValues: {
      supplierId: supplier.id,
      billDate: today,
      dueDate: defaultDueDate,
      supplierRef: "",
      description: "",
      lines: [{ ...EMPTY_LINE }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  const watchedLines = useWatch({ control: form.control, name: "lines" });

  const subtotalCents = (watchedLines ?? []).reduce(
    (sum, line) => sum + safeCents(line?.amount),
    0,
  );
  const taxCents = (watchedLines ?? []).reduce(
    (sum, line) => sum + safeCents(line?.taxAmount),
    0,
  );
  const totalCents = subtotalCents + taxCents;

  async function onSubmit(values: CreateBillFormValues): Promise<void> {
    setServerError(null);
    setPending(true);

    const result = await createSupplierBillAction({
      ...values,
      supplierId: supplier.id,
      lines: values.lines.map((line) => ({
        ...line,
        taxAmount: line.taxAmount ?? "",
      })),
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

    toast.success(result.message ?? "Bill created.");
    router.push(`/suppliers/${supplier.id}/bills/${result.documentId}`);
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-5"
        noValidate
      >
        <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-muted-foreground">Recording a bill from</span>
            <span className="font-mono text-xs font-medium">{supplier.code}</span>
            <span className="font-medium">{supplier.name}</span>
            {supplier.isActive ? null : (
              <span className="text-xs text-destructive">
                (inactive supplier — cannot receive bills)
              </span>
            )}
            <Link
              href={`/suppliers/${supplier.id}`}
              className="text-xs font-medium text-primary underline-offset-4 hover:underline sm:ml-auto"
            >
              Manage supplier
            </Link>
          </div>
          <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
            The bill posts immediately: Debit each expense account, debit Input
            VAT when tax is entered, credit 2000 Accounts Payable.
          </p>
        </div>

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
            <CardTitle>Bill details</CardTitle>
            <CardDescription>
              Supplier reference is the supplier&apos;s own invoice number.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="billDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bill date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Due date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="supplierRef"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Supplier reference (optional)</FormLabel>
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
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Cement delivery — March"
                      {...field}
                      value={field.value ?? ""}
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
              <CardTitle>Bill lines</CardTitle>
              <CardDescription>
                Debit expense accounts. Job and site tags keep cost reporting
                consistent.
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
              const sites = jobs.find((job) => job.id === jobId)?.sites ?? [];

              return (
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
                      disabled={fields.length === 1}
                      aria-label={`Remove line ${index + 1}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-12">
                    <div className="md:col-span-8">
                      <FormField
                        control={form.control}
                        name={`lines.${index}.description`}
                        render={({ field: lineField }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g. 250 tonnes OPC"
                                {...lineField}
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
                        name={`lines.${index}.expenseAccountId`}
                        render={({ field: lineField }) => (
                          <FormItem>
                            <FormLabel>Expense account</FormLabel>
                            <Select
                              value={lineField.value}
                              onValueChange={lineField.onChange}
                              disabled={expenseAccounts.length === 0}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select account" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {expenseAccounts.map((account) => (
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

                    <div className="md:col-span-3">
                      <FormField
                        control={form.control}
                        name={`lines.${index}.taxAmount`}
                        render={({ field: lineField }) => (
                          <FormItem>
                            <FormLabel>Tax</FormLabel>
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

                    <div className="md:col-span-3">
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

                    <div className="md:col-span-3">
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
            <div className="flex flex-wrap items-center gap-5">
              <div>
                <p className="text-xs text-muted-foreground">Subtotal</p>
                <p className="font-mono text-sm tabular-nums">
                  {formatCents(subtotalCents)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tax</p>
                <p className="font-mono text-sm tabular-nums">
                  {formatCents(taxCents)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="font-mono text-xl font-semibold tabular-nums">
                  {formatCents(totalCents)}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button asChild variant="outline" disabled={pending}>
                <Link href={`/suppliers/${supplier.id}`}>Cancel</Link>
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                Save Bill
              </Button>
            </div>
          </div>
        </div>
      </form>
    </Form>
  );
}
