"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * Shows a one-off success toast driven by a `?created=` search param, then
 * strips the param so a refresh does not repeat it.
 */
export function SavedToast({ message }: { message?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const shown = useRef<string | null>(null);

  useEffect(() => {
    if (!message) return;
    // React Strict Mode runs effects twice in development; toast only once.
    if (shown.current === message) return;
    shown.current = message;

    toast.success(message);

    const params = new URLSearchParams(window.location.search);
    params.delete("created");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [message, pathname, router]);

  return null;
}
