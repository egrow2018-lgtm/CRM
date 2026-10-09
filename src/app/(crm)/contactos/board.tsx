"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { LeadStatus } from "@prisma/client";
import { LEAD_STATUS } from "@/lib/leads";
import { timeAgo } from "@/lib/format";
import { Avatar } from "@/components/ui";
import { moveContactStatus } from "../leads/actions";

export type BoardContact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  company: string | null;
  owner: string | null;
  status: LeadStatus | null;
  lastActivityAt: string | null;
};

const COLUMNS: { key: LeadStatus | "none"; label: string; tone: string }[] = [
  { key: "none", label: "Sin estado", tone: "bg-slate-200" },
  { key: "NUEVO", label: LEAD_STATUS.NUEVO.label, tone: "bg-pink-100" },
  { key: "EN_SEGUIMIENTO", label: LEAD_STATUS.EN_SEGUIMIENTO.label, tone: "bg-amber-100" },
  { key: "CALIFICADO", label: LEAD_STATUS.CALIFICADO.label, tone: "bg-emerald-100" },
  { key: "DESCARTADO", label: LEAD_STATUS.DESCARTADO.label, tone: "bg-slate-100" },
];

export function ContactBoard({
  contacts: initial,
  totals,
  canMove,
}: {
  contacts: BoardContact[];
  totals: Record<string, number>;
  canMove: boolean;
}) {
  const [contacts, setContacts] = useState(initial);
  const [prev, setPrev] = useState(initial);
  if (prev !== initial) {
    setPrev(initial);
    setContacts(initial);
  }
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [, start] = useTransition();
  const [counts, setCounts] = useState(totals);
  const [prevTotals, setPrevTotals] = useState(totals);
  if (prevTotals !== totals) {
    setPrevTotals(totals);
    setCounts(totals);
  }

  function drop(key: string) {
    const id = dragging;
    setDragging(null);
    setOver(null);
    const c = contacts.find((x) => x.id === id);
    const status = key === "none" ? null : (key as LeadStatus);
    if (!c || c.status === status) return;
    const before = c.status;
    const fromKey = before ?? "none";
    setContacts((cs) => cs.map((x) => (x.id === c.id ? { ...x, status } : x)));
    setCounts((t) => ({ ...t, [fromKey]: (t[fromKey] ?? 1) - 1, [key]: (t[key] ?? 0) + 1 }));
    start(async () => {
      const res = await moveContactStatus(c.id, status);
      if (res.error) {
        alert(res.error);
        setContacts((cs) => cs.map((x) => (x.id === c.id ? { ...x, status: before } : x)));
        setCounts((t) => ({ ...t, [fromKey]: (t[fromKey] ?? 0) + 1, [key]: (t[key] ?? 1) - 1 }));
      }
    });
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {COLUMNS.map((col) => {
        const items = contacts.filter((c) => (c.status ?? "none") === col.key);
        const total = counts[col.key] ?? items.length;
        return (
          <div
            key={col.key}
            onDragOver={(e) => {
              if (!canMove) return;
              e.preventDefault();
              setOver(col.key);
            }}
            onDragLeave={() => setOver((o) => (o === col.key ? null : o))}
            onDrop={() => drop(col.key)}
            className={`flex w-64 shrink-0 flex-col rounded-xl border bg-slate-100/70 ${over === col.key ? "border-brand-500 ring-2 ring-brand-100" : "border-slate-200"}`}
          >
            <div className={`flex items-center justify-between rounded-t-xl px-3 py-2 text-sm font-semibold ${col.tone}`}>
              {col.label}
              <span className="rounded-full bg-white/70 px-2 text-xs font-medium">{total}</span>
            </div>
            <div className="space-y-2 overflow-y-auto p-2" style={{ maxHeight: "calc(100vh - 340px)" }}>
              {items.map((c) => (
                <div
                  key={c.id}
                  draggable={canMove}
                  onDragStart={() => setDragging(c.id)}
                  onDragEnd={() => setDragging(null)}
                  className={`card p-3 text-xs ${canMove ? "cursor-grab" : ""} ${dragging === c.id ? "opacity-40" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <Avatar name={c.name} />
                    <Link href={`/contactos/${c.id}`} className="link truncate text-sm">{c.name}</Link>
                  </div>
                  <div className="mt-1.5 space-y-0.5 text-slate-600">
                    {(c.jobTitle || c.company) && <div className="truncate">{[c.jobTitle, c.company].filter(Boolean).join(" · ")}</div>}
                    {c.email && <div className="truncate">{c.email}</div>}
                    {c.phone && <div>{c.phone}</div>}
                  </div>
                  <div className="mt-2 flex justify-between border-t border-slate-100 pt-1.5 text-slate-400">
                    <span className="truncate">{c.owner ?? "Sin propietario"}</span>
                    <span className="shrink-0">{timeAgo(c.lastActivityAt ? new Date(c.lastActivityAt) : null)}</span>
                  </div>
                </div>
              ))}
              {total > items.length && (
                <p className="px-1 text-center text-xs text-slate-500">
                  Mostrando {items.length} de {total}. Usa la búsqueda o la vista de lista para ver el resto.
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
