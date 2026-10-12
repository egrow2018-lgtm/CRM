import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { contactName } from "@/lib/format";
import { emailConfigured } from "@/lib/email";
import { editableDocToken, senderFor } from "@/lib/email-compose";
import { templateValues } from "@/lib/email-context";
import { lineBrand } from "@/lib/brand";
import { PageHeader } from "@/components/ui";
import { Composer } from "../composer";
import { sendEmailAction } from "../actions";

type SP = { contactId?: string; dealId?: string; companyId?: string; doc?: string };

export default async function NewEmailPage({ searchParams }: { searchParams: Promise<SP> }) {
  const current = await requirePagePermission("emails:send");
  const sp = await searchParams;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: current.id } });

  const [values, templates, docs, lines, deal, contact] = await Promise.all([
    templateValues({ contactId: sp.contactId, dealId: sp.dealId, user }),
    prisma.emailTemplate.findMany({ include: { businessLine: { select: { name: true } } }, orderBy: { name: "asc" } }),
    prisma.document.findMany({ select: { id: true, name: true, folder: { select: { name: true } } }, orderBy: { name: "asc" } }),
    prisma.businessLine.findMany({ where: { active: true, brandLogo: { not: null } }, orderBy: { name: "asc" } }),
    sp.dealId ? prisma.deal.findUnique({ where: { id: sp.dealId }, select: { id: true, name: true, businessLineId: true } }) : null,
    sp.contactId ? prisma.contact.findUnique({ where: { id: sp.contactId }, select: { id: true, firstName: true, lastName: true } }) : null,
  ]);
  const docList = docs.map((d) => ({ id: d.id, name: d.name, folder: d.folder?.name ?? null }));
  const preDoc = sp.doc ? docList.find((d) => d.id === sp.doc) : null;
  const sender = senderFor(user, process.env.EMAIL_FROM ?? "");
  const brands = [
    { value: "", label: "Correo personal (recomendado)" },
    { value: "egrow", label: "Con encabezado e-grow" },
    ...lines.flatMap((l) => {
      const b = lineBrand(l);
      return b ? [{ value: l.id, label: `Con encabezado ${b.name}` }] : [];
    }),
  ];
  const back = deal ? { href: `/negocios/${deal.id}`, label: deal.name } : contact ? { href: `/contactos/${contact.id}`, label: contactName(contact) } : null;
  const context = [contact && `Contacto: ${contactName(contact)}`, deal && `Negocio: ${deal.name}`].filter(Boolean).join(" · ") || null;
  const greeting = values.nombre ? `Estimado/a ${values.nombre}:\n\n` : "";

  return (
    <div>
      <div className="mb-2 text-sm">
        <Link href={back?.href ?? "/correos"} className="text-slate-500 hover:underline">← {back?.label ?? "Correos"}</Link>
      </div>
      <PageHeader title="Nuevo correo" />
      {!emailConfigured() ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">El correo aún no está configurado (RESEND_API_KEY y EMAIL_FROM).</div>
      ) : (
        <div className="card p-4">
          {sender.address !== (user.senderEmail || user.email) && (
            <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Tu correo ({user.senderEmail || user.email}) no es del dominio verificado, así que el mensaje sale desde {sender.address} con tu nombre y las
              respuestas te llegan a ti. El administrador puede poner tu correo @{sender.address.split("@")[1]} en «Usuarios y permisos».
            </p>
          )}
          <Composer
            action={sendEmailAction}
            sender={sender.from}
            initialTo={values.contactEmail ?? ""}
            values={values}
            templates={templates
              .filter((t) => !deal?.businessLineId || !t.businessLineId || t.businessLineId === deal.businessLineId)
              .map((t) => ({ id: t.id, name: t.name, subject: t.subject, body: t.body, line: t.businessLine?.name ?? null }))}
            docs={docList}
            brands={brands}
            initialBody={preDoc ? `${greeting}Te comparto ${editableDocToken(preDoc.name)}\n\nQuedo atento a tus comentarios.` : greeting}
            hidden={{ ...(sp.contactId ? { contactId: sp.contactId } : {}), ...(sp.dealId ? { dealId: sp.dealId } : {}), ...(sp.companyId ? { companyId: sp.companyId } : {}) }}
            context={context}
          />
        </div>
      )}
    </div>
  );
}
