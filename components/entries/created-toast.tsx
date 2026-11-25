"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * Shows a success toast after a Server Action redirects with ?created=JE-...
 * and then removes the param so a refresh does not repeat the toast.
 */
export function CreatedToast({ entryNo }: { entryNo?: string }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!entryNo) return;

    toast.success(`Entry ${entryNo} saved successfully.`);

    const params = new URLSearchParams(window.location.search);
    params.delete("created");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [entryNo, pathname, router]);

  return null;
}
