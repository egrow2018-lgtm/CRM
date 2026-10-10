"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import type { ActionState } from "@/lib/forms";
import { PERMISSION_GROUPS, type Permission } from "@/lib/permissions";

export function PermissionsEditor({
  action,
  isAdmin,
  custom,
  current,
  roleDefaults,
  roleLabel,
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  isAdmin: boolean;
  custom: boolean;
  current: Permission[];
  roleDefaults: Permission[];
  roleLabel: string;
}) {
  const [mode, setMode] = useState<"role" | "custom">(custom ? "custom" : "role");
  const [checked, setChecked] = useState<Set<string>>(new Set(current));
  if (isAdmin) {
    return <p className="text-sm text-slate-500">El administrador tiene siempre todos los permisos.</p>;
  }
  const shown = mode === "role" ? new Set<string>(roleDefaults) : checked;
  return (
    <ActionForm action={action} successMessage="Permisos guardados." className="space-y-3">
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="radio" name="mode" value="role" checked={mode === "role"} onChange={() => setMode("role")} />
          Usar los permisos del perfil ({roleLabel})
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="mode"
            value="custom"
            checked={mode === "custom"}
            onChange={() => {
              setMode("custom");
              if (!custom) setChecked(new Set(roleDefaults));
            }}
          />
          Personalizar
        </label>
      </div>
      <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${mode === "role" ? "opacity-60" : ""}`}>
        {PERMISSION_GROUPS.map((g) => (
          <fieldset key={g.module} className="rounded-lg border border-slate-200 p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{g.module}</legend>
            {g.items.map((i) => (
              <label key={i.key} className="flex items-start gap-2 py-0.5 text-sm">
                <input
                  type="checkbox"
                  name={`perm:${i.key}`}
                  className="mt-0.5"
                  disabled={mode === "role"}
                  checked={shown.has(i.key)}
                  onChange={(e) => {
                    const next = new Set(checked);
                    if (e.target.checked) next.add(i.key);
                    else next.delete(i.key);
                    setChecked(next);
                  }}
                />
                {i.label}
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      <SubmitButton className="btn btn-primary btn-sm">Guardar permisos</SubmitButton>
    </ActionForm>
  );
}
