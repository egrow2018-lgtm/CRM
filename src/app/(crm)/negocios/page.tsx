import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { dealCardInclude, dealWhere, getFilterOptions, type DealFilters } from "@/lib/queries";
import type { Prisma } from "@prisma/client";
import { contactName, formatDate, formatMoney, timeAgo, toNumber } from "@/lib/format";
import { Pager, SortHeader, pageParams } from "@/components/pager";
import { parseCustomData } from "@/lib/custom-fields";

function projectSummary(customData: unknown) {
  const data = parseCustomData(customData);
  return data.fechaEntrega || data.avance ? { entrega: data.fechaEntrega, avance: data.avance } : null;
}
import { LineBadge, PageHeader } from "@/components/ui";
import { IconPlus } from "@/components/icons";
import { DealFiltersBar } from "@/components/deal-filters";
import { DealBoard } from "./board";

const SORTS: Record<string, (dir: Prisma.SortOrder) => Prisma.DealOrderByWithRelationInput> = {
  name: (dir) => ({ name: dir }),
  stage: (dir) => ({ stage: { order: dir } }),
  amount: (dir) => ({ amount: dir }),
  closeDate: (dir) => ({ closeDate: { sort: dir, nulls: "last" } }),
  owner: (dir) => ({ owner: { name: dir } }),
  lastActivity: (dir) => ({ lastActivityAt: { sort: dir, nulls: "last" } }),
  createdAt: (dir) => ({ createdAt: dir }),
};

type SP = DealFilters & { view?: string; page?: string; per?: string; sort?: string };

export default async function DealsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const isList = sp.view === "list";
  const where = dealWhere(sp, user.id);
  const { page, per, skip } = pageParams(sp);
  const [sortField, sortDir] = (sp.sort ?? "closeDate_desc").split("_");
  const orderBy = (SORTS[sortField ?? ""] ?? SORTS.closeDate!)(sortDir === "asc" ? "asc" : "desc");

  const [stages, deals, totals, filterOptions] = await Promise.all([
    prisma.pipelineStage.findMany({ orderBy: { order: "asc" } }),
    prisma.deal.findMany({
      where,
      include: dealCardInclude,
      orderBy: isList ? [orderBy, { id: "asc" }] : { createdAt: "desc" },
      ...(isList ? { skip, take: per } : {}),
    }),
    // Totales del pipeline con los filtros (sin paginar)
    prisma.deal.findMany({ where, select: { amount: true, stage: { select: { probability: true, isWon: true, isLost: true } } } }),
    getFilterOptions(),
  ]);

  const openDeals = totals.filter((d) => !d.stage.isWon && !d.stage.isLost);
  const pipelineTotal = openDeals.reduce((s, d) => s + toNumber(d.amount), 0);
  const weightedTotal = openDeals.reduce((s, d) => s + (toNumber(d.amount) * d.stage.probability) / 100, 0);
  const spRecord = sp as Record<string, string | undefined>;

  return (
    <div>
      <PageHeader
        title="Negocios"
        subtitle={`${totals.length} negocios · Pipeline abierto ${formatMoney(pipelineTotal)} · Ponderado ${formatMoney(weightedTotal)}`}
        actions={
          can(user.role, "crm:write") && (
            <Link href="/negocios/nuevo" className="btn btn-primary">
              <IconPlus /> Agregar negocio
            </Link>
          )
        }
      />
      <DealFiltersBar options={filterOptions} />
      {isList ? (
        <>
          <div className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <SortHeader label="Nombre del negocio" field="name" path="/negocios" sp={spRecord} />
                  <SortHeader label="Etapa" field="stage" path="/negocios" sp={spRecord} />
                  <th>Línea</th>
                  <th>Empresa</th>
                  <SortHeader label="Valor" field="amount" path="/negocios" sp={spRecord} className="text-right" />
                  <SortHeader label="Fecha de cierre" field="closeDate" path="/negocios" sp={spRecord} />
                  <SortHeader label="Propietario" field="owner" path="/negocios" sp={spRecord} />
                  <th>Próxima actividad</th>
                  <SortHeader label="Última actividad" field="lastActivity" path="/negocios" sp={spRecord} />
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => {
                  const next = d.activities[0];
                  return (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="max-w-72"><Link className="link line-clamp-2" href={`/negocios/${d.id}`}>{d.name}</Link></td>
                      <td className="whitespace-nowrap">
                        <span className={`badge ${d.stage.isWon ? "bg-emerald-100 text-emerald-800" : d.stage.isLost ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-700"}`}>
                          {d.stage.name}
                        </span>
                      </td>
                      <td><LineBadge line={d.businessLine} /></td>
                      <td className="max-w-48 truncate">{d.company ? <Link className="hover:underline" href={`/empresas/${d.company.id}`}>{d.company.name}</Link> : "—"}</td>
                      <td className="text-right tabular-nums">{toNumber(d.amount) > 0 ? formatMoney(d.amount) : "—"}</td>
                      <td className="whitespace-nowrap">{formatDate(d.closeDate)}</td>
                      <td className="whitespace-nowrap">{d.owner?.name ?? "—"}</td>
                      <td className="max-w-56 truncate text-xs">
                        {next ? `${formatDate(next.dueDate)} · ${next.subject}` : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="whitespace-nowrap text-xs text-slate-500">{timeAgo(d.lastActivityAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pager path="/negocios" sp={spRecord} total={totals.length} page={page} per={per} />
        </>
      ) : (
        <DealBoard
          stages={stages.map(({ id, name, probability, isWon, isLost }) => ({ id, name, probability, isWon, isLost }))}
          deals={deals.map((d) => ({
            id: d.id,
            name: d.name,
            amount: toNumber(d.amount),
            stageId: d.stageId,
            closeDate: d.closeDate?.toISOString() ?? null,
            createdAt: d.createdAt.toISOString(),
            lastActivityAt: d.lastActivityAt?.toISOString() ?? null,
            owner: d.owner?.name ?? null,
            company: d.company?.name ?? null,
            line: d.businessLine,
            contact: d.contact && { name: contactName(d.contact), email: d.contact.email, phone: d.contact.phone },
            next: d.activities[0]
              ? { type: d.activities[0].type, subject: d.activities[0].subject, dueDate: d.activities[0].dueDate?.toISOString() ?? null }
              : null,
            pending: d._count.activities,
            project: projectSummary(d.customData),
          }))}
          users={filterOptions.users}
        />
      )}
    </div>
  );
}
