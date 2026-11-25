"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EntryFiltersProps {
  basePath: string;
  status: string;
  from: string;
  to: string;
}

export function EntryFilters({ basePath, status, from, to }: EntryFiltersProps) {
  const router = useRouter();
  const [statusValue, setStatusValue] = useState(status || "ALL");
  const [fromValue, setFromValue] = useState(from);
  const [toValue, setToValue] = useState(to);

  function apply(): void {
    const params = new URLSearchParams();
    if (statusValue !== "ALL") params.set("status", statusValue);
    if (fromValue) params.set("from", fromValue);
    if (toValue) params.set("to", toValue);
    const query = params.toString();
    router.push(query ? `${basePath}?${query}` : basePath);
  }

  function clear(): void {
    setStatusValue("ALL");
    setFromValue("");
    setToValue("");
    router.push(basePath);
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-background p-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="grid gap-1.5">
        <label
          htmlFor="filter-status"
          className="text-xs font-medium text-muted-foreground"
        >
          Status
        </label>
        <Select value={statusValue} onValueChange={setStatusValue}>
          <SelectTrigger id="filter-status" className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="POSTED">Posted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <label
          htmlFor="filter-from"
          className="text-xs font-medium text-muted-foreground"
        >
          From
        </label>
        <Input
          id="filter-from"
          type="date"
          value={fromValue}
          onChange={(event) => setFromValue(event.target.value)}
          className="w-full sm:w-40"
        />
      </div>

      <div className="grid gap-1.5">
        <label
          htmlFor="filter-to"
          className="text-xs font-medium text-muted-foreground"
        >
          To
        </label>
        <Input
          id="filter-to"
          type="date"
          value={toValue}
          onChange={(event) => setToValue(event.target.value)}
          className="w-full sm:w-40"
        />
      </div>

      <div className="flex gap-2 sm:ml-auto">
        <Button type="button" variant="ghost" onClick={clear}>
          Clear
        </Button>
        <Button type="button" onClick={apply}>
          Apply
        </Button>
      </div>
    </div>
  );
}
