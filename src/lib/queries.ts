import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

export type DealFilters = { q?: string; owner?: string; line?: string; from?: string; to?: string };

export function dealWhere(f: DealFilters, currentUserId: string): Prisma.DealWhereInput {
  const where: Prisma.DealWhereInput = {};
  if (f.q) {
    where.OR = [
      { name: { contains: f.q, mode: "insensitive" } },
      { company: { name: { contains: f.q, mode: "insensitive" } } },
      { contact: { firstName: { contains: f.q, mode: "insensitive" } } },
      { contact: { lastName: { contains: f.q, mode: "insensitive" } } },
    ];
  }
  if (f.owner === "me") where.ownerId = currentUserId;
  else if (f.owner === "none") where.ownerId = null;
  else if (f.owner) where.ownerId = f.owner;
  if (f.line === "none") where.businessLineId = null;
  else if (f.line) where.businessLineId = f.line;
  if (f.from || f.to) {
    where.closeDate = {
      ...(f.from ? { gte: new Date(`${f.from}T00:00:00Z`) } : {}),
      ...(f.to ? { lte: new Date(`${f.to}T23:59:59Z`) } : {}),
    };
  }
  return where;
}

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
