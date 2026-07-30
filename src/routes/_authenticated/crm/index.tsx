import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { STATUS_META, type ClienteStatus } from "@/lib/crm/status";
import { Users, CheckCircle2, Circle, TrendingUp, Ban, ArrowRight } from "lucide-react";
import { useMes, formatMesLabel, isCurrentMes } from "@/lib/crm/mes";
import { RepresentadaLogo } from "@/lib/crm/representadas";

export const Route = createFileRoute("/_authenticated/crm/")({
  head: () => ({
    meta: [
      { title: "Painel CRM | BI Avanti Pharma" },
      {
        name: "description",
        content: "Visão geral da carteira de clientes por representada e mês.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { mes } = useMes();

  const repsQuery = useQuery({
    queryKey: ["crm-representadas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_representadas")
        .select("id, nome, slug, ordem, logo_url")
        .order("ordem");
      if (error) throw error;
      return data;
    },
  });

  const crQuery = useQuery({
    queryKey: ["crm-cliente-representadas-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_cliente_representadas")
        .select("id, representada_id, cliente_id");
      if (error) throw error;
      return data;
    },
  });

  const smQuery = useQuery({
    queryKey: ["crm-status-mensal", mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_status_mensal")
        .select("cliente_representada_id, status")
        .eq("mes_ref", mes);
      if (error) throw error;
      return data;
    },
  });

  const crList = crQuery.data ?? [];
  const smByCr = new Map<string, ClienteStatus>();
  (smQuery.data ?? []).forEach((s) =>
    smByCr.set(s.cliente_representada_id, s.status as ClienteStatus),
  );

  const statusFor = (crId: string): ClienteStatus => smByCr.get(crId) ?? "nao_comprou";

  const stats = crList.reduce(
    (acc, cr) => {
      const s = statusFor(cr.id);
      acc.total++;
      acc[s]++;
      return acc;
    },
    { total: 0, comprou: 0, negociacao: 0, nao_comprou: 0, inativo: 0 } as Record<string, number>,
  );

  const ativos = stats.total - stats.inativo;
  const pct = ativos > 0 ? Math.round((stats.comprou / ativos) * 100) : 0;

  const cardsData = [
    { label: "Total de vínculos", value: stats.total, icon: Users, color: "text-foreground" },
    {
      label: "Compraram",
      value: stats.comprou,
      icon: CheckCircle2,
      color: "text-crm-status-comprou",
    },
    {
      label: "Em negociação",
      value: stats.negociacao,
      icon: TrendingUp,
      color: "text-crm-status-negociacao",
    },
    {
      label: "Não compraram",
      value: stats.nao_comprou,
      icon: Circle,
      color: "text-crm-status-nao-comprou",
    },
    { label: "Inativos", value: stats.inativo, icon: Ban, color: "text-crm-status-inativo" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold tracking-tight">Painel CRM</h1>
          <span className="text-sm text-muted-foreground capitalize">
            {formatMesLabel(mes)}
            {!isCurrentMes(mes) && " (histórico)"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Cobertura da carteira, status por representada e clientes trabalhados no mês.
        </p>
      </div>

      {/* Progress */}
      <Card className="p-6 bg-card border-border shadow-sm">
        <div className="flex items-baseline justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Cobertura da carteira ativa</p>
            <p className="text-4xl font-semibold mt-1 tracking-tight">
              {pct}
              <span className="text-lg text-muted-foreground">%</span>
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            {stats.comprou} de {ativos} vínculos ativos compraram
          </p>
        </div>
        <Progress value={pct} className="mt-4" />
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cardsData.map((s) => (
          <Card key={s.label} className="p-4 bg-card border-border shadow-sm">
            <div className="flex items-center gap-2">
              <s.icon className={`h-4 w-4 ${s.color}`} />
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
            <p className="text-2xl font-semibold mt-2">{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Representadas */}
      <div>
        <h2 className="text-lg font-semibold tracking-tight mb-3">Representadas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {repsQuery.data?.map((r) => {
            const crs = crList.filter((c) => c.representada_id === r.id);
            const total = crs.length;
            const statuses = crs.map((c) => statusFor(c.id));
            const compraram = statuses.filter((s) => s === "comprou").length;
            const negoc = statuses.filter((s) => s === "negociacao").length;
            const nao = statuses.filter((s) => s === "nao_comprou").length;
            const ativosR = total - statuses.filter((s) => s === "inativo").length;
            const p = ativosR > 0 ? Math.round((compraram / ativosR) * 100) : 0;
            return (
              <Link
                key={r.id}
                to="/crm/representada/$slug"
                params={{ slug: r.slug }}
                className="group"
              >
                <Card className="p-5 bg-card border-border hover:border-primary/40 hover:shadow-md transition-all">
                  <div className="flex items-start gap-3">
                    <RepresentadaLogo path={r.logo_url} nome={r.nome} size={48} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-lg truncate">{r.nome}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {total} {total === 1 ? "cliente" : "clientes"}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-3 text-xs">
                    <StatusPill count={compraram} kind="comprou" />
                    <StatusPill count={negoc} kind="negociacao" />
                    <StatusPill count={nao} kind="nao_comprou" />
                  </div>
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                      <span>Cobertura</span>
                      <span className="font-medium text-foreground">{p}%</span>
                    </div>
                    <Progress value={p} />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ count, kind }: { count: number; kind: ClienteStatus }) {
  const meta = STATUS_META[kind];
  return (
    <div className="flex items-center gap-1.5" title={meta.label}>
      <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
      <span className="text-muted-foreground">{count}</span>
    </div>
  );
}
