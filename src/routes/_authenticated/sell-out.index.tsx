import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sell-out/")({ component: SellOutIndex });

function SellOutIndex() {
  const { data: clientes } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => (await supabase.from("clientes").select("id,nome").order("nome")).data ?? [],
  });

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <header className="mb-8">
        <div className="bi-stat-label">Selecione um cliente</div>
        <h1 className="font-display text-3xl font-bold mt-1">Consolidado Sell Out</h1>
        <p className="text-muted-foreground mt-2">Acompanhamento mensal e mapas de vendas por distribuidor.</p>
      </header>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {(clientes ?? []).map((c) => (
          <Link key={c.id} to="/sell-out/$clienteId" params={{ clienteId: c.id }}
            className="bi-card p-5 hover:border-primary group transition-colors">
            <div className="h-9 w-9 rounded bg-primary/15 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <div className="font-display font-bold mt-3">{c.nome}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
