"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  deactivateSiteAction,
  reactivateSiteAction,
} from "@/lib/actions/sites";

/** Deactivates or reactivates a site. Sites are never deleted. */
export function SiteStatusButton({
  siteId,
  isActive,
}: {
  siteId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(): void {
    startTransition(async () => {
      const result = isActive
        ? await deactivateSiteAction(siteId)
        : await reactivateSiteAction(siteId);

      if (result.ok) {
        toast.success(
          result.message ??
            (isActive ? "Site deactivated." : "Site reactivated."),
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={run}
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
      {isActive ? "Deactivate" : "Reactivate"}
    </Button>
  );
}
