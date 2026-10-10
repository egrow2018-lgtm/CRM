import Link from "next/link";
import type { LeadStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { formatDate, timeAgo } from "@/lib/format";
import { websiteDomain } from "@/lib/csv";
import { duplicateGroups } from "@/lib/duplicates";
import { LEAD_STATUS } from "@/lib/leads";
import { lastActivityAlert } from "@/lib/alerts";
import { zonedToUtc } from "@/lib/timezone";
import { EmptyState, PageHeader } from "@/components/ui";
import { IconPlus } from "@/components/icons";
import { CompanyLogo } from "@/components/company-logo";
import { SemaforoDot } from "@/components/semaforo";
import { Pager, SortHeader, pageParams } from "@/components/pager";
import { CompanyFilters } from "./filters";

type SP = { q?: string; owner?: string; lead?: string; activity?: string; from?: string; to?: string; dup?: string; page?: string; per?: string; sort?: string };

const SORTS: Record<string, (d: Prisma.SortOrder) => Prisma.CompanyOrderByWithRelationInput> = {
  name: (d) => ({ name: d }),
  lastActivity: (d) => ({ lastActivityAt: { sort: d, nulls: "last" } }),
  createdAt: (d) => ({ createdAt: d }),
};

/** Estado del lead de la empresa: el más avanzado entre sus contactos. */
const LEAD_ORDER: LeadStatus[] = ["CALIFICADO", "EN_SEGUIMIENTO", "NUEVO", "DESCARTADO"];
const companyLead = (contacts: { leadStatus: LeadStatus | null }[]) => LEAD_ORDER.find((s) => contacts.some((c) => c.leadStatus === s)) ?? null;

const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const and: Prisma.CompanyWhereInput[] = [];
  if (sp.q) {
    and.push({ OR: [{ name: { contains: sp.q, mode: "insensitive" } }, { taxId: { contains: sp.q } }, { city: { contains: sp.q, mode: "insensitive" } }] });
  }
  if (sp.owner === "none") and.push({ ownerId: null });
  else if (sp.owner) and.push({ ownerId: sp.owner });
  if (sp.lead === "none") and.push({ contacts: { none: { leadStatus: { not: null } } } });
  else if (sp.lead && sp.lead in LEAD_STATUS) and.push({ contacts: { some: { leadStatus: sp.lead as LeadStatus } } });
  if (sp.activity === "ninguna") and.push({ lastActivityAt: null });
  else if (sp.activity === "mas-90") and.push({ lastActivityAt: { lt: new Date(Date.now() - 90 * 86400000) } });
  else if (["7", "30", "90"].includes(sp.activity ?? "")) and.push({ lastActivityAt: { gte: new Date(Date.now() - Number(sp.activity) * 86400000) } });
  if (isDate(sp.from)) and.push({ createdAt: { gte: zonedToUtc(sp.from!, "00:00") } });
  if (isDate(sp.to)) and.push({ createdAt: { lt: new Date(zonedToUtc(sp.to!, "00:00").getTime() + 86400000) } });

  // Posibles duplicados: se calculan sobre todas las empresas y se ordenan por grupo
  let dupOrder: Map<string, number> | null = null;
  if (sp.dup === "1") {
    const all = await prisma.company.findMany({ select: { id: true, name: true, website: true }, orderBy: { name: "asc" } });
    dupOrder = new Map(duplicateGroups(all).flatMap((g, gi) => g.map((c) => [c.id, gi] as const)));
    and.push({ id: { in: [...dupOrder.keys()] } });
  }
  const where: Prisma.CompanyWhereInput = { AND: and };

  const { page, per, skip } = pageParams(sp);
  const [sortField, sortDir] = (sp.sort ?? "name_asc").split("_");
  const orderBy = (SORTS[sortField ?? ""] ?? SORTS.name!)(sortDir === "desc" ? "desc" : "asc");
  const include = {
    owner: { select: { name: true } },
    contacts: { select: { leadStatus: true } },
    _count: { select: { contacts: true, deals: true } },
  } satisfies Prisma.CompanyInclude;

  const [total, rows, users] = await Promise.all([
    prisma.company.count({ where }),
    dupOrder
      ? prisma.company.findMany({ where, include, orderBy: { name: "asc" } })
      : prisma.company.findMany({ where, include, orderBy: [orderBy, { id: "asc" }], skip, take: per }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const companies = dupOrder ? rows.sort((a, b) => dupOrder.get(a.id)! - dupOrder.get(b.id)!).slice(skip, skip + per) : rows;
  const spRecord = sp as Record<string, string | undefined>;

  return (
    <div>
      <PageHeader
        title="Empresas"
        subtitle={`${total} empresas${dupOrder ? " · posibles duplicados (agrupados)" : ""}`}
        actions={
          can(user.role, "crm:write") && (
            <Link href="/empresas/nueva" className="btn btn-primary"><IconPlus /> Nueva empresa</Link>
          )
        }
      />
      <CompanyFilters users={users} />
      {dupOrder && total > 0 && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Empresas con el mismo nombre (sin «S.A.», «Cía. Ltda.», «AG»…) o la misma web. Abre la que tiene los datos completos y usa «Unir aquí» en la tarjeta «¿Empresas duplicadas?».
        </p>
      )}
      {companies.length === 0 ? (
        <EmptyState>No hay empresas con estos filtros.</EmptyState>
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <SortHeader label="Nombre" field="name" path="/empresas" sp={spRecord} />
                  <th>Industria</th>
                  <th>Ciudad</th>
                  <th className="text-right">Contactos</th>
                  <th className="text-right">Negocios</th>
                  <th>Estado del lead</th>
                  <th>Propietario</th>
                  <SortHeader label="Última actividad" field="lastActivity" path="/empresas" sp={spRecord} />
                  <SortHeader label="Creada" field="createdAt" path="/empresas" sp={spRecord} />
                </tr>
              </thead>
              <tbody>
                {companies.map((c, i) => {
                  const lead = companyLead(c.contacts);
                  const status = lead ? LEAD_STATUS[lead] : null;
                  const a = lastActivityAlert(c.lastActivityAt, { warnDays: 30, dangerDays: 90 });
                  // En la vista de duplicados, una línea separa cada grupo
                  const newGroup = dupOrder && i > 0 && dupOrder.get(c.id) !== dupOrder.get(companies[i - 1]!.id);
                  return (
                    <tr key={c.id} className={`hover:bg-slate-50 ${newGroup ? "border-t-2 border-amber-300" : ""}`}>
                      <td>
                        <Link className="link inline-flex items-center gap-2" href={`/empresas/${c.id}`}>
                          <CompanyLogo name={c.name} domain={websiteDomain(c.website)} />
                          {c.name}
                        </Link>
                      </td>
                      <td>{c.industry ?? "—"}</td>
                      <td>{[c.city, c.country].filter(Boolean).join(", ") || "—"}</td>
                      <td className="text-right">{c._count.contacts}</td>
                      <td className="text-right">{c._count.deals}</td>
                      <td>{status ? <span className={`badge ${status.className}`}>{status.label}</span> : <span className="text-slate-400">—</span>}</td>
                      <td className="whitespace-nowrap">{c.owner?.name ?? <span className="text-slate-400">Sin asignar</span>}</td>
                      <td className="whitespace-nowrap text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <SemaforoDot level={a.level} title={a.label} /> {timeAgo(c.lastActivityAt)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap text-xs text-slate-500">{formatDate(c.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pager path="/empresas" sp={spRecord} total={total} page={page} per={per} />
        </>
      )}
    </div>
  );
}
