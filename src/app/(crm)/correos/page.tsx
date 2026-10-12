import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { contactName, formatDateTime } from "@/lib/format";
import { EmptyState, PageHeader } from "@/components/ui";
import { Pager, pageParams } from "@/components/pager";
import { SearchBox } from "@/components/search-box";
import { CorreosTabs } from "./tabs";
import { EmailStatus } from "@/components/email-status";
import { BulkCheckCell, BulkCheckHeader, BulkSelection } from "@/components/bulk-selection";
import { can } from "@/lib/permissions";
import { DELIVERY_LABELS } from "@/lib/email";
import { deleteEmails } from "./actions";

type SP = { q?: string; owner?: string; estado?: string; page?: string; per?: string };

export default async function EmailsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePagePermission("emails:send");
  const sp = await searchParams;
  const { page, per } = pageParams(sp);
  const where: Prisma.EmailMessageWhereInput = {
    ...(sp.q
      ? {
          OR: [
            { subject: { contains: sp.q, mode: "insensitive" } },
            { to: { has: sp.q.toLowerCase() } },
            { contact: { OR: [{ firstName: { contains: sp.q, mode: "insensitive" } }, { lastName: { contains: sp.q, mode: "insensitive" } }] } },
            { company: { name: { contains: sp.q, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(sp.owner ? { fromUserId: sp.owner } : {}),
    ...(sp.estado === "abiertos" ? { openCount: { gt: 0 } } : sp.estado === "sin-abrir" ? { openCount: 0 } : sp.estado === "clic" ? { clickCount: { gt: 0 } } : {}),
  };
  const [emails, total, users, totals] = await Promise.all([
    prisma.emailMessage.findMany({
      where,
      orderBy: { sentAt: "desc" },
      skip: (page - 1) * per,
      take: per,
      include: {
        fromUser: { select: { name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        company: { select: { name: true } },
        deal: { select: { id: true, name: true } },
        docLinks: { select: { _count: { select: { views: true } } } },
      },
    }),
    prisma.emailMessage.count({ where }),
    prisma.user.findMany({ where: { emailsSent: { some: {} } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.emailMessage.aggregate({ _count: true, where: { sentAt: { gte: new Date(Date.now() - 30 * 864e5) } } }),
  ]);
  const opened30 = await prisma.emailMessage.count({ where: { sentAt: { gte: new Date(Date.now() - 30 * 864e5) }, openCount: { gt: 0 } } });
  const spRecord = sp as Record<string, string | undefined>;
  // Cada quien borra sus correos; quien gestiona plantillas y documentos puede borrar todos
  const canDeleteAll = can(user, "docs:manage");

  return (
    <div>
      <PageHeader
        title="Correos"
        subtitle={`Últimos 30 días: ${totals._count} enviados · ${opened30} abiertos${totals._count ? ` (${Math.round((opened30 / totals._count) * 100)}%)` : ""}`}
        actions={<Link href="/correos/nuevo" className="btn btn-primary">Nuevo correo</Link>}
      />
      <CorreosTabs active="enviados" />
      <div className="flex flex-wrap items-start gap-2">
        <div className="w-full sm:w-72"><SearchBox placeholder="Buscar por asunto, contacto o empresa" /></div>
        <form method="get" className="flex flex-wrap items-center gap-2 text-sm">
          {sp.q && <input type="hidden" name="q" value={sp.q} />}
          <select name="owner" defaultValue={sp.owner ?? ""} className="input w-auto">
            <option value="">Todos los remitentes</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select name="estado" defaultValue={sp.estado ?? ""} className="input w-auto">
            <option value="">Todos</option>
            <option value="abiertos">Abiertos</option>
            <option value="sin-abrir">Sin abrir</option>
            <option value="clic">Con clic o documento visto</option>
          </select>
          <button className="btn btn-sm">Filtrar</button>
        </form>
      </div>
      {emails.length === 0 ? (
        <EmptyState>
          {total === 0 && !sp.q && !sp.owner && !sp.estado
            ? "Aún no has enviado correos desde el CRM. Abre un contacto o negocio y pulsa «Enviar correo»."
            : "No hay correos con esos filtros."}
        </EmptyState>
      ) : (
        <>
          <BulkSelection onDelete={deleteEmails} noun={{ one: "correo", many: "correos" }}>
          <div className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <BulkCheckHeader />
                  <th>Asunto</th>
                  <th>Para</th>
                  <th>Estado</th>
                  <th>Enviado por</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {emails.map((e) => (
                  <tr key={e.id}>
                    {canDeleteAll || e.fromUserId === user.id ? <BulkCheckCell id={e.id} label={e.subject} /> : <td className="hidden group-data-[selecting=true]:table-cell" />}
                    <td className="max-w-xs">
                      <Link href={`/correos/${e.id}`} className="link line-clamp-1">{e.subject}</Link>
                      {e.deal && <Link href={`/negocios/${e.deal.id}`} className="block text-xs text-slate-500 hover:underline">{e.deal.name}</Link>}
                    </td>
                    <td>
                      {e.contact ? <Link className="hover:underline" href={`/contactos/${e.contact.id}`}>{contactName(e.contact)}</Link> : e.to.join(", ")}
                      {e.company && <span className="block text-xs text-slate-500">{e.company.name}</span>}
                    </td>
                    <td>
                      <EmailStatus email={e} docViews={e.docLinks.reduce((s, l) => s + l._count.views, 0)} />
                      {e.deliveryStatus && ["bounced", "complained", "failed", "delivery_delayed"].includes(e.deliveryStatus) && (
                        <span className={`badge ml-1 ${DELIVERY_LABELS[e.deliveryStatus]!.className}`}>{DELIVERY_LABELS[e.deliveryStatus]!.label}</span>
                      )}
                    </td>
                    <td>{e.fromUser?.name ?? "—"}</td>
                    <td className="whitespace-nowrap">{formatDateTime(e.sentAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </BulkSelection>
          <Pager path="/correos" sp={spRecord} total={total} page={page} per={per} />
        </>
      )}
    </div>
  );
}
