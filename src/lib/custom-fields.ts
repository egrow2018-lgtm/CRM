/** Campos adicionales que una línea de negocio activa en sus negocios (ej. E-learning). */
export type CustomFieldType = "text" | "textarea" | "number" | "date" | "select" | "user" | "team";

export type CustomField = {
  key: string;
  label: string;
  type: CustomFieldType;
  options?: string[]; // para "select"
  suffix?: string; // para "number", ej. "semanas"
  /** Para "number": unidades a elegir con botones redondos (ej. días o semanas). Se guarda en `${key}Unidad`. */
  units?: string[];
  placeholder?: string;
};

export const CUSTOM_FIELD_TYPES: Record<CustomFieldType, string> = {
  text: "Texto corto",
  textarea: "Texto largo",
  number: "Número",
  date: "Fecha",
  select: "Lista de opciones",
  user: "Usuario del CRM",
  team: "Equipo de desarrollo (lista de Configuración)",
};

export const ELEARNING_FIELDS: CustomField[] = [
  {
    key: "tipoProyecto",
    label: "Tipo de proyecto",
    type: "select",
    options: ["Curso virtual", "Plataforma LMS", "Video learning", "Producción audiovisual", "Microlearning", "Otro"],
  },
  { key: "tiempoDesarrollo", label: "Tiempo de desarrollo", type: "number", units: ["días", "semanas"] },
  { key: "fechaInicio", label: "Inicio de desarrollo", type: "date" },
  { key: "fechaEntrega", label: "Fecha de entrega", type: "date" },
  { key: "responsable", label: "Responsable del proyecto", type: "user" },
  { key: "equipo", label: "Equipo de desarrollo", type: "team" },
  { key: "avance", label: "Avance", type: "number", suffix: "%" },
];

export function parseCustomFields(value: unknown): CustomField[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (f): f is CustomField => !!f && typeof f === "object" && typeof f.key === "string" && typeof f.label === "string" && f.type in CUSTOM_FIELD_TYPES,
  );
}

export function parseCustomData(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, v]) => typeof v === "string")) as Record<string, string>;
}

/** Convierte un texto en una clave segura ("Tiempo de desarrollo" → "tiempoDeDesarrollo"). */
export function toKey(label: string) {
  const words = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return words.map((w, i) => (i === 0 ? w.toLowerCase() : w[0]!.toUpperCase() + w.slice(1).toLowerCase())).join("") || "campo";
}

/** Campo «team»: se guardan los ids de los integrantes separados por coma (los textos antiguos se conservan tal cual). */
export function parseTeamValue(value: string | undefined, memberIds: Set<string>) {
  const parts = (value ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const ids = parts.filter((x) => memberIds.has(x));
  // Si nada coincide con la lista, es el texto libre de antes («Diseño: Ana · …»)
  const legacy = value && ids.length === 0 ? value : null;
  return { ids, legacy };
}

export function teamMemberLabel(m: { name: string; specialty: string | null }) {
  return m.specialty ? `${m.name} (${m.specialty})` : m.name;
}
