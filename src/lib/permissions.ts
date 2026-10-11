import type { Role } from "@prisma/client";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  GERENTE: "Gerente",
  COMERCIAL: "Gestión de negocios",
  PROYECTOS: "Gestión de proyectos",
};

/** Permisos, agrupados por módulo para la pantalla de usuarios. */
export const PERMISSION_GROUPS = [
  {
    module: "Contactos",
    items: [
      { key: "contacts:write", label: "Crear y editar" },
      { key: "contacts:delete", label: "Eliminar" },
    ],
  },
  {
    module: "Empresas",
    items: [
      { key: "companies:write", label: "Crear y editar" },
      { key: "companies:delete", label: "Eliminar y unir duplicadas" },
    ],
  },
  {
    module: "Negocios",
    items: [
      { key: "deals:write", label: "Crear y editar (incluye cotizaciones)" },
      { key: "deals:delete", label: "Eliminar" },
      { key: "deals:production", label: "Mover entre Firma de contrato, Producción y Ganado" },
    ],
  },
  {
    module: "Seguimiento",
    items: [
      { key: "activities:write", label: "Registrar notas, llamadas, tareas y reuniones" },
      { key: "leads:take", label: "Tomar leads de la bandeja" },
    ],
  },
  {
    module: "Herramientas",
    items: [
      { key: "meetings:schedule", label: "Agendar reuniones (Agenda y Zoom)" },
      { key: "forms:manage", label: "Formularios públicos" },
      { key: "catalog:manage", label: "Líneas de negocio y productos" },
      { key: "reports:view", label: "Ver reportes" },
      { key: "import:run", label: "Importar datos (HubSpot / CSV)" },
      { key: "data:export", label: "Exportar datos y descargar respaldos" },
    ],
  },
  {
    module: "Administración",
    items: [
      { key: "pipeline:configure", label: "Etapas del pipeline y datos de la empresa" },
      { key: "users:manage", label: "Usuarios y permisos" },
    ],
  },
] as const;

export type Permission = (typeof PERMISSION_GROUPS)[number]["items"][number]["key"];
export const ALL_PERMISSIONS: Permission[] = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));

/** Permisos por defecto de cada perfil (se pueden ajustar por usuario). */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: ALL_PERMISSIONS,
  GERENTE: [
    "contacts:write", "contacts:delete", "companies:write", "companies:delete", "deals:write", "deals:delete", "deals:production",
    "activities:write", "meetings:schedule", "leads:take", "forms:manage", "catalog:manage", "import:run", "reports:view",
    "data:export",
  ],
  // Gestión de negocios: crea clientes y productos y da seguimiento a cada negocio
  COMERCIAL: [
    "contacts:write", "companies:write", "deals:write", "deals:production", "activities:write", "meetings:schedule", "leads:take", "forms:manage",
    "catalog:manage", "reports:view",
  ],
  // Gestión de proyectos: seguimiento de la producción con el equipo de desarrollo
  PROYECTOS: ["deals:production", "activities:write", "meetings:schedule"],
};

/** Quién pide el permiso: un perfil, o un usuario con permisos personalizados. */
export type PermissionSubject = Role | { role: Role; customPermissions?: boolean; permissions?: string[] };

/** Permisos efectivos. El administrador siempre los tiene todos (para no quedarse sin acceso). */
export function permissionsOf(subject: PermissionSubject): Permission[] {
  if (typeof subject === "string") return ROLE_PERMISSIONS[subject];
  if (subject.role === "ADMIN") return ALL_PERMISSIONS;
  if (subject.customPermissions) return ALL_PERMISSIONS.filter((p) => subject.permissions?.includes(p));
  return ROLE_PERMISSIONS[subject.role];
}

export function can(subject: PermissionSubject, permission: Permission) {
  return permissionsOf(subject).includes(permission);
}

/**
 * Sin permiso de editar negocios, solo se pueden mover los que ya están (y se quedan) en la
 * fase de ejecución: desde "Firma de Contrato" en adelante (probabilidad >= 80 o ganado).
 */
export function canMoveDeal(
  subject: PermissionSubject,
  from: { probability: number; isWon: boolean; isLost: boolean },
  to: { probability: number; isWon: boolean; isLost: boolean },
) {
  if (can(subject, "deals:write")) return true;
  if (!can(subject, "deals:production")) return false;
  const isExecution = (s: typeof from) => !s.isLost && (s.isWon || s.probability >= 80);
  return isExecution(from) && isExecution(to);
}
