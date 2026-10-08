"use client";

import { useTransition } from "react";
import { moveDeal } from "./actions";

type Stage = { id: string; name: string; isWon: boolean; isLost: boolean };

export function StageBar({ dealId, stages, currentId }: { dealId: string; stages: Stage[]; currentId: string }) {
  const [pending, start] = useTransition();
  const currentIndex = stages.findIndex((s) => s.id === currentId);
  return (
    <div className={`flex flex-wrap gap-1 ${pending ? "opacity-60" : ""}`}>
      {stages.map((s, i) => {
        const active = s.id === currentId;
        const done = i < currentIndex && !stages[currentIndex]?.isLost;
        const color = active
          ? s.isLost
            ? "bg-rose-600 text-white"
            : "bg-brand-700 text-white"
          : done
            ? "bg-brand-100 text-brand-800"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200";
        return (
          <button
            key={s.id}
            disabled={pending || active}
            onClick={() =>
              start(async () => {
                const res = await moveDeal(dealId, s.id);
                if (res?.error) alert(res.error);
              })
            }
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${color}`}
          >
            {s.name}
          </button>
        );
      })}
    </div>
  );
}
