"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { IconBoard, IconList } from "./icons";

/** Cambia entre vista de tarjetas (tablero) y de lista mediante el parámetro `view` de la URL. */
export function ViewToggle({ defaultView = "board" }: { defaultView?: "board" | "list" }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const view = params.get("view") ?? defaultView;
  const go = (v: string) => {
    const next = new URLSearchParams(params.toString());
    next.delete("page");
    if (v === defaultView) next.delete("view");
    else next.set("view", v);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };
  const cls = (active: boolean) =>
    `flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium ${active ? "bg-brand-50 text-brand-700" : "text-slate-500 hover:bg-slate-50"}`;
  return (
    <div className="flex overflow-hidden rounded-lg border border-slate-300 bg-white" role="group" aria-label="Vista">
      <button type="button" onClick={() => go("board")} className={cls(view === "board")} aria-pressed={view === "board"}>
        <IconBoard width={16} height={16} /> Tarjetas
      </button>
      <button type="button" onClick={() => go("list")} className={`border-l border-slate-300 ${cls(view === "list")}`} aria-pressed={view === "list"}>
        <IconList width={16} height={16} /> Lista
      </button>
    </div>
  );
}
