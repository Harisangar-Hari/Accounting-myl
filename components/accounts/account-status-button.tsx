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
  deactivateAccountAction,
  reactivateAccountAction,
} from "@/lib/actions/accounts";

interface AccountStatusButtonProps {
  accountId: string;
  accountCode: string;
  isActive: boolean;
  journalLineCount: number;
}

/**
 * Deactivates (confirming first when journal lines exist) or reactivates an
 * account. Accounts are never deleted.
 */
export function AccountStatusButton({
  accountId,
  accountCode,
  isActive,
  journalLineCount,
}: AccountStatusButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function run(): void {
    startTransition(async () => {
      const result = isActive
        ? await deactivateAccountAction(accountId)
        : await reactivateAccountAction(accountId);

      if (result.ok) {
        setOpen(false);
        toast.success(
          result.message ??
            (isActive ? "Account deactivated." : "Account reactivated."),
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
            <DialogTitle>Deactivate {accountCode}?</DialogTitle>
            <DialogDescription>
              This account has {journalLineCount} journal line
              {journalLineCount === 1 ? "" : "s"}. Deactivating will hide it
              from new entries but historical reports are unaffected. Continue?
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
