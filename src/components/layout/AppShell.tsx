import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, LayoutDashboard, Send, FileText, TrendingUp, Users, Upload, LogOut, Sun, Moon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";

const NAV = [
  { to: "/", label: "Início", icon: Activity, exact: true },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/pedidos", label: "Pedidos Enviados", icon: Send },
  { to: "/notas-fiscais", label: "Notas Fiscais", icon: FileText },
  { to: "/sell-in", label: "Sell in", icon: TrendingUp },
  
  { to: "/por-clientes", label: "Por Clientes", icon: Users },
  { to: "/importar", label: "Importar Excel", icon: Upload, editorOnly: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, roles, signOut, canEdit } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen flex">
      <aside className="w-[260px] shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-primary flex items-center justify-center bi-orange-glow">
              <Activity className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <div className="leading-tight">
              <div className="font-display text-[15px] font-bold tracking-tight">BI GLOBO PHARMA</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/60">Inteligência Comercial</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <div className="px-2 py-2 bi-stat-label text-sidebar-foreground/60">Operação</div>
          {NAV
            .filter((i) => !i.editorOnly || canEdit)
            
            .map((item) => {
            const active = item.exact ? path === item.to : path === item.to || path.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={[
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-[0_6px_18px_-6px_oklch(0.70_0.19_50/0.6)]"
                    : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                ].join(" ")}
              >
                <Icon className="h-4 w-4" strokeWidth={2.2} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border space-y-2">
          <button onClick={toggleTheme}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-sidebar-foreground/85 hover:bg-sidebar-accent transition-colors">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === "dark" ? "Modo claro" : "Modo escuro"}
          </button>
          <div className="px-3 py-2">
            <div className="text-xs text-sidebar-foreground/60 truncate">{user?.email}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {roles.length === 0 && <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50">sem papel</span>}
              {roles.map((r) => (
                <span key={r} className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-sidebar-accent text-sidebar-accent-foreground">
                  {r}
                </span>
              ))}
            </div>
          </div>
          <button onClick={() => void signOut()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-sidebar-foreground/85 hover:bg-sidebar-accent transition-colors">
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}
