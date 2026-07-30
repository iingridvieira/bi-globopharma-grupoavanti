import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/** YYYY-MM-01 date string representing the current month (UTC first day). */
export function currentMesRef(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function formatMesLabel(mesRef: string): string {
  const [y, m] = mesRef.split("-");
  return `${MESES[parseInt(m, 10) - 1]} / ${y}`;
}

export function shiftMes(mesRef: string, delta: number): string {
  const [y, m] = mesRef.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function isCurrentMes(mesRef: string): boolean {
  return mesRef === currentMesRef();
}

const MesContext = createContext<{ mes: string; setMes: (m: string) => void }>({
  mes: currentMesRef(),
  setMes: () => {},
});

export function MesProvider({ children }: { children: ReactNode }) {
  const [mes, setMesState] = useState<string>(currentMesRef());

  useEffect(() => {
    try {
      const stored = localStorage.getItem("crm-mes");
      if (stored && /^\d{4}-\d{2}-01$/.test(stored)) setMesState(stored);
    } catch {
      // localStorage indisponível (modo privado, etc.) — ignora e usa o mês atual.
    }
  }, []);

  function setMes(m: string) {
    setMesState(m);
    try {
      localStorage.setItem("crm-mes", m);
    } catch {
      // localStorage indisponível — a seleção de mês só não persiste entre sessões.
    }
  }

  return <MesContext.Provider value={{ mes, setMes }}>{children}</MesContext.Provider>;
}

export function useMes() {
  return useContext(MesContext);
}
