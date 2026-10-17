import { previewQuote } from "../actions";

export const maxDuration = 60;

/** Vista previa en una pestaña nueva (celular y tablet, donde el visor incrustado no funciona bien). No guarda nada. */
export async function POST(req: Request) {
  const res = await previewQuote(await req.formData());
  if ("error" in res) {
    return new Response(`No se pudo armar la vista previa.\n\n${res.error}`, { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  return new Response(new Uint8Array(Buffer.from(res.pdf, "base64")), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="vista-previa.pdf"', "Cache-Control": "no-store" },
  });
}
