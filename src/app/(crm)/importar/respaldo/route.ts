import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { buildWorkbook, xlsxResponse, type Sheet } from "@/lib/excel";
import { utcToZoned } from "@/lib/timezone";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Convierte cada registro en una fila de Excel: decimales a número y JSON a texto. */
function toSheet(name: string, rows: Record<string, unknown>[]): Sheet {
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return {
    name,
    columns: keys.map((k) => ({ header: k, key: k, date: rows.some((r) => r[k] instanceof Date), width: k === "id" || k.endsWith("Id") ? 28 : undefined })),
    rows: rows.map((r) =>
      Object.fromEntries(
        Object.entries(r).map(([k, v]) => [
          k,
          v instanceof Prisma.Decimal ? v.toNumber() : v !== null && typeof v === "object" && !(v instanceof Date) ? JSON.stringify(v) : v,
        ]),
      ),
    ),
  };
}

/** Respaldo completo de los datos del CRM en Excel (una hoja por tabla). No incluye contraseñas ni imágenes. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !can(user, "data:export")) return new Response("No autorizado", { status: 403 });
  const [companies, contacts, deals, dealItems, activities, quotes, lines, products, stages, users, forms, submissions, settings, templates, emails, folders, documents, docLinks, docViews] = await Promise.all([
    prisma.company.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.contact.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.deal.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.dealItem.findMany(),
    prisma.activity.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.quote.findMany({ orderBy: [{ year: "asc" }, { number: "asc" }] }),
    prisma.businessLine.findMany({ omit: { brandLogo: true } }),
    prisma.product.findMany(),
    prisma.pipelineStage.findMany({ orderBy: { order: "asc" } }),
    prisma.user.findMany({ omit: { passwordHash: true } }),
    prisma.form.findMany({ omit: { logo: true } }),
    prisma.formSubmission.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.appSetting.findMany(),
    prisma.emailTemplate.findMany(),
    prisma.emailMessage.findMany({ omit: { html: true }, orderBy: { sentAt: "asc" } }),
    prisma.documentFolder.findMany(),
    prisma.document.findMany({ omit: { thumbnail: true } }),
    prisma.documentLink.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.documentView.findMany({ orderBy: { startedAt: "asc" } }),
  ]);
  const sheets = [
    toSheet("Empresas", companies),
    toSheet("Contactos", contacts),
    toSheet("Negocios", deals),
    toSheet("Productos de negocios", dealItems),
    toSheet("Actividades", activities),
    toSheet("Cotizaciones", quotes),
    toSheet("Líneas de negocio", lines),
    toSheet("Productos", products),
    toSheet("Etapas", stages),
    toSheet("Usuarios", users),
    toSheet("Formularios", forms),
    toSheet("Respuestas de formularios", submissions),
    toSheet("Configuración", settings),
    toSheet("Plantillas de correo", templates),
    toSheet("Correos enviados", emails),
    toSheet("Carpetas de documentos", folders),
    toSheet("Documentos", documents),
    toSheet("Enlaces de documentos", docLinks),
    toSheet("Vistas de documentos", docViews),
  ];
  // Se anota cuándo y quién descargó el último respaldo, para recordarlo en la pantalla
  await prisma.appSetting.upsert({
    where: { key: "respaldo:ultimo" },
    create: { key: "respaldo:ultimo", value: { at: new Date().toISOString(), by: user.name } },
    update: { value: { at: new Date().toISOString(), by: user.name } },
  });
  const stamp = utcToZoned(new Date());
  return xlsxResponse(await buildWorkbook(sheets), `respaldo-crm-egrow-${stamp.date}-${stamp.time.replace(":", "")}.xlsx`);
}
