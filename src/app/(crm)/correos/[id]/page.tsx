import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { contactName, formatDateTime } from "@/lib/format";
import { formatDuration } from "@/lib/doc-stats";
import { quoteCode } from "@/lib/quotes";
import { InfoRow, PageHeader } from "@/components/ui";
import { DELIVERY_LABELS, deliveryStatus } from "@/lib/email";
import { EmailStatus } from "@/components/email-status";

export default async function EmailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ enviado?: string }> }) {
  await requirePagePermission("emails:send");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const email = await prisma.emailMessage.findUnique({
    where: { id },
    include: {
      fromUser: { select: { name: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
      company: { select: { id: true, name: true } },
      deal: { select: { id: true, name: true } },
      quote: { select: { year: true, number: true } },
      template: { select: { name: true } },
      events: { orderBy: { createdAt: "desc" }, take: 200 },
      docLinks: {
        include: {
          document: { select: { id: true, name: true } },
          quote: { select: { year: true, number: true } },
          views: { orderBy: { startedAt: "desc" } },
        },
      },
    },
  });
  if (!email) notFound();

  // Estado de entrega en Resend (se vuelve a consultar mientras no sea definitivo)
  const FINAL = ["delivered", "bounced", "complained", "failed", "opened", "clicked"];
  let delivery = email.deliveryStatus;
  const stale = !email.deliveryCheckedAt || Date.now() - email.deliveryCheckedAt.getTime() > 60_000;
  if (email.providerId && (!delivery || !FINAL.includes(delivery)) && stale) {
    const fresh = await deliveryStatus(email.providerId);
    if (fresh) delivery = fresh;
    await prisma.emailMessage.update({ where: { id }, data: { deliveryStatus: delivery, deliveryCheckedAt: new Date() } });
  }
  const deliveryInfo = delivery ? (DELIVERY_LABELS[delivery] ?? { label: delivery, className: "bg-slate-100 text-slate-600" }) : null;

  type Item = { at: Date; text: string; detail?: string };
  const timeline: Item[] = [
    ...email.events.map((e) =>
      e.type === "open" ? { at: e.createdAt, text: "👀 Abrió el correo" } : { at: e.createdAt, text: "🔗 Hizo clic en un enlace", detail: e.url ?? undefined },
    ),
    ...email.docLinks.flatMap((l) =>
      l.views.map((v) => ({
        at: v.startedAt,
        text: `📄 Vio ${l.document ? `«${l.document.name}»` : l.quote ? `la cotización ${quoteCode(l.quote.year, l.quote.number)}` : "un documento"}`,
        detail: `${formatDuration(v.durationSec)} de lectura${v.downloaded ? " · lo descargó" : ""}`,
      })),
    ),
    { at: email.sentAt, text: `✉️ Enviado por ${email.fromUser?.name ?? "—"}` },
  ].sort((a, b) => b.at.getTime() - a.at.getTime());
  const docViews = email.docLinks.reduce((s, l) => s + l.views.length, 0);

  return (
    <div>
      <div className="mb-2 text-sm"><Link href="/correos" className="text-slate-500 hover:underline">← Correos</Link></div>
      {sp.enviado && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          ✓ Correo enviado. Te avisaremos por correo cuando lo abran.{" "}
          {email.contact && <Link className="link" href={`/contactos/${email.contact.id}`}>Volver a {contactName(email.contact)}</Link>}
          {email.deal && <> · <Link className="link" href={`/negocios/${email.deal.id}`}>Volver al negocio</Link></>}
        </div>
      )}
      <PageHeader title={email.subject} subtitle={<EmailStatus email={email} docViews={docViews} />} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <div className="card p-4">
            <dl>
              <InfoRow label="Para">{email.to.join(", ")}</InfoRow>
              {email.cc.length > 0 && <InfoRow label="CC">{email.cc.join(", ")}</InfoRow>}
              <InfoRow label="De">{email.fromUser?.name} · {email.fromEmail}</InfoRow>
              <InfoRow label="Enviado">{formatDateTime(email.sentAt)}</InfoRow>
              <InfoRow label="Entrega">
                {deliveryInfo ? (
                  <>
                    <span className={`badge ${deliveryInfo.className}`}>{deliveryInfo.label}</span>
                    {deliveryInfo.help && <span className="mt-1 block text-xs text-slate-500">{deliveryInfo.help}</span>}
                  </>
                ) : (
                  <span className="text-xs text-slate-500">{email.providerId ? "Consultando…" : "Sin datos de entrega (correo enviado antes de esta función)."}</span>
                )}
              </InfoRow>
              {email.contact && <InfoRow label="Contacto"><Link className="link" href={`/contactos/${email.contact.id}`}>{contactName(email.contact)}</Link></InfoRow>}
              {email.company && <InfoRow label="Empresa"><Link className="link" href={`/empresas/${email.company.id}`}>{email.company.name}</Link></InfoRow>}
              {email.deal && <InfoRow label="Negocio"><Link className="link" href={`/negocios/${email.deal.id}`}>{email.deal.name}</Link></InfoRow>}
              {email.quote && <InfoRow label="Cotización">{quoteCode(email.quote.year, email.quote.number)}</InfoRow>}
              {email.template && <InfoRow label="Plantilla">{email.template.name}</InfoRow>}
              <InfoRow label="Primera apertura">{email.firstOpenedAt ? formatDateTime(email.firstOpenedAt) : "Aún no lo abre"}</InfoRow>
            </dl>
          </div>
          <div className="card p-4">
            <h2 className="mb-3 text-base">Seguimiento</h2>
            <ol className="relative space-y-3 border-l border-slate-200 pl-4">
              {timeline.map((t, i) => (
                <li key={i} className="relative text-sm">
                  <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-accent-500" />
                  <div className="font-medium text-slate-700">{t.text}</div>
                  {t.detail && <div className="break-all text-xs text-slate-500">{t.detail}</div>}
                  <div className="text-xs text-slate-400">{formatDateTime(t.at)}</div>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs text-slate-400">
              Las aperturas son aproximadas: algunos programas de correo bloquean las imágenes y otros (como el de iPhone) las abren solos. Los clics y
              las vistas de documentos son más confiables.
            </p>
          </div>
        </div>
        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <iframe title="Correo enviado" srcDoc={email.html} sandbox="allow-popups allow-popups-to-escape-sandbox" className="h-[70vh] w-full bg-white" />
          </div>
        </div>
      </div>
    </div>
  );
}
