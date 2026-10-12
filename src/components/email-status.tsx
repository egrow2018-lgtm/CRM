import { timeAgo } from "@/lib/format";

/** Enviado → Abierto (n) → Clic / documento visto */
export function EmailStatus({
  email,
  docViews = 0,
}: {
  email: { openCount: number; lastOpenedAt: Date | null; clickCount: number };
  docViews?: number;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {email.openCount > 0 ? (
        <span className="badge bg-emerald-50 text-emerald-700" title={email.lastOpenedAt ? `Última apertura ${timeAgo(email.lastOpenedAt)}` : undefined}>
          👀 Abierto {email.openCount > 1 ? `${email.openCount} veces` : ""}
        </span>
      ) : (
        <span className="badge bg-slate-100 text-slate-500">Enviado</span>
      )}
      {email.clickCount > 0 && <span className="badge bg-sky-50 text-sky-700">🔗 {email.clickCount} {email.clickCount === 1 ? "clic" : "clics"}</span>}
      {docViews > 0 && <span className="badge bg-amber-50 text-amber-800">📄 {docViews} {docViews === 1 ? "vista" : "vistas"}</span>}
    </span>
  );
}
