import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  LayoutGrid,
  Users2,
  Table2,
  Settings,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import logoAvantiWhite from "@/assets/avanti-pharma-logo-white.png.asset.json";

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
];

const CRM_NAV: NavItem[] = [
  { to: "/crm", label: "Painel", icon: LayoutGrid, exact: true },
  { to: "/crm/clientes", label: "Clientes", icon: Users2 },
  { to: "/crm/consolidado", label: "Consolidado", icon: Table2 },
  { to: "/crm/configuracoes", label: "Configurações", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, roles, signOut, canEdit, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [path]);

  const isHub = path === "/";
  const isCrm = path.startsWith("/crm");
  const isGreenScope = isHub || isCrm;
  const navItems = isCrm ? CRM_NAV : NAV;

  const brandLine = isCrm
    ? "CRM · Carteira de Clientes"
    : isHub
      ? "Inteligência Comercial"
      : "BI GLOBO PHARMA";
  const navSectionLabel = isCrm ? "CRM" : "Operação";

  return (
    <div className={`min-h-screen flex page-glow ${isGreenScope ? "crm" : ""}`}>
      <header
        className="md:hidden fixed top-0 inset-x-0 z-40 flex items-center gap-3 border-b border-sidebar-border bg-sidebar text-sidebar-foreground px-3"
        style={{ paddingTop: "env(safe-area-inset-top)", height: "calc(56px + env(safe-area-inset-top))" }}
      >
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menu"
          className="h-11 w-11 shrink-0 flex items-center justify-center rounded-md hover:bg-sidebar-accent"
        >
          <Menu className="h-6 w-6" />
        </button>
        <Link to="/" className="shrink-0" aria-label="Voltar ao painel inicial">
          <img src={logoAvantiWhite.url} alt="Avanti Pharma" className="h-6 w-auto" />
        </Link>
      </header>
      {menuOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-background/70 backdrop-blur-sm"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        className={`w-[260px] max-w-[85vw] shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex flex-col fixed md:static inset-y-0 left-0 z-50 transition-transform duration-200 md:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <button
          onClick={() => setMenuOpen(false)}
          aria-label="Fechar menu"
          className="md:hidden absolute right-2 top-2 h-10 w-10 flex items-center justify-center rounded-md hover:bg-sidebar-accent"
          style={{ marginTop: "env(safe-area-inset-top)" }}
        >
          <X className="h-5 w-5" />
        </button>
        <div className="px-5 py-5 border-b border-sidebar-border">
          <Link
            to="/"
            className="block -m-1 p-1 rounded-md hover:bg-sidebar-accent transition-colors"
            title="Voltar ao painel inicial"
          >
            <img src={logoAvantiWhite.url} alt="Avanti Pharma" className="h-8 w-auto" />
            <div className="mt-2.5 text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/60">
              {brandLine}
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

      <main
        className="flex-1 min-w-0 overflow-x-hidden pt-[calc(56px+env(safe-area-inset-top))] md:pt-0"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {children}
      </main>
    </div>
  );
}
