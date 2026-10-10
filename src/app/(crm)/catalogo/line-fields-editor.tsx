"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { CUSTOM_FIELD_TYPES, toKey, type CustomField, type CustomFieldType } from "@/lib/custom-fields";
import type { ActionState } from "@/lib/forms";

/** Editor de los campos adicionales que una línea activa en sus negocios. */
export function LineFieldsEditor({
  initial,
  action,
}: {
  initial: CustomField[];
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
}) {
  const [fields, setFields] = useState<CustomField[]>(initial);
  const set = (i: number, patch: Partial<CustomField>) => setFields((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const move = (i: number, d: -1 | 1) =>
    setFields((fs) => {
      const next = [...fs];
      const j = i + d;
      if (j < 0 || j >= next.length) return fs;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  return (
    <ActionForm action={action} successMessage="Campos guardados." className="mt-2 space-y-2">
      <input type="hidden" name="fields" value={JSON.stringify(fields)} />
      {fields.length === 0 && <p className="text-xs text-slate-500">Esta línea no tiene campos adicionales.</p>}
      {fields.map((f, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-2">
          <input
            value={f.label}
            onChange={(e) => set(i, { label: e.target.value, ...(initial.some((x) => x.key === f.key) ? {} : { key: toKey(e.target.value) }) })}
            placeholder="Nombre del campo"
            className="input w-56"
          />
          <select value={f.type} onChange={(e) => set(i, { type: e.target.value as CustomFieldType })} className="input w-auto">
            {Object.entries(CUSTOM_FIELD_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          {f.type === "number" && (
            <input value={f.suffix ?? ""} onChange={(e) => set(i, { suffix: e.target.value || undefined })} placeholder="Unidad (ej. semanas)" className="input w-36" />
          )}
          {f.type === "select" && (
            <input
              value={(f.options ?? []).join(", ")}
              onChange={(e) => set(i, { options: e.target.value.split(",").map((o) => o.trimStart()) })}
              placeholder="Opciones separadas por coma"
              className="input min-w-64 flex-1"
            />
          )}
          <span className="ml-auto flex gap-1 text-xs">
            <button type="button" onClick={() => move(i, -1)} className="btn btn-sm" title="Subir">↑</button>
            <button type="button" onClick={() => move(i, 1)} className="btn btn-sm" title="Bajar">↓</button>
            <button type="button" onClick={() => setFields((fs) => fs.filter((_, j) => j !== i))} className="btn btn-sm btn-danger">Quitar</button>
          </span>
        </div>
      ))}
      <div className="flex gap-2">
        <button type="button" className="btn btn-sm" onClick={() => setFields((fs) => [...fs, { key: "", label: "", type: "text" }])}>
          + Agregar campo
        </button>
        <SubmitButton className="btn btn-primary btn-sm">Guardar campos</SubmitButton>
      </div>
    </ActionForm>
  );
}
