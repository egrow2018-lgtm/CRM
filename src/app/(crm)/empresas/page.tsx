import Link from "next/link";
import { CompanyLogo } from "@/components/company-logo";
import { websiteDomain } from "@/lib/csv";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { EmptyState, PageHeader, Pagination } from "@/components/ui";
import { IconPlus } from "@/components/icons";
import { SearchBox } from "@/components/search-box";

const PAGE_SIZE = 50;

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const user = await requireUser();
  const { q, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const where: Prisma.CompanyWhereInput = q
    ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { taxId: { contains: q } }, { city: { contains: q, mode: "insensitive" } }] }
    : {};
  const [total, companies] = await Promise.all([
    prisma.company.count({ where }),
    prisma.company.findMany({
      where,
      include: { owner: { select: { name: true } }, _count: { select: { contacts: true, deals: true } } },
      orderBy: { name: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Empresas"
        subtitle={`${total} empresas`}
        actions={
          can(user.role, "crm:write") && (
            <Link href="/empresas/nueva" className="btn btn-primary"><IconPlus /> Nueva empresa</Link>
          )
        }
      />
      <SearchBox placeholder="Buscar por nombre, RUC o ciudad" />
      {companies.length === 0 ? (
        <EmptyState>No hay empresas{q ? " que coincidan con la búsqueda" : ""}.</EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th><th>Industria</th><th>Ciudad</th><th className="text-right">Contactos</th><th className="text-right">Negocios</th><th>Propietario</th><th>Creada</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td>
                    <Link className="link inline-flex items-center gap-2" href={`/empresas/${c.id}`}>
                      <CompanyLogo name={c.name} domain={websiteDomain(c.website)} />
                      {c.name}
                    </Link>
                  </td>
                  <td>{c.industry ?? "—"}</td>
                  <td>{[c.city, c.country].filter(Boolean).join(", ") || "—"}</td>
                  <td className="text-right">{c._count.contacts}</td>
                  <td className="text-right">{c._count.deals}</td>
                  <td>{c.owner?.name ?? "—"}</td>
                  <td>{formatDate(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination
        page={page}
        pages={Math.ceil(total / PAGE_SIZE)}
        makeHref={(p) => `/empresas?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`}
      />
    </div>
  );
}
