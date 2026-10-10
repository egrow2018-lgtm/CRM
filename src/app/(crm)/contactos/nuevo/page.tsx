import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ContactForm } from "../contact-form";
import { createContact } from "../actions";

export default async function NewContactPage({ searchParams }: { searchParams: Promise<{ companyId?: string }> }) {
  await requirePagePermission("crm:write");
  const { companyId } = await searchParams;
  const [users, companies] = await Promise.all([
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="max-w-3xl">
      <PageHeader title="Nuevo contacto" />
      <div className="card p-5">
        <ContactForm action={createContact} users={users} companies={companies} defaultCompanyId={companyId} submitLabel="Crear contacto" />
      </div>
    </div>
  );
}
