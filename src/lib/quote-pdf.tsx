import "server-only";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { LOGO_DATA_URI } from "./logo-data";
import type { QuoteSnapshot } from "./quotes";

const NAVY = "#1c315e";
const GREEN = "#b9d43a";
const MUTED = "#64748b";

const money = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const date = new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Guayaquil" });

const s = StyleSheet.create({
  page: { padding: 40, paddingBottom: 60, fontSize: 9.5, fontFamily: "Helvetica", color: "#1e293b" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logo: { width: 130 },
  company: { textAlign: "right", fontSize: 8.5, color: MUTED, lineHeight: 1.4 },
  bar: { height: 4, backgroundColor: GREEN, marginTop: 14, marginBottom: 16 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", color: NAVY },
  code: { fontSize: 11, fontFamily: "Helvetica-Bold", color: NAVY, textAlign: "right" },
  meta: { fontSize: 8.5, color: MUTED, textAlign: "right", marginTop: 2 },
  boxes: { flexDirection: "row", gap: 12, marginBottom: 16 },
  box: { flex: 1, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 4, padding: 8 },
  boxLabel: { fontSize: 7.5, color: MUTED, textTransform: "uppercase", marginBottom: 3, letterSpacing: 0.5 },
  bold: { fontFamily: "Helvetica-Bold" },
  th: { flexDirection: "row", backgroundColor: NAVY, color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 8.5, paddingVertical: 6, paddingHorizontal: 6 },
  tr: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  cDesc: { flex: 1 },
  cQty: { width: 45, textAlign: "right" },
  cPrice: { width: 75, textAlign: "right" },
  cDisc: { width: 45, textAlign: "right" },
  cTotal: { width: 80, textAlign: "right" },
  totals: { alignSelf: "flex-end", width: 230, marginTop: 10 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  grand: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, paddingHorizontal: 6, marginTop: 4, backgroundColor: GREEN, color: NAVY, fontFamily: "Helvetica-Bold", fontSize: 11 },
  section: { marginTop: 18 },
  sectionTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 4 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 7.5, color: MUTED, textAlign: "center", borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 6 },
});

export function QuoteDocument({ code, createdAt, validUntil, q }: { code: string; createdAt: Date; validUntil: Date; q: QuoteSnapshot }) {
  const c = q.company;
  return (
    <Document title={`${code} – ${q.dealName}`} author={c.name}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={LOGO_DATA_URI} style={s.logo} />
          <View style={s.company}>
            <Text style={[s.bold, { color: NAVY, fontSize: 10 }]}>{c.legalName || c.name}</Text>
            {c.taxId ? <Text>RUC: {c.taxId}</Text> : null}
            {c.address ? <Text>{c.address}</Text> : null}
            {c.phone ? <Text>{c.phone}</Text> : null}
            {c.email ? <Text>{c.email}</Text> : null}
            {c.website ? <Text>{c.website}</Text> : null}
          </View>
        </View>
        <View style={s.bar} />

        <View style={s.titleRow}>
          <Text style={s.title}>Cotización</Text>
          <View>
            <Text style={s.code}>{code}</Text>
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

        <View style={s.th}>
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
            </View>
            <Text style={s.cQty}>{it.quantity}</Text>
            <Text style={s.cPrice}>{money.format(it.unitPrice)}</Text>
            <Text style={s.cDisc}>{it.discount ? `${it.discount}%` : "—"}</Text>
            <Text style={s.cTotal}>{money.format(it.subtotal)}</Text>
          </View>
        ))}

        <View style={s.totals} wrap={false}>
          {q.discountTotal > 0 ? (
            <View style={s.totalRow}>
              <Text style={{ color: MUTED }}>Descuentos</Text>
              <Text>-{money.format(q.discountTotal)}</Text>
            </View>
          ) : null}
          <View style={s.totalRow}>
            <Text style={{ color: MUTED }}>Subtotal</Text>
            <Text>{money.format(q.subtotal)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={{ color: MUTED }}>IVA {q.ivaPercent}%</Text>
            <Text>{money.format(q.iva)}</Text>
          </View>
          <View style={s.grand}>
            <Text>TOTAL</Text>
            <Text>{money.format(q.total)}</Text>
          </View>
        </View>

        {q.notes ? (
          <View style={s.section} wrap={false}>
            <Text style={s.sectionTitle}>Observaciones</Text>
            <Text>{q.notes}</Text>
          </View>
        ) : null}
        {q.conditions ? (
          <View style={s.section} wrap={false}>
            <Text style={s.sectionTitle}>Condiciones comerciales</Text>
            {q.conditions.split("\n").filter(Boolean).map((line, i) => (
              <Text key={i} style={{ marginBottom: 2 }}>• {line}</Text>
            ))}
            <Text style={{ marginTop: 2 }}>• Esta cotización es válida por {q.validityDays} días.</Text>
          </View>
        ) : null}

        <Text
          style={s.footer}
          render={({ pageNumber, totalPages }) => `${c.name} · ${c.website} · ${code} · Página ${pageNumber} de ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}

export async function renderQuotePdf(quote: { year: number; number: number; createdAt: Date; validUntil: Date; snapshot: unknown }) {
  const { quoteCode } = await import("./quotes");
  return renderToBuffer(
    <QuoteDocument
      code={quoteCode(quote.year, quote.number)}
      createdAt={quote.createdAt}
      validUntil={quote.validUntil}
      q={quote.snapshot as QuoteSnapshot}
    />,
  );
}
