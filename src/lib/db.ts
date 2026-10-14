import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

// El costo del desarrollo es confidencial: no viaja en ninguna consulta de negocios salvo que se pida
// explícitamente (select: { developmentCost: true }) donde el usuario tiene el permiso deals:cost.
const createClient = () => new PrismaClient({ omit: { deal: { developmentCost: true } } });

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
