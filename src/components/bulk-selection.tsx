"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Selección múltiple sobre una tabla renderizada en el servidor.
 * Las filas llevan <BulkCheckCell id=… /> y el encabezado <BulkCheckHeader />; las casillas
 * solo se ven al pulsar «Seleccionar».
 */
export function BulkSelection({
  enabled = true,
  onDelete,
  noun,
  children,
}: {
  enabled?: boolean;
  onDelete: (ids: string[]) => Promise<{ error?: string; deleted?: number }>;
  noun: { one: string; many: string };
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [selecting, setSelecting] = useState(false);
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!enabled) return <>{children}</>;
  const boxes = () => [...(ref.current?.querySelectorAll<HTMLInputElement>("input[data-bulk-id]") ?? [])];
  const selected = () => boxes().filter((b) => b.checked).map((b) => b.dataset.bulkId!);
  const sync = () => {
    const all = boxes();
    const n = all.filter((b) => b.checked).length;
    setCount(n);
    const head = ref.current?.querySelector<HTMLInputElement>("input[data-bulk-all]");
    if (head) {
      head.checked = n > 0 && n === all.length;
      head.indeterminate = n > 0 && n < all.length;
    }
  };
  const clear = () => {
    for (const b of boxes()) b.checked = false;
    sync();
  };

  function remove() {
    const ids = selected();
    if (!ids.length) return;
    const label = ids.length === 1 ? `1 ${noun.one}` : `${ids.length} ${noun.many}`;
    if (!confirm(`¿Eliminar ${label}? Esta acción no se puede deshacer.`)) return;
    startTransition(async () => {
      const res = await onDelete(ids);
      if (res.error) {
        setMessage(res.error);
        return;
      }
      setMessage(`Se eliminaron ${res.deleted ?? ids.length} ${(res.deleted ?? ids.length) === 1 ? noun.one : noun.many}.`);
      clear();
      setSelecting(false);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-2 flex min-h-9 flex-wrap items-center gap-2 text-sm">
        {selecting ? (
          <>
            <span className="font-medium text-slate-700">{count} seleccionados</span>
            <button type="button" className="btn btn-sm btn-danger" disabled={!count || pending} onClick={remove}>
              {pending ? "Eliminando…" : "Eliminar"}
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                clear();
                setSelecting(false);
              }}
            >
              Cancelar
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-sm" onClick={() => { setMessage(null); setSelecting(true); }}>
            Seleccionar
          </button>
        )}
        {message && <span className="text-slate-500">{message}</span>}
      </div>
      <div
        ref={ref}
        className="group"
        data-selecting={selecting}
        onChange={(e) => {
          const t = e.target as HTMLInputElement;
          if (t.dataset.bulkAll !== undefined) for (const b of boxes()) b.checked = t.checked;
          sync();
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function BulkCheckHeader() {
  return (
    <th className="hidden w-8 group-data-[selecting=true]:table-cell">
      <input type="checkbox" data-bulk-all="" aria-label="Seleccionar todos los de esta página" className="h-4 w-4 accent-brand-700" />
    </th>
  );
}

export function BulkCheckCell({ id, label }: { id: string; label: string }) {
  return (
    <td className="hidden w-8 group-data-[selecting=true]:table-cell">
      <input type="checkbox" data-bulk-id={id} aria-label={`Seleccionar ${label}`} className="h-4 w-4 accent-brand-700" />
    </td>
  );
}
