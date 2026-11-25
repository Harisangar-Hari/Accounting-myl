import { Badge } from "@/components/ui/badge";

/** Small "Balanced ✓" / "Reconciles with P&L ✓" pill for report footers. */
export function ReconcilesBadge({
  ok,
  label,
  failLabel = "OUT OF BALANCE",
}: {
  ok: boolean;
  label: string;
  failLabel?: string;
}) {
  if (!ok) {
    return (
      <Badge variant="destructive" className="h-6 px-3">
        {failLabel}
      </Badge>
    );
  }

  return (
    <Badge className="h-6 border-emerald-500/30 bg-emerald-500/10 px-3 text-emerald-700 dark:text-emerald-400">
      {label} ✓
    </Badge>
  );
}

/** Prominent red banner for a ledger that does not balance. */
export function OutOfBalanceBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3">
      <p className="text-sm font-semibold text-destructive">{message}</p>
      <p className="text-xs text-muted-foreground">
        This indicates a bug or a corrupted ledger — contact whoever maintains
        the books before relying on this report.
      </p>
    </div>
  );
}
