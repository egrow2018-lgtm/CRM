import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { contactName, formatDate } from "@/lib/format";
import { EmptyState, PageHeader, Pagination } from "@/components/ui";
import { IconPlus } from "@/components/icons";
import { SearchBox } from "@/components/search-box";

const PAGE_SIZE = 50;

export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const user = await requireUser();
  const { q, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const where: Prisma.ContactWhereInput = q
    ? {
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
          { company: { name: { contains: q, mode: "insensitive" } } },
        ],
      }
    : {};
  const [total, contacts] = await Promise.all([
    prisma.contact.count({ where }),
    prisma.contact.findMany({
      where,
      include: { company: { select: { id: true, name: true } }, owner: { select: { name: true } } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Contactos"
        subtitle={`${total} contactos`}
        actions={can(user.role, "crm:write") && <Link href="/contactos/nuevo" className="btn btn-primary"><IconPlus /> Nuevo contacto</Link>}
      />
      <SearchBox placeholder="Buscar por nombre, email, teléfono o empresa" />
      {contacts.length === 0 ? (
        <EmptyState>No hay contactos{q ? " que coincidan con la búsqueda" : ""}.</EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>Nombre</th><th>Email</th><th>Teléfono</th><th>Cargo</th><th>Empresa</th><th>Propietario</th><th>Creado</th></tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td><Link className="link" href={`/contactos/${c.id}`}>{contactName(c)}</Link></td>
                  <td>{c.email ? <a className="hover:underline" href={`mailto:${c.email}`}>{c.email}</a> : "—"}</td>
                  <td>{c.phone ?? "—"}</td>
                  <td>{c.jobTitle ?? "—"}</td>
                  <td>{c.company ? <Link className="hover:underline" href={`/empresas/${c.company.id}`}>{c.company.name}</Link> : "—"}</td>
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
        makeHref={(p) => `/contactos?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`}
      />
    </div>
  );
}
