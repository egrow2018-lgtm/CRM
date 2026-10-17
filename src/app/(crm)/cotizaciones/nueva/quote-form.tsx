"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { BILLING, DEFAULT_TERM_MONTHS, computeTotals, isBilling, type Billing } from "@/lib/quotes";
import { PhoneInput } from "@/components/phone-input";
import { createQuote } from "../actions";
import { PreviewButton, QuotePreview } from "./quote-preview";

type Deal = { id: string; label: string; lineId: string | null };
type Option = { id: string; label: string };
type Product = { id: string; name: string; price: number; lineId: string; lineName: string; billing: Billing; term: number | null };
type Line = { productId: string; description: string; quantity: string; unitPrice: string; discount: string; billing: Billing; termMonths: string };

const money = (n: number) => n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (v: string) => {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
/** Ajusta la altura del cuadro de texto a su contenido (hasta ~12 líneas; después aparece la barra). */
const fitHeight = (el: HTMLTextAreaElement | null) => {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight + 2, 300)}px`;
};
const emptyLine = (): Line => ({ productId: "", description: "", quantity: "1", unitPrice: "", discount: "0", billing: "UNICO", termMonths: String(DEFAULT_TERM_MONTHS) });

export function QuoteForm({
  deals,
  products,
  brandByLine,
  quoteLines,
  contacts,
  editId = null,
  initial,
}: {
  deals: Deal[];
  products: Product[];
  /** Líneas con marca propia (ej. Rutalink): id → nombre de la marca */
  brandByLine: Record<string, string>;
  /** Líneas que permiten cotizar a un contacto sin negocio (ej. Rutalink) */
  quoteLines: { id: string; name: string }[];
  contacts: Option[];
  /** Corrección de una cotización aún no enviada (mantiene su número) */
  editId?: string | null;
  initial: {
    mode: "negocio" | "contacto";
    contactId: string;
    lineId: string;
    taxId: string;
    address: string;
    dealId: string;
    lines: Line[];
    validityDays: number;
    ivaPercent: number;
    notes: string;
    conditions: string;
  };
}) {
  const router = useRouter();
  const [mode, setMode] = useState(initial.mode);
  const [dealId, setDealId] = useState(initial.dealId);
  const [lineId, setLineId] = useState(initial.lineId);
  const [contactId, setContactId] = useState(initial.contactId);
  const [firstName, setFirstName] = useState("");
  const direct = mode === "contacto";
  const [lines, setLines] = useState<Line[]>(initial.lines.length ? initial.lines : [emptyLine()]);
  const [iva, setIva] = useState(String(initial.ivaPercent));
  // Cuenta los cambios en los campos del formulario para actualizar la vista previa
  const [changed, setChanged] = useState(0);
  // Clave única de este formulario: si se pulsa «Generar» dos veces, el servidor no duplica la cotización
  const [requestKey, setRequestKey] = useState("");
  useEffect(() => setRequestKey(crypto.randomUUID()), []);
  // Reajusta las descripciones cuando cambian sin escribir (producto del catálogo, línea quitada)
  useEffect(() => {
    document.querySelectorAll<HTMLTextAreaElement>("#quote-form textarea[data-description]").forEach(fitHeight);
  }, [lines]);

  const deal = direct ? null : (deals.find((d) => d.id === dealId) ?? null);
  const targetLine = direct ? lineId || null : (deal?.lineId ?? null);
  const productLines = new Set(lines.flatMap((l) => products.filter((p) => p.id === l.productId).map((p) => p.lineId)));
  const brandLine = targetLine ?? (productLines.size === 1 ? [...productLines][0] : null);
  const ready = direct ? !!lineId && (!!contactId || !!firstName.trim()) : !!dealId;
  const brandName = brandLine ? brandByLine[brandLine] : undefined;

  const valid = lines.filter((l) => l.description.trim() && num(l.quantity) > 0);
  const totals = computeTotals(
    valid.map((l) => ({
      quantity: num(l.quantity),
      unitPrice: num(l.unitPrice),
      discount: Math.min(100, num(l.discount)),
      billing: l.billing,
      termMonths: num(l.termMonths) || DEFAULT_TERM_MONTHS,
    })),
    num(iva),
  );
  const recurring = totals.monthly > 0 || totals.annual > 0;

  const update = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const pickProduct = (i: number, id: string) => {
    const p = products.find((x) => x.id === id);
    update(
      i,
      p
        ? {
            productId: id,
            description: p.name,
            unitPrice: p.price ? String(p.price) : lines[i]!.unitPrice,
            // Cómo se cobra y el plazo salen del catálogo (se pueden cambiar en la línea)
            billing: p.billing,
            termMonths: String(p.term ?? DEFAULT_TERM_MONTHS),
          }
        : { productId: "" },
    );
  };

  // Productos agrupados por línea, primero la del negocio
  const groups = new Map<string, Product[]>();
  for (const p of products) groups.set(p.lineName, [...(groups.get(p.lineName) ?? []), p]);
  const lineName = products.find((p) => p.lineId === targetLine)?.lineName;
  const groupEntries = [...groups.entries()].sort(([a], [b]) => (a === lineName ? -1 : b === lineName ? 1 : a.localeCompare(b)));

  return (
    <ActionForm action={createQuote} id="quote-form" onInput={() => setChanged((n) => n + 1)} className="space-y-4">
      {editId && <input type="hidden" name="editId" value={editId} />}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,40rem)]">
      <div className="min-w-0 space-y-4">
      <input type="hidden" name="requestKey" value={requestKey} />
      <input
        type="hidden"
        name="lines"
        value={JSON.stringify(
          valid.map((l) => ({
            productId: l.productId || null,
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice || "0",
            discount: l.discount || "0",
            billing: l.billing,
            termMonths: l.billing === "UNICO" ? null : l.termMonths,
          })),
        )}
      />

      <input type="hidden" name="mode" value={mode} />
      <div className="card p-4">
        {quoteLines.length > 0 && (
          <div className="mb-3 inline-flex rounded-lg border border-slate-300 p-0.5 text-sm" role="tablist">
            {(
              [
                ["negocio", "Para un negocio"],
                ["contacto", `Para un contacto, sin negocio (${quoteLines.map((l) => l.name).join(", ")})`],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`rounded-md px-3 py-1 ${mode === m ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {!direct ? (
          <>
            <label className="block text-sm font-medium text-slate-700">
              Negocio
              <select
                name="dealId"
                required
                value={dealId}
                onChange={(e) => {
                  setDealId(e.target.value);
                  // Si aún no hay productos escritos, se cargan los del negocio elegido
                  if (!editId && e.target.value && !lines.some((l) => l.description.trim())) router.replace(`/cotizaciones/nueva?dealId=${e.target.value}`);
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
          </>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Línea de negocio
              <select name="businessLineId" required value={lineId} onChange={(e) => setLineId(e.target.value)} className="input mt-1">
                {quoteLines.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Contacto
              <select name="contactId" value={contactId} onChange={(e) => setContactId(e.target.value)} className="input mt-1">
                <option value="">+ Crear un contacto nuevo</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </label>
            {!contactId && (
              <>
                <label className="text-sm font-medium text-slate-700">
                  Nombre *
                  <input name="firstName" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="input mt-1" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Apellido
                  <input name="lastName" className="input mt-1" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Correo
                  <input name="email" type="email" className="input mt-1" placeholder="correo@ejemplo.com" />
                </label>
                <div className="text-sm font-medium text-slate-700">
                  Teléfono
                  <PhoneInput className="mt-1" />
                </div>
              </>
            )}
            <label className="text-sm font-medium text-slate-700">
              Cédula / RUC (opcional)
              <input name="taxId" defaultValue={initial.taxId} className="input mt-1" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Dirección (opcional)
              <input name="address" defaultValue={initial.address} className="input mt-1" />
            </label>
            <p className="text-xs text-slate-500 sm:col-span-2">
              {contactId ? "El contacto" : "El contacto nuevo se guarda en Contactos y"} queda como lead «En seguimiento». Si el cliente acepta la cotización, al marcarla «Aceptada» se crea el negocio
              en producción.
            </p>
          </div>
        )}
      </div>

      <div className="card p-4">
        <h2 className="mb-3 text-base">Productos y servicios</h2>
        {/* Una tarjeta por línea: precio, descuento y subtotal siempre a la vista, también en el celular */}
        <ol className="space-y-3">
          {lines.map((l, i) => {
            const sub = num(l.quantity) * num(l.unitPrice) * (1 - Math.min(100, num(l.discount)) / 100);
            return (
              <li key={i} className="space-y-2 rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-500">Línea {i + 1}</span>
                  {lines.length > 1 && (
                    <button type="button" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="text-xs text-slate-500 hover:text-red-600">
                      ✕ Quitar
                    </button>
                  )}
                </div>
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
                <textarea
                  value={l.description}
                  onChange={(e) => {
                    fitHeight(e.target);
                    update(i, { description: e.target.value });
                  }}
                  // Crece con el texto (también cuando una línea larga se parte en dos): Enter agrega una línea nueva
                  ref={fitHeight}
                  data-description
                  rows={2}
                  maxLength={1000}
                  className="input resize-y"
                  placeholder="Descripción que verá el cliente (Enter para otra línea)"
                  aria-label="Descripción que verá el cliente"
                />
                <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-4">
                  <label className="text-xs text-slate-500">
                    Cant.
                    <input value={l.quantity} onChange={(e) => update(i, { quantity: e.target.value })} inputMode="decimal" className="input mt-1 text-right" />
                  </label>
                  <label className="text-xs text-slate-500">
                    Precio unit.{BILLING[l.billing].per}
                    <input value={l.unitPrice} onChange={(e) => update(i, { unitPrice: e.target.value })} inputMode="decimal" className="input mt-1 text-right" placeholder="0,00" />
                  </label>
                  <label className="text-xs text-slate-500">
                    Desc. %
                    <input value={l.discount} onChange={(e) => update(i, { discount: e.target.value })} inputMode="decimal" className="input mt-1 text-right" />
                  </label>
                  <div className="text-right text-xs text-slate-500">
                    Subtotal
                    <div className="mt-1 py-2 text-sm font-semibold tabular-nums text-slate-800">
                      ${money(Math.round(sub * 100) / 100)}
                      {BILLING[l.billing].per && <span className="font-normal text-slate-500">{BILLING[l.billing].per}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <select
                    data-native
                    value={l.billing}
                    onChange={(e) => update(i, { billing: isBilling(e.target.value) ? e.target.value : "UNICO" })}
                    className="input w-auto py-1 text-xs"
                    aria-label="Cómo se cobra"
                  >
                    {(Object.keys(BILLING) as Billing[]).map((b) => (
                      <option key={b} value={b}>{BILLING[b].label}</option>
                    ))}
                  </select>
                  {l.billing !== "UNICO" && (
                    <label className="flex items-center gap-1">
                      Contrato
                      <input
                        value={l.termMonths}
                        onChange={(e) => update(i, { termMonths: e.target.value.replace(/\D/g, "") })}
                        inputMode="numeric"
                        className="input w-14 py-1 text-right text-xs"
                        aria-label="Plazo del contrato en meses"
                      />
                      meses
                    </label>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        <button type="button" className="btn btn-sm mt-3" onClick={() => setLines((ls) => [...ls, emptyLine()])}>+ Agregar línea</button>

        <div className="mt-4 flex flex-wrap items-start justify-end gap-4">
          {recurring && (
            // Resumen de lo que paga el cliente: al inicio, cada mes y cada año (sin IVA)
            <div className="w-full max-w-xs space-y-1 rounded-lg border border-accent-200 bg-accent-50/60 p-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-600">Pago inicial</span><span className="tabular-nums">${money(totals.oneTime)}</span></div>
              {totals.monthly > 0 && (
                <div className="flex justify-between font-semibold text-brand-700"><span>Mensualidad</span><span className="tabular-nums">${money(totals.monthly)} /mes</span></div>
              )}
              {totals.annual > 0 && (
                <div className="flex justify-between font-semibold text-brand-700"><span>Anualidad</span><span className="tabular-nums">${money(totals.annual)} /año</span></div>
              )}
              <div className="flex justify-between border-t border-accent-200 pt-1"><span className="text-slate-600">Valor del primer año</span><span className="font-semibold tabular-nums">${money(totals.subtotal)}</span></div>
              <p className="text-xs text-slate-500">Valores sin IVA. El valor del negocio será el del primer año.</p>
            </div>
          )}
          <div className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">{recurring ? "Subtotal primer año" : "Subtotal"}</span><span className="tabular-nums">${money(totals.subtotal)}</span></div>
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
              <span>{recurring ? "Total primer año" : "Total"}</span><span className="tabular-nums">${money(totals.total)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card grid gap-3 p-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">
          Validez (días)
          <input name="validityDays" type="number" min="1" max="365" defaultValue={initial.validityDays} className="input mt-1" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Observaciones (opcional)
          <input name="notes" defaultValue={initial.notes} className="input mt-1" placeholder="Ej. Incluye 2 rondas de revisión del guion." />
        </label>
        <label className="text-sm font-medium text-slate-700 sm:col-span-2">
          Condiciones comerciales (una por línea)
          <textarea name="conditions" rows={4} ref={fitHeight} onInput={(e) => fitHeight(e.currentTarget)} defaultValue={initial.conditions} className="input mt-1" />
        </label>
        {brandName && (
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input type="checkbox" name="useBrand" defaultChecked /> Usar el logo y los colores de {brandName}
          </label>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <PreviewButton formId="quote-form" ready={ready && valid.length > 0} />
        <SubmitButton pendingText={editId ? "Guardando…" : "Generando cotización…"} disabled={!requestKey || !ready || valid.length === 0}>
          {editId ? "Guardar corrección" : "Generar cotización"}
        </SubmitButton>
        {(!ready || valid.length === 0) && (
          <span className="text-xs text-slate-500">{direct ? "Elige o crea el contacto" : "Elige el negocio"} y agrega al menos un producto o servicio.</span>
        )}
      </div>
      </div>
      <QuotePreview formId="quote-form" ready={ready && valid.length > 0} changed={`${changed}|${mode}|${dealId}|${lineId}|${contactId}|${JSON.stringify(lines)}|${iva}`} />
      </div>
    </ActionForm>
  );
}
