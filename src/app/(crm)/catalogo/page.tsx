import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { formatMoneyExact, toNumber } from "@/lib/format";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { PageHeader } from "@/components/ui";
import { saveBusinessLine, saveLineFields, saveProduct } from "./actions";
import { LineFieldsEditor } from "./line-fields-editor";
import { parseCustomFields } from "@/lib/custom-fields";

export default async function CatalogPage() {
  const user = await requireUser();
  const canManage = can(user.role, "catalog:manage");
  const lines = await prisma.businessLine.findMany({
    include: {
      products: { orderBy: { name: "asc" } },
      _count: { select: { deals: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Líneas de negocio y productos"
        subtitle="Cada línea (E-learning, Rutalink, Ludus, Humand, nuevas representaciones…) tiene su propio catálogo de productos y servicios."
      />

      {canManage && (
        <details className="card mb-4 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-brand-700">+ Nueva línea de negocio / representación</summary>
          <ActionForm action={saveBusinessLine.bind(null, null)} resetOnSuccess className="mt-3 grid gap-3 sm:grid-cols-6">
            <input name="name" required placeholder="Nombre" className="input sm:col-span-2" />
            <input name="description" placeholder="Descripción" className="input sm:col-span-3" />
            <input name="color" type="color" defaultValue="#1c315e" className="input h-9 p-1 sm:col-span-1" title="Color" />
            <div className="sm:col-span-6"><SubmitButton>Crear línea</SubmitButton></div>
          </ActionForm>
        </details>
      )}

      <div className="space-y-4">
        {lines.map((line) => (
          <section key={line.id} className={`card overflow-hidden ${line.active ? "" : "opacity-60"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3" style={{ borderLeft: `4px solid ${line.color}` }}>
              <div>
                <h2 className="text-base">
                  {line.name} {!line.active && <span className="badge bg-slate-200 text-slate-600">Inactiva</span>}
                </h2>
                {line.description && <p className="text-xs text-slate-500">{line.description}</p>}
              </div>
              <span className="text-xs text-slate-500">{line.products.length} productos · {line._count.deals} negocios</span>
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr><th>Producto / servicio</th><th>Tipo</th><th>SKU</th><th className="text-right">Precio de lista</th><th>Estado</th>{canManage && <th />}</tr>
                </thead>
                <tbody>
                  {line.products.map((p) => (
                    <tr key={p.id} className={p.active ? "" : "text-slate-400"}>
                      <td>
                        <div className="font-medium">{p.name}</div>
                        {p.description && <div className="text-xs text-slate-500">{p.description}</div>}
                      </td>
                      <td>{p.type === "PRODUCTO" ? "Producto" : "Servicio"}</td>
                      <td>{p.sku ?? "—"}</td>
                      <td className="text-right tabular-nums">{toNumber(p.unitPrice) > 0 ? formatMoneyExact(p.unitPrice) : "—"}</td>
                      <td>{p.active ? "Activo" : "Inactivo"}</td>
                      {canManage && (
                        <td className="text-right">
                          <details className="relative">
                            <summary className="cursor-pointer text-xs text-brand-700">Editar</summary>
                            <div className="card absolute right-0 z-10 mt-1 w-96 p-3 text-left">
                              <ActionForm action={saveProduct.bind(null, p.id)} className="grid gap-2 sm:grid-cols-2">
                                <input type="hidden" name="businessLineId" value={line.id} />
                                <input name="name" required defaultValue={p.name} className="input sm:col-span-2" />
                                <input name="description" defaultValue={p.description ?? ""} placeholder="Descripción" className="input sm:col-span-2" />
                                <select name="type" defaultValue={p.type} className="input">
                                  <option value="SERVICIO">Servicio</option>
                                  <option value="PRODUCTO">Producto</option>
                                </select>
                                <input name="sku" defaultValue={p.sku ?? ""} placeholder="SKU" className="input" />
                                <input name="unitPrice" type="number" step="0.01" min="0" defaultValue={toNumber(p.unitPrice)} className="input" />
                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={p.active} /> Activo</label>
                                <div className="sm:col-span-2"><SubmitButton className="btn btn-primary btn-sm">Guardar</SubmitButton></div>
                              </ActionForm>
                            </div>
                          </details>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {canManage && (
              <div className="border-t border-slate-100 bg-slate-50/60 p-3">
                <ActionForm action={saveProduct.bind(null, null)} resetOnSuccess className="grid gap-2 sm:grid-cols-12">
                  <input type="hidden" name="businessLineId" value={line.id} />
                  <input name="name" required placeholder="Nuevo producto o servicio" className="input sm:col-span-4" />
                  <input name="description" placeholder="Descripción" className="input sm:col-span-3" />
                  <select name="type" className="input sm:col-span-2" defaultValue="SERVICIO">
                    <option value="SERVICIO">Servicio</option>
                    <option value="PRODUCTO">Producto</option>
                  </select>
                  <input name="unitPrice" type="number" step="0.01" min="0" placeholder="Precio US$" className="input sm:col-span-2" />
                  <SubmitButton className="btn btn-primary sm:col-span-1" pendingText="…">Agregar</SubmitButton>
                </ActionForm>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-slate-500">
                    Campos de los negocios de esta línea ({parseCustomFields(line.customFields).length})
                  </summary>
                  <p className="mt-1 text-xs text-slate-500">
                    Se activan en la ficha de cada negocio de {line.name} (ej. tiempo de desarrollo, equipo, fecha de entrega).
                  </p>
                  <LineFieldsEditor initial={parseCustomFields(line.customFields)} action={saveLineFields.bind(null, line.id)} />
                </details>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-slate-500">Editar línea</summary>
                  <ActionForm action={saveBusinessLine.bind(null, line.id)} className="mt-2 grid gap-2 sm:grid-cols-6">
                    <input name="name" required defaultValue={line.name} className="input sm:col-span-2" />
                    <input name="description" defaultValue={line.description ?? ""} className="input sm:col-span-2" />
                    <input name="color" type="color" defaultValue={line.color} className="input h-9 p-1" />
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={line.active} /> Activa</label>
                    <div className="sm:col-span-6"><SubmitButton className="btn btn-sm btn-primary">Guardar línea</SubmitButton></div>
                  </ActionForm>
                </details>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
