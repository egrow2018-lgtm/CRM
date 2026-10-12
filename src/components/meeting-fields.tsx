"use client";

import { useState } from "react";
import { DURATIONS } from "@/lib/meetings";
import { APP_TIMEZONE, utcToZoned } from "@/lib/timezone";

type Mode = "zoom" | "presencial" | "online";

/** Campos para agendar una reunión: fecha, hora, duración, anfitrión, modalidad e invitados. */
export function MeetingFields({
  users,
  zoomEnabled,
  emailEnabled = false,
  defaultGuests = "",
  defaultHostLabel = "Yo",
}: {
  users: { id: string; name: string }[];
  zoomEnabled: boolean;
  emailEnabled?: boolean;
  defaultGuests?: string;
  defaultHostLabel?: string;
}) {
  // Por defecto: mañana a las 10:00
  const [defaults] = useState(() => utcToZoned(new Date(Date.now() + 86400000)));
  const [mode, setMode] = useState<Mode>(zoomEnabled ? "zoom" : "presencial");
  const MODES: { key: Mode; label: string; hint: string; disabled?: boolean }[] = [
    { key: "zoom", label: "Zoom", hint: zoomEnabled ? "Se crea en la cuenta de Zoom de e-grow" : "Zoom no está conectado", disabled: !zoomEnabled },
    { key: "presencial", label: "Presencial", hint: "En una oficina o lugar" },
    { key: "online", label: "Otro enlace", hint: "Meet, Teams u otro" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="text-xs text-slate-500">
        Fecha
        <input name="date" type="date" required defaultValue={defaults.date} className="input mt-1" />
      </label>
      <label className="text-xs text-slate-500">
        Hora ({APP_TIMEZONE === "America/Guayaquil" ? "Ecuador" : APP_TIMEZONE})
        <input name="time" type="time" required defaultValue="10:00" step={300} className="input mt-1" />
      </label>
      <label className="text-xs text-slate-500">
        Duración
        <select name="duration" defaultValue="30" className="input mt-1">
          {DURATIONS.map((d) => (
            <option key={d} value={d}>{d < 60 ? `${d} min` : `${d / 60} h${d % 60 ? ` ${d % 60} min` : ""}`}</option>
          ))}
        </select>
      </label>
      <label className="text-xs text-slate-500 sm:col-span-3">
        Anfitrión (para quién es la reunión)
        <select name="assigneeId" className="input mt-1" defaultValue="">
          <option value="">{defaultHostLabel}</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </label>

      <fieldset className="sm:col-span-3">
        <legend className="mb-1 text-xs text-slate-500">Modalidad</legend>
        <input type="hidden" name="mode" value={mode} />
        <div className="grid gap-2 sm:grid-cols-3">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              disabled={m.disabled}
              onClick={() => setMode(m.key)}
              className={`rounded-lg border px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
                mode === m.key ? "border-accent-500 bg-accent-50 text-brand-800" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <b>{m.label}</b>
              <span className="block text-xs text-slate-500">{m.hint}</span>
            </button>
          ))}
        </div>
      </fieldset>
      {mode === "presencial" && (
        <label className="text-xs text-slate-500 sm:col-span-3">
          Lugar
          <input name="location" required placeholder="Ej. Oficinas del cliente, Av. Amazonas N34-120, Quito" className="input mt-1" />
        </label>
      )}
      {mode === "online" && (
        <label className="text-xs text-slate-500 sm:col-span-3">
          Enlace de la reunión (opcional)
          <input name="meetingUrl" type="url" placeholder="https://meet.google.com/…" className="input mt-1" />
        </label>
      )}

      <label className="text-xs text-slate-500 sm:col-span-3">
        Invitados (correos separados por coma)
        <textarea name="guests" rows={2} defaultValue={defaultGuests} placeholder="cliente@empresa.com, otro@empresa.com" className="input mt-1" />
      </label>
      <label className={`flex items-start gap-2 text-sm sm:col-span-3 ${emailEnabled ? "" : "text-slate-400"}`}>
        <input type="checkbox" name="sendInvite" defaultChecked={emailEnabled} disabled={!emailEnabled} className="mt-0.5" />
        <span>
          Enviar la invitación por correo
          <span className="block text-xs text-slate-500">
            {emailEnabled
              ? "Les llega a los invitados, al anfitrión (y sus correos adicionales) y a ti, con un archivo para agregarla al calendario."
              : "El correo aún no está configurado."}
          </span>
        </span>
      </label>
    </div>
  );
}
