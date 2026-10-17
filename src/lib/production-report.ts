import "server-only";
import { prisma } from "./db";
import { appUrl, emailButton, emailLayout, escapeHtml } from "./email";
import { contactName, formatDate, formatMoney, formatLocalDate } from "./format";
import { normalize } from "./csv";
import { parseCustomData } from "./custom-fields";
import { formatTimeTz, utcToZoned } from "./timezone";

export type ProductionFrequency = "diario" | "semanal";
const SETTING = "reporte-produccion";
const DAY = 86400000;

export async function getProductionFrequency(): Promise<ProductionFrequency> {
  const row = await prisma.appSetting.findUnique({ where: { key: SETTING } });
  const f = (row?.value as { frequency?: string } | null)?.frequency;
  return f === "diario" ? "diario" : "semanal";
}

export async function saveProductionFrequency(frequency: ProductionFrequency) {
  await prisma.appSetting.upsert({ where: { key: SETTING }, create: { key: SETTING, value: { frequency } }, update: { value: { frequency } } });
}

/** ¿Toca enviarlo hoy? Semanal = los lunes (hora de Ecuador); diario = de lunes a viernes (lo decide el cron). */
export function isReportDay(frequency: ProductionFrequency, now = new Date()) {
  if (frequency === "diario") return true;
  const { date } = utcToZoned(now);
  return new Date(`${date}T12:00:00Z`).getUTCDay() === 1;
}

/** Días hacia atrás que cubre el reporte: una semana, o desde el último día hábil. */
function lookbackDays(frequency: ProductionFrequency, now = new Date()) {
  if (frequency === "semanal") return 7;
  const { date } = utcToZoned(now);
  return new Date(`${date}T12:00:00Z`).getUTCDay() === 1 ? 3 : 1;
}

const dot = (color: string) => `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${color};margin-right:6px"></span>`;

/** Negocios en producción con sus tareas pendientes y los seguimientos realizados en el período. */
export async function buildProductionReport(frequency: ProductionFrequency, now = new Date()) {
  const stages = await prisma.pipelineStage.findMany();
  const productionIds = stages.filter((s) => normalize(s.name).includes("produccion")).map((s) => s.id);
  const since = new Date(now.getTime() - lookbackDays(frequency, now) * DAY);
  const deals = await prisma.deal.findMany({
    where: { stageId: { in: productionIds } },
    orderBy: [{ closeDate: { sort: "asc", nulls: "last" } }, { name: "asc" }],
    include: {
      company: { select: { name: true } },
      contact: { select: { firstName: true, lastName: true } },
      owner: { select: { name: true } },
      businessLine: { select: { name: true, customFields: true } },
      activities: {
        where: { OR: [{ completed: false, type: { in: ["TAREA", "LLAMADA", "REUNION"] } }, { createdAt: { gte: since } }, { completedAt: { gte: since } }] },
        include: { assignee: { select: { name: true } }, author: { select: { name: true } } },
        orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      },
    },
  });

  const today = utcToZoned(now).date;
  let overdue = 0;
  const blocks = deals.map((d) => {
    const custom = parseCustomData(d.customData);
    const pending = d.activities.filter((a) => !a.completed && ["TAREA", "LLAMADA", "REUNION"].includes(a.type));
    const done = d.activities.filter((a) => (a.completed || a.type === "NOTA" || a.type === "EMAIL") && !pending.includes(a));
    const days = Math.floor((now.getTime() - d.stageChangedAt.getTime()) / DAY);
    const facts = [
      d.company?.name ?? (d.contact ? contactName(d.contact) : null),
      d.businessLine?.name,
      d.owner?.name && `Responsable: ${d.owner.name}`,
      `${formatMoney(d.amount)}`,
      custom.avance && `Avance: ${custom.avance}%`,
      custom.fechaEntrega && `Entrega: ${formatDate(new Date(`${custom.fechaEntrega}T12:00:00Z`))}`,
      `${days} día(s) en producción`,
    ].filter(Boolean);
    const pendingHtml = pending.length
      ? pending
          .map((a) => {
            const due = a.dueDate ? a.dueDate.toISOString().slice(0, 10) : null;
            const late = !!due && due < today;
            if (late) overdue++;
            const when = a.startAt ? `${formatLocalDate(a.startAt)} ${formatTimeTz(a.startAt)}` : due ? formatDate(a.dueDate!) : "sin fecha";
            return `<li style="margin-bottom:4px">${dot(late ? "#dc2626" : due === today ? "#f59e0b" : "#16a34a")}${escapeHtml(a.subject)} <span style="color:${late ? "#b91c1c" : "#64748b"}">· ${escapeHtml(when)}${a.assignee ? ` · ${escapeHtml(a.assignee.name)}` : ""}${late ? " · VENCIDA" : ""}</span></li>`;
          })
          .join("")
      : `<li style="color:#b45309">Sin tareas pendientes: conviene programar el siguiente paso.</li>`;
    const doneHtml = done.length
      ? done
          .slice(0, 8)
          .map((a) => `<li style="margin-bottom:4px;color:#334155">✓ ${escapeHtml(a.subject)} <span style="color:#94a3b8">· ${formatLocalDate(a.completedAt ?? a.createdAt)}${a.author ? ` · ${escapeHtml(a.author.name)}` : ""}</span></li>`)
          .join("")
      : `<li style="color:#94a3b8">Sin seguimientos en el período.</li>`;
    return `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;margin:0 0 12px">
      <div style="font-size:15px;font-weight:bold"><a href="${appUrl()}/negocios/${d.id}" style="color:#1c315e;text-decoration:none">${escapeHtml(d.name)}</a></div>
      <div style="font-size:12px;color:#64748b;margin:2px 0 8px">${facts.map((f) => escapeHtml(String(f))).join(" · ")}</div>
      <div style="font-size:12px;font-weight:bold;color:#1c315e;margin-bottom:4px">Por realizar</div>
      <ul style="padding-left:4px;list-style:none;margin:0 0 8px;font-size:13px">${pendingHtml}</ul>
      <div style="font-size:12px;font-weight:bold;color:#1c315e;margin-bottom:4px">Realizado ${frequency === "semanal" ? "en la última semana" : "desde el último reporte"}</div>
      <ul style="padding-left:4px;list-style:none;margin:0;font-size:13px">${doneHtml}</ul>
    </div>`;
  });

  const title = "Negocios en producción";
  const intro = deals.length
    ? `<p>Hay <b>${deals.length}</b> negocio(s) en producción${overdue ? ` y <b style="color:#b91c1c">${overdue} tarea(s) vencida(s)</b>` : ""}.</p>`
    : `<p>No hay negocios en producción en este momento.</p>`;
  const html = emailLayout(
    title,
    `${intro}${blocks.join("")}<p>${emailButton(`${appUrl()}/negocios?view=list`, "Abrir el CRM")}</p>
     <p style="color:#94a3b8;font-size:12px">Reporte ${frequency === "semanal" ? "semanal (lunes)" : "diario"} de negocios en producción. Se configura en Configuración y en Usuarios y permisos.</p>`,
  );
  const subject = `Producción: ${deals.length} negocio(s)${overdue ? `, ${overdue} tarea(s) vencida(s)` : ""}`;
  return { subject, html, count: deals.length };
}
