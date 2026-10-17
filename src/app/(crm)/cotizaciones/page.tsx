import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { contactName, formatMoney, formatMoneyExact, toNumber, formatLocalDate } from "@/lib/format";
import { quoteCode, type QuoteSnapshot } from "@/lib/quotes";
import { EmptyState, LineBadge, PageHeader } from "@/components/ui";
import { SemaforoPunto } from "@/components/semaforo";
import { Pager, hrefWith, pageParams } from "@/components/pager";
import { QuoteFilters } from "./filters";
import { QuoteStatusSelect } from "./status-select";
import { deleteQuotes } from "./actions";
import { can } from "@/lib/permissions";
import { BulkCheckCell, BulkCheckHeader, BulkSelection } from "@/components/bulk-selection";

type SP = { q?: string; line?: string; year?: string; status?: string; owner?: string; page?: string; per?: string };

export default async function QuotesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const canWrite = can(user, "deals:write");
  const sp = await searchParams;
  const now = new Date();

  // Filtros comunes (sin la línea de negocio, para poder mostrar el resumen por línea)
  const base: Prisma.QuoteWhereInput[] = [];
  if (sp.q) {
    const q = sp.q.trim();
    const code = q.match(/(\d{4})\D+(\d+)/);
    base.push({
      OR: [
        ...(code ? [{ year: Number(code[1]), number: Number(code[2]) }] : []),
        { deal: { name: { contains: q, mode: "insensitive" } } },
        { deal: { company: { name: { contains: q, mode: "insensitive" } } } },
        { deal: { contact: { firstName: { contains: q, mode: "insensitive" } } } },
        { deal: { contact: { lastName: { contains: q, mode: "insensitive" } } } },
        { contact: { firstName: { contains: q, mode: "insensitive" } } },
        { contact: { lastName: { contains: q, mode: "insensitive" } } },
      ],
    });
  }
  if (Number(sp.year)) base.push({ year: Number(sp.year) });
  if (sp.owner) base.push({ OR: [{ deal: { ownerId: sp.owner } }, { dealId: null, contact: { ownerId: sp.owner } }] });
  if (sp.status === "vigente") base.push({ validUntil: { gte: now } });
  if (sp.status === "vencida") base.push({ validUntil: { lt: now } });
  if (sp.status === "enviada") base.push({ sentAt: { not: null } });
  if (sp.status === "sin-enviar") base.push({ sentAt: null });
  if (sp.status === "ganada") base.push({ deal: { stage: { isWon: true } } });
  const byStatus = { emitida: "EMITIDA", "en-revision": "EN_REVISION", aprobada: "APROBADA", "no-aprobada": "NO_APROBADA" } as const;
  if (sp.status && sp.status in byStatus) base.push({ status: byStatus[sp.status as keyof typeof byStatus] });
  // Línea: la del negocio o la de alguno de sus productos
  // (sin negocio: la línea elegida al cotizar)
  const lineWhere = (lineId: string): Prisma.QuoteWhereInput => ({
    OR: [
      { deal: { OR: [{ businessLineId: lineId }, { items: { some: { product: { businessLineId: lineId } } } }] } },
      { dealId: null, businessLineId: lineId },
    ],
  });
  const where: Prisma.QuoteWhereInput = { AND: [...base, ...(sp.line ? [lineWhere(sp.line)] : [])] };

  const { page, per, skip } = pageParams(sp);
  const [total, sum, quotes, lines, users, yearRows] = await Promise.all([
    prisma.quote.count({ where }),
    prisma.quote.aggregate({ where, _sum: { total: true } }),
    prisma.quote.findMany({
      where,
      include: {
        deal: {
          select: {
            id: true,
            name: true,
            businessLine: { select: { name: true, color: true } },
            company: { select: { id: true, name: true } },
            owner: { select: { name: true } },
            stage: { select: { name: true, isWon: true, isLost: true } },
          },
        },
        contact: { select: { id: true, firstName: true, lastName: true, owner: { select: { name: true } } } },
        businessLine: { select: { name: true, color: true } },
      },
      orderBy: [{ year: "desc" }, { number: "desc" }],
      skip,
      take: per,
    }),
    prisma.businessLine.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, color: true } }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.quote.findMany({ distinct: ["year"], select: { year: true }, orderBy: { year: "desc" } }),
  ]);
  // Resumen por línea de negocio con los demás filtros aplicados
  const byLine = await Promise.all(
    lines.map(async (l) => {
      const agg = await prisma.quote.aggregate({ where: { AND: [...base, lineWhere(l.id)] }, _sum: { total: true }, _count: true });
      return { ...l, count: agg._count, total: toNumber(agg._sum.total) };
    }),
  );
  const spRecord = sp as Record<string, string | undefined>;

  return (
    <div>
      <PageHeader
        title="Cotizaciones"
        subtitle={`${total} cotizaciones · ${formatMoney(sum._sum.total)} cotizado`}
        actions={canWrite && <Link href="/cotizaciones/nueva" className="btn btn-primary">Nueva cotización</Link>}
      />
      <QuoteFilters lines={lines} users={users} years={yearRows.map((r) => r.year)} />

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {byLine.filter((l) => l.count > 0 || sp.line === l.id).map((l) => {
          const active = sp.line === l.id;
          return (
            <Link
              key={l.id}
              href={hrefWith("/cotizaciones", spRecord, { line: active ? undefined : l.id, page: undefined })}
              className={`card flex items-center justify-between gap-2 px-4 py-3 transition hover:shadow-md ${active ? "ring-2 ring-accent-500" : ""}`}
              title={active ? "Quitar este filtro" : `Ver solo ${l.name}`}
            >
              <span>
                <LineBadge line={l} />
                <span className="mt-1 block text-xs text-slate-500">{l.count} cotizaciones</span>
              </span>
              <span className="text-lg font-semibold tabular-nums text-brand-700">{formatMoney(l.total)}</span>
            </Link>
          );
        })}
      </div>

      {quotes.length === 0 ? (
        <EmptyState>No hay cotizaciones con estos filtros.</EmptyState>
      ) : (
        <>
          <BulkSelection enabled={canWrite} onDelete={deleteQuotes} noun={{ one: "cotización", many: "cotizaciones" }}>
          <div className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  {canWrite && <BulkCheckHeader />}
                  <th>Número</th>
                  <th>Estado</th>
                  <th>Negocio</th>
                  <th>Cliente</th>
                  <th>Línea</th>
                  <th className="text-right">Total</th>
                  <th>Emitida</th>
                  <th>Válida hasta</th>
                  <th>Correo</th>
                  <th>Etapa del negocio</th>
                  <th>Responsable</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => {
                  const snap = q.snapshot as unknown as QuoteSnapshot;
                  const expired = q.validUntil < now;
                  const client = q.deal?.company?.name ?? snap.client?.company ?? snap.client?.contact ?? "—";
                  return (
                    <tr key={q.id} className="hover:bg-slate-50">
                      {canWrite && <BulkCheckCell id={q.id} label={quoteCode(q.year, q.number)} />}
                      <td className="whitespace-nowrap">
                        <Link className="link" href={`/cotizaciones/${q.id}`}>{quoteCode(q.year, q.number)}</Link>
                        <a className="ml-2 text-xs text-slate-400 hover:text-brand-700" href={`/cotizaciones/${q.id}/pdf`} target="_blank" rel="noreferrer">PDF</a>
                      </td>
                      <td className="whitespace-nowrap"><QuoteStatusSelect id={q.id} status={q.status} disabled={!canWrite} /></td>
                      <td className="max-w-56 truncate">
                        {q.deal ? <Link className="hover:underline" href={`/negocios/${q.deal.id}`}>{q.deal.name}</Link> : <span className="text-xs text-slate-400">Sin negocio</span>}
                      </td>
                      <td className="max-w-48 truncate">
                        {q.deal?.company ? (
                          <Link className="hover:underline" href={`/empresas/${q.deal.company.id}`}>{client}</Link>
                        ) : !q.deal && q.contact ? (
                          <Link className="hover:underline" href={`/contactos/${q.contact.id}`}>{contactName(q.contact)}</Link>
                        ) : (
                          client
                        )}
                      </td>
                      <td><LineBadge line={q.deal?.businessLine ?? q.businessLine} /></td>
                      <td className="text-right tabular-nums">{formatMoneyExact(q.total)}</td>
                      <td className="whitespace-nowrap text-xs text-slate-500">{formatLocalDate(q.createdAt)}</td>
                      <td className="whitespace-nowrap text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <SemaforoPunto level={expired ? "rojo" : "verde"} title={expired ? "Vencida" : "Vigente"} /> {formatLocalDate(q.validUntil)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap text-xs text-slate-500">{q.sentAt ? `Enviada ${formatLocalDate(q.sentAt)}` : "—"}</td>
                      <td className="whitespace-nowrap text-xs">
                        {q.deal ? (
                          <span className={q.deal.stage.isWon ? "font-semibold text-emerald-700" : q.deal.stage.isLost ? "text-slate-400" : "text-slate-600"}>
                            {q.deal.stage.name}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-xs">{(q.deal ? q.deal.owner?.name : q.contact?.owner?.name) ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </BulkSelection>
          <Pager path="/cotizaciones" sp={spRecord} total={total} page={page} per={per} />
        </>
      )}
    </div>
  );
}
