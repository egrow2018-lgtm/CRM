import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { normalize, parseAmount, parseCsv, parseDate } from "./csv";

export type ImportKind = "companies" | "contacts" | "deals";

export type ImportResult = {
  kind: ImportKind;
  dryRun: boolean;
  rows: number;
  created: number;
  skipped: number;
  companiesCreated: number;
  columns: Record<string, string | null>;
  warnings: string[];
};

/** Alias de columnas de HubSpot (exportación en español o inglés). */
const ALIASES: Record<ImportKind, Record<string, string[]>> = {
  companies: {
    name: ["nombre de la empresa", "company name", "nombre", "name"],
    website: ["nombre de dominio de la empresa", "company domain name", "sitio web", "website url", "dominio"],
    phone: ["numero de telefono", "phone number", "telefono"],
    city: ["ciudad", "city"],
    country: ["pais/region", "country/region", "pais", "country"],
    industry: ["sector", "industria", "industry"],
    owner: ["propietario de la empresa", "company owner", "propietario"],
    createdAt: ["fecha de creacion", "create date"],
  },
  contacts: {
    firstName: ["nombre", "first name"],
    lastName: ["apellidos", "apellido", "last name"],
    email: ["correo", "email", "correo electronico"],
    phone: ["numero de telefono", "phone number", "telefono", "numero de telefono movil", "mobile phone number"],
    jobTitle: ["cargo", "job title"],
    company: ["nombre de la empresa", "company name", "empresa asociada", "associated company", "empresa"],
    owner: ["propietario del contacto", "contact owner", "propietario"],
    createdAt: ["fecha de creacion", "create date"],
  },
  deals: {
    name: ["nombre del negocio", "deal name", "negocio"],
    stage: ["etapa del negocio", "deal stage", "etapa"],
    amount: ["importe", "amount", "valor", "cantidad"],
    closeDate: ["fecha de cierre", "close date"],
    owner: ["propietario del negocio", "deal owner", "propietario"],
    createdAt: ["fecha de creacion", "create date"],
    company: ["empresa asociada", "associated company", "nombre de la empresa", "company name", "empresa"],
    description: ["descripcion del negocio", "deal description", "descripcion"],
    line: ["linea de negocio", "business line", "tipo de negocio", "deal type"],
  },
};

function mapColumns(header: string[], kind: ImportKind) {
  const norm = header.map(normalize);
  const result: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(ALIASES[kind])) {
    let idx = -1;
    for (const a of aliases) {
      idx = norm.findIndex((h, i) => h === a && !Object.values(result).includes(i));
      if (idx !== -1) break;
    }
    if (idx === -1) {
      for (const a of aliases) {
        idx = norm.findIndex((h, i) => h.startsWith(a) && !Object.values(result).includes(i));
        if (idx !== -1) break;
      }
    }
    if (idx !== -1) result[field] = idx;
  }
  return result;
}

/** Deduce la línea de negocio a partir del nombre (ej. "Holcim Ltd - Ludus"). */
const LINE_HINTS: [RegExp, string][] = [
  [/ludus|realidad virtual|\bvr\b/, "ludus"],
  [/humand/, "humand"],
  [/rutalink|gps|rastreo|candado|satelital|tag|sticker/, "rutalink"],
  [/curso|lms|video|e-?learning|virtual|induccion|animad|produccion|capacitacion|plataforma/, "e-learning"],
];

class DryRunRollback extends Error {}

