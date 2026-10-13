"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { createActivity } from "../actividades/actions";

/** Tarea suelta, sin negocio ni contacto (ej. «Cobrar la factura 123 de…»). */
export function NewTask({ users, meId }: { users: { id: string; name: string }[]; meId: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        + Nueva tarea
      </button>
    );
  }
  return (
    <div className="card w-full p-4">
      <h2 className="mb-3 text-base">Nueva tarea</h2>
      <ActionForm action={createActivity.bind(null, {})} resetOnSuccess successMessage="Tarea creada." className="grid gap-3 sm:grid-cols-6">
        <input type="hidden" name="type" value="TAREA" />
        <label className="text-xs text-slate-500 sm:col-span-6">
          Qué hay que hacer
          <input name="subject" required className="input mt-1" placeholder="Ej. Cobrar la factura 001-001-123 de Holcim" />
        </label>
        <label className="text-xs text-slate-500 sm:col-span-6">
          Detalle (opcional)
          <textarea name="body" rows={2} className="input mt-1" />
        </label>
        <label className="text-xs text-slate-500 sm:col-span-2">
          Fecha límite
          <input name="dueDate" type="date" className="input mt-1" />
        </label>
        <label className="text-xs text-slate-500 sm:col-span-2">
          Asignar a
          <select name="assigneeId" defaultValue={meId} className="input mt-1">
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.id === meId ? `Yo (${u.name})` : u.name}</option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2 sm:col-span-2">
          <SubmitButton pendingText="Creando…">Crear tarea</SubmitButton>
          <button type="button" className="btn" onClick={() => setOpen(false)}>Cerrar</button>
        </div>
      </ActionForm>
    </div>
  );
}
