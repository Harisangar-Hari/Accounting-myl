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
  deactivateSupplierAction,
  reactivateSupplierAction,
} from "@/lib/actions/suppliers";

interface SupplierStatusButtonProps {
  supplierId: string;
  supplierCode: string;
  isActive: boolean;
  billCount: number;
}

/**
 * Deactivates (confirming first when bills are linked) or reactivates a
 * supplier. Suppliers are never deleted and their bills are untouched.
 */
export function SupplierStatusButton({
  supplierId,
  supplierCode,
  isActive,
  billCount,
}: SupplierStatusButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function run(): void {
    startTransition(async () => {
      const result = isActive
        ? await deactivateSupplierAction(supplierId)
        : await reactivateSupplierAction(supplierId);

      if (result.ok) {
        setOpen(false);
        toast.success(
          result.message ??
            (isActive ? "Supplier deactivated." : "Supplier reactivated."),
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
          if (isActive && billCount > 0) {
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
            <DialogTitle>Deactivate {supplierCode}?</DialogTitle>
            <DialogDescription>
              This supplier has {billCount} bill{billCount === 1 ? "" : "s"}.
              Deactivating hides it from new bill creation but existing bills
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
