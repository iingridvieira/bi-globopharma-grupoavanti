import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Histórico de compras do CRM: cada linha é uma compra registrada para um vínculo
 * cliente<->representada, numa data específica. A "última compra" exibida na
 * tela é sempre a mais recente desse histórico, independente do mês que está
 * sendo visualizado no momento.
 */

/** Registra uma compra numa data. Se já existir uma compra nessa mesma data, não duplica. */
export async function registrarCompra(
  userId: string,
  clienteRepresentadaId: string,
  dataCompra: string,
) {
  const { error } = await supabase
    .from("crm_compras")
    .upsert(
      { user_id: userId, cliente_representada_id: clienteRepresentadaId, data_compra: dataCompra },
      { onConflict: "cliente_representada_id,data_compra" },
    );
  if (error) throw error;
}

/** Busca, para uma lista de vínculos cliente<->representada, a data da compra mais recente de cada um. */
export async function fetchUltimasCompras(crIds: string[]): Promise<Map<string, string>> {
  if (crIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("crm_compras")
    .select("cliente_representada_id, data_compra")
    .in("cliente_representada_id", crIds)
    .order("data_compra", { ascending: false });
  if (error) throw error;
  const map = new Map<string, string>();
  for (const row of data) {
    if (!map.has(row.cliente_representada_id))
      map.set(row.cliente_representada_id, row.data_compra);
  }
  return map;
}

/** Hook: última compra (global, de qualquer mês) de cada vínculo cliente<->representada informado. */
export function useUltimasCompras(crIds: string[]) {
  const key = crIds.slice().sort().join(",");
  return useQuery({
    queryKey: ["crm-ultimas-compras", key],
    enabled: crIds.length > 0,
    queryFn: () => fetchUltimasCompras(crIds),
  });
}
