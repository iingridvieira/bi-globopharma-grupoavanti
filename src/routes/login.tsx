import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/" });
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
        toast.success("Bem-vindo ao BI GLOBO PHARMA");
        navigate({ to: "/" });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: {
            data: { nome },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (error) throw error;
        toast.success("Conta criada. Você já pode acessar.");
        setMode("login");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden"
           style={{ background: "linear-gradient(140deg, oklch(0.14 0.010 130) 0%, oklch(0.20 0.030 145) 100%)" }}>
        <div>
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-md bg-primary flex items-center justify-center bi-orange-glow">
              <Activity className="h-6 w-6 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <div>
              <div className="font-display text-xl font-bold tracking-tight">BI GLOBO PHARMA</div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Inteligência Comercial</div>
            </div>
          </div>
        </div>
        <div>
          <h2 className="font-display text-4xl font-bold leading-tight">
            Controle total do <span className="text-primary">Sell In</span> e <span className="text-primary">Sell Out</span>.
          </h2>
          <p className="mt-4 text-muted-foreground max-w-md">
            Dashboards executivos, metas em tempo real, importação de Excel e mapas de vendas em uma única plataforma premium.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-4">
            {[
              { v: "Sell In", l: "Consolidado" },
              { v: "Sell Out", l: "Por cliente" },
              { v: "Tempo real", l: "Atualização" },
            ].map((s) => (
              <div key={s.v} className="bi-card p-4">
                <div className="bi-stat-value text-lg">{s.v}</div>
                <div className="bi-stat-label mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5" /> Acesso protegido por autenticação corporativa
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md bi-card p-8">
          <div className="lg:hidden mb-6 flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-primary flex items-center justify-center">
              <Activity className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <span className="font-display text-lg font-bold">BI GLOBO PHARMA</span>
          </div>
          <h1 className="font-display text-2xl font-bold">
            {mode === "login" ? "Acessar plataforma" : "Criar conta"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "login" ? "Use suas credenciais corporativas." : "Cadastre-se para começar."}
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <Field label="Nome">
                <input value={nome} onChange={(e) => setNome(e.target.value)} required
                  className="bi-input" placeholder="Seu nome" />
              </Field>
            )}
            <Field label="E-mail">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="bi-input" placeholder="voce@empresa.com" />
            </Field>
            <Field label="Senha">
              <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={6}
                className="bi-input" placeholder="••••••••" />
            </Field>
            <button type="submit" disabled={loading}
              className="w-full h-11 rounded-md bg-primary text-primary-foreground font-display font-semibold tracking-wide uppercase text-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
              {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
            </button>
          </form>

          <button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="mt-6 w-full text-sm text-muted-foreground hover:text-foreground">
            {mode === "login" ? "Não tem conta? Criar agora" : "Já tem conta? Entrar"}
          </button>
        </div>
      </div>

      <style>{`
        .bi-input {
          width: 100%;
          height: 44px;
          padding: 0 14px;
          background: var(--color-input);
          border: 1px solid var(--color-border);
          border-radius: 6px;
          color: var(--color-foreground);
          font-size: 14px;
          outline: none;
          transition: border-color .15s, box-shadow .15s;
        }
        .bi-input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-ring); }
        .bi-input::placeholder { color: var(--color-muted-foreground); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="bi-stat-label block mb-1.5">{label}</span>
      {children}
    </label>
  );
}
