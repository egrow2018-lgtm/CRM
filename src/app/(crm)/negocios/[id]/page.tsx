import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getFormOptions } from "@/lib/queries";
import { contactName, formatDate, formatMoney, formatMoneyExact, toNumber } from "@/lib/format";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/action-form";
import { ActivityPanel } from "@/components/activity-panel";
import { zoomConfigured } from "@/lib/zoom";
import { InfoRow, LineBadge, PageHeader } from "@/components/ui";
import { DealForm } from "../deal-form";
import { StageBar } from "../stage-bar";
import { addDealItem, deleteDeal, removeDealItem, updateDeal, updateDealCustomData } from "../actions";
import { CustomFieldsCard } from "@/components/custom-fields-form";
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
      activities: { include: { author: true, assignee: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!deal) notFound();

  const options = await getFormOptions();
  const products = await prisma.product.findMany({
    where: { active: true },
    include: { businessLine: true },
    orderBy: [{ businessLine: { name: "asc" } }, { name: "asc" }],
  });
  const canWrite = can(user.role, "crm:write");
  const editing = edit === "1" && canWrite;
  const weighted = (toNumber(deal.amount) * deal.stage.probability) / 100;

  // Productos agrupados por línea, mostrando primero la línea del negocio
  const groups = new Map<string, typeof products>();
  for (const p of products) {
    const key = p.businessLine.name;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  const groupEntries = [...groups.entries()].sort(([a], [b]) =>
    a === deal.businessLine?.name ? -1 : b === deal.businessLine?.name ? 1 : a.localeCompare(b),
  );

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
            <span>{formatMoney(deal.amount)} · Ponderado {formatMoney(weighted)} ({deal.stage.probability}%)</span>
          </span>
        }
        actions={
          canWrite && (
            <>
              <Link href={editing ? `/negocios/${id}` : `/negocios/${id}?edit=1`} className="btn">
                {editing ? "Cancelar edición" : "Editar"}
              </Link>
              {can(user.role, "crm:delete") && (
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
                <InfoRow label="Valor">{formatMoneyExact(deal.amount)}</InfoRow>
                <InfoRow label="Fecha de cierre">{formatDate(deal.closeDate)}</InfoRow>
                <InfoRow label="Propietario">{deal.owner?.name}</InfoRow>
                <InfoRow label="Empresa">
                  {deal.company && <Link className="link" href={`/empresas/${deal.company.id}`}>{deal.company.name}</Link>}
                </InfoRow>
                <InfoRow label="Contacto">
                  {deal.contact && <Link className="link" href={`/contactos/${deal.contact.id}`}>{contactName(deal.contact)}</Link>}
                </InfoRow>
                <InfoRow label="Fecha de creación">{formatDate(deal.createdAt)}</InfoRow>
                <InfoRow label="En la etapa actual desde">{formatDate(deal.stageChangedAt)}</InfoRow>
                {deal.lostReason && <InfoRow label="Motivo de pérdida">{deal.lostReason}</InfoRow>}
                {deal.description && (
                  <InfoRow label="Descripción"><span className="whitespace-pre-line">{deal.description}</span></InfoRow>
                )}
              </dl>
            )}
          </div>
          {deal.businessLine && (
            <CustomFieldsCard
              title={`Datos del proyecto · ${deal.businessLine.name}`}
              fields={parseCustomFields(deal.businessLine.customFields)}
              values={parseCustomData(deal.customData)}
              users={options.users}
              action={updateDealCustomData.bind(null, id)}
              canEdit={can(user.role, "crm:write") || can(user.role, "deals:production")}
            />
          )}
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div className="card p-4">
            <h2 className="mb-3 text-base">Productos y servicios</h2>
            {deal.items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Descripción</th>
                      <th className="text-right">Cant.</th>
                      <th className="text-right">Precio unit.</th>
                      <th className="text-right">Desc. %</th>
                      <th className="text-right">Subtotal</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {deal.items.map((it) => {
                      const subtotal = toNumber(it.quantity) * toNumber(it.unitPrice) * (1 - toNumber(it.discount) / 100);
                      return (
                        <tr key={it.id}>
                          <td>
                            {it.description}
                            {it.product && <div className="text-xs text-slate-400">{it.product.businessLine.name}</div>}
                          </td>
                          <td className="text-right tabular-nums">{toNumber(it.quantity)}</td>
                          <td className="text-right tabular-nums">{formatMoneyExact(it.unitPrice)}</td>
                          <td className="text-right tabular-nums">{toNumber(it.discount)}</td>
                          <td className="text-right font-medium tabular-nums">{formatMoneyExact(subtotal)}</td>
                          <td className="text-right">
                            {canWrite && (
                              <form action={removeDealItem.bind(null, it.id)}>
                                <button className="text-xs text-slate-400 hover:text-red-600">Quitar</button>
                              </form>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    <tr>
                      <td colSpan={4} className="text-right font-semibold">Total</td>
                      <td className="text-right font-semibold tabular-nums">{formatMoneyExact(deal.amount)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mb-2 text-sm text-slate-500">
                Sin productos. Al agregar productos, el valor del negocio se calcula automáticamente.
              </p>
            )}
            {canWrite && (
              <ActionForm action={addDealItem.bind(null, id)} resetOnSuccess className="mt-3 grid gap-2 sm:grid-cols-12">
                <select name="productId" className="input sm:col-span-4" defaultValue="">
                  <option value="">— Producto del catálogo —</option>
                  {groupEntries.map(([line, items]) => (
                    <optgroup key={line} label={line}>
                      {items.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}{toNumber(p.unitPrice) > 0 ? ` · ${formatMoney(p.unitPrice)}` : ""}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <input name="description" placeholder="Descripción (opcional)" className="input sm:col-span-3" />
                <input name="quantity" type="number" step="0.01" min="0" placeholder="Cant." defaultValue="1" className="input sm:col-span-1" />
                <input name="unitPrice" type="number" step="0.01" min="0" placeholder="Precio" className="input sm:col-span-2" title="Vacío = precio del catálogo" />
                <input name="discount" type="number" step="0.01" min="0" max="100" placeholder="Desc %" className="input sm:col-span-1" />
                <SubmitButton className="btn btn-primary sm:col-span-1" pendingText="…">+</SubmitButton>
              </ActionForm>
            )}
          </div>

          <ActivityPanel
            zoomEnabled={zoomConfigured()}
            viewerId={user.id}
            target={{ dealId: id }}
            activities={deal.activities}
            users={options.users}
            canWrite={can(user.role, "activities:write")}
            contact={deal.contact && { name: contactName(deal.contact), email: deal.contact.email, phone: deal.contact.phone }}
          />
        </div>
      </div>
    </div>
  );
}
