import { getCurrentUser } from "@/lib/auth";
import { buildProductionReport, getProductionFrequency } from "@/lib/production-report";

export const dynamic = "force-dynamic";

/** Vista previa del reporte de negocios en producción. */
export async function GET() {
  if (!(await getCurrentUser())) return new Response("No autorizado", { status: 401 });
  const report = await buildProductionReport(await getProductionFrequency());
  return new Response(report.html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
