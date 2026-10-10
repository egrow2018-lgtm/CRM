"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import type { ActivityType } from "@prisma/client";
import { createActivity, scheduleMeeting, type ActivityTarget } from "@/app/(crm)/actividades/actions";
import { MeetingFields } from "./meeting-fields";
import { ActionForm, SubmitButton } from "./action-form";
import { IconCalendar, IconMail, IconNote, IconPhone, IconTasks } from "./icons";

type QuickType = Exclude<ActivityType, "CAMBIO_ETAPA">;

const ACTIONS: { type: QuickType; label: string; icon: typeof IconNote }[] = [
  { type: "NOTA", label: "Nota", icon: IconNote },
  { type: "EMAIL", label: "Correo", icon: IconMail },
  { type: "LLAMADA", label: "Llamada", icon: IconPhone },
  { type: "TAREA", label: "Tarea", icon: IconTasks },
  { type: "REUNION", label: "Reunión", icon: IconCalendar },
];

const TITLES: Record<QuickType, string> = {
  NOTA: "Agregar nota",
  EMAIL: "Registrar correo",
  LLAMADA: "Registrar o programar llamada",
  TAREA: "Crear tarea",
  REUNION: "Agendar reunión",
};

const PLACEHOLDERS: Record<QuickType, string> = {
  NOTA: "Ej. Cliente interesado en la versión con realidad virtual",
  EMAIL: "Ej. Envío de propuesta económica",
  LLAMADA: "Ej. Llamada de seguimiento a la propuesta",
  TAREA: "Ej. Enviar cotización actualizada",
  REUNION: "Ej. Demo de la plataforma",
};

/**
 * Íconos de seguimiento (como HubSpot): Nota, Correo, Llamada, Tarea y Reunión.
 * `compact` se usa en las tarjetas del tablero.
 */
export function QuickActions({
  target,
  users,
  contact,
  compact,
  zoomEnabled = false,
}: {
  target: ActivityTarget;
  users: { id: string; name: string }[];
  contact?: { name: string; email?: string | null; phone?: string | null } | null;
  compact?: boolean;
  zoomEnabled?: boolean;
}) {
  const [open, setOpen] = useState<QuickType | null>(null);
  const phoneDigits = contact?.phone?.replace(/\D/g, "");

  return (
    <>
      <div className={compact ? "flex items-center gap-0.5" : "flex flex-wrap gap-3"}>
        {ACTIONS.map(({ type, label, icon: Icon }) =>
          compact ? (
            <button
              key={type}
              type="button"
              title={label}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(type);
              }}
              className="rounded p-1 text-slate-400 hover:bg-brand-50 hover:text-brand-700"
            >
              <Icon width={15} height={15} />
            </button>
          ) : (
            <button key={type} type="button" onClick={() => setOpen(type)} className="group flex w-16 flex-col items-center gap-1 text-xs text-slate-600">
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-brand-700 transition group-hover:border-accent-500 group-hover:bg-accent-50">
                <Icon />
              </span>
              {label}
            </button>
          ),
        )}
      </div>

      {open &&
        createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setOpen(null)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(null)}
        >
          <div role="dialog" aria-modal className="card w-full max-w-lg p-5 text-left" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base">{TITLES[open]}</h2>
              <button type="button" onClick={() => setOpen(null)} className="text-xl leading-none text-slate-400 hover:text-slate-700" aria-label="Cerrar">
                ×
              </button>
            </div>

            {open === "EMAIL" && contact?.email && (
              <a href={`mailto:${contact.email}`} className="mb-3 inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
                <IconMail width={15} height={15} /> Escribir a {contact.name} ({contact.email})
              </a>
            )}
            {open === "LLAMADA" && contact?.phone && (
              <div className="mb-3 flex gap-3 text-sm">
                <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-1 text-brand-600 hover:underline">
                  <IconPhone width={15} height={15} /> Llamar a {contact.name}
                </a>
                {phoneDigits && (
                  <a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline">
                    WhatsApp
                  </a>
                )}
              </div>
            )}

            <ActionForm
              action={open === "REUNION" ? scheduleMeeting.bind(null, target) : createActivity.bind(null, target)}
              onSuccess={() => setOpen(null)}
              className="grid gap-3"
            >
              <input type="hidden" name="type" value={open} />
              <input name="subject" required autoFocus placeholder={PLACEHOLDERS[open]} className="input" aria-label="Asunto" />
              <textarea name="body" rows={open === "REUNION" ? 2 : 3} placeholder={open === "REUNION" ? "Agenda o notas (opcional)" : "Detalle (opcional)"} className="input" aria-label="Detalle" />
              {open === "REUNION" && <MeetingFields users={users} zoomEnabled={zoomEnabled} />}
              {(open === "TAREA" || open === "LLAMADA") && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs text-slate-500">
                    {open === "TAREA" ? "Fecha límite" : "Fecha (si es a futuro queda programada)"}
                    <input name="dueDate" type="date" className="input mt-1" />
                  </label>
                  <label className="text-xs text-slate-500">
                    {open === "TAREA" ? "Asignar a" : "Responsable"}
                    <select name="assigneeId" className="input mt-1" defaultValue="">
                      <option value="">Yo</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button type="button" className="btn" onClick={() => setOpen(null)}>Cancelar</button>
                <SubmitButton pendingText={open === "REUNION" ? "Agendando…" : "Guardando…"}>{open === "REUNION" ? "Agendar" : "Guardar"}</SubmitButton>
              </div>
            </ActionForm>
          </div>
        </div>,
          document.body,
        )}
    </>
  );
}
