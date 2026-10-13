"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Role } from "@prisma/client";
import { ROLE_LABELS } from "@/lib/permissions";
import { initials } from "@/lib/format";
import { IconLogout } from "./icons";

/** Barra superior: aviso de leads nuevos y menú del usuario (Mi perfil / Cerrar sesión). */
export function TopBar({ user, logout, newLeads }: { user: { name: string; email: string; role: Role }; logout: () => Promise<void>; newLeads: number }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <header className="flex items-center justify-end gap-2 border-b border-slate-200 bg-white px-4 py-2 md:px-6">
      <Link
        href="/leads"
        className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-brand-700"
        title={newLeads ? `${newLeads} lead(s) nuevo(s) en la bandeja` : "Bandeja de leads"}
      >
        <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {newLeads > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />}
      </Link>
      <span className="mx-1 h-6 w-px bg-slate-200" />
      <div ref={box} className="relative">
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-100" aria-haspopup="menu">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">{initials(user.name)}</span>
          <span className="hidden text-left leading-tight sm:block">
            <span className="block text-sm font-medium text-slate-900">{user.name}</span>
            <span className="block text-[11px] uppercase tracking-wide text-slate-500">{ROLE_LABELS[user.role]}</span>
          </span>
          <span className="text-xs text-slate-400">▾</span>
        </button>
        {open && (
          <div role="menu" className="absolute right-0 z-40 mt-1 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white text-sm shadow-lg">
            <div className="border-b border-slate-100 px-3 py-2">
              <div className="font-medium text-slate-900">{user.name}</div>
              <div className="truncate text-xs text-slate-500">{user.email}</div>
            </div>
            <Link href="/perfil" onClick={() => setOpen(false)} className="block px-3 py-2 hover:bg-slate-50">Mi perfil</Link>
            <form action={logout}>
              <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-red-700 hover:bg-red-50">
                <IconLogout width={16} height={16} /> Cerrar sesión
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
