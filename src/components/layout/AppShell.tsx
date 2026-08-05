import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  LayoutDashboard,
  Send,
  FileText,
  TrendingUp,
  ShoppingCart,
  Users,
  Upload,
  LogOut,
  Sun,
  Moon,
  UserPlus,
  LayoutGrid,
  Users2,
  Table2,
  Settings,
  Factory,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";

type NavItem = {
  to: string;
  label: string;
  icon: typeof Activity;
  exact?: boolean;
  editorOnly?: boolean;
  adminOnly?: boolean;
};

const NAV: NavItem[] = [
  { to: "/bi", label: "Início", icon: Activity, exact: true },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/pedidos", label: "Pedidos Enviados", icon: Send },
  { to: "/notas-fiscais", label: "Notas Fiscais", icon: FileText },
  { to: "/sell-in", label: "Sell in", icon: TrendingUp },
  { to: "/sell-out", label: "Sell Out", icon: ShoppingCart },

  { to: "/por-clientes", label: "Por Clientes", icon: Users },
  { to: "/importar", label: "Importar Excel", icon: Upload, editorOnly: true },
  { to: "/acessos", label: "Solicitações de Acesso", icon: UserPlus, adminOnly: true },
];

const CRM_NAV: NavItem[] = [
  { to: "/crm", label: "Painel", icon: LayoutGrid, exact: true },
  { to: "/crm/clientes", label: "Clientes", icon: Users2 },
  { to: "/crm/consolidado", label: "Consolidado", icon: Table2 },
  { to: "/crm/configuracoes", label: "Configurações", icon: Settings },
];

const IMEC_NAV: NavItem[] = [
  { to: "/imec", label: "Início", icon: Factory, exact: true },
  { to: "/imec/pedidos", label: "Pedidos Enviados", icon: Send },
  { to: "/imec/notas-fiscais", label: "Notas Fiscais", icon: FileText },
  { to: "/imec/sell-in", label: "Sell In", icon: TrendingUp },
  { to: "/imec/importar", label: "Importar Excel", icon: Upload, adminOnly: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, roles, signOut, canEdit, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const isHub = path === "/";
  const isCrm = path.startsWith("/crm");
  const isImec = path.startsWith("/imec");
  const isGreenScope = isHub || isCrm;
  const navItems = isCrm ? CRM_NAV : isImec ? IMEC_NAV : NAV;

  const brandTitle = isGreenScope ? "BI AVANTI PHARMA" : isImec ? "BI IMEC" : "BI GLOBO PHARMA";
  const brandSubtitle = isCrm ? "CRM · Carteira de Clientes" : "Inteligência Comercial";
  const iconGlow = isGreenScope ? "crm-green-glow" : isImec ? "bi-imec-glow" : "bi-orange-glow";
  const navSectionLabel = isCrm ? "CRM" : isImec ? "IMEC" : "Operação";

  return (
    <div className={`min-h-screen flex ${isGreenScope ? "crm" : isImec ? "bi-imec" : ""}`}>
      <aside className="w-[260px] shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <Link
            to="/"
            className="flex items-center gap-3 -m-1 p-1 rounded-md hover:bg-sidebar-accent transition-colors"
            title="Voltar ao painel inicial"
          >
            <div
              className={`h-10 w-10 rounded-md bg-primary flex items-center justify-center shrink-0 ${iconGlow}`}
            >
              <Activity className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <div className="leading-tight">
              <div className="font-display text-[15px] font-bold tracking-tight">{brandTitle}</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/60">
                {brandSubtitle}
              </div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {!isHub && (
            <div className="px-2 py-2 bi-stat-label text-sidebar-foreground/60">
              {navSectionLabel}
            </div>
          )}
          {!isHub &&
            navItems
              .filter((i) => (!i.editorOnly || canEdit) && (!i.adminOnly || isAdmin))
              .map((item) => {
                const active = item.exact
                  ? path === item.to
                  : path === item.to || path.startsWith(item.to + "/");
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={[
                      "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground nav-active-glow"
                        : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4" strokeWidth={2.2} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
          {isHub && (
            <p className="px-2 py-2 text-sm text-sidebar-foreground/60">
              Escolha um módulo na tela ao lado.
            </p>
          )}
        </nav>

        <div className="p-3 border-t border-sidebar-border space-y-2">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-sidebar-foreground/85 hover:bg-sidebar-accent transition-colors"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === "dark" ? "Modo claro" : "Modo escuro"}
          </button>
          <div className="px-3 py-2">
            <div className="text-xs text-sidebar-foreground/60 truncate">{user?.email}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {roles.length === 0 && (
                <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50">
                  sem papel
                </span>
              )}
              {roles.map((r) => (
                <span
                  key={r}
                  className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-sidebar-accent text-sidebar-accent-foreground"
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={() => void signOut()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-sidebar-foreground/85 hover:bg-sidebar-accent transition-colors"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
