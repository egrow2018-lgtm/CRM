import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { contactName, formatDateTime, formatLocalDate } from "@/lib/format";
import { formatDuration, groupVisitors, parsePageTimes, visitorKey } from "@/lib/doc-stats";
import { websiteDomain } from "@/lib/csv";
import { appUrl } from "@/lib/email";
import { PageHeader } from "@/components/ui";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/action-form";
import { CompanyLogo } from "@/components/company-logo";
import { CopyButton } from "@/components/copy-button";
import { deleteDocument, deleteShareLink, updateDocument } from "../actions";
import { DocThumb } from "../doc-thumb";
import { ShareLinkForm } from "./share-link-form";

type SP = { visitante?: string; editar?: string };

export default async function DocumentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const user = await requirePagePermission("emails:send");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const doc = await prisma.document.findUnique({ where: { id }, include: { owner: { select: { name: true } }, folder: true } });
  if (!doc) notFound();
  const canManage = can(user, "docs:manage");

  const [links, views, folders, contacts] = await Promise.all([
    prisma.documentLink.findMany({
      where: { documentId: id },
      orderBy: { createdAt: "desc" },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { name: true } },
        email: { select: { id: true, subject: true } },
        _count: { select: { views: true } },
        views: { orderBy: { startedAt: "desc" }, take: 1, select: { startedAt: true } },
      },
    }),
    prisma.documentView.findMany({
      where: { link: { documentId: id } },
      orderBy: { startedAt: "desc" },
      include: {
        link: {
          select: {
            id: true,
            label: true,
            contactId: true,
            contact: { select: { id: true, firstName: true, lastName: true, company: { select: { name: true, website: true } } } },
          },
        },
      },
    }),
    canManage ? prisma.documentFolder.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
    prisma.contact.findMany({
      select: { id: true, firstName: true, lastName: true, company: { select: { name: true } } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      take: 3000,
    }),
  ]);
  const visitors = groupVisitors(views);
  const selected = sp.visitante ? visitors.find((v) => v.key === sp.visitante) : null;
  const selectedViews = selected ? views.filter((v) => visitorKey(v) === selected.key) : [];
  const base = appUrl();

  return (
    <div>
      <div className="mb-2 text-sm"><Link href="/documentos" className="text-slate-500 hover:underline">← Documentos</Link></div>
      <PageHeader
        title={
          <span className="flex items-center gap-4">
            <DocThumb src={doc.thumbnail} mime={doc.mimeType} className="h-20 w-32" />
            <span>
              {doc.name}
              <span className="mt-1 block text-sm font-normal text-slate-500">
                {doc.fileName} · {doc.size < 1024 * 1024 ? `${Math.max(1, Math.round(doc.size / 1024))} KB` : `${(doc.size / 1024 / 1024).toFixed(1)} MB`}{doc.pageCount ? ` · ${doc.pageCount} páginas` : ""}
              </span>
            </span>
          </span>
        }
        subtitle={
          <span className="flex flex-wrap gap-x-3">
            <span>Propietario: {doc.owner?.name ?? "—"}</span>
            {doc.folder && <span>📁 {doc.folder.name}</span>}
            <span>Descarga: {doc.allowDownload ? "permitida" : "no permitida"}</span>
            <span>Privacidad de datos: {doc.consentRequired ? "activada" : "desactivada"}</span>
            <span>Actualizado {formatLocalDate(doc.updatedAt)}</span>
          </span>
        }
        actions={
          <>
            <Link href={`/correos/nuevo?doc=${doc.id}`} className="btn btn-primary">Enviar por correo</Link>
            {canManage && <Link href={sp.editar ? `/documentos/${id}` : `/documentos/${id}?editar=1`} className="btn">{sp.editar ? "Cancelar" : "Editar"}</Link>}
            {canManage && (
              <form action={deleteDocument.bind(null, id)}>
                <ConfirmButton message="¿Eliminar este documento? Los enlaces que ya enviaste dejarán de funcionar.">Eliminar</ConfirmButton>
              </form>
            )}
          </>
        }
      />

      {doc.description && <p className="-mt-2 mb-4 whitespace-pre-line text-sm text-slate-600">{doc.description}</p>}

      {canManage && sp.editar && (
        <div className="card mb-4 p-4">
          <ActionForm action={updateDocument.bind(null, id)} successMessage="Cambios guardados." className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-500">
              Nombre que verá el cliente
              <input name="name" required defaultValue={doc.name} className="input mt-1" />
            </label>
            <label className="text-xs text-slate-500">
              Carpeta
              <select name="folderId" defaultValue={doc.folderId ?? ""} className="input mt-1">
                <option value="">Sin carpeta</option>
                {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-500 sm:col-span-2">
              Descripción (solo para el equipo)
              <textarea name="description" rows={2} defaultValue={doc.description ?? ""} className="input mt-1" />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="allowDownload" defaultChecked={doc.allowDownload} /> Permitir que el cliente lo descargue
            </label>
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" name="consentRequired" defaultChecked={doc.consentRequired} className="mt-1" />
              <span>
                Activar la privacidad de datos: el visitante acepta el aviso de uso de datos (LOPDP) antes de ver el documento
                {" "}(y escribe su correo si el enlace no es para un contacto).
              </span>
            </label>
            <div className="sm:col-span-2"><SubmitButton>Guardar</SubmitButton></div>
          </ActionForm>
        </div>
      )}

      <div className="card mb-4 grid grid-cols-3 divide-x divide-slate-100 text-center">
        {[
          ["Enlaces creados", links.length],
          ["Visitantes", visitors.length],
          ["Vistas", views.length],
        ].map(([label, value]) => (
          <div key={label} className="px-4 py-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
            <div className="mt-1 text-3xl font-semibold tabular-nums text-brand-700">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="card p-4">
            <h2 className="mb-3 text-base">Visitantes</h2>
            {visitors.length === 0 ? (
              <p className="text-sm text-slate-500">Nadie ha abierto este documento todavía. Las vistas del equipo (con sesión en el CRM) no se cuentan.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th className="text-right">Vistas</th>
                    <th className="text-right">Tiempo total</th>
                    <th>Última vista</th>
                  </tr>
                </thead>
                <tbody>
                  {visitors.map((v) => (
                    <tr key={v.key} className={selected?.key === v.key ? "bg-brand-50" : ""}>
                      <td>
                        <Link href={`/documentos/${id}?visitante=${encodeURIComponent(v.key)}`} scroll={false} className="link inline-flex items-center gap-2">
                          <CompanyLogo name={v.company?.name ?? v.name} domain={websiteDomain(v.company?.website)} />
                          <span>
                            {v.name}
                            {v.company && <span className="block text-xs font-normal text-slate-500">{v.company.name}</span>}
                          </span>
                        </Link>
                        {v.downloaded && <span className="badge ml-2 bg-emerald-50 text-emerald-700">Descargó</span>}
                      </td>
                      <td className="text-right tabular-nums">{v.visits}</td>
                      <td className="text-right tabular-nums">{formatDuration(v.totalSec)}</td>
                      <td className="whitespace-nowrap">{formatDateTime(v.lastVisit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card mt-4 p-4">
            <h2 className="mb-3 text-base">Enlaces creados</h2>
            {links.length === 0 ? (
              <p className="text-sm text-slate-500">Aún no hay enlaces. Envíalo por correo o crea un enlace para compartirlo por WhatsApp u Outlook.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {links.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                    <span className="font-medium">
                      {l.contact ? <Link className="link" href={`/contactos/${l.contact.id}`}>{contactName(l.contact)}</Link> : (l.label ?? "Sin etiqueta")}
                    </span>
                    <span className="text-xs text-slate-500">
                      {l.email ? <Link className="hover:underline" href={`/correos/${l.email.id}`}>por correo</Link> : "enlace directo"} · {l.createdBy?.name ?? "—"} · {formatLocalDate(l.createdAt)}
                    </span>
                    <span className="text-xs text-slate-500">
                      {l._count.views} {l._count.views === 1 ? "vista" : "vistas"}
                      {l.views[0] && ` · última ${formatDateTime(l.views[0].startedAt)}`}
                    </span>
                    <span className="ml-auto flex gap-1">
                      <CopyButton text={`${base}/d/${l.token}`} label="Copiar enlace" />
                      <form action={deleteShareLink.bind(null, l.id)}>
                        <ConfirmButton className="btn btn-sm text-slate-500" message="¿Desactivar este enlace? Quien lo tenga ya no podrá abrir el documento.">✕</ConfirmButton>
                      </form>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {selected ? (
            <div className="card p-4">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base">
                    {selected.contactId ? <Link className="link" href={`/contactos/${selected.contactId}`}>{selected.name}</Link> : selected.name}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {selected.visits} {selected.visits === 1 ? "visita" : "visitas"} · {formatDuration(selected.totalSec)} en total
                  </p>
                </div>
                <Link href={`/documentos/${id}`} scroll={false} className="text-slate-400 hover:text-slate-700" title="Cerrar">✕</Link>
              </div>
              <div className="space-y-2">
                {selectedViews.map((v, i) => (
                  <details key={v.id} open={i === 0} className="rounded-lg border border-slate-200 p-3">
                    <summary className="cursor-pointer text-sm font-medium text-slate-700">
                      {formatDateTime(v.startedAt)} · {formatDuration(v.durationSec)}
                      {v.downloaded && " · descargó"}
                    </summary>
                    <PageChart times={parsePageTimes(v.pageTimes, doc.pageCount)} />
                  </details>
                ))}
              </div>
            </div>
          ) : (
            visitors.length > 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                Pulsa un visitante para ver cada visita y el tiempo que pasó en cada página.
              </div>
            )
          )}
          <div className="card p-4">
            <h2 className="mb-1 text-base">Crear enlace</h2>
            <p className="mb-3 text-xs text-slate-500">
              Para pegarlo en WhatsApp o en un correo de Outlook. Si eliges el contacto, sabrás exactamente quién lo abrió.
            </p>
            <ShareLinkForm
              documentId={id}
              contacts={contacts.map((c) => ({ id: c.id, name: `${contactName(c)}${c.company ? ` · ${c.company.name}` : ""}` }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Tiempo por página (barras horizontales). */
function PageChart({ times }: { times: { page: number; seconds: number }[] }) {
  if (!times.some((t) => t.seconds > 0)) return <p className="mt-2 text-xs text-slate-500">Abrió el documento, pero no alcanzó a leer ninguna página.</p>;
  const max = Math.max(...times.map((t) => t.seconds));
  return (
    <div className="mt-3 space-y-1">
      {times.map((t) => (
        <div key={t.page} className="flex items-center gap-2 text-xs" title={`Página ${t.page}: ${formatDuration(t.seconds)}`}>
          <span className="w-14 shrink-0 text-right text-slate-500">Pág. {t.page}</span>
          <span className="h-3 flex-1 rounded-sm bg-slate-100">
            <span className="block h-3 rounded-sm bg-[#f8a488]" style={{ width: `${(t.seconds / max) * 100}%` }} />
          </span>
          <span className="w-16 shrink-0 tabular-nums text-slate-600">{t.seconds > 0 ? formatDuration(t.seconds) : "—"}</span>
        </div>
      ))}
    </div>
  );
}
