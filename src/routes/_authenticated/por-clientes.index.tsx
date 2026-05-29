import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Users, Globe2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/por-clientes/")({ component: PorClientesIndex });

const CLIENTES_PERMITIDOS = new Set([
  "ANDORINHA", "CAMPEÃ", "CG MEDICAMENTOS", "DF COMERCIAL", "DISMAP",
  "JK MEDICAMENTOS", "MAXIFARMA", "MEDSOL", "MILFARMA",
  "NAVARRO INTER", "NAVARRO SP", "NÚCLEO FARMA",
].map((s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()));

function isClientePermitido(nome: string): boolean {
  return CLIENTES_PERMITIDOS.has(nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase());
}

function PorClientesIndex() {
  const { data } = useQuery({
    queryKey: ["por-clientes-lista"],
    queryFn: async () => {
      const { data: clientes } = await supabase.from("clientes").select("id,nome").order("nome");
      return (clientes ?? [])
        .filter((c) => isClientePermitido(c.nome))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    },
  });

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <header className="mb-8">
        <div className="bi-stat-label">Operação</div>
        <h1 className="font-display text-3xl font-bold mt-1 flex items-center gap-2">
          <Users className="h-7 w-7 text-primary" /> Por Clientes
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Selecione um cliente para visualizar Sell In, Sell Out e Mapas de Vendas.
        </p>
      </header>

      <div className="mb-6">
        <Link
          to="/por-clientes/geral"
          className="bi-card p-6 rounded-xl border border-primary/40 bg-gradient-to-br from-primary/10 to-card hover:border-primary hover:shadow-lg transition-all flex items-center gap-4"
        >
          <div className="h-12 w-12 rounded-lg bg-primary/15 flex items-center justify-center">
            <Globe2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <div className="font-display text-xl font-bold">GERAL</div>
            <div className="text-xs text-muted-foreground">Visão consolidada de todos os clientes (Sell In + Sell Out)</div>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {(data ?? []).map((c) => (
          <Link
            key={c.id}
            to="/por-clientes/$clienteId"
            params={{ clienteId: c.id }}
            className="bi-card p-6 rounded-xl border border-border bg-card hover:border-primary hover:shadow-md transition-all flex items-center justify-center text-center min-h-[120px]"
          >
            <span className="font-display text-lg font-semibold text-card-foreground">{c.nome}</span>
          </Link>
        ))}
      </div>

      {(data ?? []).length === 0 && (
        <div className="text-center text-muted-foreground py-12">
          Nenhum cliente encontrado.
        </div>
      )}
    </div>
  );
}
