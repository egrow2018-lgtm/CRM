import { requirePagePermission } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ImportForm } from "./import-form";

export default async function ImportPage() {
  await requirePagePermission("import:run");
  return (
    <div className="max-w-3xl">
      <PageHeader title="Importar desde HubSpot" subtitle="Trae tus empresas, contactos y negocios en tres pasos." />
      <ol className="card mb-4 list-decimal space-y-1.5 p-5 pl-9 text-sm text-slate-700">
        <li>
          En HubSpot, ve a <b>Empresas</b>, <b>Contactos</b> o <b>Negocios</b> → <b>Exportar</b> → formato <b>CSV</b>, con
          &quot;Incluir todas las propiedades&quot; o al menos las principales.
        </li>
        <li>Importa en este orden: <b>Empresas → Contactos → Negocios</b>, para que las asociaciones queden enlazadas.</li>
        <li>
          Crea antes los usuarios en <b>Configuración</b> con el mismo nombre que tienen como propietarios en HubSpot (ej. &quot;Andres
          Poveda&quot;) para que se asignen solos.
        </li>
      </ol>
      <p className="mb-4 text-xs text-slate-500">
        Los registros duplicados se omiten (empresas y negocios por nombre, contactos por email), así que puedes volver a importar sin
        miedo. La línea de negocio de cada negocio se deduce del nombre (ej. &quot;… - Ludus&quot;, &quot;… - HUMAND&quot;, &quot;Curso
        Virtual&quot;).
      </p>
      <ImportForm />
    </div>
  );
}
