import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { EmptyState, LineBadge, PageHeader } from "@/components/ui";
import { CorreosTabs } from "../tabs";

export default async function TemplatesPage() {
  const user = await requirePagePermission("emails:send");
  const canManage = can(user, "docs:manage");
  const templates = await prisma.emailTemplate.findMany({
    orderBy: [{ businessLine: { name: "asc" } }, { name: "asc" }],
    include: { businessLine: { select: { name: true, color: true } }, createdBy: { select: { name: true } }, _count: { select: { emails: true } } },
  });
  return (
    <div>
      <PageHeader
        title="Correos"
        subtitle="Plantillas con los datos del contacto ({{nombre}}, {{empresa}}…) y documentos ya incluidos."
        actions={canManage && <Link href="/correos/plantillas/nueva" className="btn btn-primary">Nueva plantilla</Link>}
      />
      <CorreosTabs active="plantillas" />
      {templates.length === 0 ? (
        <EmptyState>Aún no hay plantillas. {canManage && "Crea la primera, por ejemplo «Envío de presentación Rutalink»."}</EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Línea</th>
                <th>Asunto</th>
                <th className="text-right">Veces usada</th>
                <th>Actualizada</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td>{canManage ? <Link className="link" href={`/correos/plantillas/${t.id}`}>{t.name}</Link> : t.name}</td>
                  <td><LineBadge line={t.businessLine} /></td>
                  <td className="max-w-sm truncate text-slate-600">{t.subject}</td>
                  <td className="text-right tabular-nums">{t._count.emails}</td>
                  <td className="whitespace-nowrap">{formatDate(t.updatedAt)}{t.createdBy && <span className="text-xs text-slate-400"> · {t.createdBy.name}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
