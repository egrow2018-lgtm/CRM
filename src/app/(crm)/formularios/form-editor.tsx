"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { CONTACT_MAPPINGS, FORM_FIELD_TYPES, type ContactMapping, type FormField, type FormFieldType } from "@/lib/forms-builder";
import { toKey } from "@/lib/custom-fields";
import type { ActionState } from "@/lib/forms";

type FormValues = {
  name: string;
  slug: string;
  title: string;
  description: string | null;
  submitLabel: string;
  successMessage: string;
  businessLineId: string | null;
  assigneeId: string | null;
  active: boolean;
  fields: FormField[];
};

export function FormEditor({
  form,
  lines,
  users,
  action,
}: {
  form: FormValues;
  lines: { id: string; name: string }[];
  users: { id: string; name: string }[];
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
}) {
  const [fields, setFields] = useState<FormField[]>(form.fields);
  const originalKeys = new Set(form.fields.map((f) => f.key));
  const set = (i: number, patch: Partial<FormField>) => setFields((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const move = (i: number, d: -1 | 1) =>
    setFields((fs) => {
      const j = i + d;
      if (j < 0 || j >= fs.length) return fs;
      const next = [...fs];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  return (
    <ActionForm action={action} successMessage="Formulario guardado." className="space-y-5">
      <input type="hidden" name="fields" value={JSON.stringify(fields)} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Nombre interno</span>
          <input name="name" required defaultValue={form.name} className="input" />
        </label>
        <label className="block">
          <span className="label">Dirección pública (/f/…)</span>
          <input name="slug" defaultValue={form.slug} className="input" />
        </label>
        <label className="block sm:col-span-2">
          <span className="label">Título</span>
          <input name="title" required defaultValue={form.title} className="input" />
        </label>
        <label className="block sm:col-span-2">
          <span className="label">Descripción</span>
          <textarea name="description" rows={2} defaultValue={form.description ?? ""} className="input" />
        </label>
        <label className="block">
          <span className="label">Línea de negocio de interés</span>
          <select name="businessLineId" defaultValue={form.businessLineId ?? ""} className="input">
            <option value="">— General —</option>
            {lines.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">¿Quién recibe los leads?</span>
          <select name="assigneeId" defaultValue={form.assigneeId ?? ""} className="input">
            <option value="">Bandeja de leads (alguien los toma)</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Texto del botón</span>
          <input name="submitLabel" defaultValue={form.submitLabel} className="input" />
        </label>
        <label className="block">
          <span className="label">Mensaje al enviar</span>
          <input name="successMessage" defaultValue={form.successMessage} className="input" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={form.active} /> Publicado (acepta respuestas)
        </label>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold text-slate-700">Campos</h3>
        <p className="mb-2 text-xs text-slate-500">
          &quot;Guardar en&quot; indica a qué dato del contacto va cada respuesta. Las demás quedan en la nota del contacto.
        </p>
        <div className="space-y-2">
          {fields.map((f, i) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-slate-50/60 p-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={f.label}
                  onChange={(e) => set(i, { label: e.target.value, ...(originalKeys.has(f.key) ? {} : { key: toKey(e.target.value) }) })}
                  placeholder="Pregunta o etiqueta"
                  className="input min-w-48 flex-1"
                />
                <select value={f.type} onChange={(e) => set(i, { type: e.target.value as FormFieldType })} className="input w-auto" aria-label="Tipo">
                  {Object.entries(FORM_FIELD_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <select value={f.map} onChange={(e) => set(i, { map: e.target.value as ContactMapping })} className="input w-auto" aria-label="Guardar en">
                  <option value="">Guardar en: solo nota</option>
                  {Object.entries(CONTACT_MAPPINGS).map(([k, v]) => (
                    <option key={k} value={k}>Guardar en: {v}</option>
                  ))}
                </select>
                <label className="flex items-center gap-1 text-xs text-slate-600">
                  <input type="checkbox" checked={f.required} onChange={(e) => set(i, { required: e.target.checked })} /> Obligatorio
                </label>
                <span className="ml-auto flex gap-1">
                  <button type="button" onClick={() => move(i, -1)} className="btn btn-sm" title="Subir">↑</button>
                  <button type="button" onClick={() => move(i, 1)} className="btn btn-sm" title="Bajar">↓</button>
                  <button type="button" onClick={() => setFields((fs) => fs.filter((_, j) => j !== i))} className="btn btn-sm btn-danger">Quitar</button>
                </span>
              </div>
              {f.type === "select" && (
                <input
                  value={(f.options ?? []).join(", ")}
                  onChange={(e) => set(i, { options: e.target.value.split(",").map((o) => o.trimStart()) })}
                  placeholder="Opciones separadas por coma (ej. Curso virtual, Plataforma LMS, Videos)"
                  className="input mt-2"
                />
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-sm mt-2"
          onClick={() => setFields((fs) => [...fs, { key: "", label: "", type: "text", required: false, map: "" }])}
        >
          + Agregar campo
        </button>
      </div>

      <SubmitButton>Guardar formulario</SubmitButton>
    </ActionForm>
  );
}
