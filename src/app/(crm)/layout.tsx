import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/user-menu";
import { SearchableSelects } from "@/components/searchable-selects";
import { requireUser } from "@/lib/auth";
import { permissionsOf } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { logout } from "../login/actions";

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const newLeads = await prisma.contact.count({ where: { leadStatus: "NUEVO" } });
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar user={{ name: user.name, role: user.role, permissions: permissionsOf(user) }} newLeads={newLeads} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar user={{ name: user.name, email: user.email, role: user.role }} logout={logout} newLeads={newLeads} />
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
      <SearchableSelects />
    </div>
  );
}
