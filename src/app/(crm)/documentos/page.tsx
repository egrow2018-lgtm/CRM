import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { storageConfigured } from "@/lib/storage";
import { EmptyState, PageHeader } from "@/components/ui";
import { SortHeader, hrefWith } from "@/components/pager";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { BulkCheckCell, BulkCheckHeader, BulkSelection } from "@/components/bulk-selection";
import { SearchBox } from "@/components/search-box";
import { createFolder, deleteDocuments, deleteFolder } from "./actions";
import { UploadButton } from "./upload-button";
import { DocThumb } from "./doc-thumb";

type SP = { q?: string; owner?: string; folder?: string; sort?: string };

const SORTS: Record<string, (d: Prisma.SortOrder) => Prisma.DocumentOrderByWithRelationInput> = {
  name: (d) => ({ name: d }),
  updatedAt: (d) => ({ updatedAt: d }),
};

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePagePermission("emails:send");
  const sp = await searchParams;
  const canManage = can(user, "docs:manage");
  const where: Prisma.DocumentWhereInput = {
    ...(sp.q ? { OR: [{ name: { contains: sp.q, mode: "insensitive" } }, { fileName: { contains: sp.q, mode: "insensitive" } }] } : {}),
    ...(sp.owner ? { ownerId: sp.owner } : {}),
    ...(sp.folder === "sin" ? { folderId: null } : sp.folder ? { folderId: sp.folder } : {}),
  };
  const [field, dir] = (sp.sort ?? "name_asc").split("_");
  const orderBy = (SORTS[field] ?? SORTS.name)(dir === "desc" ? "desc" : "asc");

  const [docs, folders, owners, total] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy,
      include: { owner: { select: { name: true } }, folder: { select: { name: true } }, _count: { select: { links: true } } },
      take: 500,
    }),
    prisma.documentFolder.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { documents: true } } } }),
    prisma.user.findMany({ where: { documents: { some: {} } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.document.count(),
  ]);
  const viewRows = await prisma.documentLink.findMany({
    where: { documentId: { in: docs.map((d) => d.id) } },
    select: { documentId: true, _count: { select: { views: true } } },
  });
  const views = new Map<string, number>();
  for (const r of viewRows) views.set(r.documentId!, (views.get(r.documentId!) ?? 0) + r._count.views);
  const spRecord = sp as Record<string, string | undefined>;

  return (
    <div>
      <PageHeader
        title="Documentos"
        subtitle="Comparte presentaciones y propuestas con enlaces rastreados: sabrás quién las abrió, cuántas veces y cuánto tiempo pasó en cada página."
        actions={
          canManage && (
            <>
              <details className="relative">
                <summary className="btn cursor-pointer list-none">Nueva carpeta</summary>
                <ActionForm action={createFolder} resetOnSuccess className="absolute right-0 z-20 mt-2 flex w-72 gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                  <input name="name" required placeholder="Ej. Rutalink" className="input" />
                  <SubmitButton pendingText="…">Crear</SubmitButton>
                </ActionForm>
              </details>
              {storageConfigured() && <UploadButton folders={folders} defaultFolderId={sp.folder && sp.folder !== "sin" ? sp.folder : undefined} />}
            </>
          )
        }
      />

      {!storageConfigured() && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Para subir documentos falta conectar el espacio de archivos: agrega <b>SUPABASE_URL</b> y <b>SUPABASE_SERVICE_ROLE_KEY</b> en Vercel
          (Settings → Environment Variables) y vuelve a publicar.
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-72"><SearchBox placeholder="Buscar en documentos" /></div>
        <form method="get" className="flex items-center gap-2 text-sm text-slate-600">
          {sp.q && <input type="hidden" name="q" value={sp.q} />}
          {sp.folder && <input type="hidden" name="folder" value={sp.folder} />}
          Propietario:
          <select name="owner" defaultValue={sp.owner ?? ""} className="input w-auto">
            <option value="">Cualquiera</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <button className="btn btn-sm">Filtrar</button>
        </form>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-1.5 text-sm">
        <FolderChip href={hrefWith("/documentos", spRecord, { folder: undefined })} active={!sp.folder} label={`Todos (${total})`} />
        {folders.map((f) => (
          <span key={f.id} className="inline-flex items-center">
            <FolderChip href={hrefWith("/documentos", spRecord, { folder: f.id })} active={sp.folder === f.id} label={`📁 ${f.name} (${f._count.documents})`} />
            {canManage && sp.folder === f.id && f._count.documents === 0 && (
              <form action={deleteFolder.bind(null, f.id)}>
                <button className="ml-1 text-xs text-slate-400 hover:text-red-600" title="Eliminar carpeta vacía">✕</button>
              </form>
            )}
          </span>
        ))}
        {folders.length > 0 && <FolderChip href={hrefWith("/documentos", spRecord, { folder: "sin" })} active={sp.folder === "sin"} label="Sin carpeta" />}
      </div>

      {docs.length === 0 ? (
        <EmptyState>{total === 0 ? "Aún no hay documentos. Sube tu primera presentación." : "No hay documentos con esos filtros."}</EmptyState>
      ) : (
        <BulkSelection enabled={canManage} onDelete={deleteDocuments} noun={{ one: "documento", many: "documentos" }}>
          <div className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  {canManage && <BulkCheckHeader />}
                  <SortHeader label="Nombre" field="name" path="/documentos" sp={spRecord} />
                  <th className="text-right">Enlaces creados</th>
                  <th className="text-right">Vistas</th>
                  <th>Propietario</th>
                  <SortHeader label="Última actualización" field="updatedAt" path="/documentos" sp={spRecord} />
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id}>
                    {canManage && <BulkCheckCell id={d.id} label={d.name} />}
                    <td>
                      <Link href={`/documentos/${d.id}`} className="link inline-flex items-center gap-3">
                        <DocThumb src={d.thumbnail} mime={d.mimeType} className="h-8 w-12" />
                        <span>
                          {d.name}
                          {d.folder && !sp.folder && <span className="ml-2 text-xs font-normal text-slate-400">📁 {d.folder.name}</span>}
                        </span>
                      </Link>
                    </td>
                    <td className="text-right tabular-nums">{d._count.links}</td>
                    <td className="text-right tabular-nums">{views.get(d.id) ?? 0}</td>
                    <td>{d.owner?.name ?? "—"}</td>
                    <td className="whitespace-nowrap">{formatDate(d.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </BulkSelection>
      )}
    </div>
  );
}

function FolderChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link href={href} className={`rounded-full border px-3 py-1 ${active ? "border-brand-700 bg-brand-700 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-brand-200"}`}>
      {label}
    </Link>
  );
}
