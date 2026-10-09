"use client";

import { startTransition, useActionState, useState } from "react";
import type { FormField } from "@/lib/forms-builder";
import { submitPublicForm } from "./actions";

export function PublicForm({
  slug,
  fields,
  submitLabel,
  successMessage,
}: {
  slug: string;
  fields: FormField[];
  submitLabel: string;
  successMessage: string;
}) {
  const [state, action, pending] = useActionState(submitPublicForm.bind(null, slug), undefined);
  const [startedAt] = useState(() => Date.now());

  if (state?.done) {
    return (
      <div className="rounded-xl bg-emerald-50 px-5 py-8 text-center">
        <div className="mb-2 text-3xl">✅</div>
        <p className="text-base font-medium text-emerald-900">{successMessage}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        // Se envía sin la prop `action` para no vaciar lo escrito si hay un error
        startTransition(() => action(data));
      }}
      className="grid gap-4"
    >
      <input type="hidden" name="_t" value={startedAt} />
      {/* Campo trampa para bots: las personas no lo ven */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="absolute -left-[9999px] h-0 w-0 opacity-0" aria-hidden />
      {state?.error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>}
      {fields.map((f) => (
        <div key={f.key}>
          {f.type === "checkbox" ? (
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" name={f.key} required={f.required} className="mt-0.5" />
              <span>{f.label}{f.required && <span className="text-red-600"> *</span>}</span>
            </label>
          ) : (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                {f.label}
                {f.required && <span className="text-red-600"> *</span>}
              </span>
              {f.type === "textarea" ? (
                <textarea name={f.key} required={f.required} rows={4} placeholder={f.placeholder} className="input py-2 text-base" />
              ) : f.type === "select" ? (
                <select name={f.key} required={f.required} className="input py-2 text-base" defaultValue="">
                  <option value="" disabled>Selecciona…</option>
                  {f.options?.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  name={f.key}
                  type={f.type}
                  required={f.required}
                  placeholder={f.placeholder}
                  autoComplete={f.map === "email" ? "email" : f.map === "phone" ? "tel" : f.map === "firstName" ? "given-name" : f.map === "lastName" ? "family-name" : f.map === "company" ? "organization" : undefined}
                  className="input py-2 text-base"
                />
              )}
            </label>
          )}
        </div>
      ))}
      <button type="submit" disabled={pending} className="btn btn-primary w-full py-2.5 text-base">
        {pending ? "Enviando…" : submitLabel}
      </button>
      <p className="text-center text-xs text-slate-400">Tus datos se usarán solo para contactarte sobre tu solicitud.</p>
    </form>
  );
}
