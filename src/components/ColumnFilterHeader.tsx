import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownAZ, ArrowUpAZ, ArrowDown01, ArrowUp10, Check, Filter, Search, X } from "lucide-react";

export type ColumnSort = "asc" | "desc" | null;
export type ColumnType = "text" | "number" | "date";

/**
 * Cabeçalho de coluna estilo Excel: ordenação + filtro multi-seleção com busca.
 *
 * Uso:
 *  - `values`: lista de valores distintos da coluna (já como strings exibidas).
 *  - `selected`: subconjunto selecionado (vazio = todos).
 *  - `sort`: 'asc' | 'desc' | null.
 *  - O componente é meramente apresentacional/controlado; a página é responsável
 *    por aplicar `selected` (filtro) e `sort` (ordenação) ao dataset.
 */
export function ColumnFilterHeader({
  label,
  values,
  selected,
  onChange,
  sort,
  onSortChange,
  type = "text",
  align = "left",
  className = "",
}: {
  label: React.ReactNode;
  values: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  sort: ColumnSort;
  onSortChange: (s: ColumnSort) => void;
  type?: ColumnType;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const distinct = useMemo(() => {
    const set = new Set<string>();
    values.forEach((v) => set.add(v ?? ""));
    const arr = Array.from(set);
    if (type === "number") {
      arr.sort((a, b) => parseBRNum(a) - parseBRNum(b));
    } else if (type === "date") {
      arr.sort((a, b) => parseBRDate(a) - parseBRDate(b));
    } else {
      arr.sort((a, b) => a.localeCompare(b, "pt-BR"));
    }
    return arr;
  }, [values, type]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return distinct;
    return distinct.filter((v) => v.toLowerCase().includes(t));
  }, [distinct, q]);

  const allSel = filtered.length > 0 && filtered.every((v) => selected.includes(v));
  function toggleAll() {
    if (allSel) onChange(selected.filter((s) => !filtered.includes(s)));
    else onChange(Array.from(new Set([...selected, ...filtered])));
  }
  function toggle(v: string) {
    onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);
  }

  const active = selected.length > 0 || !!sort;
  const isNum = type === "number" || type === "date";
  const justify = align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";

  return (
    <div ref={wrap} className={`relative inline-flex ${justify} w-full ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${active ? "text-primary" : ""}`}
        title="Filtrar / ordenar"
      >
        <span className="truncate">{label}</span>
        {sort === "asc" && (isNum ? <ArrowDown01 className="h-3.5 w-3.5" /> : <ArrowDownAZ className="h-3.5 w-3.5" />)}
        {sort === "desc" && (isNum ? <ArrowUp10 className="h-3.5 w-3.5" /> : <ArrowUpAZ className="h-3.5 w-3.5" />)}
        <Filter className={`h-3.5 w-3.5 ${selected.length > 0 ? "fill-primary" : "opacity-60"}`} />
      </button>

      {open && (
        <div
          className="absolute z-50 top-full mt-1 bg-popover border border-border rounded-md shadow-lg w-64"
          style={{ [align === "right" ? "right" : "left"]: 0 } as React.CSSProperties}
        >
          <div className="flex border-b border-border">
            <button
              type="button"
              onClick={() => onSortChange(sort === "asc" ? null : "asc")}
              className={`flex-1 px-2 py-1.5 text-xs flex items-center gap-1 justify-center hover:bg-accent ${sort === "asc" ? "text-primary font-semibold" : ""}`}
            >
              {isNum ? <ArrowDown01 className="h-3.5 w-3.5" /> : <ArrowDownAZ className="h-3.5 w-3.5" />}
              {isNum ? "Menor → Maior" : "A → Z"}
            </button>
            <button
              type="button"
              onClick={() => onSortChange(sort === "desc" ? null : "desc")}
              className={`flex-1 px-2 py-1.5 text-xs flex items-center gap-1 justify-center hover:bg-accent border-l border-border ${sort === "desc" ? "text-primary font-semibold" : ""}`}
            >
              {isNum ? <ArrowUp10 className="h-3.5 w-3.5" /> : <ArrowUpAZ className="h-3.5 w-3.5" />}
              {isNum ? "Maior → Menor" : "Z → A"}
            </button>
          </div>

          <div className="relative border-b border-border">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar..."
              className="w-full pl-7 pr-2 h-8 bg-transparent text-sm outline-none"
            />
          </div>

          <div className="max-h-56 overflow-y-auto py-1">
            <button
              type="button"
              onClick={toggleAll}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent text-left"
            >
              <span className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${allSel ? "bg-primary border-primary" : "border-border"}`}>
                {allSel && <Check className="h-3 w-3 text-primary-foreground" />}
              </span>
              <span className="font-medium">(Selecionar tudo)</span>
            </button>
            {filtered.map((v) => {
              const checked = selected.includes(v);
              return (
                <button
                  type="button"
                  key={v || "__vazio__"}
                  onClick={() => toggle(v)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent text-left"
                >
                  <span className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${checked ? "bg-primary border-primary" : "border-border"}`}>
                    {checked && <Check className="h-3 w-3 text-primary-foreground" />}
                  </span>
                  <span className="truncate">{v === "" ? "(em branco)" : v}</span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="px-2 py-3 text-xs text-muted-foreground text-center">Nenhum resultado.</div>
            )}
          </div>

          {(selected.length > 0 || sort) && (
            <div className="border-t border-border p-1.5 flex justify-between">
              <button
                type="button"
                onClick={() => { onChange([]); onSortChange(null); setQ(""); }}
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-2"
              >
                <X className="h-3 w-3" /> Limpar
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs text-primary font-semibold px-2"
              >
                OK
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Botão discreto para limpar todos os filtros/ordenações da tabela. */
export function ClearFiltersButton({
  filters,
  sorts,
  onReset,
  className = "",
  label = "Limpar filtros",
}: {
  filters: Record<string, string[]>;
  sorts: Record<string, ColumnSort>;
  onReset: () => void;
  className?: string;
  label?: string;
}) {
  const active =
    Object.values(filters).some((f) => (f?.length ?? 0) > 0) ||
    Object.values(sorts).some((s) => !!s);
  if (!active) return null;
  return (
    <button
      type="button"
      onClick={onReset}
      className={`text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline inline-flex items-center gap-1 ${className}`}
      title="Limpar todos os filtros e ordenações desta tabela"
    >
      <X className="h-3 w-3" /> {label}
    </button>
  );
}

function parseBRNum(s: string): number {
  if (!s) return 0;
  const n = Number(String(s).replace(/[^\d,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function parseBRDate(s: string): number {
  // dd/mm/aaaa or yyyy-mm-dd
  if (!s) return 0;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s).getTime();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}`).getTime();
  return 0;
}

/** Hook utilitário: aplica filtros + ordenação multi-coluna ao dataset.
 *  `getters` mapeia chave → função que extrai o valor exibido (string) da linha.
 *  `types` define o tipo de cada coluna (default 'text').
 */
export function useColumnFilters<T>(
  rows: T[],
  getters: Record<string, (r: T) => string>,
  types: Record<string, ColumnType> = {},
) {
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [sorts, setSorts] = useState<Record<string, ColumnSort>>({});

  const distinct = useMemo(() => {
    const out: Record<string, string[]> = {};
    Object.keys(getters).forEach((k) => {
      const set = new Set<string>();
      rows.forEach((r) => set.add(getters[k](r) ?? ""));
      out[k] = Array.from(set);
    });
    return out;
  }, [rows, getters]);

  const view = useMemo(() => {
    let out = rows;
    Object.keys(filters).forEach((k) => {
      const sel = filters[k];
      if (!sel || sel.length === 0) return;
      const get = getters[k]; if (!get) return;
      const set = new Set(sel);
      out = out.filter((r) => set.has(get(r) ?? ""));
    });
    const sortKeys = Object.keys(sorts).filter((k) => sorts[k]);
    if (sortKeys.length > 0) {
      out = [...out].sort((a, b) => {
        for (const k of sortKeys) {
          const dir = sorts[k] === "asc" ? 1 : -1;
          const t = types[k] ?? "text";
          const av = getters[k](a) ?? "";
          const bv = getters[k](b) ?? "";
          let cmp = 0;
          if (t === "number") cmp = parseBRNum(av) - parseBRNum(bv);
          else if (t === "date") cmp = parseBRDate(av) - parseBRDate(bv);
          else cmp = av.localeCompare(bv, "pt-BR");
          if (cmp !== 0) return cmp * dir;
        }
        return 0;
      });
    }
    return out;
  }, [rows, filters, sorts, getters, types]);

  function setFilter(k: string, next: string[]) {
    setFilters((f) => ({ ...f, [k]: next }));
  }
  function setSort(k: string, next: ColumnSort) {
    setSorts((s) => ({ ...s, [k]: next }));
  }
  function reset() { setFilters({}); setSorts({}); }

  return { view, distinct, filters, sorts, setFilter, setSort, reset };
}
