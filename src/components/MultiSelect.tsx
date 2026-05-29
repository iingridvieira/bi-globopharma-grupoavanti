import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

export type MSOption = { value: string; label: string };

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Todos",
  allLabel = "(Selecionar tudo)",
  searchPlaceholder = "Buscar...",
  className = "",
  width = 240,
}: {
  options: MSOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  allLabel?: string;
  searchPlaceholder?: string;
  className?: string;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return options;
    return options.filter((o) => o.label.toLowerCase().includes(term));
  }, [options, q]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((o) => selected.includes(o.value));

  function toggle(v: string) {
    if (selected.includes(v)) onChange(selected.filter((s) => s !== v));
    else onChange([...selected, v]);
  }

  function toggleAll() {
    if (allFilteredSelected) {
      onChange(selected.filter((s) => !filtered.some((o) => o.value === s)));
    } else {
      const add = filtered.map((o) => o.value).filter((v) => !selected.includes(v));
      onChange([...selected, ...add]);
    }
  }

  const label =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? placeholder
        : `${selected.length} selecionados`;

  return (
    <div ref={wrapRef} className={`relative ${className}`} style={{ width }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="bi-input-sm w-full flex items-center justify-between text-left"
        style={{ width: "100%" }}
      >
        <span className={`truncate ${selected.length === 0 ? "text-muted-foreground" : ""}`}>{label}</span>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {selected.length > 0 && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); onChange([]); }}
              className="text-muted-foreground hover:text-foreground"
              title="Limpar"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-lg overflow-hidden">
          <div className="relative border-b border-border">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-7 pr-2 h-8 bg-transparent text-sm outline-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            <button
              type="button"
              onClick={toggleAll}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent text-left"
            >
              <span className={`h-4 w-4 rounded border flex items-center justify-center ${allFilteredSelected ? "bg-primary border-primary" : "border-border"}`}>
                {allFilteredSelected && <Check className="h-3 w-3 text-primary-foreground" />}
              </span>
              <span className="font-medium">{allLabel}</span>
            </button>
            {filtered.map((o) => {
              const checked = selected.includes(o.value);
              return (
                <button
                  type="button"
                  key={o.value}
                  onClick={() => toggle(o.value)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent text-left"
                >
                  <span className={`h-4 w-4 rounded border flex items-center justify-center ${checked ? "bg-primary border-primary" : "border-border"}`}>
                    {checked && <Check className="h-3 w-3 text-primary-foreground" />}
                  </span>
                  <span className="truncate">{o.label}</span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="px-2 py-3 text-xs text-muted-foreground text-center">Nenhum resultado.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
