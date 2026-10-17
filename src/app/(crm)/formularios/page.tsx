import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { formatDateTime, formatLocalDate } from "@/lib/format";
import { conversionRate } from "@/lib/form-stats";
import { EmptyState, LineBadge, PageHeader } from "@/components/ui";
import { IconPlus } from "@/components/icons";

export default async function FormsPage() {
  await requirePagePermission("forms:manage");
  const forms = await prisma.form.findMany({
    include: {
      businessLine: { select: { name: true, color: true } },
      assignee: { select: { name: true } },
      _count: { select: { submissions: true, views: true } },
      submissions: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const totals = forms.reduce((t, f) => ({ views: t.views + f._count.views, submissions: t.submissions + f._count.submissions }), { views: 0, submissions: 0 });
  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Formularios"
        subtitle={`${forms.length} formularios · comparte el enlace en redes, publicaciones o tu web; cada respuesta llega a Contactos y a la bandeja de Leads.`}
        actions={<Link href="/formularios/nuevo" className="btn btn-primary"><IconPlus /> Crear formulario</Link>}
      />
      {forms.length === 0 ? (
        <EmptyState>Aún no hay formularios. Crea el primero, por ejemplo &quot;Solicita una demo de Ludus&quot;.</EmptyState>
      ) : (
        <>
          <div className="card mb-4 grid grid-cols-3 divide-x divide-slate-100 text-center">
            {[
              ["Visualizaciones", totals.views.toLocaleString("es-EC")],
              ["Envíos", totals.submissions.toLocaleString("es-EC")],
              ["Tasa de conversión", conversionRate(totals.submissions, totals.views)],
            ].map(([label, value]) => (
              <div key={label} className="px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums text-brand-700">{value}</div>
              </div>
            ))}
          </div>
          <div className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Línea</th>
                  <th>Leads para</th>
                  <th className="text-right">Visualizaciones</th>
                  <th className="text-right">Envíos</th>
                  <th className="text-right">Envíos / visualizaciones</th>
                  <th>Último envío</th>
                  <th>Actualizado</th>
                </tr>
              </thead>
              <tbody>
                {forms.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50">
                    <td>
                      <Link className="link" href={`/formularios/${f.id}`}>{f.name}</Link>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                        <span className={`inline-block h-2 w-2 rounded-full ${f.active ? "bg-alert-green" : "bg-slate-300"}`} />
                        {f.active ? "Publicado" : "Pausado"} · /f/{f.slug}
                      </div>
                    </td>
                    <td><LineBadge line={f.businessLine} /></td>
                    <td className="whitespace-nowrap">{f.assignee?.name ?? <span className="text-slate-500">Bandeja de leads</span>}</td>
                    <td className="text-right tabular-nums">{f._count.views}</td>
                    <td className="text-right tabular-nums">
                      <Link className="link" href={`/formularios/${f.id}?tab=envios`}>{f._count.submissions}</Link>
                    </td>
                    <td className="text-right tabular-nums">{conversionRate(f._count.submissions, f._count.views)}</td>
                    <td className="whitespace-nowrap text-xs text-slate-500">{f.submissions[0] ? formatDateTime(f.submissions[0].createdAt) : "—"}</td>
                    <td className="whitespace-nowrap text-xs text-slate-500">{formatLocalDate(f.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500">Las visualizaciones se cuentan desde hoy; las de HubSpot no se importan.</p>
        </>
      )}
    </div>
  );
}
