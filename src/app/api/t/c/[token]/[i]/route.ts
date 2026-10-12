import { recordClick } from "@/lib/client-email";
import { appUrl } from "@/lib/email";

export const dynamic = "force-dynamic";

/** Enlace de un correo enviado desde el CRM: cuenta el clic y lleva al destino. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string; i: string }> }) {
  const { token, i } = await params;
  const index = Number(i);
  const url =
    /^[A-Za-z0-9_-]{16,40}$/.test(token) && Number.isInteger(index) && index >= 0
      ? await recordClick(token, index, req.headers.get("user-agent")).catch((e) => {
          console.error("Clic", e);
          return null;
        })
      : null;
  // Solo se redirige a destinos guardados al enviar el correo (no es un redirector abierto)
  return Response.redirect(url && /^https?:\/\//.test(url) ? url : appUrl(), 302);
}
