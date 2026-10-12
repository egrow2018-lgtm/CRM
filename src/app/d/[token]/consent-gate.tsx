"use client";

import { ActionForm, SubmitButton } from "@/components/action-form";
import { acceptDocumentConsent } from "./actions";

export function ConsentGate({ token, title, askEmail, text }: { token: string; title: string; askEmail: boolean; text: string }) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-accent-50 px-4 py-10">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/egrow-logo.png" alt="e-grow" className="mx-auto h-12 w-auto" />
        </div>
        <div className="card p-6">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-accent-700">Documento compartido</div>
          <h1 className="text-xl font-semibold text-brand-700">📄 {title}</h1>
          <ActionForm action={acceptDocumentConsent.bind(null, token)} className="mt-5 space-y-4">
            {askEmail && (
              <label className="block text-sm text-slate-700">
                Tu correo
                <input name="email" type="email" required className="input mt-1" placeholder="nombre@empresa.com" />
              </label>
            )}
            <label className="flex items-start gap-2 text-sm text-slate-600">
              <input type="checkbox" name="consent" required className="mt-1" />
              <span>{text}</span>
            </label>
            <SubmitButton pendingText="Abriendo…">Ver documento</SubmitButton>
          </ActionForm>
        </div>
      </div>
    </main>
  );
}
