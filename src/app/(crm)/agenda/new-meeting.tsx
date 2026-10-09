"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { scheduleMeeting } from "../actividades/actions";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { MeetingFields } from "@/components/meeting-fields";
import { IconPlus } from "@/components/icons";

type Opt = { id: string; name: string };

export function NewMeetingButton({
  users,
  deals,
  contacts,
  zoomEnabled,
}: {
  users: Opt[];
  deals: Opt[];
  contacts: Opt[];
  zoomEnabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        <IconPlus /> Nueva reunión
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/40 p-4" onClick={() => setOpen(false)}>
            <div role="dialog" aria-modal className="card w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base">Nueva reunión</h2>
                <button type="button" onClick={() => setOpen(false)} className="text-xl leading-none text-slate-400 hover:text-slate-700" aria-label="Cerrar">×</button>
              </div>
              <ActionForm action={scheduleMeeting.bind(null, {})} onSuccess={() => setOpen(false)} className="grid gap-3">
                <input name="subject" required autoFocus placeholder="Tema (ej. Demo de Ludus para Holcim)" className="input" aria-label="Tema" />
                <textarea name="body" rows={2} placeholder="Agenda o notas (opcional)" className="input" aria-label="Agenda" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs text-slate-500">
                    Negocio (opcional)
                    <select name="dealId" defaultValue="" className="input mt-1">
                      <option value="">—</option>
                      {deals.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-slate-500">
                    Contacto (opcional)
                    <select name="contactId" defaultValue="" className="input mt-1">
                      <option value="">—</option>
                      {contacts.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <MeetingFields users={users} zoomEnabled={zoomEnabled} />
                <div className="flex justify-end gap-2">
                  <button type="button" className="btn" onClick={() => setOpen(false)}>Cancelar</button>
                  <SubmitButton pendingText="Agendando…">Agendar</SubmitButton>
                </div>
              </ActionForm>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
