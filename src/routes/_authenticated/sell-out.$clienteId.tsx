import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/sell-out/$clienteId")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/por-clientes/$clienteId", params: { clienteId: params.clienteId } });
  },
});
