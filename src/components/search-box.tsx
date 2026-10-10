"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { IconSearch } from "./icons";

export function SearchBox({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") === q) return;
      const next = new URLSearchParams(params.toString());
      if (q) next.set("q", q);
      else next.delete("q");
      next.delete("page");
      router.replace(`${pathname}?${next.toString()}`);
    }, 350);
    return () => clearTimeout(t);
  }, [q, params, pathname, router]);

  return (
    <div className="relative mb-4 max-w-md">
      <IconSearch className="pointer-events-none absolute left-2.5 top-2 text-slate-400" width={16} height={16} />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="input pl-8" />
    </div>
  );
}
