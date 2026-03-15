import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { LayoutDashboard, Building2, Users, CreditCard, Activity, Settings, ShieldAlert, LogOut } from "lucide-react";

export const metadata = { title: "FocalOS Control" };

const navItems = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Workspaces", href: "/admin/workspaces", icon: Building2 },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();
  if (!supabaseUser) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser.id },
    select: { isSuperAdmin: true, fullName: true, email: true },
  });

  if (!user?.isSuperAdmin) redirect("/");

  return (
    <div className="flex h-screen bg-[#080810] text-slate-200 overflow-hidden font-mono">

      {/* Sidebar */}
      <aside className="flex flex-col w-56 shrink-0 border-r border-[#ffffff08] bg-[#05050d]">

        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-[#ffffff08]">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-violet-600 shrink-0">
            <ShieldAlert className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-white tracking-widest uppercase">FocalOS</p>
            <p className="text-[9px] text-violet-400 tracking-widest uppercase">Operator Console</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-0.5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 px-3 py-2 rounded text-[12px] font-medium text-slate-400 hover:text-white hover:bg-white/[0.04] transition-colors"
            >
              <item.icon className="h-3.5 w-3.5 text-violet-500" />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-[#ffffff08] p-3">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-violet-900 flex items-center justify-center text-[10px] font-bold text-violet-300 shrink-0">
              {user.fullName?.[0] ?? "S"}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-violet-300 font-bold truncate">{user.fullName}</p>
              <p className="text-[9px] text-slate-600 truncate">{user.email}</p>
            </div>
          </div>
          <Link
            href="/"
            className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
          >
            <LogOut className="h-3 w-3" /> Back to app
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
