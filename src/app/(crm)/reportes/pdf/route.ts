import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { loadReportData } from "@/lib/report-data";
import { renderReportsPdf } from "@/lib/report-pdf";
import { utcToZoned } from "@/lib/timezone";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Descarga en PDF los reportes de la página, con el año y la línea elegidos. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user, "reports:view")) return new Response("No autorizado", { status: 403 });
  const url = new URL(req.url);
  const lineId = url.searchParams.get("line") || undefined;
  const year = Number(url.searchParams.get("year")) || Number(utcToZoned(new Date()).date.slice(0, 4));
  const { deals, quotes, leads, lines } = await loadReportData(lineId);
  const lineName = lineId ? (lines[0]?.name ?? null) : null;
  const pdf = await renderReportsPdf({ year, lineName, lines, deals, quotes, leads });
  const suffix = lineName ? `-${lineName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : "";
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="reportes-${year}${suffix}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
