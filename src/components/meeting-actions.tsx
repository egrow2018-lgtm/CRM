"use client";

import { useState } from "react";
import { deleteActivity } from "@/app/(crm)/actividades/actions";
import { ConfirmButton } from "./action-form";

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
}: {
  activityId: string;
  joinUrl: string | null;
  hostUrl: string | null;
  invitation: string;
  inviteEmail?: string | null;
  calendarUrl: string;
  subject: string;
  canCancel: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const isZoom = !!joinUrl?.includes("zoom.");
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {hostUrl && (
        <a href={hostUrl} target="_blank" rel="noreferrer" className="btn btn-sm border-blue-600 bg-blue-600 text-white hover:bg-blue-700">
          Iniciar {isZoom ? "Zoom" : "reunión"}
        </a>
      )}
      {joinUrl && (
        <a href={joinUrl} target="_blank" rel="noreferrer" className={`btn btn-sm ${hostUrl ? "" : "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"}`}>
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
        href={`mailto:${inviteEmail ?? ""}?subject=${encodeURIComponent(`Invitación: ${subject}`)}&body=${encodeURIComponent(invitation)}`}
      >
        Correo
      </a>
      <a className="btn btn-sm" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(invitation)}`}>
        WhatsApp
      </a>
      <a className="btn btn-sm" target="_blank" rel="noreferrer" href={calendarUrl}>
        Google Calendar
      </a>
      {canCancel && (
        <form action={deleteActivity.bind(null, activityId)}>
          <ConfirmButton message={`¿Cancelar la reunión "${subject}"?${isZoom ? " También se eliminará en Zoom." : ""}`} className="btn btn-sm btn-danger">
            Cancelar
          </ConfirmButton>
        </form>
      )}
    </div>
  );
}
