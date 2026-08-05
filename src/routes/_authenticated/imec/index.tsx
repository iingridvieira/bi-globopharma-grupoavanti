import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard,
  Send,
  FileText,
  TrendingUp,
  Upload,
  ArrowRight,
  Factory,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/imec/")({
  head: () => ({
    meta: [
      { title: "BI IMEC — Início" },
      {
        name: "description",
        content: "Escolha uma área do BI IMEC: dashboard, pedidos, notas fiscais ou sell in.",
      },
      { property: "og:title", content: "BI IMEC — Início" },
      {
        property: "og:description",
        content: "Inteligência comercial IMEC/Nutivit: dashboard, pedidos, notas fiscais e sell in.",
      },
    ],
  }),
  component: ImecHome,
});

const MENU_ITEMS = [
  {
    to: "/imec/dashboard",
    label: "Dashboard",
    desc: "Visão executiva do mês · enviado x faturado por cliente",
    icon: LayoutDashboard,
  },
  {
    to: "/imec/pedidos",
    label: "Pedidos Enviados",
    desc: "Relatório completo de pedidos enviados por período",
    icon: Send,
  },
  {
    to: "/imec/notas-fiscais",
    label: "Notas Fiscais",
    desc: "Consulta e filtro de notas fiscais emitidas",
    icon: FileText,
  },
  {
    to: "/imec/sell-in",
    label: "Sell In",
    desc: "Consolidado mensal e anual de vendas Sell In",
    icon: TrendingUp,
  },
] as const;

const ADMIN_ITEM = {
  to: "/imec/importar",
  label: "Importar Excel",
  desc: "Importar planilhas de faturamento IMEC e Nutivit",
  icon: Upload,
} as const;

function ImecHome() {
  const { isAdmin } = useAuth();
  const items = isAdmin ? [...MENU_ITEMS, ADMIN_ITEM] : [...MENU_ITEMS];

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <div className="mb-10 text-center">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-xl bg-primary mb-4 bi-imec-glow">
          <Factory className="h-7 w-7 text-primary-foreground" strokeWidth={2.5} />
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight">BI IMEC</h1>
        <p className="text-muted-foreground mt-2 text-base max-w-lg mx-auto">
          Plataforma de inteligência comercial IMEC · Nutivit. Escolha uma área para começar.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className="group relative bi-card p-6 hover:border-primary transition-all duration-200 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              <div className="relative z-10 flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <Icon className="h-5 w-5" strokeWidth={2} />
                    </div>
                    <h2 className="font-display text-lg font-bold">{item.label}</h2>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0 mt-1 ml-3" />
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-12 text-center text-sm text-muted-foreground">
        Sistema de Inteligência Comercial · IMEC / NUTIVIT
      </div>
    </div>
  );
}
