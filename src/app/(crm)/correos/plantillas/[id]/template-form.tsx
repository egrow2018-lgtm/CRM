"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { MessageEditor, MessagePreview } from "../../composer";

export function TemplateForm({
  action,
  lines,
  docs,
  initial,
}: {
  action: Parameters<typeof ActionForm>[0]["action"];
  lines: { id: string; name: string }[];
  docs: { id: string; name: string; folder: string | null }[];
  initial: { name: string; subject: string; body: string; businessLineId: string };
}) {
  const [body, setBody] = useState(initial.body);
  return (
    <ActionForm action={action} className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-slate-500">
            Nombre de la plantilla
            <input name="name" required defaultValue={initial.name} className="input mt-1" placeholder="Ej. Envío de presentación" />
          </label>
          <label className="text-xs text-slate-500">
            Línea de negocio
            <select name="businessLineId" defaultValue={initial.businessLineId} className="input mt-1">
              <option value="">Todas</option>
              {lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>
        </div>
        <label className="block text-xs text-slate-500">
          Asunto
          <input name="subject" required defaultValue={initial.subject} className="input mt-1" placeholder="Ej. {{empresa}}: presentación de Rutalink" />
        </label>
        <MessageEditor value={body} onChange={setBody} docs={docs} rows={14} />
        <p className="text-xs text-slate-500">
          Los datos entre llaves, como {"{{nombre}}"} o {"{{empresa}}"}, se llenan solos con los del contacto al usar la plantilla. Los documentos
          insertados van como enlace rastreado.
        </p>
        <SubmitButton>Guardar plantilla</SubmitButton>
      </div>
      <div>
        <div className="mb-1 text-xs font-medium text-slate-500">Vista previa</div>
        <MessagePreview text={body} docs={docs} />
      </div>
    </ActionForm>
  );
}
