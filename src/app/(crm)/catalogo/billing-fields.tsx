"use client";

import { useState } from "react";
import { BILLING, DEFAULT_TERM_MONTHS, type Billing } from "@/lib/quotes";

/** Cómo se cobra el producto y, si es recurrente, el plazo del contrato (meses). */
export function BillingFields({ billing, term }: { billing: Billing; term: number | null }) {
  const [value, setValue] = useState<Billing>(billing);
  return (
    <>
      <label className="text-xs text-slate-500">
        Cobro
        <select name="billing" value={value} onChange={(e) => setValue(e.target.value as Billing)} className="input mt-1">
          {(Object.keys(BILLING) as Billing[]).map((b) => (
            <option key={b} value={b}>{BILLING[b].label}</option>
          ))}
        </select>
      </label>
      {value !== "UNICO" ? (
        <label className="text-xs text-slate-500">
          Plazo del contrato (meses)
          <input name="renewalMonths" type="number" min="1" max="120" defaultValue={term ?? DEFAULT_TERM_MONTHS} className="input mt-1" />
        </label>
      ) : (
        <span className="hidden sm:block" />
      )}
    </>
  );
}
