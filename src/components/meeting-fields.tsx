"use client";

import { useState } from "react";
import { DURATIONS } from "@/lib/meetings";
import { APP_TIMEZONE, utcToZoned } from "@/lib/timezone";

/** Campos para agendar una reunión (fecha, hora, duración, anfitrión y Zoom). */
export function MeetingFields({
  users,
  zoomEnabled,
  defaultHostLabel = "Yo",
}: {
  users: { id: string; name: string }[];
  zoomEnabled: boolean;
  defaultHostLabel?: string;
}) {
  // Por defecto: mañana a las 10:00
  const [defaults] = useState(() => utcToZoned(new Date(Date.now() + 86400000)));
  const [zoom, setZoom] = useState(zoomEnabled);
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
        Anfitrión
        <select name="assigneeId" className="input mt-1" defaultValue="">
          <option value="">{defaultHostLabel}</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </label>
      <label className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm sm:col-span-3 ${zoom ? "border-blue-300 bg-blue-50 text-blue-900" : "border-slate-200"}`}>
        <input type="checkbox" name="zoom" checked={zoom} disabled={!zoomEnabled} onChange={(e) => setZoom(e.target.checked)} />
        <span>
          <b>Crear reunión de Zoom</b>
          <span className="block text-xs text-slate-500">
            {zoomEnabled
              ? "Se crea en la cuenta de Zoom de e-grow con el anfitrión elegido."
              : "Zoom aún no está conectado (lo configura el administrador). Puedes pegar otro enlace abajo."}
          </span>
        </span>
      </label>
      {!zoom && (
        <label className="text-xs text-slate-500 sm:col-span-3">
          Enlace de la reunión (Meet, Teams… opcional)
          <input name="meetingUrl" type="url" placeholder="https://" className="input mt-1" />
        </label>
      )}
    </div>
  );
}
