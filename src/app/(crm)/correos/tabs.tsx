import Link from "next/link";

export function CorreosTabs({ active }: { active: "enviados" | "plantillas" }) {
  const tabs = [
    { key: "enviados", label: "Enviados", href: "/correos" },
    { key: "plantillas", label: "Plantillas", href: "/correos/plantillas" },
  ];
  return (
    <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`-mb-px rounded-t-lg border px-3 py-2 text-sm ${
            t.key === active ? "border-slate-200 border-b-white bg-white font-semibold text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
