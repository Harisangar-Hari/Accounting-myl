"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { postEntryAction } from "@/lib/actions/entries";

export function PostEntryButton({ entryId }: { entryId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await postEntryAction(entryId);
          if (result.ok) {
            toast.success(result.message ?? "Entry posted.");
            router.refresh();
          } else {
            toast.error(result.error);
          }
        });
      }}
    >
      {pending ? "Posting…" : "Post entry"}
    </Button>
  );
}
