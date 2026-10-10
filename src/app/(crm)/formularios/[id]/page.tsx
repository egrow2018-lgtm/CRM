import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { contactName, formatDateTime } from "@/lib/format";
import { parseFormFields } from "@/lib/forms-builder";
import { ConfirmButton } from "@/components/action-form";
import { PageHeader } from "@/components/ui";
import { deleteForm, updateForm } from "../actions";
import { FormEditor } from "../form-editor";
import { SharePanel } from "../share-panel";

async function publicBaseUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function FormPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("forms:manage");
  const { id } = await params;
  const [form, lines, users] = await Promise.all([
    prisma.form.findUnique({
      where: { id },
      include: {
        submissions: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: { contact: { select: { id: true, firstName: true, lastName: true, email: true } } },
        },
        _count: { select: { submissions: true } },
      },
    }),
    prisma.businessLine.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!form) notFound();
  const url = `${await publicBaseUrl()}/f/${form.slug}`;
  const qrSvg = await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#1c315e", light: "#ffffff" } });
  const fields = parseFormFields(form.fields);

  return (
    <div>
      <div className="mb-2 text-sm"><Link href="/formularios" className="text-slate-500 hover:underline">← Formularios</Link></div>
      <PageHeader
        title={form.name}
        subtitle={`${form._count.submissions} respuestas · ${form.active ? "Publicado" : "Pausado"}`}
        actions={
          <form action={deleteForm.bind(null, id)}>
            <ConfirmButton message="¿Eliminar este formulario? Los contactos creados se conservan.">Eliminar</ConfirmButton>
          </form>
        }
      />
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="card p-5 lg:col-span-3">
          <FormEditor
            form={{ ...form, fields }}
            lines={lines}
            users={users}
            action={updateForm.bind(null, id)}
          />
        </div>
        <div className="space-y-4 lg:col-span-2">
          <div className="card p-5">
            <h2 className="mb-3 text-base">Compartir</h2>
            <SharePanel url={url} title={form.title} qrSvg={qrSvg} />
          </div>
          <div className="card p-5">
            <h2 className="mb-3 text-base">Últimas respuestas</h2>
            {form.submissions.length === 0 ? (
              <p className="text-sm text-slate-500">Aún no hay respuestas.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {form.submissions.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                    {s.contact ? (
                      <Link className="link truncate" href={`/contactos/${s.contact.id}`}>
                        {contactName(s.contact)}
                        {s.contact.email && <span className="font-normal text-slate-500"> · {s.contact.email}</span>}
                      </Link>
                    ) : (
                      <span className="text-slate-500">Contacto eliminado</span>
                    )}
                    <span className="shrink-0 text-xs text-slate-400">{formatDateTime(s.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
