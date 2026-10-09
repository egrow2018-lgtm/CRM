import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

export type DealFilters = {
  q?: string;
  owner?: string;
  line?: string;
  product?: string;
  year?: string;
  from?: string;
  to?: string;
};

/** Filtros comunes del tablero, la lista y el inicio. El año se refiere a la fecha de cierre. */
export function dealWhere(f: DealFilters, currentUserId: string): Prisma.DealWhereInput {
  const and: Prisma.DealWhereInput[] = [];
  if (f.q) {
    and.push({
      OR: [
        { name: { contains: f.q, mode: "insensitive" } },
        { company: { name: { contains: f.q, mode: "insensitive" } } },
        { contact: { firstName: { contains: f.q, mode: "insensitive" } } },
        { contact: { lastName: { contains: f.q, mode: "insensitive" } } },
      ],
    });
  }
  if (f.owner === "me") and.push({ ownerId: currentUserId });
  else if (f.owner === "none") and.push({ ownerId: null });
  else if (f.owner) and.push({ ownerId: f.owner });
  if (f.line === "none") and.push({ businessLineId: null });
  else if (f.line) and.push({ businessLineId: f.line });
  if (f.product) and.push({ items: { some: { productId: f.product } } });
  const year = Number(f.year);
  if (f.year === "none") and.push({ closeDate: null });
  else if (Number.isInteger(year) && year > 1900) {
    and.push({ closeDate: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } });
  }
  if (f.from) and.push({ closeDate: { gte: new Date(`${f.from}T00:00:00Z`) } });
  if (f.to) and.push({ closeDate: { lte: new Date(`${f.to}T23:59:59Z`) } });
  return and.length ? { AND: and } : {};
}

/** Opciones para los selectores de filtros. */
export async function getFilterOptions() {
  const [users, lines, products, years] = await Promise.all([
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.businessLine.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.product.findMany({
      orderBy: [{ businessLine: { name: "asc" } }, { name: "asc" }],
      select: { id: true, name: true, businessLineId: true, businessLine: { select: { name: true } } },
    }),
    prisma.$queryRaw<{ y: number }[]>`
      SELECT DISTINCT EXTRACT(YEAR FROM "closeDate")::int AS y FROM "Deal" WHERE "closeDate" IS NOT NULL ORDER BY y DESC`,
  ]);
  const current = new Date().getUTCFullYear();
  const yearList = [...new Set([current, ...years.map((r) => Number(r.y))])].sort((a, b) => b - a);
  return {
    users,
    lines,
    products: products.map((p) => ({ id: p.id, name: p.name, lineId: p.businessLineId, lineName: p.businessLine.name })),
    years: yearList,
  };
}

export type FilterOptions = Awaited<ReturnType<typeof getFilterOptions>>;

export const dealCardInclude = {
  stage: true,
  owner: { select: { id: true, name: true } },
  company: { select: { id: true, name: true } },
  contact: { select: { id: true, firstName: true, lastName: true } },
  businessLine: { select: { id: true, name: true, color: true } },
  _count: { select: { activities: { where: { type: "TAREA", completed: false } } } },
} satisfies Prisma.DealInclude;

export async function getFormOptions() {
  const [stages, lines, users, companies, contacts] = await Promise.all([
    prisma.pipelineStage.findMany({ orderBy: { order: "asc" } }),
    prisma.businessLine.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.contact.findMany({
      orderBy: { firstName: "asc" },
      select: { id: true, firstName: true, lastName: true, companyId: true },
    }),
  ]);
  return { stages, lines, users, companies, contacts };
}
