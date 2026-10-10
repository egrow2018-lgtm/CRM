import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { contactName } from "@/lib/format";
import { googleCalendarUrl, meetingInvitation } from "@/lib/meetings";
import { formatDateTimeTz, formatTimeTz, utcToZoned } from "@/lib/timezone";
import { zoomConfigured } from "@/lib/zoom";
import { ACTIVITY_LABELS } from "@/components/activity-panel";
import { MeetingActions } from "@/components/meeting-actions";
import { EmptyState, PageHeader } from "@/components/ui";
import { NewMeetingButton } from "./new-meeting";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const CHIP: Record<string, string> = {
  REUNION: "bg-brand-100 text-brand-800",
  LLAMADA: "bg-sky-100 text-sky-900",
  TAREA: "bg-accent-100 text-brand-800",
};

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ month?: string; who?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const who = sp.who === "all" ? "all" : "me";
  const today = utcToZoned(new Date()).date;
  const [y, m] = (/^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : today.slice(0, 7)).split("-").map(Number) as [number, number];

  // Cuadrícula de lunes a domingo que cubre el mes
  const first = new Date(Date.UTC(y, m - 1, 1));
  const gridStart = new Date(first.getTime() - ((first.getUTCDay() + 6) % 7) * 86400000);
  const last = new Date(Date.UTC(y, m, 0));
  const gridEnd = new Date(last.getTime() + (6 - ((last.getUTCDay() + 6) % 7)) * 86400000);
  const days: string[] = [];
  for (let t = gridStart.getTime(); t <= gridEnd.getTime(); t += 86400000) days.push(new Date(t).toISOString().slice(0, 10));

  const whoFilter: Prisma.ActivityWhereInput = who === "me" ? { assigneeId: user.id } : { assigneeId: { not: null } };
  const [items, upcoming, users, deals, contacts] = await Promise.all([
    prisma.activity.findMany({
      where: { ...whoFilter, type: { in: ["REUNION", "LLAMADA", "TAREA"] }, dueDate: { gte: gridStart, lte: gridEnd } },
      include: { assignee: { select: { name: true } }, deal: { select: { id: true, name: true } }, contact: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: [{ startAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    }),
    prisma.activity.findMany({
      where: { ...whoFilter, type: "REUNION", completed: false, startAt: { gte: new Date(Date.now() - 2 * 3600000) } },
      include: {
        assignee: { select: { id: true, name: true } },
        deal: { select: { id: true, name: true, contact: { select: { email: true } } } },
        contact: { select: { id: true, firstName: true, lastName: true, email: true } },
        company: { select: { id: true, name: true } },
      },
      orderBy: { startAt: "asc" },
      take: 15,
    }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.deal.findMany({
      where: { stage: { isWon: false, isLost: false } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.contact.findMany({ orderBy: { firstName: "asc" }, select: { id: true, firstName: true, lastName: true } }),
  ]);

  const byDay = new Map<string, typeof items>();
  for (const it of items) {
    const key = it.dueDate!.toISOString().slice(0, 10);
    byDay.set(key, [...(byDay.get(key) ?? []), it]);
  }
  const monthLabel = new Intl.DateTimeFormat("es-EC", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  const shift = (d: number) => {
    const t = new Date(Date.UTC(y, m - 1 + d, 1));
    return `/agenda?${new URLSearchParams({ month: t.toISOString().slice(0, 7), ...(who === "all" ? { who } : {}) })}`;
  };
  const zoomOn = zoomConfigured();
  const canWrite = can(user.role, "activities:write");

  return (
    <div>
      <PageHeader
        title="Agenda"
        subtitle={zoomOn ? "Reuniones con Zoom, llamadas y tareas del equipo." : "Reuniones, llamadas y tareas del equipo. Zoom aún no está conectado (ver Configuración)."}
        actions={
          canWrite && (
            <NewMeetingButton
              users={users}
              deals={deals}
              contacts={contacts.map((c) => ({ id: c.id, name: contactName(c) }))}
              zoomEnabled={zoomOn}
            />
          )
        }
      />
      <div className="grid gap-4 xl:grid-cols-4">
        <div className="card overflow-hidden xl:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <Link href={shift(-1)} className="btn btn-sm" aria-label="Mes anterior">‹</Link>
              <Link href={`/agenda${who === "all" ? "?who=all" : ""}`} className="btn btn-sm">Hoy</Link>
              <Link href={shift(1)} className="btn btn-sm" aria-label="Mes siguiente">›</Link>
              <h2 className="ml-2 text-base first-letter:uppercase">{monthLabel}</h2>
            </div>
            <div className="flex gap-1 text-sm">
              <Link href={`/agenda?month=${y}-${String(m).padStart(2, "0")}`} className={`rounded-lg px-3 py-1 ${who === "me" ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-100"}`}>Mi agenda</Link>
              <Link href={`/agenda?month=${y}-${String(m).padStart(2, "0")}&who=all`} className={`rounded-lg px-3 py-1 ${who === "all" ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-100"}`}>Todo el equipo</Link>
            </div>
          </div>
          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50 text-center text-xs font-semibold text-slate-500">
            {WEEKDAYS.map((d) => <div key={d} className="py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const inMonth = Number(d.slice(5, 7)) === m;
              const list = byDay.get(d) ?? [];
              return (
                <div key={d} className={`min-h-28 border-b border-r border-slate-100 p-1.5 ${inMonth ? "" : "bg-slate-50/70"}`}>
                  <div className={`mb-1 text-right text-xs ${d === today ? "font-bold" : inMonth ? "text-slate-600" : "text-slate-300"}`}>
                    <span className={d === today ? "rounded-full bg-accent-500 px-1.5 py-0.5 text-brand-800" : ""}>{Number(d.slice(8))}</span>
                  </div>
                  <div className="space-y-1">
                    {list.slice(0, 4).map((it) => {
                      const href = it.deal ? `/negocios/${it.deal.id}` : it.contact ? `/contactos/${it.contact.id}` : "/tareas";
                      return (
                        <Link
                          key={it.id}
                          href={href}
                          title={`${ACTIVITY_LABELS[it.type]}: ${it.subject}${it.assignee ? ` · ${it.assignee.name}` : ""}`}
                          className={`block truncate rounded px-1.5 py-0.5 text-[11px] ${CHIP[it.type]} ${it.completed ? "line-through opacity-50" : ""}`}
                        >
                          {it.startAt ? `${formatTimeTz(it.startAt)} ` : ""}
                          {it.zoomMeetingId ? "🎥 " : ""}
                          {it.subject}
                        </Link>
                      );
                    })}
                    {list.length > 4 && <div className="px-1 text-[11px] text-slate-500">+{list.length - 4} más</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-base">Próximas reuniones</h2>
          {upcoming.length === 0 ? (
            <EmptyState>No hay reuniones agendadas.</EmptyState>
          ) : (
            upcoming.map((mt) => {
              const related = mt.deal ? { href: `/negocios/${mt.deal.id}`, name: mt.deal.name } : mt.contact ? { href: `/contactos/${mt.contact.id}`, name: contactName(mt.contact) } : mt.company ? { href: `/empresas/${mt.company.id}`, name: mt.company.name } : null;
              return (
                <div key={mt.id} className="card p-3">
                  <div className="text-xs font-medium text-brand-600 first-letter:uppercase">{formatDateTimeTz(mt.startAt!)}</div>
                  <div className="text-sm font-semibold text-slate-800">{mt.subject}</div>
                  <div className="text-xs text-slate-500">
                    {mt.durationMinutes} min · Anfitrión: {mt.assignee?.name ?? "—"}
                    {mt.zoomMeetingId && <span className="ml-1 font-medium text-brand-600">· Zoom</span>}
                  </div>
                  {related && <Link href={related.href} className="block truncate text-xs text-brand-600 hover:underline">{related.name}</Link>}
                  <MeetingActions
                    activityId={mt.id}
                    subject={mt.subject}
                    joinUrl={mt.meetingUrl}
                    hostUrl={mt.assigneeId === user.id ? mt.hostUrl : null}
                    invitation={meetingInvitation({ ...mt, startAt: mt.startAt! }, mt.assignee?.name)}
                    calendarUrl={googleCalendarUrl({ ...mt, startAt: mt.startAt! })}
                    inviteEmail={mt.contact?.email ?? mt.deal?.contact?.email}
                    canCancel={canWrite}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
