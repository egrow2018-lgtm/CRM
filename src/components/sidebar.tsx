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
    <aside className="flex w-full shrink-0 flex-col bg-brand-900 text-brand-100 md:h-screen md:w-56 md:sticky md:top-0">
      <div className="px-5 py-4 text-xl font-bold text-white">
        e-grow <span className="font-light text-brand-200">CRM</span>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-1 md:flex-col md:overflow-visible">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                active ? "bg-white/15 font-medium text-white" : "hover:bg-white/10"
              }`}
            >
              <Icon />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="hidden border-t border-white/10 p-3 md:block">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white">
            {initials(user.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-white">{user.name}</div>
            <div className="text-xs text-brand-200">{ROLE_LABELS[user.role]}</div>
          </div>
          <form action={logout}>
            <button title="Cerrar sesión" className="rounded p-1.5 hover:bg-white/10">
              <IconLogout />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
