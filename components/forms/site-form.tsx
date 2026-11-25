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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ActiveBadge } from "@/components/status-badge";
import { createSiteAction, updateSiteAction } from "@/lib/actions/sites";
import { siteFormSchema, type SiteFormValues } from "@/lib/validators/sites";

/** The job's customer, shown read-only so the user can confirm context. */
export interface SiteFormJobCustomer {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  isActive: boolean;
}

interface SiteFormProps {
  mode: "create" | "edit";
  jobId: string;
  siteId?: string;
  jobLabel: string;
  /**
   * The parent job's customer. Display-only and ignored in edit mode; sites
   * inherit their customer through the job and never store one themselves.
   */
  jobCustomer?: SiteFormJobCustomer | null;
  defaultValues?: Partial<SiteFormValues>;
}

const EMPTY_VALUES: SiteFormValues = { code: "", name: "" };

export function SiteForm({
  mode,
  jobId,
  siteId,
  jobLabel,
  jobCustomer,
  defaultValues,
}: SiteFormProps) {
  const isCreate = mode === "create";
  const customer = jobCustomer ?? null;
  const hasContactDetails = Boolean(
    customer?.email || customer?.phone || customer?.address,
  );
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const form = useForm<SiteFormValues>({
    resolver: zodResolver(siteFormSchema),
    defaultValues: { ...EMPTY_VALUES, ...defaultValues },
  });

  async function onSubmit(values: SiteFormValues): Promise<void> {
    setServerError(null);
    setPending(true);

    const result =
      mode === "create"
        ? await createSiteAction(jobId, values)
        : await updateSiteAction(siteId ?? "", values);

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

    toast.success(result.message ?? "Site saved.");
    router.push(`/jobs/${jobId}`);
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
            <span className="text-muted-foreground">
              {isCreate ? "Adding site to " : "Editing site under "}
            </span>
            <span className="font-medium">{jobLabel}</span>
          </div>

          {/* The job's customer is context only: sites never store a customer. */}
          {isCreate ? (
            <div className="mt-2 flex flex-col gap-1.5 border-t pt-2">
              {customer ? (
                <>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-muted-foreground">Customer</span>
                    <span className="font-medium">
                      {customer.code} — {customer.name}
                    </span>
                    {customer.isActive ? null : <ActiveBadge active={false} />}
                    <Link
                      href={`/customers/${customer.id}`}
                      className="text-xs font-medium text-primary underline-offset-4 hover:underline sm:ml-auto"
                    >
                      Manage customer
                    </Link>
                  </div>

                  {hasContactDetails ? (
                    <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                      {customer.email ? (
                        <div>
                          <dt className="inline text-muted-foreground">
                            Email{" "}
                          </dt>
                          <dd className="inline">{customer.email}</dd>
                        </div>
                      ) : null}
                      {customer.phone ? (
                        <div>
                          <dt className="inline text-muted-foreground">
                            Phone{" "}
                          </dt>
                          <dd className="inline">{customer.phone}</dd>
                        </div>
                      ) : null}
                      {customer.address ? (
                        <div className="sm:col-span-2">
                          <dt className="inline text-muted-foreground">
                            Address{" "}
                          </dt>
                          <dd className="inline whitespace-pre-line">
                            {customer.address}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No contact details on file.
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground">
                    This site belongs to this customer through its job. Customer
                    details are managed at{" "}
                    <Link
                      href="/customers"
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      /customers
                    </Link>
                    .
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  This job has no customer linked.
                </p>
              )}
            </div>
          ) : null}
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
            <CardTitle>Site details</CardTitle>
            <CardDescription>
              Site codes must be unique within this job (e.g. SITE-A and
              SITE-B).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Site code</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="SITE-A"
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
                    <Input placeholder="North Section" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button asChild variant="outline" disabled={pending}>
            <Link href={`/jobs/${jobId}`}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {isCreate ? "Create Site" : "Save changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
