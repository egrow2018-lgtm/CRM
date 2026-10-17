import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { EMAIL_TRACKING } from "@/lib/queries";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { contactName, formatMoney, formatLocalDate } from "@/lib/format";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/action-form";
import { ContactPicker } from "@/components/contact-picker";
import { ActivityPanel } from "@/components/activity-panel";
import { zoomConfigured } from "@/lib/zoom";
import { emailConfigured } from "@/lib/email";
import { InfoRow, LineBadge, PageHeader } from "@/components/ui";
import { CompanyForm } from "../company-form";
import { GpsboxCard } from "@/components/gpsbox-card";
import { companyKey, normalize, websiteDomain } from "@/lib/csv";
import { CompanyLogo } from "@/components/company-logo";
import { duplicateGroups, websiteKey } from "@/lib/duplicates";
import { deleteCompany, linkContacts, mergeCompany, updateCompany } from "../actions";

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
        deals: { include: { stage: true, businessLine: { omit: { brandLogo: true } }, contact: true }, orderBy: { createdAt: "desc" } },
        activities: { include: { author: true, assignee: true, email: { select: EMAIL_TRACKING } }, orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!company) notFound();
  // Posibles duplicados: mismo nombre sin sufijos o misma web, más las que contienen la primera palabra del nombre
  const firstWord = companyKey(company.name).split(" ")[0] ?? "";
  const duplicates = can(user, "companies:delete")
    ? await prisma.company
        .findMany({ select: { id: true, name: true, website: true, taxId: true } })
        .then(async (all) => {
          const group = duplicateGroups(all).find((g) => g.some((c) => c.id === id)) ?? [];
          const ids = new Set(group.map((c) => c.id));
          if (firstWord.length >= 3) for (const c of all) if (c.name.toLowerCase().includes(firstWord)) ids.add(c.id);
          ids.delete(id);
          const found = await prisma.company.findMany({
            where: { id: { in: [...ids] } },
            select: { id: true, name: true, city: true, _count: { select: { contacts: true, deals: true } } },
            orderBy: { name: "asc" },
          });
          // Primero las del mismo grupo (nombre o web iguales), luego las de nombre parecido
          const inGroup = (c: { id: string }) => (group.some((g) => g.id === c.id) ? 0 : 1);
          return found.sort((a, b) => inGroup(a) - inGroup(b)).slice(0, 10);
        })
    : [];
  const canWrite = can(user, "companies:write");
  // Contactos para asociar: cualquiera que no esté ya en esta empresa; sugeridos los del dominio de su sitio web
  const domain = websiteKey(company.website);
  const linkable = can(user, "contacts:write")
    ? await prisma.contact.findMany({
        // Todos menos los que ya están en esta empresa («distinto de esta» deja fuera a los sin empresa, por eso el OR)
        where: { OR: [{ companyId: null }, { companyId: { not: id } }] },
        select: { id: true, firstName: true, lastName: true, email: true, company: { select: { name: true } } },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      })
    : [];
  const suggested = domain ? linkable.filter((c) => c.email?.toLowerCase().endsWith(`@${domain}`)).map((c) => c.id) : [];
  const editing = edit === "1" && canWrite;
  // GPSBox: se muestra si la empresa tiene negocios de Rutalink o ya tiene RUC
  const showGpsbox = company.deals.some((d) => normalize(d.businessLine?.name ?? "") === "rutalink") || !!company.taxId;

  return (
    <div>
      <div className="mb-2 text-sm"><Link href="/empresas" className="text-slate-500 hover:underline">← Empresas</Link></div>
      <PageHeader
        title={
          <span className="inline-flex items-center gap-3">
            <CompanyLogo name={company.name} domain={websiteDomain(company.website)} size="lg" />
            {company.name}
          </span>
        }
        subtitle={[company.industry, company.city, company.country].filter(Boolean).join(" · ")}
        actions={
          (canWrite || can(user, "deals:write") || can(user, "contacts:write")) && (
            <>
              {can(user, "deals:write") && <Link href={`/negocios/nuevo?companyId=${id}`} className="btn btn-primary">Nuevo negocio</Link>}
              {can(user, "contacts:write") && <Link href={`/contactos/nuevo?companyId=${id}`} className="btn">Nuevo contacto</Link>}
              {canWrite && <Link href={editing ? `/empresas/${id}` : `/empresas/${id}?edit=1`} className="btn">{editing ? "Cancelar" : "Editar"}</Link>}
              {can(user, "companies:delete") && (
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
                <InfoRow label="Creada">{formatLocalDate(company.createdAt)}</InfoRow>
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
          {duplicates.length > 0 && (
            <div className="card border-amber-300 p-4">
              <h2 className="mb-1 text-base">¿Empresas duplicadas?</h2>
              <p className="mb-2 text-xs text-slate-500">
                «Unir aquí» pasa sus contactos, negocios y actividades a esta empresa, completa los datos vacíos y elimina la otra.
              </p>
              <ul className="space-y-2 text-sm">
                {duplicates.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2">
                    <span>
                      <Link className="link" href={`/empresas/${d.id}`}>{d.name}</Link>
                      <span className="text-slate-500"> · {d._count.contacts} contactos · {d._count.deals} negocios{d.city ? ` · ${d.city}` : ""}</span>
                    </span>
                    <form action={mergeCompany.bind(null, id, d.id)}>
                      <ConfirmButton className="btn btn-sm" message={`¿Unir «${d.name}» dentro de «${company.name}»? «${d.name}» se eliminará y todo lo suyo pasará a esta empresa.`}>
                        Unir aquí
                      </ConfirmButton>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
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
            {linkable.length > 0 && (
              <details className="mt-3" open={suggested.length > 0 && company.contacts.length === 0}>
                <summary className="cursor-pointer text-sm font-medium text-brand-700">
                  + Asociar contactos existentes
                  {suggested.length > 0 && <span className="badge ml-1 bg-accent-100 text-brand-800">{suggested.length} sugeridos</span>}
                </summary>
                <ActionForm action={linkContacts.bind(null, id)} resetOnSuccess successMessage="Contactos asociados." className="mt-2 space-y-2">
                  <ContactPicker
                    contacts={linkable.map((c) => ({ id: c.id, name: contactName(c), email: c.email, company: c.company?.name ?? null }))}
                    suggested={suggested}
                  />
                  <SubmitButton className="btn btn-primary btn-sm" pendingText="Asociando…">Asociar a {company.name}</SubmitButton>
                </ActionForm>
              </details>
            )}
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
            emailEnabled={emailConfigured()}
            canMeet={can(user, "meetings:schedule")}
            viewerId={user.id} target={{ companyId: id }} activities={company.activities} users={users} canWrite={can(user, "activities:write")} />
        </div>
      </div>
    </div>
  );
}
