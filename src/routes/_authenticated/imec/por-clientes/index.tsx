import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeKey } from "@/lib/cliente-mapping";

const CLIENTES_VISIVEIS = ["ANDORINHA", "DF COMERCIAL", "DISMAP", "GA COMERCIAL", "NAVARRO INTER", "NAVARRO SP", "NÚCLEO FARMA", "MEDSOL"].map(normalizeKey);

export const Route = createFileRoute("/_authenticated/imec/por-clientes/")({
  head: () => ({
    meta: [
      { title: "Por Clientes · BI IMEC" },
      { name: "description", content: "Sell In e pendências em aberto por cliente do BI IMEC." },
      { property: "og:title", content: "Por Clientes · BI IMEC" },
      { property: "og:description", content: "Sell In e pendências em aberto por cliente do BI IMEC." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ImecPorClientes,
});

function ImecPorClientes() {
  const { data, isLoading } = useQuery({
    queryKey: ["imec-por-clientes"],
    queryFn: async () => {
      const { data: clientes, error } = await supabase.from("imec_clientes").select("id,nome").eq("ativo", true).order("nome");
      if (error) throw error;
      return (clientes ?? []).filter((c) => CLIENTES_VISIVEIS.includes(normalizeKey(c.nome)));
    },
  });

  return (
    <div className="p-5 sm:p-8 max-w-[1600px] mx-auto">
      <header className="mb-8">
        <div className="bi-stat-label">Operação · IMEC / Nutivit</div>
        <h1 className="font-display text-3xl font-bold mt-1 flex items-center gap-2"><Users className="h-7 w-7 text-primary" /> Por Clientes</h1>
        <p className="text-sm text-muted-foreground mt-1">Selecione um cliente para visualizar Sell In, Sell Out e pendências.</p>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {(data ?? []).map((cliente) => (
          <Link key={cliente.id} to="/imec/por-clientes/$clienteId" params={{ clienteId: cliente.id }} className="bi-card p-6 border border-border hover:border-primary hover:shadow-md transition-all flex items-center justify-center text-center min-h-[120px]">
            <span className="font-display text-lg font-semibold text-card-foreground">{cliente.nome}</span>
          </Link>
        ))}
      </div>
      {isLoading && <div className="text-center text-muted-foreground py-12">Carregando…</div>}
      {!isLoading && (data?.length ?? 0) === 0 && <div className="text-center text-muted-foreground py-12">Nenhum cliente encontrado.</div>}
    </div>
  );
}
