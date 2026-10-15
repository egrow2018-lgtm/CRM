"use client";

import { useState } from "react";
import { ActionForm, ConfirmButton, SubmitButton } from "./action-form";
import { deleteActivity, updateTask } from "@/app/(crm)/actividades/actions";

type Task = { id: string; subject: string; body: string | null; dueDate: string; assigneeId: string | null };

/** Botones «Editar» y «Eliminar» de una tarea; al cambiar la fecha se pide el motivo. */
export function TaskEditButtons({ task, users }: { task: Task; users?: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [due, setDue] = useState(task.dueDate);
  const moved = due !== task.dueDate;
  return (
    <div className="mt-1">
      <div className="flex gap-3 text-xs">
        <button type="button" className="text-brand-700 hover:underline" onClick={() => setOpen((v) => !v)}>
          {open ? "Cerrar" : "✎ Editar"}
        </button>
        <form action={deleteActivity.bind(null, task.id)}>
          <ConfirmButton className="text-slate-500 hover:text-red-700 hover:underline" message={`¿Eliminar la tarea «${task.subject}»? No se puede deshacer.`}>
            Eliminar
          </ConfirmButton>
        </form>
      </div>
      {open && (
        <ActionForm
          action={updateTask.bind(null, task.id)}
          successMessage="Tarea actualizada."
          onSuccess={() => setOpen(false)}
          className="mt-2 grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2"
        >
          <label className="text-xs text-slate-500 sm:col-span-2">
            Qué hay que hacer
            <input name="subject" required defaultValue={task.subject} className="input mt-1" />
          </label>
          <label className="text-xs text-slate-500 sm:col-span-2">
            Detalle
            <textarea name="body" rows={2} defaultValue={task.body ?? ""} className="input mt-1" />
          </label>
          <label className="text-xs text-slate-500">
            Fecha
            <input name="dueDate" type="date" value={due} onChange={(e) => setDue(e.target.value)} className="input mt-1" />
          </label>
          {users && (
            <label className="text-xs text-slate-500">
              Asignada a
              <select name="assigneeId" defaultValue={task.assigneeId ?? ""} className="input mt-1">
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </label>
          )}
          <label className="text-xs text-slate-500 sm:col-span-2">
            {moved ? "Motivo del cambio de fecha *" : "Comentario del cambio (opcional)"}
            <input
              name="reason"
              required={moved}
              placeholder={moved ? "Ej. El cliente pidió cambiar la reunión para el viernes" : "Ej. Se agregó el detalle de la propuesta"}
              className="input mt-1"
            />
          </label>
          <div className="sm:col-span-2">
            <SubmitButton className="btn btn-primary btn-sm" pendingText="Guardando…">Guardar cambios</SubmitButton>
          </div>
        </ActionForm>
      )}
    </div>
  );
}
