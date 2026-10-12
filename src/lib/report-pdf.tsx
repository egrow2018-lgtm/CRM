import "server-only";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { LOGO_DATA_URI } from "./logo-data";
import {
  MONTHS,
  avgDaysToWin,
  byOwner,
  leadsByMonthAndSource,
  lostReasons,
  openPipelineByStage,
  quoteConversion,
  quotesByMonthAndLine,
  sumCells,
  topClients,
  topProducts,
  winLossByYear,
  wonByYearAndLine,
  type Cell,
  type RDeal,
  type RLead,
  type RQuote,
} from "./reports";

const NAVY = "#1c315e";
const GREEN = "#b9d43a";
const MUTED = "#64748b";
const money = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("es-EC");
const pct = (v: number | null) => (v == null ? "—" : `${v.toLocaleString("es-EC")} %`);
const cell = (c: Cell | undefined) => (c && c.count ? `${money.format(c.amount)} (${c.count})` : "—");

const s = StyleSheet.create({
  page: { padding: 28, paddingBottom: 44, fontSize: 8, fontFamily: "Helvetica", color: "#1e293b" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  logo: { width: 95 },
  bar: { height: 3, backgroundColor: GREEN, marginTop: 8, marginBottom: 10 },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", color: NAVY },
  subtitle: { fontSize: 8.5, color: MUTED, textAlign: "right" },
  kpis: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  kpi: { width: "24%", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 4, padding: 6 },
  kpiLabel: { fontSize: 6.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4 },
  kpiValue: { fontSize: 13, fontFamily: "Helvetica-Bold", color: NAVY, marginTop: 2 },
  kpiHint: { fontSize: 6.5, color: MUTED },
  h2: { fontSize: 10, fontFamily: "Helvetica-Bold", color: NAVY, marginTop: 10, marginBottom: 2 },
  hint: { fontSize: 7, color: MUTED, marginBottom: 4 },
  th: { flexDirection: "row", backgroundColor: NAVY, color: "#ffffff", fontFamily: "Helvetica-Bold", paddingVertical: 4, paddingHorizontal: 4 },
  tr: { flexDirection: "row", paddingVertical: 3.5, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  total: { fontFamily: "Helvetica-Bold", backgroundColor: "#f1f5f9" },
  footer: { position: "absolute", bottom: 18, left: 28, right: 28, fontSize: 7, color: MUTED, textAlign: "center", borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 4 },
});

type Col = { label: string; width?: number; align?: "right" };
function Table({ cols, rows, totalRow }: { cols: Col[]; rows: string[][]; totalRow?: string[] }) {
  const cellStyle = (c: Col) => ({ flex: c.width ? undefined : 1, width: c.width, textAlign: c.align ?? ("left" as const), paddingRight: 3 });
  return (
    <View>
      <View style={s.th} fixed>
        {cols.map((c, i) => <Text key={i} style={cellStyle(c)}>{c.label}</Text>)}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={s.tr} wrap={false}>
          {r.map((v, j) => <Text key={j} style={cellStyle(cols[j]!)}>{v}</Text>)}
        </View>
      ))}
      {rows.length === 0 && <View style={s.tr}><Text style={{ color: MUTED }}>Sin datos.</Text></View>}
      {totalRow && (
        <View style={[s.tr, s.total]} wrap={false}>
          {totalRow.map((v, j) => <Text key={j} style={cellStyle(cols[j]!)}>{v}</Text>)}
        </View>
      )}
    </View>
  );
}

const Section = ({ title, hint, children, breakBefore }: { title: string; hint?: string; children: React.ReactNode; breakBefore?: boolean }) => (
  <View break={breakBefore} wrap>
    <Text style={s.h2} minPresenceAhead={60}>{title}</Text>
    {hint ? <Text style={s.hint}>{hint}</Text> : null}
    {children}
  </View>
);

