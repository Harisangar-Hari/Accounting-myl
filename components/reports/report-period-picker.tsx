"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDateInput } from "@/lib/dates";

type PresetKey =
  | "this-month"
  | "last-month"
  | "this-quarter"
  | "year-to-date"
  | "last-12-months";

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "this-month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "this-quarter", label: "This quarter" },
  { key: "year-to-date", label: "Year to date" },
  { key: "last-12-months", label: "Last 12 months" },
];

function utcDate(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day));
}

/** Today in the local calendar, as UTC midnight (the storage convention). */
function todayUtc(): Date {
  const now = new Date();
  return utcDate(now.getFullYear(), now.getMonth(), now.getDate());
}

function presetRange(key: PresetKey): { fromDate: string; toDate: string } {
  const today = todayUtc();
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();

  switch (key) {
    case "this-month":
      return {
        fromDate: formatDateInput(utcDate(year, month, 1)),
        toDate: formatDateInput(today),
      };
    case "last-month":
      return {
        fromDate: formatDateInput(utcDate(year, month - 1, 1)),
        toDate: formatDateInput(utcDate(year, month, 0)),
      };
    case "this-quarter":
      return {
        fromDate: formatDateInput(utcDate(year, Math.floor(month / 3) * 3, 1)),
        toDate: formatDateInput(today),
      };
    case "year-to-date":
      return {
        fromDate: formatDateInput(utcDate(year, 0, 1)),
        toDate: formatDateInput(today),
      };
    case "last-12-months":
      return {
        fromDate: formatDateInput(utcDate(year, month - 11, 1)),
        toDate: formatDateInput(today),
      };
  }
}

interface ReportPeriodPickerProps {
  defaultFromDate: string;
  defaultToDate: string;
  /** "range" shows From + To; "asOf" shows a single As-of date. */
  mode: "range" | "asOf";
}

export function ReportPeriodPicker({
  defaultFromDate,
  defaultToDate,
  mode,
}: ReportPeriodPickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [fromValue, setFromValue] = useState(defaultFromDate);
  const [toValue, setToValue] = useState(defaultToDate);

  function navigate(next: { fromDate?: string; toDate?: string }): void {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("fromDate");
    params.delete("toDate");
    if (next.fromDate) params.set("fromDate", next.fromDate);
    if (next.toDate) params.set("toDate", next.toDate);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function apply(): void {
    if (mode === "asOf") {
      navigate({ toDate: toValue });
    } else {
      navigate({ fromDate: fromValue, toDate: toValue });
    }
  }

  function applyPreset(key: PresetKey): void {
    const range = presetRange(key);
    if (mode === "asOf") {
      setToValue(range.toDate);
      navigate({ toDate: range.toDate });
      return;
    }
    setFromValue(range.fromDate);
    setToValue(range.toDate);
    navigate(range);
  }

  return (
    <Card className="print:hidden">
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          {mode === "range" ? (
            <>
              <div className="grid gap-1.5">
                <label
                  htmlFor="report-from"
                  className="text-xs font-medium text-muted-foreground"
                >
                  From
                </label>
                <Input
                  id="report-from"
                  type="date"
                  value={fromValue}
                  onChange={(event) => setFromValue(event.target.value)}
                  className="w-40"
                />
              </div>
              <div className="grid gap-1.5">
                <label
                  htmlFor="report-to"
                  className="text-xs font-medium text-muted-foreground"
                >
                  To
                </label>
                <Input
                  id="report-to"
                  type="date"
                  value={toValue}
                  onChange={(event) => setToValue(event.target.value)}
                  className="w-40"
                />
              </div>
            </>
          ) : (
            <div className="grid gap-1.5">
              <label
                htmlFor="report-as-of"
                className="text-xs font-medium text-muted-foreground"
              >
                As of
              </label>
              <Input
                id="report-as-of"
                type="date"
                value={toValue}
                onChange={(event) => setToValue(event.target.value)}
                className="w-40"
              />
            </div>
          )}

          <Button type="button" onClick={apply}>
            Apply
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <Button
              key={preset.key}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyPreset(preset.key)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
