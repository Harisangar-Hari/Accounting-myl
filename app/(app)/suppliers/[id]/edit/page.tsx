import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SupplierForm } from "@/components/forms/supplier-form";
import { getSupplier } from "@/lib/accounting/ap-queries";

export const metadata = { title: "Edit supplier" };

export default async function EditSupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supplier = await getSupplier(id);

  if (!supplier) notFound();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Edit supplier
          </h1>
          <p className="text-sm text-muted-foreground">
            {supplier.code} — {supplier.name}
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/suppliers/${supplier.id}`}>
            <ArrowLeft className="size-4" />
            Back to supplier
          </Link>
        </Button>
      </div>

      <SupplierForm
        mode="edit"
        supplierId={supplier.id}
        defaultValues={{
          code: supplier.code,
          name: supplier.name,
          email: supplier.email ?? "",
          phone: supplier.phone ?? "",
          address: supplier.address ?? "",
          taxId: supplier.taxId ?? "",
          notes: supplier.notes ?? "",
          isActive: supplier.isActive,
        }}
      />
    </div>
  );
}
