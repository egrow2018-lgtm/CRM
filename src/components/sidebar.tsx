"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";
import { can, ROLE_LABELS } from "@/lib/permissions";
import { initials } from "@/lib/format";
import {
  IconCatalog,
  IconCompany,
  IconContacts,
  IconDeals,
  IconHome,
  IconImport,
  IconLogout,
  IconSettings,
  IconTasks,
} from "./icons";

export function Sidebar({ user, logout }: { user: { name: string; role: Role }; logout: () => Promise<void> }) {
  const pathname = usePathname();
  const items = [
    { href: "/", label: "Inicio", icon: IconHome },
    { href: "/negocios", label: "Negocios", icon: IconDeals },
    { href: "/contactos", label: "Contactos", icon: IconContacts },
    { href: "/empresas", label: "Empresas", icon: IconCompany },
    { href: "/tareas", label: "Tareas", icon: IconTasks },
    { href: "/catalogo", label: "Líneas y productos", icon: IconCatalog },
    ...(can(user.role, "import:run") ? [{ href: "/importar", label: "Importar HubSpot", icon: IconImport }] : []),
    ...(can(user.role, "users:manage") ? [{ href: "/configuracion", label: "Configuración", icon: IconSettings }] : []),
  ];

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-slate-200 bg-white text-slate-600 md:sticky md:top-0 md:h-screen md:w-56 md:border-r md:border-b-0">
      <div className="flex items-end gap-2 px-5 py-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/egrow-logo.png" alt="e-grow" className="h-9 w-auto" />
        <span className="pb-0.5 text-sm font-semibold tracking-wide text-egrow-magenta">CRM</span>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-1 md:flex-col md:overflow-visible">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                active ? "bg-brand-50 font-semibold text-brand-700" : "hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Icon />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-200 p-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-xs font-semibold text-white">
            {initials(user.name)}
          </div>
          <div className="min-w-0 flex-1">
            <Link href="/perfil" className="block truncate text-sm font-medium text-slate-900 hover:underline">{user.name}</Link>
            <div className="text-xs text-slate-500">{ROLE_LABELS[user.role]}</div>
          </div>
          <form action={logout}>
            <button title="Cerrar sesión" className="rounded p-1.5 hover:bg-slate-100">
              <IconLogout />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
