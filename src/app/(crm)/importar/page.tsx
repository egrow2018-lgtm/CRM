import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { ImportForm } from "./import-form";

// La importación de archivos grandes puede tardar más que el límite por defecto.
export const maxDuration = 60;

export default async function ImportPage() {
  const user = await requireUser();
  const canImport = can(user, "import:run");
  const canExport = can(user, "data:export");
  if (!canImport && !canExport) redirect("/");
  const last = canExport ? ((await prisma.appSetting.findUnique({ where: { key: "respaldo:ultimo" } }))?.value as { at: string; by: string } | null) : null;
  const daysSince = last ? Math.floor((Date.now() - new Date(last.at).getTime()) / 86400000) : null;
  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader title="Importar / Exportar" subtitle="Trae datos desde HubSpot u otros CSV, y descarga tus datos o un respaldo completo." />

      {canExport && (
        <section>
          <h2 className="mb-1">Exportar y respaldo</h2>
          <div className="card space-y-3 p-5 text-sm">
            <p>
              Descarga un <b>Excel con todos los datos del CRM</b>, una hoja por tabla: empresas, contactos, negocios con sus productos,
              actividades, cotizaciones, líneas, productos, etapas, usuarios (sin contraseñas), formularios y sus respuestas.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <a href="/importar/respaldo" className="btn btn-primary">Descargar respaldo completo (Excel)</a>
              {can(user, "reports:view") && <Link href="/reportes" className="btn">Ver reportes</Link>}
            </div>
            <p className={`text-xs ${daysSince == null || daysSince > 7 ? "font-medium text-amber-700" : "text-slate-500"}`}>
              {last
                ? `Último respaldo: ${formatDateTime(new Date(last.at))} por ${last.by}${daysSince! > 7 ? ` (hace ${daysSince} días: conviene descargar uno nuevo).` : "."}`
                : "Aún no se ha descargado ningún respaldo."}{" "}
              Recomendación: descárgalo cada semana y guárdalo en una carpeta segura (Drive, OneDrive); contiene datos personales de clientes.
            </p>
          </div>
        </section>
      )}

      {canImport && (
        <section>
          <h2 className="mb-1">Importar desde HubSpot</h2>
      <ol className="card mb-4 list-decimal space-y-1.5 p-5 pl-9 text-sm text-slate-700">
        <li>
          En HubSpot, ve a <b>Empresas</b>, <b>Contactos</b> o <b>Negocios</b> → <b>Exportar</b> → formato <b>CSV</b>, con
          &quot;Incluir todas las propiedades&quot; o al menos las principales.
        </li>
        <li>Importa en este orden: <b>Empresas → Contactos → Negocios</b>, para que las asociaciones queden enlazadas.</li>
        <li>
          Los propietarios se asignan por nombre (&quot;Janine Salgado Torres&quot; → Janine Salgado). Si un propietario de HubSpot ya
          no está en el equipo, sus registros quedan a tu nombre.
        </li>
      </ol>
      <p className="mb-4 text-xs text-slate-500">
        Los contactos se enlazan a su empresa por el dominio del email corporativo o por el nombre. Los duplicados se omiten
        (empresas y negocios por nombre, contactos por email), así que puedes volver a importar sin miedo. Si una empresa ya
        existía (por ejemplo, creada al importar contactos), se completan sus datos vacíos: sector, ciudad, país, web, etc. La línea de negocio de cada negocio se deduce del nombre (ej. &quot;… - Ludus&quot;, &quot;… - HUMAND&quot;, &quot;Curso
        Virtual&quot;).
      </p>
      <ImportForm />
        </section>
      )}
    </div>
  );
}
