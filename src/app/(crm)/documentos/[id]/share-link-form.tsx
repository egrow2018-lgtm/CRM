"use client";

import { useActionState } from "react";
import { CopyButton } from "@/components/copy-button";
import { createShareLink } from "../actions";

export function ShareLinkForm({ documentId, contacts }: { documentId: string; contacts: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createShareLink.bind(null, documentId), undefined);
  return (
    <div>
      <form action={action} className="space-y-2">
        <select name="contactId" defaultValue="" className="input">
          <option value="">— Para un contacto —</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <input name="label" className="input" placeholder="…o una etiqueta (ej. Grupo WhatsApp Holcim)" />
        <button className="btn btn-primary btn-sm" disabled={pending}>{pending ? "Creando…" : "Crear enlace"}</button>
      </form>
      {state?.error && <p className="mt-2 text-sm text-red-700">{state.error}</p>}
      {state?.url && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <div className="break-all font-medium text-emerald-900">{state.url}</div>
          <div className="mt-2 flex gap-1.5">
            <CopyButton text={state.url} label="Copiar enlace" />
            <a className="btn btn-sm" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(state.url)}`}>WhatsApp</a>
          </div>
        </div>
      )}
    </div>
  );
}
