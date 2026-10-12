"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { computeTotals } from "@/lib/quotes";
import { createQuote } from "../actions";

type Deal = { id: string; label: string; lineId: string | null };
type Product = { id: string; name: string; price: number; lineId: string; lineName: string };
type Line = { productId: string; description: string; quantity: string; unitPrice: string; discount: string };

const money = (n: number) => n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (v: string) => {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const emptyLine = (): Line => ({ productId: "", description: "", quantity: "1", unitPrice: "", discount: "0" });

export function QuoteForm({
  deals,
  products,
  brandByLine,
  initial,
}: {
  deals: Deal[];
  products: Product[];
  /** Líneas con marca propia (ej. Rutalink): id → nombre de la marca */
  brandByLine: Record<string, string>;
  initial: {
    dealId: string;
    lines: Line[];
    validityDays: number;
    ivaPercent: number;
    notes: string;
    conditions: string;
  };
}) {
  const router = useRouter();
  const [dealId, setDealId] = useState(initial.dealId);
  const [lines, setLines] = useState<Line[]>(initial.lines.length ? initial.lines : [emptyLine()]);
  const [iva, setIva] = useState(String(initial.ivaPercent));
  // Clave única de este formulario: si se pulsa «Generar» dos veces, el servidor no duplica la cotización
  const [requestKey, setRequestKey] = useState("");
  useEffect(() => setRequestKey(crypto.randomUUID()), []);

  const deal = deals.find((d) => d.id === dealId) ?? null;
  const productLines = new Set(lines.flatMap((l) => products.filter((p) => p.id === l.productId).map((p) => p.lineId)));
  const brandLine = deal?.lineId ?? (productLines.size === 1 ? [...productLines][0] : null);
  const brandName = brandLine ? brandByLine[brandLine] : undefined;

  const valid = lines.filter((l) => l.description.trim() && num(l.quantity) > 0);
  const totals = computeTotals(
    valid.map((l) => ({ quantity: num(l.quantity), unitPrice: num(l.unitPrice), discount: Math.min(100, num(l.discount)) })),
    num(iva),
  );

  const update = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const pickProduct = (i: number, id: string) => {
    const p = products.find((x) => x.id === id);
    update(i, p ? { productId: id, description: p.name, unitPrice: p.price ? String(p.price) : lines[i].unitPrice } : { productId: "" });
  };

  // Productos agrupados por línea, primero la del negocio
  const groups = new Map<string, Product[]>();
  for (const p of products) groups.set(p.lineName, [...(groups.get(p.lineName) ?? []), p]);
  const lineName = products.find((p) => p.lineId === deal?.lineId)?.lineName;
  const groupEntries = [...groups.entries()].sort(([a], [b]) => (a === lineName ? -1 : b === lineName ? 1 : a.localeCompare(b)));

  return (
    <ActionForm action={createQuote} className="space-y-4">
      <input type="hidden" name="requestKey" value={requestKey} />
      <input
        type="hidden"
        name="lines"
        value={JSON.stringify(valid.map((l) => ({ productId: l.productId || null, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice || "0", discount: l.discount || "0" })))}
      />

      <div className="card p-4">
        <label className="block text-sm font-medium text-slate-700">
          Negocio
          <select
            name="dealId"
            required
            value={dealId}
            onChange={(e) => {
              setDealId(e.target.value);
              // Si aún no hay productos escritos, se cargan los del negocio elegido
              if (e.target.value && !lines.some((l) => l.description.trim())) router.replace(`/cotizaciones/nueva?dealId=${e.target.value}`);
            }}
            className="input mt-1"
          >
            <option value="">— Elige el negocio —</option>
            {deals.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
        </label>
        <p className="mt-1 text-xs text-slate-500">
          Los datos del cliente salen del negocio (empresa y contacto). ¿No existe? <Link className="link" href="/negocios/nuevo">Crea el negocio</Link> primero.
        </p>
      </div>

      <div className="card p-4">
        <h2 className="mb-3 text-base">Productos y servicios</h2>
        <div className="overflow-x-auto">
          <table className="table min-w-[44rem]">
            <thead>
              <tr>
                <th className="w-[34%]">Producto / descripción</th>
                <th className="w-20 text-right">Cant.</th>
                <th className="w-32 text-right">Precio unit.</th>
                <th className="w-20 text-right">Desc. %</th>
                <th className="w-28 text-right">Subtotal</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const sub = num(l.quantity) * num(l.unitPrice) * (1 - Math.min(100, num(l.discount)) / 100);
                return (
                  <tr key={i} className="align-top">
                    <td className="space-y-1.5">
                      <select value={l.productId} onChange={(e) => pickProduct(i, e.target.value)} className="input" aria-label="Producto del catálogo">
                        <option value="">— Producto del catálogo (opcional) —</option>
                        {groupEntries.map(([line, items]) => (
                          <optgroup key={line} label={line}>
                            {items.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}{p.price > 0 ? ` · $${money(p.price)}` : ""}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      <input value={l.description} onChange={(e) => update(i, { description: e.target.value })} className="input" placeholder="Descripción que verá el cliente" />
                    </td>
                    <td><input value={l.quantity} onChange={(e) => update(i, { quantity: e.target.value })} inputMode="decimal" className="input text-right" /></td>
                    <td><input value={l.unitPrice} onChange={(e) => update(i, { unitPrice: e.target.value })} inputMode="decimal" className="input text-right" placeholder="0,00" /></td>
                    <td><input value={l.discount} onChange={(e) => update(i, { discount: e.target.value })} inputMode="decimal" className="input text-right" /></td>
                    <td className="pt-3.5 text-right font-medium tabular-nums">${money(Math.round(sub * 100) / 100)}</td>
                    <td className="pt-3">
                      {lines.length > 1 && (
                        <button type="button" title="Quitar" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-600">✕</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button type="button" className="btn btn-sm mt-2" onClick={() => setLines((ls) => [...ls, emptyLine()])}>+ Agregar línea</button>

        <div className="mt-4 ml-auto w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="tabular-nums">${money(totals.subtotal)}</span></div>
          {totals.discountTotal > 0 && (
            <div className="flex justify-between text-xs text-slate-500"><span>Descuentos incluidos</span><span className="tabular-nums">−${money(totals.discountTotal)}</span></div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-slate-500">
              IVA <input name="ivaPercent" value={iva} onChange={(e) => setIva(e.target.value)} inputMode="decimal" className="input inline-block w-16 py-0.5 text-right" /> %
            </span>
            <span className="tabular-nums">${money(totals.iva)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-semibold text-brand-700">
            <span>Total</span><span className="tabular-nums">${money(totals.total)}</span>
          </div>
        </div>
      </div>

      <div className="card grid gap-3 p-4 sm:grid-cols-2">
        <label className="text-xs text-slate-500">
          Validez (días)
          <input name="validityDays" type="number" min="1" max="365" defaultValue={initial.validityDays} className="input mt-1" />
        </label>
        <label className="text-xs text-slate-500">
          Observaciones (opcional)
          <input name="notes" defaultValue={initial.notes} className="input mt-1" placeholder="Ej. Incluye 2 rondas de revisión del guion." />
        </label>
        <label className="text-xs text-slate-500 sm:col-span-2">
          Condiciones comerciales (una por línea)
          <textarea name="conditions" rows={4} defaultValue={initial.conditions} className="input mt-1" />
        </label>
        {brandName && (
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input type="checkbox" name="useBrand" defaultChecked /> Usar el logo y los colores de {brandName}
          </label>
        )}
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton pendingText="Generando cotización…" disabled={!requestKey || !dealId || valid.length === 0}>
          Generar cotización
        </SubmitButton>
        {(!dealId || valid.length === 0) && <span className="text-xs text-slate-500">Elige el negocio y agrega al menos un producto o servicio.</span>}
      </div>
    </ActionForm>
  );
}
