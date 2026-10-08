import { requirePagePermission } from "@/lib/auth";
import { getFormOptions } from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import { DealForm } from "../deal-form";
import { createDeal } from "../actions";

export default async function NewDealPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string; contactId?: string }>;
}) {
  await requirePagePermission("crm:write");
  const [options, sp] = await Promise.all([getFormOptions(), searchParams]);
  return (
    <div className="max-w-3xl">
      <PageHeader title="Nuevo negocio" />
      <div className="card p-5">
        <DealForm action={createDeal} options={options} defaults={sp} submitLabel="Crear negocio" />
      </div>
    </div>
  );
}
