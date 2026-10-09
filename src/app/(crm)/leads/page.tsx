import Link from "next/link";
import type { LeadStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { contactName, formatDateTime } from "@/lib/format";
import { LEAD_STATUS } from "@/lib/leads";
import { EmptyState, LineBadge, PageHeader } from "@/components/ui";
import { setLeadStatus, takeLead } from "./actions";

const TABS: { key: string; label: string; where: (userId: string) => Prisma.ContactWhereInput }[] = [
  { key: "nuevos", label: "Nuevos sin asignar", where: () => ({ leadStatus: "NUEVO" }) },
  { key: "mios", label: "Mis leads", where: (id) => ({ ownerId: id, leadStatus: { in: ["NUEVO", "EN_SEGUIMIENTO"] } }) },
  { key: "seguimiento", label: "En seguimiento", where: () => ({ leadStatus: "EN_SEGUIMIENTO" }) },
  { key: "calificados", label: "Calificados", where: () => ({ leadStatus: "CALIFICADO" }) },
  { key: "descartados", label: "Descartados", where: () => ({ leadStatus: "DESCARTADO" }) },
];

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const { tab = "nuevos" } = await searchParams;
  const current = TABS.find((t) => t.key === tab) ?? TABS[0]!;
  const canTake = can(user.role, "leads:take");
  const [counts, leads] = await Promise.all([
    Promise.all(TABS.map((t) => prisma.contact.count({ where: t.where(user.id) }))),
    prisma.contact.findMany({
      where: current.where(user.id),
      include: {
        owner: { select: { id: true, name: true } },
        company: { select: { id: true, name: true } },
        submissions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { form: { select: { name: true, businessLine: { select: { id: true, name: true, color: true } } } } },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
  ]);

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Leads"
        subtitle="Personas que llenaron un formulario. Tómalas para darles seguimiento y conviértelas en negocio."
        actions={can(user.role, "forms:manage") && <Link href="/formularios" className="btn">Ver formularios</Link>}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t, i) => (
          <Link
            key={t.key}
            href={`/leads?tab=${t.key}`}
            className={`rounded-lg px-3 py-1.5 text-sm ${t.key === current.key ? "bg-brand-700 text-white" : "bg-white text-slate-600 hover:bg-slate-100"}`}
          >
            {t.label} <span className="opacity-70">({counts[i]})</span>
          </Link>
        ))}
      </div>
      {leads.length === 0 ? (
        <EmptyState>No hay leads en esta vista.</EmptyState>
      ) : (
        <div className="space-y-2">
          {leads.map((c) => {
            const sub = c.submissions[0];
            const answers = (sub?.data ?? {}) as Record<string, string>;
            const message = Object.entries(answers).find(([k]) => /mensaje|ayudar|comentario|consulta/i.test(k))?.[1];
            const line = sub?.form.businessLine;
            const status = c.leadStatus ? LEAD_STATUS[c.leadStatus] : null;
            const newDeal = `/negocios/nuevo?contactId=${c.id}${c.companyId ? `&companyId=${c.companyId}` : ""}${line ? `&businessLineId=${line.id}` : ""}`;
            return (
              <div key={c.id} className="card flex flex-wrap items-start gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/contactos/${c.id}`} className="link text-base">{contactName(c)}</Link>
                    {status && <span className={`badge ${status.className}`}>{status.label}</span>}
                    <LineBadge line={line} />
                  </div>
                  <div className="mt-0.5 text-sm text-slate-600">
                    {[c.jobTitle, c.company?.name].filter(Boolean).join(" · ")}
                    {c.email && <> · <a className="hover:underline" href={`mailto:${c.email}`}>{c.email}</a></>}
                    {c.phone && <> · <a className="hover:underline" href={`https://wa.me/${c.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">{c.phone}</a></>}
                  </div>
                  {message && <p className="mt-1 line-clamp-2 text-sm text-slate-500">“{message}”</p>}
                  <div className="mt-1 text-xs text-slate-400">
                    {sub ? `${sub.form.name} · ${formatDateTime(sub.createdAt)}` : c.source}
                    {c.owner && ` · Responsable: ${c.owner.name}`}
                  </div>
                </div>
                {canTake && (
                  <div className="flex flex-wrap items-center gap-2">
                    {c.owner?.id !== user.id && (
                      <form action={takeLead.bind(null, c.id)}>
                        <button className="btn btn-primary btn-sm">{c.owner ? "Tomar yo" : "Tomar lead"}</button>
                      </form>
                    )}
                    <Link href={newDeal} className="btn btn-sm">Crear negocio</Link>
                    {(["CALIFICADO", "DESCARTADO"] as LeadStatus[])
                      .filter((s) => s !== c.leadStatus)
                      .map((s) => (
                        <form key={s} action={setLeadStatus.bind(null, c.id, s)}>
                          <button className="btn btn-sm">{s === "CALIFICADO" ? "Calificar" : "Descartar"}</button>
                        </form>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
