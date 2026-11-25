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
  createSupplierAction,
  updateSupplierAction,
} from "@/lib/actions/suppliers";
import {
  supplierFormSchema,
  type SupplierFormValues,
} from "@/lib/validators/suppliers";

interface SupplierFormProps {
  mode: "create" | "edit";
  supplierId?: string;
  defaultValues?: Partial<SupplierFormValues>;
}

const EMPTY_VALUES: SupplierFormValues = {
  code: "",
  name: "",
  email: "",
  phone: "",
  address: "",
  taxId: "",
  notes: "",
  isActive: true,
};

export function SupplierForm({
  mode,
  supplierId,
  defaultValues,
}: SupplierFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isEdit = mode === "edit";

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: { ...EMPTY_VALUES, ...defaultValues },
  });

  async function onSubmit(values: SupplierFormValues): Promise<void> {
    setServerError(null);
    setPending(true);

    const result = isEdit
      ? await updateSupplierAction(supplierId ?? "", values)
      : await createSupplierAction(values);

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
      toast.success(result.message ?? "Supplier updated.");
      router.push(`/suppliers/${supplierId}`);
      return;
    }

    router.push(`/suppliers?created=${encodeURIComponent(values.code)}`);
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
            <CardTitle>Supplier details</CardTitle>
            <CardDescription>
              Codes are stored uppercase and must be unique. Suppliers are
              external parties, not chart-of-accounts entries.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {isEdit ? (
              <div className="grid gap-2">
                <Label htmlFor="supplier-code">Supplier code</Label>
                <Input
                  id="supplier-code"
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
                    <FormLabel>Supplier code</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="SUP-001"
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
                    <Input placeholder="Ceylon Steel Ltd" {...field} />
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
                      placeholder="accounts@supplier.com"
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
                    <Input placeholder="+94 11 234 5678" {...field} />
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
                    <Input placeholder="Industrial Zone, Colombo" {...field} />
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
                      Inactive suppliers are hidden from new bill creation.
                      Existing bills keep their supplier link.
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
            <Link href={isEdit ? `/suppliers/${supplierId}` : "/suppliers"}>
              Cancel
            </Link>
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {isEdit ? "Save changes" : "Create Supplier"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
