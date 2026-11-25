import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JobForm } from "@/components/forms/job-form";
import { getJob, listCustomerOptions } from "@/lib/accounting/queries";

export const metadata = { title: "Edit job" };

export default async function EditJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await getJob(id);

  if (!job) notFound();

  const customers = await listCustomerOptions();
  // A deactivated customer keeps its link, so keep it selectable while editing.
  if (job.customer && !customers.some((c) => c.id === job.customer!.id)) {
    customers.push({
      id: job.customer.id,
      code: job.customer.code,
      name: `${job.customer.name} (inactive)`,
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Edit job
          </h1>
          <p className="text-sm text-muted-foreground">
            {job.code} — {job.name}
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/jobs/${job.id}`}>
            <ArrowLeft className="size-4" />
            Back to job
          </Link>
        </Button>
      </div>

      <JobForm
        mode="edit"
        jobId={job.id}
        customers={customers}
        defaultValues={{
          code: job.code,
          name: job.name,
          customerId: job.customer?.id ?? "",
          isActive: job.isActive,
        }}
      />
    </div>
  );
}
