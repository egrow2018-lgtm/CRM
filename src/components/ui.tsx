import Link from "next/link";
import { initials } from "@/lib/format";

export function PageHeader({ title, subtitle, actions }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "h-6 w-6 text-[10px]" : "h-9 w-9 text-xs";
  return (
    <span title={name} className={`inline-flex shrink-0 items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-600 ${cls}`}>
      {initials(name)}
    </span>
  );
}

export function LineBadge({ line }: { line: { name: string; color: string } | null | undefined }) {
  if (!line) return null;
  return (
    <span className="badge" style={{ backgroundColor: `${line.color}1a`, color: line.color }}>
      {line.name}
    </span>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{children}</div>;
}

export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

export function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-1.5">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-800">{children ?? "—"}</dd>
    </div>
  );
}

export function Pagination({ page, pages, makeHref }: { page: number; pages: number; makeHref: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-end gap-2 text-sm">
      {page > 1 && <Link className="btn btn-sm" href={makeHref(page - 1)}>Anterior</Link>}
      <span className="text-slate-500">Página {page} de {pages}</span>
      {page < pages && <Link className="btn btn-sm" href={makeHref(page + 1)}>Siguiente</Link>}
    </div>
  );
}
