import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteForm } from "@/components/forms/site-form";
import { getJob } from "@/lib/accounting/queries";

export const metadata = { title: "New site" };

export default async function NewSitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await getJob(id);

  if (!job) notFound();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            New site
          </h1>
          <p className="text-sm text-muted-foreground">
            Sites are created under a job and are unique within it.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/jobs/${job.id}`}>
            <ArrowLeft className="size-4" />
            Back to job
          </Link>
        </Button>
      </div>

      <SiteForm
        mode="create"
        jobId={job.id}
        jobLabel={`${job.code} — ${job.name}`}
        jobCustomer={job.customer ?? null}
      />
    </div>
  );
}
