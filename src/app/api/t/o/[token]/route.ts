import { after } from "next/server";
import { recordOpen } from "@/lib/client-email";

export const dynamic = "force-dynamic";

// GIF transparente de 1×1
const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

/** Píxel de apertura de los correos enviados desde el CRM. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (/^[A-Za-z0-9_-]{16,40}$/.test(token)) {
    const ua = req.headers.get("user-agent");
    after(() => recordOpen(token, ua).catch((e) => console.error("Apertura", e)));
  }
  return new Response(new Uint8Array(GIF), {
    headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache, must-revalidate, private", "X-Robots-Tag": "noindex" },
  });
}
