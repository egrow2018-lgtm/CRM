"use client";

import { useActionState } from "react";
import { testZoom } from "./actions";

export function ZoomTest() {
  const [state, action, pending] = useActionState(testZoom, undefined);
  return (
    <div>
      <form action={action}>
        <button className="btn btn-sm" disabled={pending}>{pending ? "Probando…" : "Probar conexión con Zoom"}</button>
      </form>
      {state?.error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state?.results && (
        <ul className="mt-2 space-y-1 text-sm">
          {state.results.map((r) => (
            <li key={r.email}>
              <span className={r.ok ? "text-emerald-700" : "text-amber-700"}>{r.ok ? "✓" : "!"}</span> <b>{r.name}</b>{" "}
              <span className="text-slate-500">({r.email})</span> — {r.status}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
