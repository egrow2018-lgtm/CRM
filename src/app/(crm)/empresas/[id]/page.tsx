import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { contactName, formatDate, formatMoney } from "@/lib/format";
import { ConfirmButton } from "@/components/action-form";
import { ActivityPanel } from "@/components/activity-panel";
import { zoomConfigured } from "@/lib/zoom";
import { InfoRow, LineBadge, PageHeader } from "@/components/ui";
import { CompanyForm } from "../company-form";
import { GpsboxCard } from "@/components/gpsbox-card";
import { normalize } from "@/lib/csv";
import { deleteCompany, updateCompany } from "../actions";

export default async function CompanyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { edit } = await searchParams;
  const [company, users] = await Promise.all([
    prisma.company.findUnique({
      where: { id },
      include: {
        owner: true,
        contacts: { orderBy: { firstName: "asc" } },
        deals: { include: { stage: true, businessLine: true, contact: true }, orderBy: { createdAt: "desc" } },
        activities: { include: { author: true, assignee: true }, orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!company) notFound();
  const canWrite = can(user.role, "crm:write");
  const editing = edit === "1" && canWrite;
  // GPSBox: se muestra si la empresa tiene negocios de Rutalink o ya tiene RUC
  const showGpsbox = company.deals.some((d) => normalize(d.businessLine?.name ?? "") === "rutalink") || !!company.taxId;

  return (
    <div>
      <div className="mb-2 text-sm"><Link href="/empresas" className="text-slate-500 hover:underline">← Empresas</Link></div>
      <PageHeader
        title={company.name}
        subtitle={[company.industry, company.city, company.country].filter(Boolean).join(" · ")}
        actions={
          canWrite && (
            <>
              <Link href={`/negocios/nuevo?companyId=${id}`} className="btn btn-primary">Nuevo negocio</Link>
              <Link href={`/contactos/nuevo?companyId=${id}`} className="btn">Nuevo contacto</Link>
              <Link href={editing ? `/empresas/${id}` : `/empresas/${id}?edit=1`} className="btn">{editing ? "Cancelar" : "Editar"}</Link>
              {can(user.role, "crm:delete") && (
                <form action={deleteCompany.bind(null, id)}>
                  <ConfirmButton message="¿Eliminar esta empresa? Los contactos y negocios quedarán sin empresa.">Eliminar</ConfirmButton>
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
              <CompanyForm action={updateCompany.bind(null, id)} company={company} users={users} />
            ) : (
              <dl>
                <InfoRow label="RUC / NIT">{company.taxId}</InfoRow>
                <InfoRow label="Sitio web">
                  {company.website && (
                    <a className="link" href={company.website.startsWith("http") ? company.website : `https://${company.website}`} target="_blank" rel="noreferrer">
                      {company.website}
                    </a>
                  )}
                </InfoRow>
                <InfoRow label="Teléfono">{company.phone}</InfoRow>
                <InfoRow label="Dirección">{company.address}</InfoRow>
                <InfoRow label="Propietario">{company.owner?.name}</InfoRow>
                <InfoRow label="Creada">{formatDate(company.createdAt)}</InfoRow>
                {company.notes && <InfoRow label="Notas"><span className="whitespace-pre-line">{company.notes}</span></InfoRow>}
              </dl>
            )}
          </div>
          {showGpsbox && (
            <GpsboxCard
              company={company}
              contact={company.deals.find((d) => d.contact && normalize(d.businessLine?.name ?? "") === "rutalink")?.contact ?? company.contacts[0] ?? null}
              canEdit={canWrite}
            />
          )}
          <div className="card p-4">
            <h2 className="mb-2 text-base">Contactos ({company.contacts.length})</h2>
            {company.contacts.length === 0 && <p className="text-sm text-slate-500">Sin contactos.</p>}
            <ul className="space-y-1.5 text-sm">
              {company.contacts.map((c) => (
                <li key={c.id}>
                  <Link className="link" href={`/contactos/${c.id}`}>{contactName(c)}</Link>
                  {c.jobTitle && <span className="text-slate-500"> · {c.jobTitle}</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="space-y-4 lg:col-span-2">
          <div className="card p-4">
            <h2 className="mb-2 text-base">Negocios ({company.deals.length})</h2>
            {company.deals.length === 0 ? (
              <p className="text-sm text-slate-500">Sin negocios.</p>
            ) : (
              <table className="table">
                <tbody>
                  {company.deals.map((d) => (
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
          <ActivityPanel
            zoomEnabled={zoomConfigured()}
            viewerId={user.id} target={{ companyId: id }} activities={company.activities} users={users} canWrite={can(user.role, "activities:write")} />
        </div>
      </div>
    </div>
  );
}
