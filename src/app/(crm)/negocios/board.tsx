"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { formatDate, formatMoney, timeAgo } from "@/lib/format";
import { Avatar } from "@/components/ui";
import { QuickActions } from "@/components/quick-actions";
import { moveDeal } from "./actions";

export type BoardStage = { id: string; name: string; probability: number; isWon: boolean; isLost: boolean };
export type BoardDeal = {
  id: string;
  name: string;
  amount: number;
  stageId: string;
  closeDate: string | null;
  createdAt: string;
  lastActivityAt: string | null;
  owner: string | null;
  company: string | null;
  line: { name: string; color: string } | null;
  contact: { name: string; email: string | null; phone: string | null } | null;
  next: { type: string; subject: string; dueDate: string | null } | null;
  pending: number;
  project: { entrega?: string; avance?: string } | null;
};

const NEXT_LABEL: Record<string, string> = { TAREA: "Tarea", LLAMADA: "Llamada", REUNION: "Reunión" };

export function DealBoard({
  stages,
  deals: initial,
  users,
  zoomEnabled,
}: {
  stages: BoardStage[];
  deals: BoardDeal[];
  users: { id: string; name: string }[];
  zoomEnabled: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [deals, setDeals] = useState(initial);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Sincroniza cuando cambian los filtros (nuevos datos del servidor)
  const [prevInitial, setPrevInitial] = useState(initial);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setDeals(initial);
  }

  function drop(stageId: string) {
    const id = dragging;
    setDragging(null);
    setOver(null);
    if (!id) return;
    const deal = deals.find((d) => d.id === id);
    if (!deal || deal.stageId === stageId) return;
    const previous = deal.stageId;
    setDeals((ds) => ds.map((d) => (d.id === id ? { ...d, stageId } : d)));
    startTransition(async () => {
      const res = await moveDeal(id, stageId);
      if (res?.error) {
        alert(res.error);
        setDeals((ds) => ds.map((d) => (d.id === id ? { ...d, stageId: previous } : d)));
      }
    });
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-3" style={{ minHeight: "calc(100vh - 220px)" }}>
      {stages.map((stage) => {
        const items = deals.filter((d) => d.stageId === stage.id);
        const total = items.reduce((s, d) => s + d.amount, 0);
        const weighted = (total * stage.probability) / 100;
        const headerColor = stage.isWon ? "bg-emerald-100" : stage.isLost ? "bg-rose-100" : "bg-orange-50";
        return (
          <div
            key={stage.id}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(stage.id);
            }}
            onDragLeave={() => setOver((o) => (o === stage.id ? null : o))}
            onDrop={() => drop(stage.id)}
            className={`flex w-64 shrink-0 flex-col rounded-xl border bg-slate-100/70 transition ${
              over === stage.id ? "border-brand-500 ring-2 ring-brand-100" : "border-slate-200"
            }`}
          >
            <div className={`rounded-t-xl px-3 py-2 ${headerColor}`}>
              <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
                <span>{stage.name}</span>
                <span className="rounded-full bg-white/70 px-2 text-xs font-medium text-slate-600">{items.length}</span>
              </div>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-2" style={{ maxHeight: "calc(100vh - 290px)" }}>
              {items.map((d) => (
                <div
                  key={d.id}
                  draggable
                  onDragStart={() => setDragging(d.id)}
                  onDragEnd={() => setDragging(null)}
                  className={`card cursor-grab p-3 text-xs active:cursor-grabbing ${dragging === d.id ? "opacity-40" : ""}`}
                >
                  <Link href={`/negocios/${d.id}`} className="block text-sm font-semibold leading-snug text-brand-800 hover:underline">
                    {d.name}
                  </Link>
                  {d.line && (
                    <span className="badge mt-1" style={{ backgroundColor: `${d.line.color}1a`, color: d.line.color }}>
                      {d.line.name}
                    </span>
                  )}
                  <dl className="mt-2 space-y-0.5 text-slate-600">
                    <div>Valor: <span className="font-medium text-slate-800">{formatMoney(d.amount)}</span></div>
                    {d.company && <div className="truncate">Empresa: {d.company}</div>}
                    <div>Fecha de cierre: {formatDate(d.closeDate ? new Date(d.closeDate) : null)}</div>
                    <div>Creado: {formatDate(new Date(d.createdAt))}</div>
                    {d.project?.entrega && <div>Entrega: {formatDate(new Date(`${d.project.entrega}T00:00:00Z`))}</div>}
                  </dl>
                  {d.project?.avance && (
                    <div className="mt-1.5 h-1.5 rounded bg-slate-100" title={`Avance ${d.project.avance}%`}>
                      <div className="h-1.5 rounded bg-egrow-cyan" style={{ width: `${Math.min(100, Number(d.project.avance))}%` }} />
                    </div>
                  )}
                  <div
                    className={`mt-2 truncate rounded-md border px-2 py-1 ${
                      !d.next
                        ? "border-slate-200 text-slate-400"
                        : d.next.dueDate && d.next.dueDate.slice(0, 10) < today
                          ? "border-red-200 bg-red-50 text-red-700"
                          : "border-amber-200 bg-amber-50 text-amber-800"
                    }`}
                    title={d.next ? `${NEXT_LABEL[d.next.type] ?? ""}: ${d.next.subject}` : undefined}
                  >
                    {d.next ? (
                      <>
                        {NEXT_LABEL[d.next.type]} {d.next.dueDate ? formatDate(new Date(d.next.dueDate)) : ""} · {d.next.subject}
                        {d.pending > 1 && <span className="text-slate-500"> (+{d.pending - 1})</span>}
                      </>
                    ) : (
                      "No hay próximas actividades"
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-slate-500">
                    <span className="flex items-center gap-1.5">
                      {d.owner ? <Avatar name={d.owner} /> : <span className="italic">Sin propietario</span>}
                    </span>
                    <span title="Última actividad">{timeAgo(d.lastActivityAt ? new Date(d.lastActivityAt) : null)}</span>
                  </div>
                  <div className="mt-1 flex justify-end border-t border-slate-100 pt-1">
                    <QuickActions compact target={{ dealId: d.id }} users={users} contact={d.contact} zoomEnabled={zoomEnabled} />
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-b-xl border-t border-slate-200 bg-white/60 px-3 py-2 text-xs text-slate-600">
              <div><span className="font-semibold text-slate-800">{formatMoney(total)}</span> · Cantidad total</div>
              <div>
                <span className="font-semibold text-slate-800">{formatMoney(weighted)}</span> ({stage.probability}%) · Ponderada
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
