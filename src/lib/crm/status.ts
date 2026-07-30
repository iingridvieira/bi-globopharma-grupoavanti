export type ClienteStatus = "comprou" | "negociacao" | "nao_comprou" | "inativo";

export const STATUS_META: Record<
  ClienteStatus,
  { label: string; dot: string; bg: string; text: string }
> = {
  comprou: {
    label: "Comprou no mês",
    dot: "bg-crm-status-comprou",
    bg: "bg-crm-status-comprou-bg",
    text: "text-crm-status-comprou",
  },
  negociacao: {
    label: "Em negociação",
    dot: "bg-crm-status-negociacao",
    bg: "bg-crm-status-negociacao-bg",
    text: "text-crm-status-negociacao",
  },
  nao_comprou: {
    label: "Ainda não comprou",
    dot: "bg-crm-status-nao-comprou",
    bg: "bg-crm-status-nao-comprou-bg",
    text: "text-crm-status-nao-comprou",
  },
  inativo: {
    label: "Inativo",
    dot: "bg-crm-status-inativo",
    bg: "bg-crm-status-inativo-bg",
    text: "text-crm-status-inativo",
  },
};

export const STATUS_ORDER: ClienteStatus[] = ["comprou", "negociacao", "nao_comprou", "inativo"];

export function daysSince(date: string | null): number | null {
  if (!date) return null;
  const d = new Date(date);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatDate(date: string | null): string {
  if (!date) return "—";
  const [y, m, d] = date.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
}

export const MOTIVOS = [
  "Comprou da concorrência",
  "Estoque cheio",
  "Sem verba",
  "Sem giro",
  "Sem limite",
  "Comprador ausente",
  "Não consegui contato",
  "Outro",
];
