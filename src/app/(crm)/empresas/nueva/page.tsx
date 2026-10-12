import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { contactName } from "@/lib/format";
import { CompanyForm } from "../company-form";
import { createCompany } from "../actions";

export default async function NewCompanyPage() {
  await requirePagePermission("companies:write");
  const [users, contacts] = await Promise.all([
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.contact.findMany({
      where: { companyId: null },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
  ]);
  return (
    <div className="max-w-3xl">
      <PageHeader title="Nueva empresa" />
      <div className="card p-5"><CompanyForm
            action={createCompany}
            users={users}
            contacts={contacts.map((c) => ({ id: c.id, name: contactName(c), email: c.email, company: null }))}
            submitLabel="Crear empresa"
          /></div>
    </div>
  );
}
