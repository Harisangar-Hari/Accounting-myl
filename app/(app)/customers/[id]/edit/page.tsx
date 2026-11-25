import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomerForm } from "@/components/forms/customer-form";
import { getCustomer } from "@/lib/accounting/queries";

export const metadata = { title: "Edit customer" };

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomer(id);

  if (!customer) notFound();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Edit customer
          </h1>
          <p className="text-sm text-muted-foreground">
            {customer.code} — {customer.name}
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/customers/${customer.id}`}>
            <ArrowLeft className="size-4" />
            Back to customer
          </Link>
        </Button>
      </div>

      <CustomerForm
        mode="edit"
        customerId={customer.id}
        defaultValues={{
          code: customer.code,
          name: customer.name,
          email: customer.email ?? "",
          phone: customer.phone ?? "",
          address: customer.address ?? "",
          taxId: customer.taxId ?? "",
          notes: customer.notes ?? "",
          isActive: customer.isActive,
        }}
      />
    </div>
  );
}
