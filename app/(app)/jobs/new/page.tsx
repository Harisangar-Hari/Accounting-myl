import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JobForm } from "@/components/forms/job-form";
import { listCustomerOptions } from "@/lib/accounting/queries";

export const metadata = { title: "New job" };

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const { customerId } = await searchParams;
  const customers = await listCustomerOptions();
  // Only pre-select a real, active customer (e.g. the "Add Job" flow).
  const preselected = customers.find(
    (customer) => customer.id === customerId,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            New job
          </h1>
          <p className="text-sm text-muted-foreground">
            Create a job to group sites and tag expense lines.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/jobs">
            <ArrowLeft className="size-4" />
            Back to jobs
          </Link>
        </Button>
      </div>

      <JobForm
        mode="create"
        customers={customers}
        defaultValues={preselected ? { customerId: preselected.id } : undefined}
      />
    </div>
  );
}
