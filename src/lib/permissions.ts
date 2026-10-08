import type { Role } from "@prisma/client";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  GERENTE: "Gerente",
  COMERCIAL: "Gestor comercial",
  PROYECTOS: "Proyectos",
};

export type Permission =
  | "users:manage" // crear / editar usuarios
  | "pipeline:configure" // editar etapas del pipeline
  | "catalog:manage" // líneas de negocio y productos
  | "crm:write" // crear / editar contactos, empresas y negocios
  | "crm:delete" // eliminar registros
  | "deals:production" // mover negocios entre Firma de contrato, Producción y Ganado
  | "activities:write" // notas, llamadas, tareas
  | "import:run"; // importar datos desde HubSpot

const MATRIX: Record<Role, Permission[]> = {
  ADMIN: [
    "users:manage",
    "pipeline:configure",
    "catalog:manage",
    "crm:write",
    "crm:delete",
    "deals:production",
    "activities:write",
    "import:run",
  ],
  GERENTE: ["catalog:manage", "crm:write", "crm:delete", "deals:production", "activities:write", "import:run"],
  COMERCIAL: ["crm:write", "deals:production", "activities:write"],
  PROYECTOS: ["deals:production", "activities:write"],
};

export function can(role: Role, permission: Permission) {
  return MATRIX[role].includes(permission);
}

/**
 * Proyectos solo puede mover negocios que ya están (y se quedan) en la fase de
 * ejecución: desde "Firma de Contrato" en adelante (probabilidad >= 80 o ganado).
 */
export function canMoveDeal(
  role: Role,
  from: { probability: number; isWon: boolean; isLost: boolean },
  to: { probability: number; isWon: boolean; isLost: boolean },
) {
  if (can(role, "crm:write")) return true;
  if (!can(role, "deals:production")) return false;
  const isExecution = (s: typeof from) => !s.isLost && (s.isWon || s.probability >= 80);
  return isExecution(from) && isExecution(to);
}
