import { Sidebar } from "@/components/sidebar";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logout } from "../login/actions";

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const newLeads = await prisma.contact.count({ where: { leadStatus: "NUEVO" } });
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar user={{ name: user.name, role: user.role }} logout={logout} newLeads={newLeads} />
      <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
