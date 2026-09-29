import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { NovoPedidoModal } from "./pedidos";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(), auth: { getSession: vi.fn() } },
}));

describe("NovoPedidoModal - itens bonificados no cadastro", () => {
  it("mostra o botão Importar Bonificados e abre a área de colagem", () => {
    render(<NovoPedidoModal clientes={[{ id: "1", nome: "ANDORINHA" }]} onClose={() => {}} onCreated={() => {}} />);
    const btn = screen.getByRole("button", { name: /importar bonificados/i });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(screen.getByText(/não somam no valor do pedido/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /adicionar bonificados/i })).toBeTruthy();
  });
});
