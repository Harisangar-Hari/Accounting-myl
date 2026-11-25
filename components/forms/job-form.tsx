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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { createJobAction, updateJobAction } from "@/lib/actions/jobs";
import { jobFormSchema, type JobFormValues } from "@/lib/validators/jobs";
import type { CustomerOption } from "@/lib/accounting/queries";

interface JobFormProps {
  mode: "create" | "edit";
  jobId?: string;
  /** Active customers for the dropdown (plus this job's customer when editing). */
  customers?: CustomerOption[];
  defaultValues?: Partial<JobFormValues>;
}

const EMPTY_VALUES: JobFormValues = {
  code: "",
  name: "",
  customerId: "",
  isActive: true,
};

/** Radix Select does not allow an empty string value. */
const NO_CUSTOMER = "none";

export function JobForm({
  mode,
  jobId,
  customers = [],
  defaultValues,
}: JobFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const form = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: { ...EMPTY_VALUES, ...defaultValues },
  });

  async function onSubmit(values: JobFormValues): Promise<void> {
    setServerError(null);
    setPending(true);

    // "" from the dropdown means "no customer".
    const payload = { ...values, customerId: values.customerId || null };

    const result =
      mode === "create"
        ? await createJobAction(payload)
        : await updateJobAction(jobId ?? "", payload);

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
      router.push(`/jobs?created=${encodeURIComponent(values.code)}`);
      return;
    }

    toast.success(result.message ?? "Job updated.");
    router.push(`/jobs/${jobId}`);
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
            <CardTitle>Job details</CardTitle>
            <CardDescription>
              Codes are stored uppercase and must be unique across all jobs.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Job code</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="JOB-2026-001"
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

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Highway Extension" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="customerId"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <div className="flex items-center justify-between gap-2">
                    <FormLabel>Customer (optional)</FormLabel>
                    <Link
                      href="/customers"
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Manage customers
                    </Link>
                  </div>
                  <Select
                    value={field.value ? field.value : NO_CUSTOMER}
                    onValueChange={(value) =>
                      field.onChange(value === NO_CUSTOMER ? "" : value)
                    }
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="No customer" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_CUSTOMER}>No customer</SelectItem>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.code} — {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Link this job to a customer. Manage customers at /customers.
                  </FormDescription>
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
                      Inactive jobs are hidden from new expense entries.
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
            <Link href={mode === "create" ? "/jobs" : `/jobs/${jobId}`}>
              Cancel
            </Link>
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {mode === "create" ? "Create Job" : "Save changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