export async function runHubspotImport(kind: ImportKind, csvText: string, dryRun: boolean, userId: string): Promise<ImportResult> {
  const rows = parseCsv(csvText);
  if (rows.length < 2) throw new Error("El archivo no tiene filas de datos.");
  const [header, ...data] = rows;
  const cols = mapColumns(header, kind);
  const result: ImportResult = {
    kind,
    dryRun,
    rows: data.length,
    created: 0,
    skipped: 0,
    companiesCreated: 0,
    columns: Object.fromEntries(Object.keys(ALIASES[kind]).map((f) => [f, cols[f] != null ? header[cols[f]] : null])),
    warnings: [],
  };
  const required = kind === "contacts" ? "firstName" : "name";
  if (cols[required] == null) {
    throw new Error(`No se encontró la columna obligatoria (${ALIASES[kind][required].slice(0, 2).join(" / ")}). Revisa el archivo.`);
  }
  const get = (row: string[], field: string) => (cols[field] != null ? row[cols[field]]?.trim() || undefined : undefined);

  const users = await prisma.user.findMany();
  const findOwner = (raw?: string) => {
    if (!raw) return null;
    const n = normalize(raw);
    return users.find((u) => normalize(u.name) === n || u.email.toLowerCase() === n || n.includes(normalize(u.name)))?.id ?? null;
  };
  const unknownOwners = new Set<string>();
  const unknownStages = new Set<string>();

  try {
    await prisma.$transaction(
      async (tx) => {
        const companies = new Map((await tx.company.findMany({ select: { id: true, name: true } })).map((c) => [normalize(c.name), c.id]));
        const companyId = async (name?: string) => {
          if (!name) return null;
          const key = normalize(name);
          let id = companies.get(key);
          if (!id) {
            id = (await tx.company.create({ data: { name, ownerId: userId } })).id;
            companies.set(key, id);
            result.companiesCreated++;
          }
          return id;
        };

        if (kind === "companies") {
          for (const row of data) {
            const name = get(row, "name");
            if (!name || companies.has(normalize(name))) {
              result.skipped++;
              continue;
            }
            const ownerRaw = get(row, "owner");
            const ownerId = findOwner(ownerRaw);
            if (ownerRaw && !ownerId) unknownOwners.add(ownerRaw);
            const c = await tx.company.create({
              data: {
                name,
                website: get(row, "website"),
                phone: get(row, "phone"),
                city: get(row, "city"),
                country: get(row, "country"),
                industry: get(row, "industry"),
                ownerId: ownerId ?? userId,
                ...(parseDate(get(row, "createdAt")) ? { createdAt: parseDate(get(row, "createdAt"))! } : {}),
              },
            });
            companies.set(normalize(name), c.id);
            result.created++;
          }
        }

        if (kind === "contacts") {
          const emails = new Set(
            (await tx.contact.findMany({ where: { email: { not: null } }, select: { email: true } })).map((c) => c.email!.toLowerCase()),
          );
          for (const row of data) {
            const firstName = get(row, "firstName");
            const email = get(row, "email")?.toLowerCase();
            if (!firstName && !email) {
              result.skipped++;
              continue;
            }
            if (email && emails.has(email)) {
              result.skipped++;
              continue;
            }
            const ownerRaw = get(row, "owner");
            const ownerId = findOwner(ownerRaw);
            if (ownerRaw && !ownerId) unknownOwners.add(ownerRaw);
            await tx.contact.create({
              data: {
                firstName: firstName ?? email!,
                lastName: get(row, "lastName"),
                email,
                phone: get(row, "phone"),
                jobTitle: get(row, "jobTitle"),
                source: "HubSpot",
                companyId: await companyId(get(row, "company")),
                ownerId: ownerId ?? userId,
                ...(parseDate(get(row, "createdAt")) ? { createdAt: parseDate(get(row, "createdAt"))! } : {}),
              },
            });
            if (email) emails.add(email);
            result.created++;
          }
        }

        if (kind === "deals") {
          const stages = await tx.pipelineStage.findMany({ orderBy: { order: "asc" } });
          const lines = await tx.businessLine.findMany();
          const existing = new Set((await tx.deal.findMany({ select: { name: true } })).map((d) => normalize(d.name)));
          const findStage = (raw?: string) => {
            if (!raw) return stages[0];
            const n = normalize(raw);
            if (/closed ?won|cerrado ganado|ganado/.test(n)) return stages.find((s) => s.isWon) ?? stages[0];
            if (/closed ?lost|cerrado perdido|perdido/.test(n)) return stages.find((s) => s.isLost) ?? stages[0];
            const match =
              stages.find((s) => normalize(s.name) === n) ??
              stages.find((s) => normalize(s.name).split(/[\s-]/)[0] === n.split(/[\s-]/)[0]) ??
              stages.find((s) => n.includes(normalize(s.name).split(/[\s-]/)[0]));
            if (!match) unknownStages.add(raw);
            return match ?? stages[0];
          };
          const findLine = (explicit: string | undefined, name: string) => {
            if (explicit) {
              const l = lines.find((x) => normalize(x.name) === normalize(explicit));
              if (l) return l.id;
            }
            const n = normalize(name);
            for (const [re, lineName] of LINE_HINTS) {
              if (re.test(n)) return lines.find((l) => normalize(l.name) === lineName)?.id ?? null;
            }
            return null;
          };

          for (const row of data) {
            const name = get(row, "name");
            if (!name || existing.has(normalize(name))) {
              result.skipped++;
              continue;
            }
            const stage = findStage(get(row, "stage"));
            const ownerRaw = get(row, "owner");
            const ownerId = findOwner(ownerRaw);
            if (ownerRaw && !ownerId) unknownOwners.add(ownerRaw);
            const createdAt = parseDate(get(row, "createdAt"));
            const data: Prisma.DealUncheckedCreateInput = {
              name,
              stageId: stage.id,
              amount: parseAmount(get(row, "amount")),
              closeDate: parseDate(get(row, "closeDate")),
              description: get(row, "description"),
              ownerId,
              companyId: await companyId(get(row, "company")),
              businessLineId: findLine(get(row, "line"), name),
              ...(createdAt ? { createdAt, stageChangedAt: createdAt } : {}),
            };
            await tx.deal.create({ data });
            existing.add(normalize(name));
            result.created++;
          }
        }

        if (dryRun) throw new DryRunRollback();
      },
      { timeout: 120_000, maxWait: 10_000 },
    );
  } catch (e) {
    if (!(e instanceof DryRunRollback)) throw e;
  }

  if (unknownOwners.size) {
    result.warnings.push(
      `Propietarios no encontrados (crea el usuario con el mismo nombre y vuelve a importar, o asígnalos luego): ${[...unknownOwners].join(", ")}`,
    );
  }
  if (unknownStages.size) {
    result.warnings.push(`Etapas no reconocidas (se asignaron a "Contacto"): ${[...unknownStages].join(", ")}`);
  }
  return result;
}
