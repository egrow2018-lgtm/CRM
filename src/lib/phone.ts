/** Teléfonos con código de país: lista de países, lectura y formato "+593 99 543 9203". Sin dependencias del servidor. */

export type Country = { iso: string; name: string; dial: string };

/** Primero Ecuador y la región; luego otros países frecuentes. */
export const COUNTRIES: Country[] = [
  { iso: "EC", name: "Ecuador", dial: "593" },
  { iso: "PE", name: "Perú", dial: "51" },
  { iso: "CO", name: "Colombia", dial: "57" },
  { iso: "MX", name: "México", dial: "52" },
  { iso: "CL", name: "Chile", dial: "56" },
  { iso: "AR", name: "Argentina", dial: "54" },
  { iso: "BO", name: "Bolivia", dial: "591" },
  { iso: "VE", name: "Venezuela", dial: "58" },
  { iso: "PA", name: "Panamá", dial: "507" },
  { iso: "CR", name: "Costa Rica", dial: "506" },
  { iso: "GT", name: "Guatemala", dial: "502" },
  { iso: "SV", name: "El Salvador", dial: "503" },
  { iso: "HN", name: "Honduras", dial: "504" },
  { iso: "NI", name: "Nicaragua", dial: "505" },
  { iso: "DO", name: "República Dominicana", dial: "1809" },
  { iso: "PR", name: "Puerto Rico", dial: "1787" },
  { iso: "CU", name: "Cuba", dial: "53" },
  { iso: "PY", name: "Paraguay", dial: "595" },
  { iso: "UY", name: "Uruguay", dial: "598" },
  { iso: "BR", name: "Brasil", dial: "55" },
  { iso: "US", name: "Estados Unidos", dial: "1" },
  { iso: "CA", name: "Canadá", dial: "1" },
  { iso: "ES", name: "España", dial: "34" },
  { iso: "PT", name: "Portugal", dial: "351" },
  { iso: "IT", name: "Italia", dial: "39" },
  { iso: "FR", name: "Francia", dial: "33" },
  { iso: "DE", name: "Alemania", dial: "49" },
  { iso: "GB", name: "Reino Unido", dial: "44" },
  { iso: "NL", name: "Países Bajos", dial: "31" },
  { iso: "CH", name: "Suiza", dial: "41" },
  { iso: "IL", name: "Israel", dial: "972" },
  { iso: "CN", name: "China", dial: "86" },
  { iso: "IN", name: "India", dial: "91" },
  { iso: "JP", name: "Japón", dial: "81" },
  { iso: "AU", name: "Australia", dial: "61" },
];

export const DEFAULT_COUNTRY = "EC";

export const countryByIso = (iso: string) => COUNTRIES.find((c) => c.iso === iso) ?? COUNTRIES[0]!;

/** Bandera (imagen, porque Windows no muestra las banderas emoji). */
export const flagUrl = (iso: string) => `https://flagcdn.com/24x18/${iso.toLowerCase()}.png`;

/** Separa el código de país del número. Sin "+" se asume Ecuador (o el país indicado). */
export function parsePhone(raw: string | null | undefined, fallbackIso = DEFAULT_COUNTRY): { iso: string; national: string } {
  const text = (raw ?? "").trim();
  let digits = text.replace(/\D/g, "");
  const international = text.startsWith("+") || digits.startsWith("00");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (international) {
    // El código más largo que coincida (ej. 593 antes que 59x, 1809 antes que 1)
    const match = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length).find((c) => digits.startsWith(c.dial));
    if (match) return { iso: match.iso === "CA" ? "US" : match.iso, national: stripTrunk(digits.slice(match.dial.length)) };
  }
  // "593 99…" sin "+" (12 dígitos)
  if (fallbackIso === "EC" && digits.startsWith("593") && digits.length >= 11) return { iso: "EC", national: stripTrunk(digits.slice(3)) };
  return { iso: fallbackIso, national: stripTrunk(digits) };
}

/** Quita el 0 inicial de los números nacionales (099… → 99…). */
function stripTrunk(national: string) {
  return national.replace(/^0+/, "");
}

/** Agrupa los dígitos del número nacional: 995439203 → "99 543 9203", 24513888 → "2 451 3888". */
export function groupNational(national: string, iso = DEFAULT_COUNTRY) {
  const d = national.replace(/\D/g, "");
  const parts = (sizes: number[]) => {
    const out: string[] = [];
    let i = 0;
    for (const s of sizes) {
      if (i >= d.length) break;
      out.push(d.slice(i, i + s));
      i += s;
    }
    if (i < d.length) out.push(d.slice(i));
    return out.join(" ");
  };
  switch (d.length) {
    case 7:
      return parts([3, 4]);
    case 8:
      return iso === "EC" ? parts([1, 3, 4]) : parts([4, 4]);
    case 9:
      return parts([2, 3, 4]);
    case 10:
      return parts([3, 3, 4]);
    case 11:
      return parts([2, 5, 4]);
    default:
      return d.length > 11 ? parts([3, 3, 3, 3]) : d;
  }
}

/** "+593 99 543 9203"; vacío si no hay dígitos. Si no se entiende, se deja como se escribió. */
export function formatPhone(raw: string | null | undefined, fallbackIso = DEFAULT_COUNTRY) {
  const text = (raw ?? "").trim();
  if (!text) return "";
  const { iso, national } = parsePhone(text, fallbackIso);
  if (national.length < 6 || national.length > 13) return text;
  return `+${countryByIso(iso).dial} ${groupNational(national, iso)}`;
}

/** Para guardar desde formularios: devuelve el teléfono con formato o null. */
export function normalizePhone(raw: string | null | undefined) {
  const f = formatPhone(raw);
  return f || null;
}

/** Enlace de WhatsApp con el mensaje: directo al chat del número si es válido; si no, para elegir el chat. */
export function whatsappUrl(phone: string | null | undefined, text: string) {
  const { iso, national } = parsePhone(phone);
  const to = national.length >= 6 && national.length <= 13 ? `${countryByIso(iso).dial}${national}` : "";
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}
