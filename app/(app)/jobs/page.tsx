import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { JobStatusButton } from "@/components/jobs/job-status-button";
import {
  StatusTabs,
  type StatusFilter,
} from "@/components/locations/status-tabs";
import { SavedToast } from "@/components/saved-toast";
import { ActiveBadge } from "@/components/status-badge";
import { listJobs } from "@/lib/accounting/queries";

export const metadata = { title: "Jobs" };

function parseStatus(value: string | undefined): StatusFilter {
  return value === "active" || value === "inactive" ? value : "all";
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; created?: string }>;
}) {
  const params = await searchParams;
  const status = parseStatus(params.status);
  const allJobs = await listJobs({ includeInactive: true });
  const jobs =
    status === "all"
      ? allJobs
      : allJobs.filter((job) => job.isActive === (status === "active"));

  return (
    <div className="space-y-5">
      <SavedToast
        message={params.created ? `Job ${params.created} created.` : undefined}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Jobs
          </h1>
          <p className="text-sm text-muted-foreground">
            Jobs and their sites, used to tag every expense line.
          </p>
        </div>
        <Button asChild>
          <Link href="/jobs/new">
            <Plus className="size-4" />
            New Job
          </Link>
        </Button>
      </div>

      <StatusTabs basePath="/jobs" status={status} />

      {jobs.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-background/60 px-6 py-12 text-center text-sm text-muted-foreground">
          {allJobs.length === 0
            ? "No jobs yet. Create your first job to start tagging expenses."
            : "No jobs match this filter."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-3">Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Sites</TableHead>
                <TableHead className="text-right">Journal Lines</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-3 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id} className="relative odd:bg-muted/25">
                  <TableCell className="pl-3 font-mono text-xs font-medium">
                    <Link
                      href={`/jobs/${job.id}`}
                      className="after:absolute after:inset-0 after:content-[''] hover:underline"
                    >
                      {job.code}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">{job.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {job.customerCode ? (
                      <span>
                        <span className="font-mono text-xs">
                          {job.customerCode}
                        </span>
                        {" — "}
                        {job.customerName}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {job.siteCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {job.journalLineCount}
                  </TableCell>
                  <TableCell>
                    <ActiveBadge active={job.isActive} />
                  </TableCell>
                  <TableCell className="pr-3">
                    <div className="relative z-10 flex items-center justify-end gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/jobs/${job.id}`}>View</Link>
                      </Button>
                      <JobStatusButton
                        jobId={job.id}
                        jobCode={job.code}
                        isActive={job.isActive}
                        journalLineCount={job.journalLineCount}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
