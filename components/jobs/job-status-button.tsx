"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deactivateJobAction,
  reactivateJobAction,
} from "@/lib/actions/jobs";

interface JobStatusButtonProps {
  jobId: string;
  jobCode: string;
  isActive: boolean;
  journalLineCount: number;
}

/**
 * Deactivates (with a confirmation dialog when journal lines exist) or
 * reactivates a job. Jobs are never deleted.
 */
export function JobStatusButton({
  jobId,
  jobCode,
  isActive,
  journalLineCount,
}: JobStatusButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function run(): void {
    startTransition(async () => {
      const result = isActive
        ? await deactivateJobAction(jobId)
        : await reactivateJobAction(jobId);

      if (result.ok) {
        setOpen(false);
        toast.success(
          result.message ??
            (isActive ? "Job deactivated." : "Job reactivated."),
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (isActive && journalLineCount > 0) {
            setOpen(true);
            return;
          }
          run();
        }}
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
        {isActive ? "Deactivate" : "Reactivate"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate {jobCode}?</DialogTitle>
            <DialogDescription>
              This job has {journalLineCount} journal line
              {journalLineCount === 1 ? "" : "s"}. It will be hidden from new
              entries but historical data is preserved. Continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={run}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
