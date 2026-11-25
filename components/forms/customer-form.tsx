"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  createCustomerAction,
  updateCustomerAction,
} from "@/lib/actions/customers";
import {
  customerFormSchema,
  type CustomerFormValues,
} from "@/lib/validators/customers";

interface CustomerFormProps {
  mode: "create" | "edit";
  customerId?: string;
  defaultValues?: Partial<CustomerFormValues>;
}

const EMPTY_VALUES: CustomerFormValues = {
  code: "",
  name: "",
  email: "",
  phone: "",
  address: "",
  taxId: "",
  notes: "",
  isActive: true,
};

export function CustomerForm({
  mode,
  customerId,
  defaultValues,
}: CustomerFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isEdit = mode === "edit";

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: { ...EMPTY_VALUES, ...defaultValues },
  });

  async function onSubmit(values: CustomerFormValues): Promise<void> {
    setServerError(null);
    setPending(true);

    const result = isEdit
      ? await updateCustomerAction(customerId ?? "", values)
      : await createCustomerAction(values);

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

    if (isEdit) {
      toast.success(result.message ?? "Customer updated.");
      router.push(`/customers/${customerId}`);
      return;
    }

    router.push(`/customers?created=${encodeURIComponent(values.code)}`);
  }

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
            <CardTitle>Customer details</CardTitle>
            <CardDescription>
              Codes are stored uppercase and must be unique. Customers are
              metadata only — they never affect the ledger.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {isEdit ? (
              <div className="grid gap-2">
                <Label htmlFor="customer-code">Customer code</Label>
                <Input
                  id="customer-code"
                  value={defaultValues?.code ?? ""}
                  readOnly
                  disabled
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Code cannot be changed after creation.
                </p>
              </div>
            ) : (
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer code</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="CUST-001"
                        autoComplete="off"
                        className="font-mono uppercase"
                        {...field}
                        onChange={(event) =>
                          field.onChange(event.target.value.toUpperCase())
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Mr. Perera" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="customer@example.com"
                      autoComplete="off"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="+94 77 123 4567" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="No. 12, Galle Road, Colombo 03"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="taxId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tax ID</FormLabel>
                  <FormControl>
                    <Input placeholder="VAT registration number" {...field} />
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
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={4} placeholder="Internal notes" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between gap-3 rounded-lg border p-3 md:col-span-2">
                  <div className="space-y-1">
                    <FormLabel>Active</FormLabel>
                    <FormDescription>
                      Inactive customers are hidden from new job creation.
                      Existing jobs keep their customer link.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
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
            <Link
              href={isEdit ? `/customers/${customerId}` : "/customers"}
            >
              Cancel
            </Link>
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {isEdit ? "Save changes" : "Create Customer"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
