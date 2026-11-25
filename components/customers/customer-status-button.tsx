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
  deactivateCustomerAction,
  reactivateCustomerAction,
} from "@/lib/actions/customers";

interface CustomerStatusButtonProps {
  customerId: string;
  customerCode: string;
  isActive: boolean;
  jobCount: number;
}

/**
 * Deactivates (confirming first when jobs are linked) or reactivates a
 * customer. Customers are never deleted and their job links are untouched.
 */
export function CustomerStatusButton({
  customerId,
  customerCode,
  isActive,
  jobCount,
}: CustomerStatusButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function run(): void {
    startTransition(async () => {
      const result = isActive
        ? await deactivateCustomerAction(customerId)
        : await reactivateCustomerAction(customerId);

      if (result.ok) {
        setOpen(false);
        toast.success(
          result.message ??
            (isActive ? "Customer deactivated." : "Customer reactivated."),
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
          if (isActive && jobCount > 0) {
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
            <DialogTitle>Deactivate {customerCode}?</DialogTitle>
            <DialogDescription>
              This customer has {jobCount} job{jobCount === 1 ? "" : "s"}.
              Deactivating hides it from new job creation but existing jobs
              remain linked. Continue?
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
