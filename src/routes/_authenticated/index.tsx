import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, ArrowRight, LineChart, Users2, Factory } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "BI Avanti Pharma" },
      {
        name: "description",
        content: "Escolha um módulo para começar: BI Globo Pharma, BI IMEC ou CRM.",
      },
    ],
  }),
  component: HubPage,
});

const MODULOS = [
  {
    to: "/bi",
    label: "BI Globo Pharma",
    desc: "Inteligência comercial Sell In e Sell Out, dashboards, pedidos e notas fiscais.",
    icon: LineChart,
    scope: "bi-globo",
  },
  {
    to: "/imec",
    label: "BI IMEC",
    desc: "Inteligência comercial da Imec/Nutivit. Módulo em construção.",
    icon: Factory,
    scope: "bi-imec",
  },
  {
    to: "/crm",
    label: "CRM",
    desc: "Carteira de clientes por representada: status de compra, histórico e consolidado.",
    icon: Users2,
    scope: "crm",
  },
] as const;

function HubPage() {
  return (
    <div className="min-h-[calc(100vh-0px)] flex items-center justify-center p-8">
      <div className="w-full max-w-4xl">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-xl bg-primary mb-4 crm-green-glow">
            <Activity className="h-7 w-7 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight">BI AVANTI PHARMA</h1>
          <p className="text-muted-foreground mt-2 text-base max-w-lg mx-auto">
            Escolha um módulo para começar.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {MODULOS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`group relative bi-card p-7 hover:border-primary transition-all duration-200 overflow-hidden ${item.scope}`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <Icon className="h-5 w-5" strokeWidth={2} />
                    </div>
                    <h2 className="font-display text-xl font-bold">{item.label}</h2>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                    Entrar
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-12 text-center text-sm text-muted-foreground">
          Grupo Avanti · BI AVANTI PHARMA
        </div>
      </div>
    </div>
  );
}
