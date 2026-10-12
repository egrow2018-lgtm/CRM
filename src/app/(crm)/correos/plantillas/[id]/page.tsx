import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { toEditable } from "@/lib/email-compose";
import { PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/action-form";
import { deleteTemplate, saveTemplate } from "../../actions";
import { TemplateForm } from "./template-form";

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("docs:manage");
  const { id } = await params;
  const isNew = id === "nueva";
  const [template, lines, docs, images] = await Promise.all([
    isNew ? null : prisma.emailTemplate.findUnique({ where: { id } }),
    prisma.businessLine.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.document.findMany({ select: { id: true, name: true, folder: { select: { name: true } } }, orderBy: { name: "asc" } }),
    prisma.emailImage.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "desc" } }),
  ]);
  if (!isNew && !template) notFound();
  const docList = docs.map((d) => ({ id: d.id, name: d.name, folder: d.folder?.name ?? null }));

  return (
    <div>
      <div className="mb-2 text-sm"><Link href="/correos/plantillas" className="text-slate-500 hover:underline">← Plantillas</Link></div>
      <PageHeader
        title={isNew ? "Nueva plantilla" : template!.name}
        actions={
          !isNew && (
            <form action={deleteTemplate.bind(null, id)}>
              <ConfirmButton message="¿Eliminar esta plantilla? Los correos ya enviados no cambian.">Eliminar</ConfirmButton>
            </form>
          )
        }
      />
      <div className="card p-4">
        <TemplateForm
          action={saveTemplate.bind(null, isNew ? null : id)}
          lines={lines}
          docs={docList}
          images={images}
          initial={{
            name: template?.name ?? "",
            subject: template?.subject ?? "",
            body: template ? toEditable(template.body, docList, images) : "Estimado/a {{nombre}}:\n\n\n\nSaludos cordiales.",
            businessLineId: template?.businessLineId ?? "",
          }}
        />
      </div>
    </div>
  );
}
