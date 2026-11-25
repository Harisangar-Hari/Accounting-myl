import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteForm } from "@/components/forms/site-form";
import { getSite } from "@/lib/accounting/queries";

export const metadata = { title: "Edit site" };

export default async function EditSitePage({
  params,
}: {
  params: Promise<{ id: string; siteId: string }>;
}) {
  const { id, siteId } = await params;
  const site = await getSite(siteId);

  // The job in the URL must be the site's actual job: this prevents editing a
  // site through another job's URL.
  if (!site || site.jobId !== id) notFound();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Edit site
          </h1>
          <p className="text-sm text-muted-foreground">
            {site.code} — {site.name}
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/jobs/${site.jobId}`}>
            <ArrowLeft className="size-4" />
            Back to job
          </Link>
        </Button>
      </div>

      <SiteForm
        mode="edit"
        jobId={site.jobId}
        siteId={site.id}
        jobLabel={`${site.job.code} — ${site.job.name}`}
        defaultValues={{ code: site.code, name: site.name }}
      />
    </div>
  );
}
