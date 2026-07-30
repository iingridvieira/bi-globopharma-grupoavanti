import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Rep = { id: string; nome: string; slug: string; ordem: number; logo_url: string | null };

const RepresentadasContext = createContext<{ data: Rep[]; loading: boolean }>({
  data: [],
  loading: true,
});

export function RepresentadasProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: ["crm-representadas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_representadas")
        .select("id, nome, slug, ordem, logo_url")
        .order("ordem");
      if (error) throw error;
      return data as Rep[];
    },
    staleTime: 60_000,
  });
  return (
    <RepresentadasContext.Provider value={{ data: data ?? [], loading: isLoading }}>
      {children}
    </RepresentadasContext.Provider>
  );
}

export function useRepresentadas() {
  return useContext(RepresentadasContext);
}

/** Gera um slug simples e legível a partir do nome (ex: "Imec/Nutivit" -> "imec-nutivit"). */
export function slugify(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Signed URL para o logo (privado) guardado no bucket `crm-representada-logos`. */
export function useLogoUrl(path: string | null) {
  return useQuery({
    queryKey: ["crm-logo-signed", path],
    enabled: !!path,
    staleTime: 55 * 60 * 1000,
    queryFn: async () => {
      if (!path) return null;
      const { data, error } = await supabase.storage
        .from("crm-representada-logos")
        .createSignedUrl(path, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

export function RepresentadaLogo({
  path,
  nome,
  size = 40,
}: {
  path: string | null;
  nome: string;
  size?: number;
}) {
  const { data: url } = useLogoUrl(path);
  const initials = nome
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className={`rounded-lg flex items-center justify-center overflow-hidden shrink-0 border border-border ${
        url ? "bg-card" : "bg-muted"
      }`}
      style={{ width: size, height: size }}
    >
      {url ? (
        <img src={url} alt={`Logo ${nome}`} className="h-full w-full object-contain" />
      ) : (
        <span className="text-sm font-semibold text-muted-foreground">{initials}</span>
      )}
    </div>
  );
}
