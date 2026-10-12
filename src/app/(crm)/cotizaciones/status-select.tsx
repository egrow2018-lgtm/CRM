"use client";

import { useTransition } from "react";
import type { QuoteStatus } from "@prisma/client";
import { QUOTE_STATUS } from "@/lib/quotes";
import { setQuoteStatus } from "./actions";

/** Estado de la cotización, editable en la misma tabla. */
export function QuoteStatusSelect({ id, status, disabled }: { id: string; status: QuoteStatus; disabled?: boolean }) {
  const [pending, start] = useTransition();
  if (disabled) return <span className={`badge ${QUOTE_STATUS[status].className}`}>{QUOTE_STATUS[status].label}</span>;
  return (
    <select
      data-native
      aria-label="Estado de la cotización"
      value={status}
      disabled={pending}
      onChange={(e) => start(() => setQuoteStatus(id, e.target.value as QuoteStatus))}
      className={`rounded-full border-0 px-2 py-0.5 text-xs font-medium ${QUOTE_STATUS[status].className} ${pending ? "opacity-50" : ""}`}
    >
      {Object.entries(QUOTE_STATUS).map(([k, v]) => (
        <option key={k} value={k}>{v.label}</option>
      ))}
    </select>
  );
}
