import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { companyKey, corporateDomain, normalize, parseAmount, parseCsv, parseDate, samePerson, websiteDomain } from "./csv";

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
    website: ["url del sitio web", "website url", "nombre de dominio de la empresa", "company domain name", "sitio web", "dominio"],
    phone: ["numero de telefono", "phone number", "telefono"],
    city: ["ciudad", "city"],
    country: ["pais/region", "country/region", "pais", "country"],
    industry: ["sector", "industria", "industry"],
    address: ["direccion", "street address"],
    notes: ["descripcion", "description"],
    owner: ["propietario de la empresa", "propietario del registro de empresa", "company owner", "propietario"],
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
  [/rutalink|\bsesa\b|gps|rastreo|candado|satelital|\btags?\b|sticker/, "rutalink"],
  [/curso|lms|video|e-?learning|virtual|induccion|animad|produccion|capacitacion|plataforma|microlearning|tutorial|podcast|escuela|taller|instruccional|academy|codigo de etica/, "e-learning"],
];

const CHUNK = 500;

async function inChunks<T>(items: T[], fn: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < items.length; i += CHUNK) await fn(items.slice(i, i + CHUNK));
}

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
  const required = kind === "contacts" ? "email" : "name";
  if (cols[required] == null && !(kind === "contacts" && cols.firstName != null)) {
    throw new Error(`No se encontró la columna obligatoria (${ALIASES[kind][required].slice(0, 2).join(" / ")}). Revisa el archivo.`);
  }
  const get = (row: string[], field: string) => (cols[field] != null ? row[cols[field]]?.trim() || undefined : undefined);
  const createdAtOf = (row: string[]) => {
    const d = parseDate(get(row, "createdAt"));
    return d ? { createdAt: d } : {};
  };

  const users = await prisma.user.findMany();
  const unknownOwners = new Set<string>();
  const ownerOf = (row: string[]) => {
    const raw = get(row, "owner");
    if (!raw) return null;
    const n = normalize(raw);
    const id = users.find((u) => normalize(u.name) === n || u.email.toLowerCase() === n || samePerson(u.name, raw))?.id;
    if (!id) unknownOwners.add(raw);
    return id ?? null;
  };

  // Empresas existentes (por nombre sin sufijos legales y por dominio web) y las nuevas que haya que crear
  const existingCompanies = await prisma.company.findMany({ select: { id: true, name: true, website: true } });
  const companyIds = new Map(existingCompanies.map((c) => [companyKey(c.name), c.id]));
  const companyByDomain = new Map<string, string>();
  for (const c of existingCompanies) {
    const d = websiteDomain(c.website);
    if (d && !companyByDomain.has(d)) companyByDomain.set(d, c.id);
  }
  const newCompanies = new Map<string, Prisma.CompanyCreateManyInput>();
  const wantCompany = (name?: string) => {
    if (!name) return;
    const key = companyKey(name);
    if (key && !companyIds.has(key) && !newCompanies.has(key)) newCompanies.set(key, { name, ownerId: userId });
  };

  // 1) Preparar los registros (sin escribir nada todavía)
  let records: Prisma.CompanyCreateManyInput[] | (Prisma.ContactCreateManyInput & { _company?: string })[] | (Prisma.DealCreateManyInput & { _company?: string })[] = [];

  if (kind === "companies") {
    const list: Prisma.CompanyCreateManyInput[] = [];
    const seen = new Set(companyIds.keys());
    for (const row of data) {
      const name = get(row, "name");
      if (!name || !companyKey(name) || seen.has(companyKey(name))) {
        result.skipped++;
        continue;
      }
      seen.add(companyKey(name));
      list.push({
        name,
        website: get(row, "website"),
        phone: get(row, "phone"),
        address: get(row, "address"),
        city: get(row, "city"),
        country: get(row, "country"),
        industry: get(row, "industry"),
        notes: get(row, "notes"),
        ownerId: ownerOf(row) ?? userId,
        ...createdAtOf(row),
      });
    }
    records = list;
  }

  if (kind === "contacts") {
    // Duplicados: por email o, si no tiene, por nombre + empresa
    const contactKey = (email: string | null | undefined, first: string, last: string | null | undefined, company: string | null | undefined) =>
      email ? email.toLowerCase() : `${normalize(first)}|${normalize(last ?? "")}|${companyKey(company ?? "")}`;
    const seen = new Set(
      (await prisma.contact.findMany({ select: { email: true, firstName: true, lastName: true, company: { select: { name: true } } } })).map(
        (c) => contactKey(c.email, c.firstName, c.lastName, c.company?.name),
      ),
    );
    const list: (Prisma.ContactCreateManyInput & { _company?: string })[] = [];
    for (const row of data) {
      const email = get(row, "email")?.toLowerCase();
      // Si no hay nombre, se usa la parte del email antes de la @ (ej. "gerencia")
      const firstName = get(row, "firstName") ?? email?.split("@")[0];
      const companyName = get(row, "company");
      const key = firstName && contactKey(email, firstName, get(row, "lastName"), companyName);
      if (!firstName || !key || seen.has(key)) {
        result.skipped++;
        continue;
      }
      seen.add(key);
      // Empresa: primero por el dominio del email corporativo (como HubSpot), luego por nombre
      const domainCompany = companyByDomain.get(corporateDomain(email) ?? "");
      const company = domainCompany ? undefined : companyName;
      wantCompany(company);
      list.push({
        companyId: domainCompany ?? null,
        firstName,
        lastName: get(row, "lastName"),
        email,
        phone: get(row, "phone"),
        jobTitle: get(row, "jobTitle"),
        source: "HubSpot",
        ownerId: ownerOf(row) ?? userId,
        _company: company,
        ...createdAtOf(row),
      });
    }
    records = list;
  }

  if (kind === "deals") {
    const stages = await prisma.pipelineStage.findMany({ orderBy: { order: "asc" } });
    const lines = await prisma.businessLine.findMany();
    const existing = new Set((await prisma.deal.findMany({ select: { name: true } })).map((d) => normalize(d.name)));
    const unknownStages = new Set<string>();
    const findStage = (raw?: string) => {
      if (!raw) return stages[0];
      const n = normalize(raw);
      if (/closed ?won|cerrado ganado|ganado/.test(n)) return stages.find((s) => s.isWon) ?? stages[0];
      if (/closed ?lost|cerrado perdido|perdido|no concretado/.test(n)) return stages.find((s) => s.isLost) ?? stages[0];
      const first = (x: string) => x.split(/[\s-]/)[0];
      const match =
        stages.find((s) => normalize(s.name) === n) ??
        stages.find((s) => first(normalize(s.name)) === first(n)) ??
        stages.find((s) => n.includes(first(normalize(s.name))));
      if (!match) unknownStages.add(raw.trim());
      return match;
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
    const list: (Prisma.DealCreateManyInput & { _company?: string })[] = [];
    for (const row of data) {
      const name = get(row, "name");
      if (!name || existing.has(normalize(name))) {
        result.skipped++;
        continue;
      }
      existing.add(normalize(name));
      let company = get(row, "company");
      if (company) wantCompany(company);
      else {
        // Sin columna de empresa: se deduce del nombre ("Duragas - Curso conductores" → Duragas),
        // solo si esa empresa ya existe (para no crear empresas a partir de nombres de personas).
        const prefix = name.split(/\s+-\s*|\s*-\s+/)[0];
        if (prefix !== name && companyIds.has(companyKey(prefix))) company = prefix;
      }
      const createdAt = parseDate(get(row, "createdAt"));
      list.push({
        name,
        // Etapa desconocida: se marca con su nombre y se crea antes de guardar
        stageId: findStage(get(row, "stage"))?.id ?? `new:${get(row, "stage")!.trim()}`,
        amount: parseAmount(get(row, "amount")),
        closeDate: parseDate(get(row, "closeDate")),
        description: get(row, "description"),
        ownerId: ownerOf(row) ?? userId,
        businessLineId: findLine(get(row, "line"), name),
        _company: company,
        ...(createdAt ? { createdAt, stageChangedAt: createdAt } : {}),
      });
    }
    if (unknownStages.size) {
      result.warnings.push(
        `Etapas de HubSpot que no existían ${dryRun ? "(se crearán" : "(se crearon"} al final del pipeline; ajústalas en Configuración): ${[...unknownStages].join(", ")}`,
      );
    }
    records = list;
  }

  result.created = records.length;
  result.companiesCreated = newCompanies.size;
  if (unknownOwners.size) {
    result.warnings.push(
      `Propietarios de HubSpot sin usuario en el CRM (sus registros quedaron a tu nombre; puedes reasignarlos luego): ${[...unknownOwners].join(", ")}`,
    );
  }
  if (dryRun) return result;

  // 2) Escribir todo en una transacción, en lotes
  await prisma.$transaction(
    async (tx) => {
      if (newCompanies.size) {
        await inChunks([...newCompanies.values()], (chunk) => tx.company.createMany({ data: chunk }));
        const created = await tx.company.findMany({ where: { name: { in: [...newCompanies.values()].map((c) => c.name) } }, select: { id: true, name: true } });
        for (const c of created) companyIds.set(companyKey(c.name), c.id);
      }
      const withCompany = <T extends { _company?: string; companyId?: string | null }>(r: T) => {
        const { _company, ...rest } = r;
        return { ...rest, companyId: rest.companyId ?? (_company ? (companyIds.get(companyKey(_company)) ?? null) : null) };
      };
      if (kind === "companies") {
        await inChunks(records as Prisma.CompanyCreateManyInput[], (chunk) => tx.company.createMany({ data: chunk }));
      } else if (kind === "contacts") {
        const list = (records as (Prisma.ContactCreateManyInput & { _company?: string })[]).map(withCompany);
        await inChunks(list, (chunk) => tx.contact.createMany({ data: chunk }));
      } else {
        const stageIds = new Map<string, string>();
        let order = (await tx.pipelineStage.aggregate({ _max: { order: true } }))._max.order ?? 0;
        for (const r of records as Prisma.DealCreateManyInput[]) {
          if (!r.stageId.startsWith("new:")) continue;
          const name = r.stageId.slice(4);
          if (!stageIds.has(name)) stageIds.set(name, (await tx.pipelineStage.create({ data: { name, order: ++order, probability: 0 } })).id);
          r.stageId = stageIds.get(name)!;
        }
        const list = (records as (Prisma.DealCreateManyInput & { _company?: string })[]).map(withCompany);
        await inChunks(list, (chunk) => tx.deal.createMany({ data: chunk }));
      }
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
  return result;
}
