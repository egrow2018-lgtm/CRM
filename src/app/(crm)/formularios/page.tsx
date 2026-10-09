import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { EmptyState, LineBadge, PageHeader } from "@/components/ui";
import { IconPlus } from "@/components/icons";

export default async function FormsPage() {
  await requirePagePermission("forms:manage");
  const forms = await prisma.form.findMany({
    include: {
      businessLine: { select: { name: true, color: true } },
      assignee: { select: { name: true } },
      _count: { select: { submissions: true } },
      submissions: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Formularios"
        subtitle="Crea formularios para compartir en redes, publicaciones o tu sitio web. Cada respuesta llega a Contactos y a la bandeja de Leads."
        actions={<Link href="/formularios/nuevo" className="btn btn-primary"><IconPlus /> Nuevo formulario</Link>}
      />
      {forms.length === 0 ? (
        <EmptyState>Aún no hay formularios. Crea el primero, por ejemplo &quot;Solicita una demo de Ludus&quot;.</EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>Formulario</th><th>Línea</th><th>Leads para</th><th className="text-right">Respuestas</th><th>Última</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {forms.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50">
                  <td>
                    <Link className="link" href={`/formularios/${f.id}`}>{f.name}</Link>
                    <div className="text-xs text-slate-400">/f/{f.slug}</div>
                  </td>
                  <td><LineBadge line={f.businessLine} /></td>
                  <td>{f.assignee?.name ?? <span className="text-slate-500">Bandeja de leads</span>}</td>
                  <td className="text-right tabular-nums">{f._count.submissions}</td>
                  <td>{formatDate(f.submissions[0]?.createdAt)}</td>
                  <td>
                    <span className={`badge ${f.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>
                      {f.active ? "Publicado" : "Pausado"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
