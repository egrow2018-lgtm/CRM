import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { contactName, formatDate, formatDateTime } from "@/lib/format";
import { defaultConsentText, parseFormFields } from "@/lib/forms-builder";
import { getCompanySettings } from "@/lib/settings";
import { conversionRate, dailyFormStats, periodFrom } from "@/lib/form-stats";
import { ConfirmButton } from "@/components/action-form";
import { PageHeader } from "@/components/ui";
import { deleteForm, updateForm } from "../actions";
import { FormEditor } from "../form-editor";
import { SharePanel } from "../share-panel";

type SP = { tab?: string; from?: string; to?: string };

const TABS = [
  { key: "rendimiento", label: "Rendimiento" },
  { key: "envios", label: "Envíos" },
  { key: "editar", label: "Editar y compartir" },
];

async function publicBaseUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function FormPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  await requirePagePermission("forms:manage");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const tab = TABS.some((t) => t.key === sp.tab) ? sp.tab! : "rendimiento";
  const period = periodFrom(sp);
  const inPeriod = { formId: id, createdAt: { gte: period.start, lt: period.end } };

  const form = await prisma.form.findUnique({
    where: { id },
    include: {
      assignee: { select: { name: true } },
      _count: { select: { submissions: true } },
      submissions: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });
  if (!form) notFound();
  const fields = parseFormFields(form.fields);

  const tabHref = (key: string) => {
    const q = new URLSearchParams({ ...(key === "rendimiento" ? {} : { tab: key }), ...(sp.from ? { from: sp.from } : {}), ...(sp.to ? { to: sp.to } : {}) });
    return `/formularios/${id}${q.size ? `?${q}` : ""}`;
  };

  const PeriodPicker = () => (
    <form method="get" className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-600">
      {tab !== "rendimiento" && <input type="hidden" name="tab" value={tab} />}
      Período:
      <input type="date" name="from" defaultValue={period.from} className="input w-auto" aria-label="Desde" />
      al
      <input type="date" name="to" defaultValue={period.to} className="input w-auto" aria-label="Hasta" />
      <button className="btn btn-sm">Aplicar</button>
    </form>
  );

  return (
    <div>
      <div className="mb-2 text-sm"><Link href="/formularios" className="text-slate-500 hover:underline">← Formularios</Link></div>
      <PageHeader
        title={form.name}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <span className={`inline-block h-2 w-2 rounded-full ${form.active ? "bg-alert-green" : "bg-slate-300"}`} />
              {form.active ? "Publicado" : "Pausado"}
            </span>
            <span>Creado {formatDate(form.createdAt)}</span>
            <span>Último envío: {form.submissions[0] ? formatDateTime(form.submissions[0].createdAt) : "—"}</span>
            <span>Leads para: {form.assignee?.name ?? "Bandeja de leads"}</span>
            <span>Autorización de datos: {form.consentEnabled ? "Sí" : "No"}</span>
          </span>
        }
        actions={
          <>
            <a href={`/f/${form.slug}`} target="_blank" rel="noreferrer" className="btn">Ver formulario</a>
            <form action={deleteForm.bind(null, id)}>
              <ConfirmButton message="¿Eliminar este formulario? Los contactos creados se conservan.">Eliminar</ConfirmButton>
            </form>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={tabHref(t.key)}
            className={`-mb-px rounded-t-lg border px-3 py-2 text-sm ${
              t.key === tab ? "border-slate-200 border-b-white bg-white font-semibold text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "rendimiento" && <Performance id={id} period={period} inPeriod={inPeriod} Picker={PeriodPicker} />}
      {tab === "envios" && <Submissions inPeriod={inPeriod} fields={fields} Picker={PeriodPicker} />}
      {tab === "editar" && <Editor form={form} fields={fields} />}
    </div>
  );
}

type InPeriod = { formId: string; createdAt: { gte: Date; lt: Date } };

async function Performance({ id, period, inPeriod, Picker }: { id: string; period: ReturnType<typeof periodFrom>; inPeriod: InPeriod; Picker: () => React.ReactElement }) {
  const [views, submissions, daily] = await Promise.all([
    prisma.formView.count({ where: inPeriod }),
    prisma.formSubmission.count({ where: inPeriod }),
    dailyFormStats(id, period.start, period.end),
  ]);
  const max = Math.max(1, ...daily.map((d) => Math.max(d.views, d.submissions)));
  const labelEvery = Math.ceil(daily.length / 10);
  return (
    <div>
      <Picker />
      <div className="card mb-4 grid grid-cols-3 divide-x divide-slate-100 text-center">
        {[
          ["Visualizaciones", views.toLocaleString("es-EC")],
          ["Tasa de conversión", conversionRate(submissions, views)],
          ["Envíos", submissions.toLocaleString("es-EC")],
        ].map(([label, value]) => (
          <div key={label} className="px-4 py-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
            <div className="mt-1 text-3xl font-semibold tabular-nums text-brand-700">{value}</div>
          </div>
        ))}
      </div>
      <div className="card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base">Visualizaciones y envíos por día</h2>
          <span className="flex items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-brand-200" /> Visualizaciones</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-accent-500" /> Envíos</span>
          </span>
        </div>
        <div className="flex items-end gap-px">
          {daily.map((d, i) => (
            <div key={d.day} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${d.day}: ${d.views} visualizaciones · ${d.submissions} envíos`}>
              <div className="flex h-40 w-full items-end justify-center gap-px">
                <div className="w-1/2 rounded-t bg-brand-200" style={{ height: `${(d.views / max) * 100}%`, minHeight: d.views ? 3 : 0 }} />
                <div className="w-1/2 rounded-t bg-accent-500" style={{ height: `${(d.submissions / max) * 100}%`, minHeight: d.submissions ? 3 : 0 }} />
              </div>
              <span className="h-4 text-[10px] text-slate-400">{i % labelEvery === 0 ? d.day.slice(8, 10) + "/" + d.day.slice(5, 7) : ""}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

async function Submissions({ inPeriod, fields, Picker }: { inPeriod: InPeriod; fields: ReturnType<typeof parseFormFields>; Picker: () => React.ReactElement }) {
  const subs = await prisma.formSubmission.findMany({
    where: inPeriod,
    orderBy: { createdAt: "desc" },
    take: 500,
    include: { contact: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
  const shown = fields.filter((f) => f.map !== "firstName" && f.map !== "lastName" && f.map !== "email").slice(0, 4);
  return (
    <div>
      <Picker />
      {subs.length === 0 ? (
        <p className="card p-6 text-center text-sm text-slate-500">No hay envíos en este período.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Contacto</th>
                {shown.map((f) => <th key={f.key}>{f.label}</th>)}
                <th>Autorización de datos</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => {
                const data = (s.data ?? {}) as Record<string, string>;
                return (
                  <tr key={s.id}>
                    <td className="max-w-60">
                      {s.contact ? (
                        <Link className="link" href={`/contactos/${s.contact.id}`}>
                          {contactName(s.contact)}
                          {s.contact.email && <span className="block truncate text-xs font-normal text-slate-500">{s.contact.email}</span>}
                        </Link>
                      ) : (
                        <span className="text-slate-500">Contacto eliminado</span>
                      )}
                    </td>
                    {shown.map((f) => <td key={f.key} className="max-w-48 truncate text-sm">{data[f.key] || "—"}</td>)}
                    <td className="whitespace-nowrap text-xs">{s.consentAt ? <span className="text-emerald-700">✓ {formatDateTime(s.consentAt)}</span> : <span className="text-slate-400">—</span>}</td>
                    <td className="whitespace-nowrap text-xs text-slate-500">{formatDateTime(s.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

async function Editor({
  form,
  fields,
}: {
  form: NonNullable<Awaited<ReturnType<typeof prisma.form.findUnique>>>;
  fields: ReturnType<typeof parseFormFields>;
}) {
  const [lines, users, company] = await Promise.all([
    prisma.businessLine.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getCompanySettings(),
  ]);
  const url = `${await publicBaseUrl()}/f/${form.slug}`;
  const qrSvg = await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#1c315e", light: "#ffffff" } });
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="card p-5 lg:col-span-3">
        <FormEditor form={{ ...form, fields }} lines={lines} users={users} action={updateForm.bind(null, form.id)} defaultConsent={defaultConsentText(company)} />
      </div>
      <div className="lg:col-span-2">
        <div className="card p-5">
          <h2 className="mb-3 text-base">Compartir</h2>
          <SharePanel url={url} title={form.title} qrSvg={qrSvg} />
        </div>
      </div>
    </div>
  );
}
