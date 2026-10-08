import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { contactName, formatDate, formatMoney } from "@/lib/format";
import { ConfirmButton } from "@/components/action-form";
import { ActivityPanel } from "@/components/activity-panel";
import { InfoRow, LineBadge, PageHeader } from "@/components/ui";
import { ContactForm } from "../contact-form";
import { deleteContact, updateContact } from "../actions";

export default async function ContactPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { edit } = await searchParams;
  const [contact, users, companies] = await Promise.all([
    prisma.contact.findUnique({
      where: { id },
      include: {
        owner: true,
        company: true,
        deals: { include: { stage: true, businessLine: true }, orderBy: { createdAt: "desc" } },
        activities: { include: { author: true, assignee: true }, orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!contact) notFound();
  const canWrite = can(user.role, "crm:write");
  const editing = edit === "1" && canWrite;
  const phoneDigits = contact.phone?.replace(/\D/g, "");

  return (
    <div>
      <div className="mb-2 text-sm"><Link href="/contactos" className="text-slate-500 hover:underline">← Contactos</Link></div>
      <PageHeader
        title={contactName(contact)}
        subtitle={[contact.jobTitle, contact.company?.name].filter(Boolean).join(" · ")}
        actions={
          canWrite && (
            <>
              <Link href={`/negocios/nuevo?contactId=${id}${contact.companyId ? `&companyId=${contact.companyId}` : ""}`} className="btn btn-primary">
                Nuevo negocio
              </Link>
              <Link href={editing ? `/contactos/${id}` : `/contactos/${id}?edit=1`} className="btn">{editing ? "Cancelar" : "Editar"}</Link>
              {can(user.role, "crm:delete") && (
                <form action={deleteContact.bind(null, id)}>
                  <ConfirmButton message="¿Eliminar este contacto?">Eliminar</ConfirmButton>
                </form>
              )}
            </>
          )
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <div className="card p-4">
            {editing ? (
              <ContactForm action={updateContact.bind(null, id)} contact={contact} users={users} companies={companies} />
            ) : (
              <dl>
                <InfoRow label="Email">{contact.email && <a className="link" href={`mailto:${contact.email}`}>{contact.email}</a>}</InfoRow>
                <InfoRow label="Teléfono">
                  {contact.phone && (
                    <span className="flex items-center gap-2">
                      <a className="link" href={`tel:${contact.phone}`}>{contact.phone}</a>
                      {phoneDigits && (
                        <a className="badge bg-emerald-100 text-emerald-800" href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noreferrer">
                          WhatsApp
                        </a>
                      )}
                    </span>
                  )}
                </InfoRow>
                <InfoRow label="Empresa">
                  {contact.company && <Link className="link" href={`/empresas/${contact.company.id}`}>{contact.company.name}</Link>}
                </InfoRow>
                <InfoRow label="Origen">{contact.source}</InfoRow>
                <InfoRow label="Propietario">{contact.owner?.name}</InfoRow>
                <InfoRow label="Creado">{formatDate(contact.createdAt)}</InfoRow>
                {contact.notes && <InfoRow label="Notas"><span className="whitespace-pre-line">{contact.notes}</span></InfoRow>}
              </dl>
            )}
          </div>
        </div>
        <div className="space-y-4 lg:col-span-2">
          <div className="card p-4">
            <h2 className="mb-2 text-base">Negocios ({contact.deals.length})</h2>
            {contact.deals.length === 0 ? (
              <p className="text-sm text-slate-500">Sin negocios.</p>
            ) : (
              <table className="table">
                <tbody>
                  {contact.deals.map((d) => (
                    <tr key={d.id}>
                      <td><Link className="link" href={`/negocios/${d.id}`}>{d.name}</Link></td>
                      <td><LineBadge line={d.businessLine} /></td>
                      <td>{d.stage.name}</td>
                      <td className="text-right tabular-nums">{formatMoney(d.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <ActivityPanel target={{ contactId: id }} activities={contact.activities} users={users} canWrite={can(user.role, "activities:write")} />
        </div>
      </div>
    </div>
  );
}
