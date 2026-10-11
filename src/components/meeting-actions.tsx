"use client";

import { useState } from "react";
import { deleteActivity, resendInvite } from "@/app/(crm)/actividades/actions";
import { ActionForm, ConfirmButton, SubmitButton } from "./action-form";

/** Botones de una reunión: unirse, iniciar como anfitrión, invitar y cancelar. */
export function MeetingActions({
  activityId,
  joinUrl,
  hostUrl,
  invitation,
  inviteEmail,
  calendarUrl,
  subject,
  canCancel,
  location,
  guests = [],
  invitedAt,
  emailEnabled = false,
}: {
  activityId: string;
  joinUrl: string | null;
  hostUrl: string | null;
  invitation: string;
  inviteEmail?: string | null;
  calendarUrl: string;
  subject: string;
  canCancel: boolean;
  location?: string | null;
  guests?: string[];
  invitedAt?: Date | null;
  emailEnabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const isZoom = !!joinUrl?.includes("zoom.");
  return (
    <div className="mt-1.5 space-y-1.5">
      {(location || guests.length > 0) && (
        <div className="space-y-0.5 text-xs text-slate-600">
          {location && <div>📍 {location}</div>}
          {guests.length > 0 && (
            <div>
              Invitados: {guests.join(", ")}
              <span className={invitedAt ? "text-emerald-700" : "text-amber-700"}>
                {" "}· {invitedAt ? `invitación enviada ${new Date(invitedAt).toLocaleDateString("es-EC", { timeZone: "America/Guayaquil" })}` : "invitación no enviada"}
              </span>
            </div>
          )}
        </div>
      )}
    <div className="flex flex-wrap items-center gap-1.5">
      {hostUrl && (
        <a href={hostUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-primary">
          Iniciar {isZoom ? "Zoom" : "reunión"}
        </a>
      )}
      {joinUrl && (
        <a href={joinUrl} target="_blank" rel="noreferrer" className={`btn btn-sm ${hostUrl ? "" : "btn-primary"}`}>
          Unirse
        </a>
      )}
      <button
        type="button"
        className="btn btn-sm"
        onClick={async () => {
          await navigator.clipboard.writeText(invitation);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "¡Copiada!" : "Copiar invitación"}
      </button>
      <a
        className="btn btn-sm"
        href={`mailto:${guests.length ? guests.join(",") : (inviteEmail ?? "")}?subject=${encodeURIComponent(`Invitación: ${subject}`)}&body=${encodeURIComponent(invitation)}`}
      >
        Correo
      </a>
      <a className="btn btn-sm" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(invitation)}`}>
        WhatsApp
      </a>
      <a className="btn btn-sm" target="_blank" rel="noreferrer" href={calendarUrl}>
        Google Calendar
      </a>
      {canCancel && emailEnabled && (
        <details className="relative">
          <summary className="btn btn-sm cursor-pointer list-none">{invitedAt ? "Reenviar invitación" : "Enviar invitación"}</summary>
          <div className="card absolute left-0 z-20 mt-1 w-80 p-3">
            <ActionForm action={resendInvite.bind(null, activityId)} successMessage="Invitación enviada." className="grid gap-2">
              <label className="text-xs text-slate-500">
                Agregar invitados (opcional)
                <textarea name="guests" rows={2} placeholder="correo@empresa.com, otro@empresa.com" className="input mt-1" />
              </label>
              <p className="text-xs text-slate-500">Se envía a todos los invitados, al anfitrión y a ti, con el archivo para el calendario.</p>
              <SubmitButton className="btn btn-primary btn-sm">Enviar</SubmitButton>
            </ActionForm>
          </div>
        </details>
      )}
      {canCancel && (
        <form action={deleteActivity.bind(null, activityId)}>
          <ConfirmButton
            message={`¿Cancelar la reunión "${subject}"?${isZoom ? " También se eliminará en Zoom." : ""}${invitedAt ? " Se avisará por correo a los invitados." : ""}`}
            className="btn btn-sm btn-danger"
          >
            Cancelar
          </ConfirmButton>
        </form>
      )}
    </div>
    </div>
  );
}
