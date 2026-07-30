import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { ArrowLeft, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import {
  MesProvider,
  useMes,
  formatMesLabel,
  shiftMes,
  currentMesRef,
  isCurrentMes,
} from "@/lib/crm/mes";

export const Route = createFileRoute("/_authenticated/crm")({
  component: () => (
    <MesProvider>
      <CrmLayout />
    </MesProvider>
  ),
});

function CrmLayout() {
  const { mes, setMes } = useMes();

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          to="/"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> BI Avanti Pharma
        </Link>

        <div className="flex items-center rounded-md border border-border bg-card overflow-hidden h-9">
          <button
            onClick={() => setMes(shiftMes(mes, -1))}
            className="h-full px-2 hover:bg-accent"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-3 text-sm font-medium min-w-[130px] text-center capitalize">
            {formatMesLabel(mes)}
          </span>
          <button
            onClick={() => setMes(shiftMes(mes, 1))}
            className="h-full px-2 hover:bg-accent"
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {!isCurrentMes(mes) && (
            <button
              onClick={() => setMes(currentMesRef())}
              className="h-full px-2 hover:bg-accent border-l border-border"
              aria-label="Voltar para o mês atual"
              title="Mês atual"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <Outlet />
    </div>
  );
}
