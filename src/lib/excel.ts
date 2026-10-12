import "server-only";
import ExcelJS from "exceljs";

export type SheetColumn = { header: string; key: string; width?: number; money?: boolean; date?: boolean };
export type Sheet = { name: string; columns: SheetColumn[]; rows: Record<string, unknown>[] };

/** Arma un archivo Excel (.xlsx) con una hoja por tabla, con encabezados en los colores de e-grow. */
export async function buildWorkbook(sheets: Sheet[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "CRM e-grow";
  wb.created = new Date();
  for (const s of sheets) {
    // Excel no admite algunos caracteres y más de 31 letras en el nombre de la hoja
    const ws = wb.addWorksheet(s.name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
    ws.columns = s.columns.map((c) => ({
      header: c.header,
      key: c.key,
      width: c.width ?? Math.min(50, Math.max(10, c.header.length + 2)),
      style: c.money ? { numFmt: '"$"#,##0.00' } : c.date ? { numFmt: "dd/mm/yyyy hh:mm" } : {},
    }));
    ws.addRows(s.rows);
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1C315E" } };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    if (s.rows.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: s.columns.length } };
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function xlsxResponse(buffer: Buffer, filename: string) {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
