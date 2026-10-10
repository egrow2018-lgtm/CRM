import Link from "next/link";
import type { LeadStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { contactName, formatDate, timeAgo } from "@/lib/format";
import { LEAD_STATUS } from "@/lib/leads";
import { Avatar, EmptyState, PageHeader } from "@/components/ui";
import { IconPlus } from "@/components/icons";
import { Pager, SortHeader, hrefWith, pageParams } from "@/components/pager";
import { ContactFilters } from "./filters";
import { ContactBoard } from "./board";
import { lastActivityAlert } from "@/lib/alerts";
import { SemaforoDot } from "@/components/semaforo";

type SP = { tab?: string; issue?: string; q?: string; owner?: string; lead?: string; view?: string; page?: string; per?: string; sort?: string };

const RECENT_DAYS = 30;

const TABS = [
  { key: "mios", label: "Mis contactos" },
  { key: "sin-asignar", label: "Contactos no asignados" },
  { key: "no-contactados", label: "Mis no contactados" },
  { key: "todos", label: "Todos los contactos" },
];

const SORTS: Record<string, (d: Prisma.SortOrder) => Prisma.ContactOrderByWithRelationInput> = {
  name: (d) => ({ firstName: d }),
  email: (d) => ({ email: { sort: d, nulls: "last" } }),
  company: (d) => ({ company: { name: d } }),
  lastActivity: (d) => ({ lastActivityAt: { sort: d, nulls: "last" } }),
  createdAt: (d) => ({ createdAt: d }),
};

export default async function ContactsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp.tab) ? sp.tab! : "mios";
  const recent = new Date(Date.now() - RECENT_DAYS * 86400000);
  const noRecentActivity: Prisma.ContactWhereInput = { OR: [{ lastActivityAt: null }, { lastActivityAt: { lt: recent } }] };

  // Vista (pestaña) + búsqueda + filtros: sobre esto se calculan los indicadores
  const base: Prisma.ContactWhereInput[] = [];
  if (tab === "mios") base.push({ ownerId: user.id });
  if (tab === "sin-asignar") base.push({ ownerId: null });
  if (tab === "no-contactados") base.push({ ownerId: user.id }, { OR: [{ lastActivityAt: null }, { leadStatus: "NUEVO" }] });
  if (sp.q) {
    base.push({
      OR: [
        { firstName: { contains: sp.q, mode: "insensitive" } },
        { lastName: { contains: sp.q, mode: "insensitive" } },
        { email: { contains: sp.q, mode: "insensitive" } },
        { phone: { contains: sp.q } },
        { company: { name: { contains: sp.q, mode: "insensitive" } } },
      ],
    });
  }
  if (sp.owner) base.push({ ownerId: sp.owner });
  if (sp.lead === "none") base.push({ leadStatus: null });
  else if (sp.lead && sp.lead in LEAD_STATUS) base.push({ leadStatus: sp.lead as LeadStatus });

  const ISSUES: { key: string; label: string; where: Prisma.ContactWhereInput }[] = [
    { key: "sin-propietario", label: "Contactos falta el propietario", where: { ownerId: null } },
    { key: "sin-email", label: "Contactos falta e-mail", where: { email: null } },
    { key: "sin-estado", label: "Contactos falta estado del lead", where: { leadStatus: null } },
    { key: "sin-actividad", label: "Contactos sin actividad reciente", where: noRecentActivity },
  ];
  const issue = ISSUES.find((i) => i.key === sp.issue);
  const where: Prisma.ContactWhereInput = { AND: [...base, ...(issue ? [issue.where] : [])] };

  const isBoard = sp.view === "board";
  const { page, per, skip } = pageParams(sp);
  const [sortField, sortDir] = (sp.sort ?? "createdAt_desc").split("_");
  const orderBy = (SORTS[sortField ?? ""] ?? SORTS.createdAt!)(sortDir === "asc" ? "asc" : "desc");
  const include = {
    company: { select: { id: true, name: true } },
    owner: { select: { name: true } },
  } satisfies Prisma.ContactInclude;

  const [issueCounts, total, contacts, users, statusGroups] = await Promise.all([
    Promise.all(ISSUES.map((i) => prisma.contact.count({ where: { AND: [...base, i.where] } }))),
    prisma.contact.count({ where }),
    isBoard
      ? // Tarjetas: hasta 60 por estado, los de actividad más reciente primero
        Promise.all(
          ([null, "NUEVO", "EN_SEGUIMIENTO", "CALIFICADO", "DESCARTADO"] as (LeadStatus | null)[]).map((s) =>
            prisma.contact.findMany({
              where: { AND: [where, { leadStatus: s }] },
              include,
              orderBy: [{ lastActivityAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
              take: 60,
            }),
          ),
        ).then((groups) => groups.flat())
      : prisma.contact.findMany({ where, include, orderBy: [orderBy, { id: "asc" }], skip, take: per }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    isBoard ? prisma.contact.groupBy({ by: ["leadStatus"], where, _count: true }) : Promise.resolve([]),
  ]);
  const spRecord = sp as Record<string, string | undefined>;
  const fmt = new Intl.NumberFormat("es-EC");

  return (
    <div>
      <PageHeader
        title="Contactos"
        subtitle={`${total} contactos${issue ? ` · ${issue.label.toLowerCase()}` : ""}`}
        actions={can(user.role, "crm:write") && <Link href="/contactos/nuevo" className="btn btn-primary"><IconPlus /> Agregar contacto</Link>}
      />

      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={hrefWith("/contactos", { view: sp.view }, { tab: t.key === "mios" ? undefined : t.key })}
            className={`-mb-px rounded-t-lg border px-3 py-2 text-sm ${
              t.key === tab ? "border-slate-200 border-b-white bg-white font-semibold text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <ContactFilters users={users} />

      <div className="card mb-4 grid grid-cols-2 divide-slate-100 lg:grid-cols-4 lg:divide-x">
        {ISSUES.map((i, idx) => {
          const active = sp.issue === i.key;
          return (
            <Link
              key={i.key}
              href={hrefWith("/contactos", spRecord, { issue: active ? undefined : i.key, page: undefined })}
              className={`px-4 py-5 text-center transition hover:bg-slate-50 ${active ? "bg-brand-50" : ""}`}
              title={active ? "Quitar este filtro" : "Ver estos contactos"}
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">{i.label}</div>
              <div className={`mt-1 text-3xl font-semibold tabular-nums ${issueCounts[idx] ? "text-brand-700" : "text-slate-400"}`}>
                {fmt.format(issueCounts[idx] ?? 0)}
              </div>
            </Link>
          );
        })}
      </div>

      {total === 0 ? (
        <EmptyState>No hay contactos en esta vista.</EmptyState>
      ) : isBoard ? (
        <ContactBoard
          canMove={can(user.role, "leads:take")}
          totals={Object.fromEntries(statusGroups.map((g) => [g.leadStatus ?? "none", g._count]))}
          contacts={contacts.map((c) => ({
            id: c.id,
            name: contactName(c),
            email: c.email,
            phone: c.phone,
            jobTitle: c.jobTitle,
            company: c.company?.name ?? null,
            owner: c.owner?.name ?? null,
            status: c.leadStatus,
            lastActivityAt: c.lastActivityAt?.toISOString() ?? null,
          }))}
        />
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <SortHeader label="Nombre" field="name" path="/contactos" sp={spRecord} />
                  <SortHeader label="Correo" field="email" path="/contactos" sp={spRecord} />
                  <th>Número de teléfono</th>
                  <th>Cargo</th>
                  <SortHeader label="Nombre de la empresa" field="company" path="/contactos" sp={spRecord} />
                  <th>Estado del lead</th>
                  <th>Propietario</th>
                  <SortHeader label="Última actividad" field="lastActivity" path="/contactos" sp={spRecord} />
                  <SortHeader label="Creado" field="createdAt" path="/contactos" sp={spRecord} />
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => {
                  const status = c.leadStatus ? LEAD_STATUS[c.leadStatus] : null;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="max-w-60">
                        <span className="flex items-center gap-2">
                          <Avatar name={contactName(c)} />
                          <Link className="link truncate" href={`/contactos/${c.id}`}>{contactName(c)}</Link>
                        </span>
                      </td>
                      <td className="max-w-56 truncate">{c.email ? <a className="hover:underline" href={`mailto:${c.email}`}>{c.email}</a> : "—"}</td>
                      <td className="whitespace-nowrap">{c.phone ?? "—"}</td>
                      <td className="max-w-40 truncate">{c.jobTitle ?? "—"}</td>
                      <td className="max-w-48 truncate">{c.company ? <Link className="hover:underline" href={`/empresas/${c.company.id}`}>{c.company.name}</Link> : "—"}</td>
                      <td>{status ? <span className={`badge ${status.className}`}>{status.label}</span> : <span className="text-slate-400">—</span>}</td>
                      <td className="whitespace-nowrap">{c.owner?.name ?? <span className="text-slate-400">Sin asignar</span>}</td>
                      <td className="whitespace-nowrap text-xs text-slate-500">
                        {(() => {
                          const a = lastActivityAlert(c.lastActivityAt, { warnDays: 30, dangerDays: 90 });
                          return (
                            <span className="inline-flex items-center gap-1">
                              <SemaforoDot level={a.level} title={a.label} /> {timeAgo(c.lastActivityAt)}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="whitespace-nowrap text-xs text-slate-500">{formatDate(c.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pager path="/contactos" sp={spRecord} total={total} page={page} per={per} />
        </>
      )}
    </div>
  );
}
