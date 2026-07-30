import { createFileRoute } from "@tanstack/react-router";
import { Factory } from "lucide-react";

export const Route = createFileRoute("/_authenticated/imec/")({
  head: () => ({
    meta: [
      { title: "BI IMEC" },
      { name: "description", content: "Inteligência comercial da Imec/Nutivit." },
    ],
  }),
  component: ImecHome,
});

function ImecHome() {
  return (
    <div className="max-w-2xl mx-auto text-center py-16">
      <div className="inline-flex items-center justify-center h-14 w-14 rounded-xl bg-primary mb-4 bi-imec-glow">
        <Factory className="h-7 w-7 text-primary-foreground" strokeWidth={2.5} />
      </div>
      <h1 className="font-display text-2xl font-bold tracking-tight">BI IMEC</h1>
      <p className="text-muted-foreground mt-3 leading-relaxed">
        Este módulo está em construção. As telas e funcionalidades serão adicionadas aos poucos,
        conforme forem definidas — reaproveitando o que fizer sentido do BI Globo Pharma.
      </p>
    </div>
  );
}
