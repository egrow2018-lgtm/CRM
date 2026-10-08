import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { dealCardInclude, dealWhere, type DealFilters } from "@/lib/queries";
import { formatDate, formatMoney, toNumber } from "@/lib/format";
import { LineBadge, PageHeader } from "@/components/ui";
import { IconPlus } from "@/components/icons";
import { DealFiltersBar } from "./filters";
import { DealBoard } from "./board";

export default async function DealsPage({ searchParams }: { searchParams: Promise<DealFilters & { view?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [stages, deals, users, lines] = await Promise.all([
    prisma.pipelineStage.findMany({ orderBy: { order: "asc" } }),
    prisma.deal.findMany({ where: dealWhere(sp, user.id), include: dealCardInclude, orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.businessLine.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const openDeals = deals.filter((d) => !d.stage.isWon && !d.stage.isLost);
  const pipelineTotal = openDeals.reduce((s, d) => s + toNumber(d.amount), 0);
  const weightedTotal = openDeals.reduce((s, d) => s + (toNumber(d.amount) * d.stage.probability) / 100, 0);

  return (
    <div>
      <PageHeader
        title="Negocios"
        subtitle={`${deals.length} negocios · Pipeline abierto ${formatMoney(pipelineTotal)} · Ponderado ${formatMoney(weightedTotal)}`}
        actions={
          can(user.role, "crm:write") && (
            <Link href="/negocios/nuevo" className="btn btn-primary">
              <IconPlus /> Agregar negocio
            </Link>
          )
        }
      />
      <DealFiltersBar users={users} lines={lines} />
      {sp.view === "list" ? (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Negocio</th>
                <th>Etapa</th>
                <th>Línea</th>
                <th>Empresa</th>
                <th className="text-right">Valor</th>
                <th>Cierre</th>
                <th>Propietario</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td><Link className="link" href={`/negocios/${d.id}`}>{d.name}</Link></td>
                  <td>{d.stage.name}</td>
                  <td><LineBadge line={d.businessLine} /></td>
                  <td>{d.company ? <Link className="hover:underline" href={`/empresas/${d.company.id}`}>{d.company.name}</Link> : "—"}</td>
                  <td className="text-right tabular-nums">{formatMoney(d.amount)}</td>
                  <td>{formatDate(d.closeDate)}</td>
                  <td>{d.owner?.name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
            openTasks: d._count.activities,
          }))}
        />
      )}
    </div>
  );
}
