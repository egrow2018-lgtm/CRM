import "server-only";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { LOGO_DATA_URI } from "./logo-data";
import { BILLING, DEFAULT_TERM_MONTHS, type QuoteSnapshot } from "./quotes";
import { EGROW_ACCENT, EGROW_PRIMARY, textOn } from "./brand";

const MUTED = "#64748b";

const money = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const date = new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Guayaquil" });

const s = StyleSheet.create({
  page: { padding: 40, paddingBottom: 60, fontSize: 9.5, fontFamily: "Helvetica", color: "#1e293b" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logo: { width: 130 },
  company: { textAlign: "right", fontSize: 8.5, color: MUTED, lineHeight: 1.4 },
  bar: { height: 4, marginTop: 14, marginBottom: 16 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold" },
  code: { fontSize: 11, fontFamily: "Helvetica-Bold", textAlign: "right" },
  meta: { fontSize: 8.5, color: MUTED, textAlign: "right", marginTop: 2 },
  boxes: { flexDirection: "row", gap: 12, marginBottom: 16 },
  box: { flex: 1, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 4, padding: 8 },
  boxLabel: { fontSize: 7.5, color: MUTED, textTransform: "uppercase", marginBottom: 3, letterSpacing: 0.5 },
  bold: { fontFamily: "Helvetica-Bold" },
  th: { flexDirection: "row", fontFamily: "Helvetica-Bold", fontSize: 8.5, paddingVertical: 6, paddingHorizontal: 6 },
  tr: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  cDesc: { flex: 1 },
  cQty: { width: 45, textAlign: "right" },
  cPrice: { width: 75, textAlign: "right" },
  cDisc: { width: 45, textAlign: "right" },
  cTotal: { width: 80, textAlign: "right" },
  totals: { alignSelf: "flex-end", width: 230, marginTop: 10 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  grand: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, paddingHorizontal: 6, marginTop: 4, fontFamily: "Helvetica-Bold", fontSize: 11 },
  section: { marginTop: 18 },
  sectionTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 7.5, color: MUTED, textAlign: "center", borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 6 },
});

export function QuoteDocument({ code, createdAt, validUntil, q }: { code: string; createdAt: Date; validUntil: Date; q: QuoteSnapshot }) {
  const c = q.company;
  // Marca: la de la línea (ej. Rutalink) o la de e-grow
  const b = q.brand;
  const primary = b?.primary ?? EGROW_PRIMARY;
  const accent = b?.accent ?? EGROW_ACCENT;
  const onAccent = b ? textOn(accent) : EGROW_PRIMARY;
  const brandName = b?.name ?? c.name;
  const website = b?.website ?? c.website;
  // Logos claros: el encabezado va sobre un fondo de color
  const headerBg = b?.headerBg ?? null;
  const headerText = headerBg ? textOn(headerBg) : null;
  return (
    <Document title={`${code} – ${q.dealName}`} author={brandName}>
      <Page size="A4" style={s.page}>
        <View style={[s.header, headerBg ? { backgroundColor: headerBg, margin: -40, marginBottom: 0, padding: 24, paddingHorizontal: 40 } : {}]}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={b?.logo ?? LOGO_DATA_URI} style={[s.logo, { maxHeight: 60, objectFit: "contain" }]} />
          <View style={[s.company, headerText ? { color: headerText } : {}]}>
            {b ? <Text style={[s.bold, { color: headerText ?? primary, fontSize: 11 }]}>{b.name}</Text> : null}
            <Text style={[s.bold, { color: headerText ?? (b ? "#334155" : primary), fontSize: b ? 8.5 : 10 }]}>{c.legalName || c.name}</Text>
            {c.taxId ? <Text>RUC: {c.taxId}</Text> : null}
            {c.address ? <Text>{c.address}</Text> : null}
            {c.phone ? <Text>{c.phone}</Text> : null}
            {c.email ? <Text>{c.email}</Text> : null}
            {website ? <Text>{website}</Text> : null}
          </View>
        </View>
        <View style={[s.bar, { backgroundColor: accent }, headerBg ? { marginTop: 0, marginHorizontal: -40 } : {}]} />

        <View style={s.titleRow}>
          <Text style={[s.title, { color: primary }]}>Cotización</Text>
          <View>
            <Text style={[s.code, { color: primary }]}>{code}</Text>
            <Text style={s.meta}>Fecha: {date.format(createdAt)}</Text>
            <Text style={s.meta}>Válida hasta: {date.format(validUntil)}</Text>
          </View>
        </View>

        <View style={s.boxes}>
          <View style={s.box}>
            <Text style={s.boxLabel}>Cliente</Text>
            <Text style={s.bold}>{q.client.company ?? q.client.contact ?? "—"}</Text>
            {q.client.company && q.client.contact ? <Text>Atención: {q.client.contact}</Text> : null}
            {q.client.taxId ? <Text>RUC: {q.client.taxId}</Text> : null}
            {q.client.email ? <Text>{q.client.email}</Text> : null}
            {q.client.phone ? <Text>Tel.: {q.client.phone}</Text> : null}
          </View>
          <View style={s.box}>
            <Text style={s.boxLabel}>Proyecto</Text>
            <Text style={s.bold}>{q.dealName}</Text>
            {q.owner ? (
              <>
                <Text style={[s.boxLabel, { marginTop: 6 }]}>Asesor comercial</Text>
                <Text>{q.owner.name}</Text>
                <Text>{q.owner.email}</Text>
              </>
            ) : null}
          </View>
        </View>

        <View style={[s.th, { backgroundColor: primary, color: textOn(primary) }]}>
          <Text style={s.cDesc}>Descripción</Text>
          <Text style={s.cQty}>Cant.</Text>
          <Text style={s.cPrice}>Precio unit.</Text>
          <Text style={s.cDisc}>Desc.</Text>
          <Text style={s.cTotal}>Subtotal</Text>
        </View>
        {q.items.map((it, i) => (
          <View key={i} style={s.tr} wrap={false}>
            <View style={s.cDesc}>
              <Text>{it.description}</Text>
              {it.detail ? <Text style={{ color: MUTED, fontSize: 8 }}>{it.detail}</Text> : null}
              {it.billing && it.billing !== "UNICO" ? (
                <Text style={{ color: MUTED, fontSize: 8 }}>
                  {BILLING[it.billing].label} · contrato de {it.termMonths ?? DEFAULT_TERM_MONTHS} meses
                </Text>
              ) : null}
            </View>
            <Text style={s.cQty}>{it.quantity}</Text>
            <Text style={s.cPrice}>{money.format(it.unitPrice)}{it.billing ? BILLING[it.billing].per : ""}</Text>
            <Text style={s.cDisc}>{it.discount ? `${it.discount}%` : "—"}</Text>
            <Text style={s.cTotal}>{money.format(it.subtotal)}{it.billing ? BILLING[it.billing].per : ""}</Text>
          </View>
        ))}

        <View style={s.totals} wrap={false}>
          {q.discountTotal > 0 ? (
            <View style={s.totalRow}>
              <Text style={{ color: MUTED }}>Descuentos</Text>
              <Text>-{money.format(q.discountTotal)}</Text>
            </View>
          ) : null}
          {q.monthly !== undefined ? (
            <>
              <View style={s.totalRow}>
                <Text style={{ color: MUTED }}>Inversión inicial</Text>
                <Text>{money.format(q.oneTime ?? 0)}</Text>
              </View>
              {(q.monthly ?? 0) > 0 ? (
                <View style={s.totalRow}>
                  <Text style={{ color: primary }}>Mensualidad (más IVA)</Text>
                  <Text style={{ color: primary }}>{money.format(q.monthly ?? 0)}/mes</Text>
                </View>
              ) : null}
              {(q.annual ?? 0) > 0 ? (
                <View style={s.totalRow}>
                  <Text style={{ color: primary }}>Anualidad (más IVA)</Text>
                  <Text style={{ color: primary }}>{money.format(q.annual ?? 0)}/año</Text>
                </View>
              ) : null}
            </>
          ) : null}
          <View style={s.totalRow}>
            <Text style={{ color: MUTED }}>{q.monthly !== undefined ? "Subtotal primer año" : "Subtotal"}</Text>
            <Text>{money.format(q.subtotal)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={{ color: MUTED }}>IVA {q.ivaPercent}%</Text>
            <Text>{money.format(q.iva)}</Text>
          </View>
          <View style={[s.grand, { backgroundColor: accent, color: onAccent }]}>
            <Text>{q.monthly !== undefined ? "TOTAL PRIMER AÑO" : "TOTAL"}</Text>
            <Text>{money.format(q.total)}</Text>
          </View>
        </View>

        {q.notes ? (
          <View style={s.section} wrap={false}>
            <Text style={[s.sectionTitle, { color: primary }]}>Observaciones</Text>
            <Text>{q.notes}</Text>
          </View>
        ) : null}
        {q.conditions ? (
          <View style={s.section} wrap={false}>
            <Text style={[s.sectionTitle, { color: primary }]}>Condiciones comerciales</Text>
            {q.conditions.split("\n").filter(Boolean).map((line, i) => (
              <Text key={i} style={{ marginBottom: 2 }}>• {line}</Text>
            ))}
            <Text style={{ marginTop: 2 }}>• Esta cotización es válida por {q.validityDays} días.</Text>
          </View>
        ) : null}

        <Text
          style={s.footer}
          render={({ pageNumber, totalPages }) => `${brandName}${website ? ` · ${website}` : ""} · ${code} · Página ${pageNumber} de ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}

export async function renderQuotePdf(quote: { year: number; number: number; createdAt: Date; validUntil: Date; snapshot: unknown }) {
  const { quoteCode } = await import("./quotes");
  const render = (q: QuoteSnapshot) =>
    renderToBuffer(<QuoteDocument code={quoteCode(quote.year, quote.number)} createdAt={quote.createdAt} validUntil={quote.validUntil} q={q} />);
  const snap = quote.snapshot as QuoteSnapshot;
  try {
    return await render(snap);
  } catch (e) {
    // Si el logo de la marca no se puede leer, la cotización sale igual con el logo de e-grow
    if (!snap.brand?.logo) throw e;
    console.error("No se pudo usar el logo de la marca en la cotización; se usa el de e-grow", e);
    return render({ ...snap, brand: { ...snap.brand, logo: null } });
  }
}
