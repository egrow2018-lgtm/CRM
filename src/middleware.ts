import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export async function middleware(req: NextRequest) {
  // Formularios y cotizaciones públicas, y tareas programadas (protegidas con CRON_SECRET)
  const path = req.nextUrl.pathname;
  if (path.startsWith("/f/") || path.startsWith("/c/") || path.startsWith("/api/cron/")) return NextResponse.next();
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const isLogin = req.nextUrl.pathname === "/login";
  if (!session && !isLogin) {
    const url = new URL("/login", req.url);
    if (req.nextUrl.pathname !== "/") url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  if (session && isLogin) return NextResponse.redirect(new URL("/", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|ico)$).*)"],
};
