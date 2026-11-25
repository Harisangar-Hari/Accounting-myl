import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomerForm } from "@/components/forms/customer-form";

export const metadata = { title: "New customer" };

export default function NewCustomerPage() {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            New customer
          </h1>
          <p className="text-sm text-muted-foreground">
            Add a customer to link jobs and reference contact details.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/customers">
            <ArrowLeft className="size-4" />
            Back to customers
          </Link>
        </Button>
      </div>

      <CustomerForm mode="create" />
    </div>
  );
}
