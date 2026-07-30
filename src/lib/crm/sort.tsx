import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowDownAZ } from "lucide-react";

export type SortKey = "nome-asc" | "nome-desc" | "compra-recente" | "compra-antiga";

/** Ordena uma lista por nome (A-Z / Z-A) ou pela data de última compra (mais recente / mais antiga primeiro).
 * Clientes sem nenhuma compra registrada sempre ficam por último, nas duas ordens por data. */
export function ordenar<T>(
  items: T[],
  sort: SortKey,
  getNome: (item: T) => string,
  getUltimaCompra?: (item: T) => string | null,
): T[] {
  const arr = [...items];
  if (sort === "nome-asc") {
    arr.sort((a, b) => getNome(a).localeCompare(getNome(b), "pt-BR"));
  } else if (sort === "nome-desc") {
    arr.sort((a, b) => getNome(b).localeCompare(getNome(a), "pt-BR"));
  } else if (getUltimaCompra) {
    arr.sort((a, b) => {
      const av = getUltimaCompra(a);
      const bv = getUltimaCompra(b);
      if (!av && !bv) return 0;
      if (!av) return 1;
      if (!bv) return -1;
      return sort === "compra-recente" ? bv.localeCompare(av) : av.localeCompare(bv);
    });
  }
  return arr;
}

export function SortDropdown({
  value,
  onChange,
  comCompra = false,
}: {
  value: SortKey;
  onChange: (v: SortKey) => void;
  comCompra?: boolean;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as SortKey)}>
      <SelectTrigger className="h-9 w-[220px]">
        <ArrowDownAZ className="h-4 w-4 mr-1.5 text-muted-foreground shrink-0" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="nome-asc">Nome (A → Z)</SelectItem>
        <SelectItem value="nome-desc">Nome (Z → A)</SelectItem>
        {comCompra && <SelectItem value="compra-recente">Compra mais recente primeiro</SelectItem>}
        {comCompra && <SelectItem value="compra-antiga">Compra mais antiga primeiro</SelectItem>}
      </SelectContent>
    </Select>
  );
}
