"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";

/** Debounced search input; writes ?q= (preserving other params) to the URL. */
export function CustomerSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery);

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = value.trim();
      if (next === (searchParams.get("q") ?? "")) return;

      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set("q", next);
      else params.delete("q");

      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    }, 300);

    return () => clearTimeout(timer);
  }, [value, pathname, router, searchParams]);

  return (
    <Input
      type="search"
      placeholder="Search by code or name…"
      aria-label="Search customers"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      className="w-full sm:max-w-xs"
    />
  );
}
