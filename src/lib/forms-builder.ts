/** Definición de los campos de los formularios públicos. */
export type FormFieldType = "text" | "email" | "tel" | "textarea" | "select" | "checkbox";

/** A qué dato del contacto se guarda la respuesta (vacío = solo queda en la respuesta y en la nota). */
export type ContactMapping = "firstName" | "lastName" | "email" | "phone" | "company" | "jobTitle" | "";

export type FormField = {
  key: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  map: ContactMapping;
  options?: string[];
  placeholder?: string;
};

export const FORM_FIELD_TYPES: Record<FormFieldType, string> = {
  text: "Texto",
  email: "Email",
  tel: "Teléfono",
  textarea: "Texto largo",
  select: "Lista de opciones",
  checkbox: "Casilla (sí/no)",
};

export const CONTACT_MAPPINGS: Record<Exclude<ContactMapping, "">, string> = {
  firstName: "Nombre",
  lastName: "Apellido",
  email: "Email",
  phone: "Teléfono",
  company: "Empresa",
  jobTitle: "Cargo",
};

export const DEFAULT_FORM_FIELDS: FormField[] = [
  { key: "nombre", label: "Nombre", type: "text", required: true, map: "firstName" },
  { key: "apellido", label: "Apellido", type: "text", required: false, map: "lastName" },
  { key: "email", label: "Email", type: "email", required: true, map: "email" },
  { key: "telefono", label: "Teléfono / WhatsApp", type: "tel", required: false, map: "phone" },
  { key: "empresa", label: "Empresa", type: "text", required: false, map: "company" },
  { key: "cargo", label: "Cargo", type: "text", required: false, map: "jobTitle" },
  { key: "mensaje", label: "¿En qué podemos ayudarte?", type: "textarea", required: false, map: "" },
];

export function parseFormFields(value: unknown): FormField[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (f): f is FormField => !!f && typeof f === "object" && typeof f.key === "string" && typeof f.label === "string" && f.type in FORM_FIELD_TYPES,
  );
}

export function slugify(text: string) {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "formulario"
  );
}
