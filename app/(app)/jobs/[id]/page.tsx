import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { JobStatusButton } from "@/components/jobs/job-status-button";
import { SiteStatusButton } from "@/components/jobs/site-status-button";
import { ActiveBadge } from "@/components/status-badge";
import { getJob } from "@/lib/accounting/queries";
import { formatDateDisplay } from "@/lib/dates";

export const metadata = { title: "Job" };

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await getJob(id);

  if (!job) notFound();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {job.code}
            </span>
            <ActiveBadge active={job.isActive} />
          </div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {job.name}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/jobs">
              <ArrowLeft className="size-4" />
              Back to jobs
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/jobs/${job.id}/edit`}>Edit</Link>
          </Button>
          <JobStatusButton
            jobId={job.id}
            jobCode={job.code}
            isActive={job.isActive}
            journalLineCount={job._count.lines}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Job info</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Code</p>
            <p className="font-mono font-medium">{job.code}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Name</p>
            <p className="font-medium">{job.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Customer</p>
            {job.customer ? (
              <Link
                href={`/customers/${job.customer.id}`}
                className="font-medium underline-offset-4 hover:underline"
              >
                <span className="font-mono text-xs">{job.customer.code}</span>
                {" — "}
                {job.customer.name}
              </Link>
            ) : (
              <p className="font-medium">—</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <ActiveBadge active={job.isActive} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Created</p>
            <p className="font-medium">{formatDateDisplay(job.createdAt)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Sites</CardTitle>
            <CardDescription>
              {job._count.sites} site{job._count.sites === 1 ? "" : "s"} under
              this job.
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/jobs/${job.id}/sites/new`}>
              <Plus className="size-4" />
              Add Site
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {job.sites.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-background/60 px-6 py-10 text-center text-sm text-muted-foreground">
              No sites yet for this job. Add the first site.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border bg-background">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="pl-3">Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-3 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {job.sites.map((site) => (
                    <TableRow key={site.id} className="odd:bg-muted/25">
                      <TableCell className="pl-3 font-mono text-xs font-medium">
                        {site.code}
                      </TableCell>
                      <TableCell className="font-medium">{site.name}</TableCell>
                      <TableCell>
                        <ActiveBadge active={site.isActive} />
                      </TableCell>
                      <TableCell className="pr-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button asChild variant="ghost" size="sm">
                            <Link
                              href={`/jobs/${job.id}/sites/${site.id}/edit`}
                            >
                              Edit
                            </Link>
                          </Button>
                          <SiteStatusButton
                            siteId={site.id}
                            isActive={site.isActive}
                          />
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
    </div>
  );
}
