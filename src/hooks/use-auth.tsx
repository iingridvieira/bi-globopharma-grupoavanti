import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "representante" | "viewer" | "editor";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: Role[];
  isAdmin: boolean;
  canEdit: boolean;
  restrictedClientes: string[] | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const EDUARDO_EMAIL = "avantipharma.comercial2@gmail.com";
const EDUARDO_CLIENTES = [
  "CAMPEÃ", "CG MEDICAMENTOS", "DF COMERCIAL", "DF DISTRIBUIDORA", "FARMA CONDE", "MEDLOG",
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => { void fetchRoles(s.user.id); }, 0);
      } else {
        setRoles([]);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) void fetchRoles(data.session.user.id);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function fetchRoles(userId: string) {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    setRoles((data ?? []).map((r) => r.role as Role));
  }

  const user = session?.user ?? null;
  const email = (user?.email ?? "").toLowerCase();
  const isEduardoOnly = email === EDUARDO_EMAIL;
  const isAdmin = roles.includes("admin");
  const canEdit = roles.includes("admin") || roles.includes("editor");
  const restrictedClientes = isEduardoOnly ? EDUARDO_CLIENTES : null;

  return (
    <AuthContext.Provider value={{
      user, session, loading, roles, isAdmin, canEdit, restrictedClientes,
      signOut: async () => { await supabase.auth.signOut(); },
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
