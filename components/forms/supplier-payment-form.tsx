"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createSupplierPaymentAction } from "@/lib/actions/ap";
import { formatCents, toCents } from "@/lib/money";
import {
  createSupplierPaymentFormSchema,
  type CreateSupplierPaymentFormValues,
} from "@/lib/validators/ap";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const baseSchema = createSupplierPaymentFormSchema.omit({ allocations: true });
type PaymentFormValues = Omit<CreateSupplierPaymentFormValues, "allocations">;

export interface OpenBillOption {
  id: string;
  billNo: string;
  billDate: Date;
  dueDate: Date;
  remainingCents: number;
  status: string;
}

interface SupplierPaymentFormProps {
  supplier: { id: string; code: string; name: string };
  bills: OpenBillOption[];
  today: string;
}

function safeCents(value: string | undefined): number {
  if (!value?.trim()) return 0;
  try {
    return toCents(value);
  } catch {
    return 0;
  }
}

/**
 * Records a supplier payment. Allocations must add up to the payment amount
 * exactly; the submit button stays disabled until they do.
 */
export function SupplierPaymentForm({
  supplier,
  bills,
  today,
}: SupplierPaymentFormProps) {
  const router = useRouter();
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(baseSchema),
    defaultValues: {
      supplierId: supplier.id,
      paymentDate: today,
      amount: "",
      method: "BANK",
      reference: "",
      notes: "",
    },
  });

  const amount = useWatch({ control: form.control, name: "amount" });
  const paymentCents = safeCents(amount);

  const allocationRows = bills
    .map((bill) => ({
      bill,
      amount: allocations[bill.id] ?? "",
      cents: safeCents(allocations[bill.id]),
    }))
    .filter((row) => row.amount.trim() !== "" || row.cents > 0);

  const allocatedCents = allocationRows.reduce(
    (sum, row) => sum + row.cents,
    0,
  );
  const differenceCents = paymentCents - allocatedCents;
  const matches =
    paymentCents > 0 && allocatedCents === paymentCents && allocationRows.length > 0;

  async function onSubmit(values: PaymentFormValues): Promise<void> {
    setServerError(null);

    if (!matches) {
      setServerError(
        "Allocated amount must equal the payment amount before saving.",
      );
      return;
    }

    for (const row of allocationRows) {
      if (row.cents > row.bill.remainingCents) {
        setServerError(
          `${row.bill.billNo}: allocation exceeds the remaining balance ${formatCents(row.bill.remainingCents)}.`,
        );
        return;
      }
    }

    setPending(true);

    const result = await createSupplierPaymentAction({
      ...values,
      supplierId: supplier.id,
      allocations: allocationRows.map((row) => ({
        billId: row.bill.id,
        amount: row.amount,
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

    toast.success(result.message ?? "Payment recorded.");
    router.push(`/suppliers/${supplier.id}/payments/${result.documentId}`);
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
            <span className="text-muted-foreground">Paying</span>
            <span className="font-mono text-xs font-medium">{supplier.code}</span>
            <span className="font-medium">{supplier.name}</span>
            <Link
              href={`/suppliers/${supplier.id}`}
              className="text-xs font-medium text-primary underline-offset-4 hover:underline sm:ml-auto"
            >
              Manage supplier
            </Link>
          </div>
          <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
            The payment posts immediately: Debit 2000 Accounts Payable, credit
            cash or bank.
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
            <CardTitle>Payment details</CardTitle>
            <CardDescription>
              Payments must be allocated in full across open bills.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="paymentDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount paid</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="0.00"
                      className="text-right font-mono"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Method</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="CASH">Cash (1000)</SelectItem>
                      <SelectItem value="BANK">Bank (1010)</SelectItem>
                      <SelectItem value="CHEQUE">Cheque (1010)</SelectItem>
                    </SelectContent>
                  </Select>
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
                      placeholder="Cheque no. / transfer ref"
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
              name="notes"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Internal note"
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
          <CardHeader>
            <CardTitle>Allocate to bills</CardTitle>
            <CardDescription>
              Enter the amount applied to each bill. The total must equal the
              amount paid.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {bills.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-background/60 px-6 py-10 text-center text-sm text-muted-foreground">
                This supplier has no open bills to allocate against.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border bg-background">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="pl-3">Bill</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead className="text-right">Remaining</TableHead>
                      <TableHead className="w-48 pr-3 text-right">
                        Allocate
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bills.map((bill) => (
                      <TableRow key={bill.id} className="odd:bg-muted/25">
                        <TableCell className="pl-3 font-mono text-xs font-medium">
                          {bill.billNo}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {bill.dueDate.toISOString().slice(0, 10)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {formatCents(bill.remainingCents)}
                        </TableCell>
                        <TableCell className="pr-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <Input
                              inputMode="decimal"
                              autoComplete="off"
                              placeholder="0.00"
                              aria-label={`Allocate to ${bill.billNo}`}
                              className="h-8 w-28 text-right font-mono"
                              value={allocations[bill.id] ?? ""}
                              onChange={(event) =>
                                setAllocations((current) => ({
                                  ...current,
                                  [bill.id]: event.target.value,
                                }))
                              }
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setAllocations((current) => ({
                                  ...current,
                                  [bill.id]: (bill.remainingCents / 100).toFixed(
                                    2,
                                  ),
                                }))
                              }
                            >
                              Full
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="sticky bottom-0 z-30 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-5">
              <div>
                <p className="text-xs text-muted-foreground">Payment</p>
                <p className="font-mono text-sm tabular-nums">
                  {formatCents(paymentCents)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Allocated</p>
                <p className="font-mono text-sm tabular-nums">
                  {formatCents(allocatedCents)}
                </p>
              </div>
              <Badge
                variant="outline"
                className={
                  matches
                    ? "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                    : "border-transparent bg-muted text-muted-foreground"
                }
              >
                {matches
                  ? "Fully allocated ✓"
                  : `Unallocated ${formatCents(Math.max(differenceCents, 0))}`}
              </Badge>
            </div>

            <div className="flex gap-2">
              <Button asChild variant="outline" disabled={pending}>
                <Link href={`/suppliers/${supplier.id}`}>Cancel</Link>
              </Button>
              <Button type="submit" disabled={pending || !matches}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                Save Payment
              </Button>
            </div>
          </div>
        </div>
      </form>
    </Form>
  );
}
