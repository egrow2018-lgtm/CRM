/** Campos adicionales que una línea de negocio activa en sus negocios (ej. E-learning). */
export type CustomFieldType = "text" | "textarea" | "number" | "date" | "select" | "user";

export type CustomField = {
  key: string;
  label: string;
  type: CustomFieldType;
  options?: string[]; // para "select"
  suffix?: string; // para "number", ej. "semanas"
  placeholder?: string;
};

export const CUSTOM_FIELD_TYPES: Record<CustomFieldType, string> = {
  text: "Texto corto",
  textarea: "Texto largo",
  number: "Número",
  date: "Fecha",
  select: "Lista de opciones",
  user: "Usuario del CRM",
};

export const ELEARNING_FIELDS: CustomField[] = [
  {
    key: "tipoProyecto",
    label: "Tipo de proyecto",
    type: "select",
    options: ["Curso virtual", "Plataforma LMS", "Video learning", "Producción audiovisual", "Microlearning", "Otro"],
  },
  { key: "tiempoDesarrollo", label: "Tiempo de desarrollo", type: "number", suffix: "semanas" },
  { key: "fechaInicio", label: "Inicio de desarrollo", type: "date" },
  { key: "fechaEntrega", label: "Fecha de entrega", type: "date" },
  { key: "responsable", label: "Responsable del proyecto", type: "user" },
  {
    key: "equipo",
    label: "Equipo de desarrollo",
    type: "textarea",
    placeholder: "Ej. Diseño instruccional: Ana · Diseño gráfico: Luis · Programación: Pedro · Edición de video: …",
  },
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
