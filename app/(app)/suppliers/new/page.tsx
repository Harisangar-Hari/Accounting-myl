import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SupplierForm } from "@/components/forms/supplier-form";

export const metadata = { title: "New supplier" };

export default function NewSupplierPage() {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            New supplier
          </h1>
          <p className="text-sm text-muted-foreground">
            Add a supplier to record bills and payments against.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/suppliers">
            <ArrowLeft className="size-4" />
            Back to suppliers
          </Link>
        </Button>
      </div>

      <SupplierForm mode="create" />
    </div>
  );
}
