import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { CompanyForm } from "../company-form";
import { createCompany } from "../actions";

export default async function NewCompanyPage() {
  await requirePagePermission("crm:write");
  const users = await prisma.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  return (
    <div className="max-w-3xl">
      <PageHeader title="Nueva empresa" />
      <div className="card p-5"><CompanyForm action={createCompany} users={users} submitLabel="Crear empresa" /></div>
    </div>
  );
}
