import type { ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { LogOut, Settings, Wrench, AlertTriangle, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { AppPermission, AppRole } from "@/lib/roles";
import { hasAnyPermission, roleLabels } from "@/lib/roles";

type AppShellProps = {
  children: ReactNode;
  title: string;
  roles: AppRole[];
};

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  permissions?: AppPermission[];
};

const navItems: NavItem[] = [
  { to: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard, permissions: ["dashboard.read"] },
  {
    to: "/engineers",
    label: "المهندسون",
    icon: Wrench,
    permissions: ["engineers.read_all", "engineers.read_assigned"],
  },
  {
    to: "/catalog",
    label: "الفئات والعلامات والمنتجات",
    icon: Settings,
    permissions: ["products.read"],
  },
  {
    to: "/error-codes",
    label: "رموز الأخطاء",
    icon: AlertTriangle,
    permissions: ["error_codes.read"],
  },
];

export function AppShell({ children, title, roles }: AppShellProps) {
  const location = useLocation();

  const visibleItems = navItems.filter((item) => {
    if (!item.permissions) return true;
    return hasAnyPermission(roles, item.permissions);
  });

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 md:px-6">
          <div>
            <p className="text-sm text-muted-foreground">نظام إدارة الصيانة والخدمة الميدانية</p>
            <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
              {roles.map((role) => roleLabels[role]).join(" · ")}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const { error } = await supabase.auth.signOut();
                if (error) {
                  toast.error("تعذر تسجيل الخروج");
                  return;
                }
                toast.success("تم تسجيل الخروج");
                window.location.href = "/auth";
              }}
            >
              <LogOut className="h-4 w-4" />
              تسجيل الخروج
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 px-4 py-5 md:grid-cols-[260px_1fr] md:px-6">
        <aside className="rounded-lg border bg-card p-3">
          <nav className="space-y-1">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
                    active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent"
                  }`}
                >
                  <span>{item.label}</span>
                  <Icon className="h-4 w-4" />
                </Link>
              );
            })}
          </nav>
        </aside>

        <main>{children}</main>
      </div>
    </div>
  );
}