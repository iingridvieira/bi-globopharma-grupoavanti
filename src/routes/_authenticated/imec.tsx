import { createFileRoute, Outlet, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/imec")({
  component: ImecLayout,
});

function ImecLayout() {
  const router = useRouter();

  return (
    <div>
      <div className="px-8 pt-4">
        <button
          onClick={() => router.history.back()}
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
      </div>

      <Outlet />
    </div>
  );
}
