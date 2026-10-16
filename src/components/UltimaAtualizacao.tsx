import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Clock } from "lucide-react";

/**
 * Mostra a data e hora da última atualização de uma área alimentada
 * por importação de Excel ou lançamento manual.
 * Usa a coluna de timestamp mais recente da tabela informada.
 */
export function UltimaAtualizacao({
  tabela,
  coluna = "updated_at",
  className = "",
}: {
  tabela: string | string[];
  coluna?: "updated_at" | "created_at";
  className?: string;
}) {
  const tabelas = Array.isArray(tabela) ? tabela : [tabela];
  const { data } = useQuery({
    queryKey: ["ultima-atualizacao", tabelas.join("|"), coluna],
    queryFn: async () => {
      const resultados = await Promise.all(
        tabelas.map(async (t) => {
          const { data, error } = await supabase
            .from(t as never)
            .select(coluna)
            .order(coluna, { ascending: false })
            .limit(1);
          if (error) return null;
          return (data?.[0] as Record<string, string> | undefined)?.[coluna] ?? null;
        }),
      );
      const validos = resultados.filter((v): v is string => !!v);
      if (!validos.length) return null;
      return validos.sort().reverse()[0];
    },
    staleTime: 60_000,
  });

  if (!data) return null;
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) return null;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs text-muted-foreground ${className}`}
      title="Data e hora da última atualização desta área"
    >
      <Clock className="h-3.5 w-3.5" />
      Atualizado em {dd}/{mm}/{d.getFullYear()} às {hh}:{mi}
    </span>
  );
}
