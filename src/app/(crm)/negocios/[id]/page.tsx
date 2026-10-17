import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { EMAIL_TRACKING, getFormOptions } from "@/lib/queries";
import { contactName, formatDate, formatMoney, formatMoneyExact, recurringLabel, toNumber, formatLocalDate } from "@/lib/format";
import { ConfirmButton } from "@/components/action-form";
import { ActivityPanel } from "@/components/activity-panel";
import { zoomConfigured } from "@/lib/zoom";
import { InfoRow, LineBadge, PageHeader } from "@/components/ui";
import { DealForm } from "../deal-form";
import { StageBar } from "../stage-bar";
import { createRenewalNow, deleteDeal, updateDeal, updateDealCost, updateDealCustomData } from "../actions";
import { DealCostCard } from "../cost-card";
import { renewalAlert } from "@/lib/alerts";
import { Semaforo } from "@/components/semaforo";
import { CustomFieldsCard } from "@/components/custom-fields-form";
import { QuotesCard } from "@/components/quotes-card";
import { GpsboxCard } from "@/components/gpsbox-card";
import { normalize } from "@/lib/csv";
import { appUrl, emailConfigured } from "@/lib/email";
import { parseCustomData, parseCustomFields } from "@/lib/custom-fields";

export default async function DealPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { edit } = await searchParams;
  const deal = await prisma.deal.findUnique({
    where: { id },
    include: {
      stage: true,
      owner: true,
      company: true,
      contact: true,
      businessLine: true,
      items: { include: { product: { include: { businessLine: true } } }, orderBy: { id: "asc" } },
      activities: { include: { author: true, assignee: true, email: { select: EMAIL_TRACKING } }, orderBy: { createdAt: "desc" } },
      quotes: {
        orderBy: { createdAt: "desc" },
        include: { links: { select: { token: true, emailId: true, views: { select: { startedAt: true }, orderBy: { startedAt: "desc" } } }, orderBy: { createdAt: "asc" } } },
      },
      renewalOf: { select: { id: true, name: true } },
      renewals: { select: { id: true, name: true, stage: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!deal) notFound();

  const canCost = can(user, "deals:cost");
  const [options, cost, team] = await Promise.all([
    getFormOptions(),
    // El costo es confidencial: solo se consulta si el usuario tiene el permiso
    canCost ? prisma.deal.findUnique({ where: { id }, select: { developmentCost: true, extraExpense: true } }) : null,
    prisma.teamMember.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
  ]);
  const canWrite = can(user, "deals:write");
  const canEmail = can(user, "emails:send") && emailConfigured();
  const editing = edit === "1" && canWrite;
  const weighted = (toNumber(deal.amount) * deal.stage.probability) / 100;
  const renewal = renewalAlert(deal.renewalDate);

  return (
    <div>
      <div className="mb-2 text-sm">
        <Link href="/negocios" className="text-slate-500 hover:underline">← Negocios</Link>
      </div>
      <PageHeader
        title={deal.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <LineBadge line={deal.businessLine} />
            <span>{formatMoney(deal.amount)} sin IVA · Ponderado {formatMoney(weighted)} ({deal.stage.probability}%)</span>
            {recurringLabel(deal.recurringMonthly, deal.recurringAnnual) && (
              <span className="badge bg-accent-100 text-brand-800" title="Servicio recurrente (sin IVA). El valor del negocio es el del primer año.">
                {recurringLabel(deal.recurringMonthly, deal.recurringAnnual)}
              </span>
            )}
          </span>
        }
        actions={
          (canWrite || canEmail) && (
            <>
              {canEmail && (
                <Link href={`/correos/nuevo?dealId=${id}${deal.contactId ? `&contactId=${deal.contactId}` : ""}`} className="btn btn-primary">
                  Enviar correo
                </Link>
              )}
              {canWrite && <Link href={editing ? `/negocios/${id}` : `/negocios/${id}?edit=1`} className="btn">
                {editing ? "Cancelar edición" : "Editar"}
              </Link>}
              {can(user, "deals:delete") && (
                <form action={deleteDeal.bind(null, id)}>
                  <ConfirmButton message="¿Eliminar este negocio y todo su historial?">Eliminar</ConfirmButton>
                </form>
              )}
            </>
          )
        }
      />

      <div className="card mb-4 p-3">
        <StageBar
          dealId={id}
          currentId={deal.stageId}
          stages={options.stages.map(({ id, name, isWon, isLost }) => ({ id, name, isWon, isLost }))}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <div className="card p-4">
            {editing ? (
              <DealForm action={updateDeal.bind(null, id)} options={options} deal={deal} hasItems={deal.items.length > 0} />
            ) : (
              <dl>
                <InfoRow label="Etapa">{deal.stage.name}</InfoRow>
                <InfoRow label="Valor (sin IVA)">{formatMoneyExact(deal.amount)}</InfoRow>
                <InfoRow label="Fecha de cierre">{formatDate(deal.closeDate)}</InfoRow>
                <InfoRow label="Propietario">{deal.owner?.name}</InfoRow>
                <InfoRow label="Empresa">
                  {deal.company && <Link className="link" href={`/empresas/${deal.company.id}`}>{deal.company.name}</Link>}
                </InfoRow>
                <InfoRow label="Contacto">
                  {deal.contact && <Link className="link" href={`/contactos/${deal.contact.id}`}>{contactName(deal.contact)}</Link>}
                </InfoRow>
                {(deal.renewalDate || deal.stage.isWon) && (
                  <InfoRow label="Renovación">
                    {deal.renewalDate ? (
                      <span className="flex flex-wrap items-center gap-2">
                        {formatDate(deal.renewalDate)}
                        {deal.renewals.length === 0 && renewal && <Semaforo level={renewal.level} label={renewal.label} />}
                      </span>
                    ) : (
                      <span className="text-slate-400">Sin fecha (edita el negocio si es un servicio recurrente)</span>
                    )}
                    {deal.renewals.map((r) => (
                      <Link key={r.id} href={`/negocios/${r.id}`} className="link mt-1 block text-xs">↻ {r.name} · {r.stage.name}</Link>
                    ))}
                    {canWrite && deal.renewalDate && deal.renewals.length === 0 && (
                      <form action={createRenewalNow.bind(null, id)} className="mt-1">
                        <button className="btn btn-sm">Crear negocio de renovación</button>
                      </form>
                    )}
                  </InfoRow>
                )}
                {deal.renewalOf && (
                  <InfoRow label="Renovación de">
                    <Link className="link" href={`/negocios/${deal.renewalOf.id}`}>{deal.renewalOf.name}</Link>
                  </InfoRow>
                )}
                <InfoRow label="Fecha de creación">{formatLocalDate(deal.createdAt)}</InfoRow>
                <InfoRow label="En la etapa actual desde">{formatLocalDate(deal.stageChangedAt)}</InfoRow>
                {deal.lostReason && <InfoRow label="Motivo de pérdida">{deal.lostReason}</InfoRow>}
                {deal.description && (
                  <InfoRow label="Descripción"><span className="whitespace-pre-line">{deal.description}</span></InfoRow>
                )}
              </dl>
            )}
          </div>
          {deal.company && normalize(deal.businessLine?.name ?? "") === "rutalink" && (
            <GpsboxCard company={deal.company} contact={deal.contact} canEdit={canWrite} />
          )}
          {deal.businessLine && (
            <CustomFieldsCard
              title={`Datos del proyecto · ${deal.businessLine.name}`}
              fields={parseCustomFields(deal.businessLine.customFields)}
              values={parseCustomData(deal.customData)}
              users={options.users}
              team={team}
              action={updateDealCustomData.bind(null, id)}
              canEdit={can(user, "deals:write") || can(user, "deals:production")}
            />
          )}
          {/* Debajo de los datos del proyecto (después de «Avance») */}
          {canCost && (
            <DealCostCard
              amount={toNumber(deal.amount)}
              cost={cost?.developmentCost == null ? null : toNumber(cost.developmentCost)}
              extra={cost?.extraExpense == null ? null : toNumber(cost.extraExpense)}
              action={updateDealCost.bind(null, id)}
            />
          )}
        </div>

        <div className="space-y-4 lg:col-span-2">
          <QuotesCard
            dealId={id}
            // La aceptada va primero; las demás, debajo
            quotes={[...deal.quotes].sort((a, b) => Number(b.status === "APROBADA") - Number(a.status === "APROBADA"))}
            canWrite={canWrite}
            canAccept={canWrite || can(user, "deals:production")}
            baseUrl={appUrl()}
            contactEmail={deal.contact?.email ?? null}
            contactPhone={deal.contact?.phone ?? null}
            contactFirstName={deal.contact?.firstName ?? null}
            emailEnabled={emailConfigured()}
          />

          <ActivityPanel
            zoomEnabled={zoomConfigured()}
            emailEnabled={emailConfigured()}
            canMeet={can(user, "meetings:schedule")}
            viewerId={user.id}
            target={{ dealId: id }}
            activities={deal.activities}
            users={options.users}
            canWrite={can(user, "activities:write")}
            contact={deal.contact && { name: contactName(deal.contact), email: deal.contact.email, phone: deal.contact.phone }}
          />
        </div>
      </div>
    </div>
  );
}
