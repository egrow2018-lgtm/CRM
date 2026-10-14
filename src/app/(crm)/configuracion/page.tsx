import { prisma } from "@/lib/db";
import { PhoneInput } from "@/components/phone-input";
import { requirePagePermission } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { PageHeader } from "@/components/ui";
import { deleteStage, saveCompany, saveProductionReport, saveStage, saveTeamMember, sendProductionReportNow, sendTestEmail } from "./actions";
import { getProductionFrequency } from "@/lib/production-report";
import { getCompanySettings } from "@/lib/settings";
import { emailConfigured } from "@/lib/email";
import { Field } from "@/components/ui";
import { ZoomTest } from "./zoom-test";
import { zoomConfigured } from "@/lib/zoom";

export default async function SettingsPage() {
  const user = await requirePagePermission("pipeline:configure");
  const isAdmin = user.role === "ADMIN";
  const company = await getCompanySettings();
  const team = isAdmin ? await prisma.teamMember.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }) : [];
  const [productionFrequency, productionRecipients] = await Promise.all([
    getProductionFrequency(),
    prisma.user.findMany({ where: { active: true, productionReport: true }, select: { name: true }, orderBy: { name: "asc" } }),
  ]);
  const stages = await prisma.pipelineStage.findMany({ orderBy: { order: "asc" }, include: { _count: { select: { deals: true } } } });

  return (
    <div className="max-w-5xl space-y-8">
      <PageHeader title="Configuración" />

      <section>
        <h2 className="mb-1">Datos de la empresa (cotizaciones)</h2>
        <p className="mb-3 text-xs text-slate-500">Aparecen en el encabezado y las condiciones de cada cotización en PDF.</p>
        <div className="card p-4">
          <ActionForm action={saveCompany} successMessage="Datos guardados." className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre comercial"><input name="name" required defaultValue={company.name} className="input" /></Field>
            <Field label="Razón social"><input name="legalName" defaultValue={company.legalName} className="input" /></Field>
            <Field label="RUC"><input name="taxId" defaultValue={company.taxId} className="input" /></Field>
            <Field label="Teléfono"><PhoneInput defaultValue={company.phone} placeholder="2 451 3888" /></Field>
            <Field label="Email"><input name="email" type="email" defaultValue={company.email} className="input" /></Field>
            <Field label="Sitio web"><input name="website" defaultValue={company.website} className="input" /></Field>
            <Field label="Dirección" className="sm:col-span-2"><input name="address" defaultValue={company.address} className="input" /></Field>
            <Field label="IVA por defecto (%)"><input name="ivaPercent" type="number" step="0.01" min="0" max="100" defaultValue={company.ivaPercent} className="input" /></Field>
            <Field label="Validez por defecto (días)"><input name="validityDays" type="number" min="1" max="365" defaultValue={company.validityDays} className="input" /></Field>
            <Field label="Condiciones comerciales por defecto (una por línea)" className="sm:col-span-2">
              <textarea name="conditions" rows={4} defaultValue={company.conditions} className="input" />
            </Field>
            <div className="sm:col-span-2"><SubmitButton>Guardar</SubmitButton></div>
          </ActionForm>
        </div>
      </section>

      {isAdmin && (
        <section>
          <h2 className="mb-1">Equipo de desarrollo</h2>
          <p className="mb-3 text-xs text-slate-500">
            Es la lista que aparece en el campo «Equipo de desarrollo» de los negocios. Solo el administrador la edita. Si alguien deja de
            colaborar, desactívalo: sigue apareciendo en los negocios donde ya estaba, pero no en los nuevos.
          </p>
          <div className="card divide-y divide-slate-100">
            {team.map((m) => (
              <ActionForm key={m.id} action={saveTeamMember.bind(null, m.id)} successMessage="Guardado." className="space-y-2 p-3">
                <div className="grid items-center gap-2 sm:grid-cols-12">
                <input name="name" required defaultValue={m.name} className="input sm:col-span-4" aria-label="Nombre" />
                <input name="specialty" defaultValue={m.specialty ?? ""} placeholder="Especialidad" className="input sm:col-span-4" aria-label="Especialidad" />
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input type="checkbox" name="active" defaultChecked={m.active} /> Activo
                </label>
                <SubmitButton className="btn btn-sm sm:col-span-2">Guardar</SubmitButton>
                </div>
              </ActionForm>
            ))}
            <ActionForm action={saveTeamMember.bind(null, null)} resetOnSuccess successMessage="Integrante agregado." className="space-y-2 bg-slate-50/60 p-3">
              <div className="grid items-center gap-2 sm:grid-cols-12">
              <input name="name" required placeholder="Nombre del integrante" className="input sm:col-span-4" />
              <input name="specialty" placeholder="Especialidad (ej. Diseño instruccional)" className="input sm:col-span-6" />
              <SubmitButton className="btn btn-primary btn-sm sm:col-span-2">Agregar</SubmitButton>
              </div>
            </ActionForm>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-1">Correo</h2>
        <div className="card p-4 text-sm">
          {emailConfigured() ? (
            <p className="mb-3 text-emerald-700">
              ✓ El correo está conectado. Se envían cotizaciones, avisos de leads nuevos y el resumen diario de las 8:00.
            </p>
          ) : (
            <div className="mb-3 space-y-1 text-slate-600">
              <p className="font-medium text-amber-700">El correo aún no está conectado.</p>
              <p>
                Crea una cuenta en <a className="link" href="https://resend.com" target="_blank" rel="noreferrer">resend.com</a>, verifica el dominio
                e-growonline.com y agrega las variables <code>RESEND_API_KEY</code> y <code>EMAIL_FROM</code> en Vercel. Los pasos están en el README.
              </p>
            </div>
          )}
          <ActionForm action={sendTestEmail} successMessage="Correo de prueba enviado a tu email.">
            <SubmitButton className="btn btn-sm" pendingText="Enviando…">Enviarme un correo de prueba</SubmitButton>
          </ActionForm>
        </div>
      </section>

      <section>
        <h2 className="mb-1">Reporte de negocios en producción</h2>
        <div className="card space-y-3 p-4 text-sm">
          <p className="text-slate-600">
            Correo automático con los negocios en la etapa «En Producción», sus tareas por realizar (con las vencidas en rojo) y los seguimientos
            realizados. Lo reciben las personas marcadas en <a className="link" href="/usuarios">Usuarios y permisos</a>
            {productionRecipients.length ? <> (hoy: <b>{productionRecipients.map((u) => u.name).join(", ")}</b>)</> : " (aún nadie)"}.
          </p>
          <ActionForm action={saveProductionReport} successMessage="Guardado." className="flex flex-wrap items-center gap-2">
            <span className="text-slate-600">Enviar</span>
            <select name="frequency" defaultValue={productionFrequency} className="input w-auto">
              <option value="semanal">cada lunes, 8:00</option>
              <option value="diario">de lunes a viernes, 8:00</option>
            </select>
            <SubmitButton className="btn btn-sm">Guardar</SubmitButton>
          </ActionForm>
          <div className="flex flex-wrap items-center gap-2">
            <a href="/api/reporte-produccion" target="_blank" rel="noreferrer" className="btn btn-sm">Ver el reporte de hoy</a>
            <ActionForm action={sendProductionReportNow} successMessage="Reporte enviado.">
              <SubmitButton className="btn btn-sm" pendingText="Enviando…">Enviarlo ahora</SubmitButton>
            </ActionForm>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-1">Zoom</h2>
        <div className="card p-4 text-sm">
          {zoomConfigured() ? (
            <p className="mb-3 text-emerald-700">✓ Zoom está conectado. Las reuniones agendadas en el CRM se crean en la cuenta de Zoom de e-grow.</p>
          ) : (
            <div className="mb-3 space-y-1 text-slate-600">
              <p className="font-medium text-amber-700">Zoom aún no está conectado.</p>
              <p>
                En <a className="link" href="https://marketplace.zoom.us/" target="_blank" rel="noreferrer">marketplace.zoom.us</a> → Develop →
                Build App → <b>Server-to-Server OAuth</b>, con los permisos para crear, actualizar y eliminar reuniones y para leer usuarios.
                Luego copia Account ID, Client ID y Client Secret en las variables <code>ZOOM_ACCOUNT_ID</code>, <code>ZOOM_CLIENT_ID</code> y{" "}
                <code>ZOOM_CLIENT_SECRET</code> del hosting (Vercel) y vuelve a publicar. Los pasos completos están en el README.
              </p>
            </div>
          )}
          <ZoomTest />
        </div>
      </section>

      <section>
        <h2 className="mb-1">Etapas del pipeline</h2>
        <p className="mb-3 text-xs text-slate-500">
          La probabilidad se usa para calcular la cantidad ponderada. El orden define la posición en el tablero.
        </p>
        <div className="card divide-y divide-slate-100">
          {stages.map((s) => (
            <div key={s.id} className="flex flex-wrap items-start gap-2 p-3">
              <ActionForm action={saveStage.bind(null, s.id)} className="grid flex-1 gap-2 sm:grid-cols-6">
                <input name="order" type="number" defaultValue={s.order} className="input" title="Orden" />
                <input name="name" required defaultValue={s.name} className="input sm:col-span-2" />
                <label className="flex items-center gap-1 text-sm">
                  <input name="probability" type="number" min="0" max="100" defaultValue={s.probability} className="input" />%
                </label>
                <select name="kind" defaultValue={s.isWon ? "won" : s.isLost ? "lost" : "open"} className="input">
                  <option value="open">Abierta</option>
                  <option value="won">Ganado</option>
                  <option value="lost">Perdido</option>
                </select>
                <SubmitButton className="btn btn-sm">Guardar</SubmitButton>
              </ActionForm>
              <span className="pt-2 text-xs text-slate-400">{s._count.deals} negocios</span>
              {s._count.deals === 0 && (
                <form action={deleteStage.bind(null, s.id)}>
                  <button className="pt-2 text-xs text-slate-400 hover:text-red-600">Eliminar</button>
                </form>
              )}
            </div>
          ))}
        </div>
        <div className="card mt-3 p-4">
          <h3 className="mb-2 text-sm font-semibold">Nueva etapa</h3>
          <ActionForm action={saveStage.bind(null, null)} resetOnSuccess className="grid gap-2 sm:grid-cols-6">
            <input name="order" type="number" required placeholder="Orden" defaultValue={stages.length} className="input" />
            <input name="name" required placeholder="Nombre" className="input sm:col-span-2" />
            <input name="probability" type="number" min="0" max="100" placeholder="%" className="input" />
            <select name="kind" defaultValue="open" className="input">
              <option value="open">Abierta</option>
              <option value="won">Ganado</option>
              <option value="lost">Perdido</option>
            </select>
            <SubmitButton className="btn btn-primary">Agregar</SubmitButton>
          </ActionForm>
        </div>
      </section>
    </div>
  );
}
