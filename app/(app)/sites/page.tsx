import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SiteStatusButton } from "@/components/jobs/site-status-button";
import {
  StatusTabs,
  type StatusFilter,
} from "@/components/locations/status-tabs";
import { ActiveBadge } from "@/components/status-badge";
import { listAllSites } from "@/lib/accounting/queries";

export const metadata = { title: "Sites" };

function parseStatus(value: string | undefined): StatusFilter {
  return value === "active" || value === "inactive" ? value : "all";
}

export default async function SitesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const status = parseStatus(params.status);
  const allSites = await listAllSites({ includeInactive: true });
  const sites =
    status === "all"
      ? allSites
      : allSites.filter(
          (site) => site.isActive === (status === "active"),
        );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Sites
        </h1>
        <p className="text-sm text-muted-foreground">
          All sites across jobs. Sites are created from a job&apos;s detail
          page.
        </p>
      </div>

      <StatusTabs basePath="/sites" status={status} />

      {sites.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-background/60 px-6 py-12 text-center text-sm text-muted-foreground">
          {allSites.length === 0
            ? "No sites yet. Sites are created from a job's detail page."
            : "No sites match this filter."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-3">Job Code</TableHead>
                <TableHead>Job Name</TableHead>
                <TableHead>Site Code</TableHead>
                <TableHead>Site Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-3 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sites.map((site) => (
                <TableRow key={site.id} className="odd:bg-muted/25">
                  <TableCell className="pl-3 font-mono text-xs font-medium">
                    <Link href={`/jobs/${site.jobId}`} className="hover:underline">
                      {site.jobCode}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {site.jobName}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-medium">
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
                          href={`/jobs/${site.jobId}/sites/${site.id}/edit`}
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
    </div>
  );
}