export async function renderReportsPdf(input: {
  year: number;
  lineName: string | null;
  lines: { id: string; name: string }[];
  deals: RDeal[];
  quotes: RQuote[];
  leads: RLead[];
}) {
  const { year, deals, quotes, leads, lines } = input;
  const lineIds = lines.map((l) => l.id);
  const cols = lines.map((l) => [l.id, l.name] as const).concat(input.lineName ? [] : [["none", "Sin línea"] as const]);
  const wonYears = wonByYearAndLine(deals, lineIds);
  const quoteMonths = quotesByMonthAndLine(quotes, year, lineIds);
  const winLoss = winLossByYear(deals);
  const wl = winLoss.find((r) => r.year === year);
  const pipeline = openPipelineByStage(deals);
  const owners = byOwner(deals, quotes, year);
  const conv = quoteConversion(quotes, year);
  const days = avgDaysToWin(deals, year);
  const leadRows = leadsByMonthAndSource(leads, year);
  const quoteTotal = sumCells(quoteMonths.map((m) => m.total));
  const open = pipeline.reduce((t, p) => ({ amount: t.amount + p.amount, weighted: t.weighted + p.weighted }), { amount: 0, weighted: 0 });
  const generated = new Date().toLocaleString("es-EC", { timeZone: "America/Guayaquil", dateStyle: "long", timeStyle: "short" });
  const scope = `Año ${year} · ${input.lineName ?? "todas las líneas de negocio"}`;

  const kpis: [string, string, string][] = [
    ["Vendido (ganado)", money.format(wl?.won.amount ?? 0), `${wl?.won.count ?? 0} negocios`],
    ["Perdido", money.format(wl?.lost.amount ?? 0), `${wl?.lost.count ?? 0} negocios`],
    ["Tasa de cierre", pct(wl?.rate ?? null), "ganados / (ganados + perdidos)"],
    ["Cotizaciones", num.format(quoteTotal.count), money.format(quoteTotal.amount)],
    ["Cotizaciones ganadas", pct(conv.rate), `${conv.won} de ${conv.quotes}`],
    ["Días promedio para ganar", days.avg == null ? "—" : num.format(days.avg), "desde que se crea el negocio"],
    ["Pipeline abierto", money.format(open.amount), `ponderado ${money.format(open.weighted)}`],
    ["Leads nuevos", num.format(leadRows.reduce((t, r) => t + r.total, 0)), "contactos creados en el año"],
  ];
  const matrixCols: Col[] = [{ label: "", width: 42 }, ...cols.map(([, name]) => ({ label: name, align: "right" as const })), { label: "Total", align: "right" }];

  const doc = (
    <Document title={`Reportes CRM e-grow – ${scope}`} author="e-grow">
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={LOGO_DATA_URI} style={s.logo} />
          <View>
            <Text style={[s.title, { textAlign: "right" }]}>Reportes comerciales</Text>
            <Text style={s.subtitle}>{scope}</Text>
          </View>
        </View>
        <View style={s.bar} />

        <View style={s.kpis}>
          {kpis.map(([label, value, hint]) => (
            <View key={label} style={s.kpi}>
              <Text style={s.kpiLabel}>{label}</Text>
              <Text style={s.kpiValue}>{value}</Text>
              <Text style={s.kpiHint}>{hint}</Text>
            </View>
          ))}
        </View>

        <Section title="Ventas ganadas por año y línea de negocio" hint="Monto ganado y (número de negocios), por año de cierre.">
          <Table
            cols={[{ ...matrixCols[0]!, label: "Año" }, ...matrixCols.slice(1)]}
            rows={wonYears.map((r) => [String(r.year), ...cols.map(([id]) => cell(r.cells.get(id))), cell(r.total)])}
          />
        </Section>

        <Section title={`Cotizaciones por mes y línea de negocio (${year})`} hint="Monto cotizado y (número de cotizaciones), por mes de emisión." breakBefore>
          <Table
            cols={[{ ...matrixCols[0]!, label: "Mes" }, ...matrixCols.slice(1)]}
            rows={quoteMonths.map((r) => [MONTHS[r.month]!, ...cols.map(([id]) => cell(r.cells.get(id))), cell(r.total)])}
            totalRow={["Total", ...cols.map(([id]) => cell(sumCells(quoteMonths.map((m) => m.cells.get(id) ?? { count: 0, amount: 0 })))), cell(quoteTotal)]}
          />
        </Section>

        <View style={{ flexDirection: "row", gap: 14 }}>
          <View style={{ flex: 1 }}>
            <Section title="Ganados vs perdidos" hint="Por año de cierre.">
              <Table
                cols={[{ label: "Año", width: 34 }, { label: "Ganados", align: "right" }, { label: "Perdidos", align: "right" }, { label: "Tasa", width: 40, align: "right" }]}
                rows={winLoss.map((r) => [String(r.year), cell(r.won), cell(r.lost), pct(r.rate)])}
              />
            </Section>
          </View>
          <View style={{ flex: 1 }}>
            <Section title="Pipeline abierto por etapa" hint="Negocios en curso al generar el reporte.">
              <Table
                cols={[{ label: "Etapa" }, { label: "Negocios", width: 42, align: "right" }, { label: "Monto", width: 60, align: "right" }, { label: "Ponderado", width: 60, align: "right" }]}
                rows={pipeline.map((p) => [`${p.stage} (${p.probability}%)`, String(p.count), money.format(p.amount), money.format(p.weighted)])}
              />
            </Section>
          </View>
        </View>

        <Section title={`Desempeño por responsable (${year})`} breakBefore>
          <Table
            cols={[{ label: "Responsable" }, { label: "Ganados", align: "right" }, { label: "Perdidos", align: "right" }, { label: "Tasa", width: 40, align: "right" }, { label: "Cotizaciones", align: "right" }, { label: "Pipeline abierto", align: "right" }]}
            rows={owners.map((o) => [o.owner, cell(o.won), cell(o.lost), pct(o.rate), cell(o.quotes), cell(o.open)])}
          />
        </Section>

        <View style={{ flexDirection: "row", gap: 14 }}>
          <View style={{ flex: 1 }}>
            <Section title={`Top 10 clientes (${year})`}>
              <Table
                cols={[{ label: "Cliente" }, { label: "Negocios", width: 42, align: "right" }, { label: "Monto", width: 64, align: "right" }]}
                rows={topClients(deals, year).map((c) => [c.client, String(c.count), money.format(c.amount)])}
              />
            </Section>
          </View>
          <View style={{ flex: 1 }}>
            <Section title={`Productos y servicios vendidos (${year})`}>
              <Table
                cols={[{ label: "Producto / servicio" }, { label: "Cant.", width: 34, align: "right" }, { label: "Monto", width: 64, align: "right" }]}
                rows={topProducts(deals, year, 10).map((p) => [p.product, num.format(p.quantity), money.format(p.amount)])}
              />
            </Section>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 14 }}>
          <View style={{ flex: 1 }}>
            <Section title={`Motivos de pérdida (${year})`}>
              <Table
                cols={[{ label: "Motivo" }, { label: "Negocios", width: 42, align: "right" }, { label: "Monto", width: 64, align: "right" }]}
                rows={lostReasons(deals, year).map((r) => [r.reason, String(r.count), money.format(r.amount)])}
              />
            </Section>
          </View>
          <View style={{ flex: 1.4 }}>
            <Section title={`Leads nuevos por origen (${year})`}>
              <Table
                cols={[{ label: "Origen" }, ...MONTHS.map((m) => ({ label: m, width: 20, align: "right" as const })), { label: "Total", width: 28, align: "right" }]}
                rows={leadRows.map((r) => [r.source, ...r.months.map((n) => (n ? String(n) : "·")), String(r.total)])}
              />
            </Section>
          </View>
        </View>

        <Text
          style={s.footer}
          render={({ pageNumber, totalPages }) => `CRM e-grow · ${scope} · Generado el ${generated} · Página ${pageNumber} de ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
