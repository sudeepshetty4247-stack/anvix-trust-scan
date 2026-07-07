import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, LayoutDashboard, LogOut, Plus, Home } from "lucide-react";
import type { ReactNode } from "react";

export function AppShell({
  children,
  onNewInvestigation,
}: {
  children: ReactNode;
  onNewInvestigation?: () => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border/70 bg-surface/40 backdrop-blur md:flex">
        <Link to="/" className="flex items-center gap-2 px-5 py-5 hover:opacity-80">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/15 ring-1 ring-primary/30">
            <ShieldCheck className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-semibold tracking-tight">ANVIX</span>
        </Link>

        <nav className="flex-1 space-y-1 px-3">
          <NavItem to="/" active={false} icon={<Home className="h-4 w-4" />}>
            Home
          </NavItem>
          <NavItem
            to="/dashboard"
            active={pathname === "/dashboard"}
            icon={<LayoutDashboard className="h-4 w-4" />}
          >
            Dashboard
          </NavItem>
          {onNewInvestigation && (
            <button
              onClick={onNewInvestigation}
              className="mt-3 flex w-full items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> New investigation
            </button>
          )}
        </nav>

        <div className="border-t border-border/70 p-3">
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        {/* Mobile top bar */}
        <div className="flex items-center justify-between border-b border-border/60 bg-surface/40 px-4 py-3 backdrop-blur md:hidden">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-primary/15 ring-1 ring-primary/30">
              <ShieldCheck className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-semibold tracking-tight">ANVIX</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs hover:bg-accent"
            >
              <Home className="h-3.5 w-3.5" /> Home
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs hover:bg-accent"
            >
              <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
            </Link>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}

function NavItem({
  to,
  active,
  icon,
  children,
}: {
  to: string;
  active?: boolean;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
      }`}
    >
      {icon} {children}
    </Link>
  );
}
