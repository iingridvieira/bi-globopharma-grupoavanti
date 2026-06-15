import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Activity,
  ShieldCheck,
  Send,
  ArrowRight,
  BarChart3,
  LineChart,
  Map as MapIcon,
  Target,
  Sparkles,
  Eye,
  EyeOff,
} from "lucide-react";
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
  const [mode, setMode] = useState<"login" | "solicitar">("login");
  const [identificador, setIdentificador] = useState("");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [nome, setNome] = useState("");
  const [emailSolic, setEmailSolic] = useState("");
  const [telefone, setTelefone] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        let loginEmail = identificador.trim();
        if (!loginEmail.includes("@")) {
          const { data: mapped, error: rpcErr } = await supabase.rpc("get_email_for_username", {
            _username: loginEmail,
          });
          if (rpcErr || !mapped) throw new Error("Usuário não encontrado. Verifique o nome de usuário.");
          loginEmail = mapped;
        }
        const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: senha });
        if (error) throw new Error("Credenciais inválidas. Verifique usuário e senha.");
        toast.success("Bem-vindo ao BI GLOBO PHARMA");
        navigate({ to: "/" });
      } else {
        const { error } = await supabase.from("access_requests").insert({
          nome: nome.trim(),
          email: emailSolic.trim(),
          telefone: telefone.trim() || null,
        });
        if (error) throw new Error("Não foi possível enviar a solicitação. Tente novamente.");
        setEnviado(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  const highlights = [
    { icon: BarChart3, title: "Sell In consolidado", desc: "Faturamento, metas e bonificações por representante." },
    { icon: LineChart, title: "Sell Out em tempo real", desc: "Curva por produto e cliente, atualização contínua." },
    { icon: MapIcon, title: "Mapa de cobertura", desc: "Distribuição geográfica e oportunidades em aberto." },
    { icon: Target, title: "Metas e atingimento", desc: "Acompanhe gap, tendência e projeção de fechamento." },
  ];

  return (
    <div className="login-shell min-h-screen w-full grid lg:grid-cols-[1.05fr_1fr]">
      {/* Brand / value panel */}
      <aside className="login-brand relative hidden lg:flex flex-col justify-between p-10 xl:p-14 overflow-hidden">
        <div className="login-glow login-glow-a" aria-hidden />
        <div className="login-glow login-glow-b" aria-hidden />
        <div className="login-grid" aria-hidden />

        <div className="relative flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary flex items-center justify-center bi-orange-glow shrink-0">
            <Activity className="h-6 w-6 text-primary-foreground" strokeWidth={2.6} />
          </div>
          <div className="min-w-0">
            <div className="font-display text-lg font-bold tracking-tight leading-none">BI GLOBO PHARMA</div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground mt-1">
              Inteligência Comercial
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
            <Sparkles className="h-3 w-3" /> Plataforma 2026
          </div>
          <h2 className="mt-5 font-display text-4xl xl:text-5xl font-bold leading-[1.05] tracking-tight">
            Decisões comerciais
            <br />
            com <span className="text-primary">precisão de dados</span>.
          </h2>
          <p className="mt-4 text-[15px] text-muted-foreground/90 max-w-md leading-relaxed">
            Centralize Sell In, Sell Out, metas e cobertura em um único painel executivo —
            pensado para a operação farmacêutica.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3 max-w-lg">
            {highlights.map((h) => (
              <div key={h.title} className="login-feature">
                <div className="login-feature-icon">
                  <h.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground leading-tight">{h.title}</div>
                  <div className="text-[12px] text-muted-foreground mt-0.5 leading-snug">{h.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-primary/80" />
            Acesso protegido · autenticação corporativa
          </span>
          <span className="hidden xl:inline">© {new Date().getFullYear()} Grupo Avanti</span>
        </div>
      </aside>

      {/* Form panel */}
      <main className="relative flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[420px]">
          {/* Mobile brand */}
          <div className="lg:hidden mb-8 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center bi-orange-glow shrink-0">
              <Activity className="h-5 w-5 text-primary-foreground" strokeWidth={2.6} />
            </div>
            <div className="min-w-0">
              <div className="font-display text-base font-bold tracking-tight leading-none">BI GLOBO PHARMA</div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground mt-1">
                Inteligência Comercial
              </div>
            </div>
          </div>

          <div className="login-card">
            {mode === "solicitar" && enviado ? (
              <div className="text-center py-4">
                <div className="mx-auto h-14 w-14 rounded-full bg-primary/15 flex items-center justify-center mb-5 ring-1 ring-primary/30">
                  <Send className="h-6 w-6 text-primary" />
                </div>
                <h1 className="font-display text-2xl font-bold tracking-tight">Solicitação enviada</h1>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                  Sua solicitação de acesso foi recebida. Após análise, um administrador
                  liberará seu acesso e enviará as instruções.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setEnviado(false);
                    setMode("login");
                  }}
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                >
                  Voltar para o login <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {mode === "login" ? "Bem-vindo de volta" : "Novo acesso"}
                </div>
                <h1 className="mt-2 font-display text-[28px] font-bold tracking-tight leading-tight">
                  {mode === "login" ? "Entrar na plataforma" : "Solicitar acesso"}
                </h1>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                  {mode === "login"
                    ? "Use seu nome de usuário ou e-mail corporativo."
                    : "Preencha seus dados. Um administrador analisará sua solicitação."}
                </p>

                <form onSubmit={onSubmit} className="mt-7 space-y-4">
                  {mode === "login" ? (
                    <>
                      <Field label="Usuário ou e-mail">
                        <input
                          value={identificador}
                          onChange={(e) => setIdentificador(e.target.value)}
                          required
                          autoComplete="username"
                          className="bi-input"
                          placeholder="seu.usuario ou voce@empresa.com"
                        />
                      </Field>
                      <Field label="Senha">
                        <div className="relative">
                          <input
                            type={showSenha ? "text" : "password"}
                            value={senha}
                            onChange={(e) => setSenha(e.target.value)}
                            required
                            minLength={6}
                            autoComplete="current-password"
                            className="bi-input pr-11"
                            placeholder="••••••••"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSenha((v) => !v)}
                            className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground hover:text-foreground"
                            tabIndex={-1}
                            aria-label={showSenha ? "Ocultar senha" : "Mostrar senha"}
                          >
                            {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </Field>
                    </>
                  ) : (
                    <>
                      <Field label="Nome completo">
                        <input
                          value={nome}
                          onChange={(e) => setNome(e.target.value)}
                          required
                          minLength={2}
                          className="bi-input"
                          placeholder="Seu nome"
                        />
                      </Field>
                      <Field label="E-mail">
                        <input
                          type="email"
                          value={emailSolic}
                          onChange={(e) => setEmailSolic(e.target.value)}
                          required
                          className="bi-input"
                          placeholder="voce@empresa.com"
                        />
                      </Field>
                      <Field label="Telefone (opcional)">
                        <input
                          value={telefone}
                          onChange={(e) => setTelefone(e.target.value)}
                          className="bi-input"
                          placeholder="(11) 99999-9999"
                        />
                      </Field>
                    </>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="login-submit"
                  >
                    {loading
                      ? "Aguarde..."
                      : mode === "login"
                      ? "Entrar agora"
                      : "Enviar solicitação"}
                    {!loading && <ArrowRight className="h-4 w-4" />}
                  </button>
                </form>

                <div className="mt-6 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">ou</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <button
                  type="button"
                  onClick={() => setMode(mode === "login" ? "solicitar" : "login")}
                  className="mt-4 w-full h-11 rounded-lg border border-border bg-transparent text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors"
                >
                  {mode === "login" ? "Solicitar novo acesso" : "Já tenho conta — entrar"}
                </button>
              </>
            )}
          </div>

          <p className="mt-5 text-center text-[11px] text-muted-foreground">
            Ao continuar você concorda com as políticas de uso e privacidade da plataforma.
          </p>
        </div>
      </main>

      <style>{`
        .login-shell {
          background: var(--color-background);
          color: var(--color-foreground);
        }
        .login-brand {
          background:
            radial-gradient(110% 60% at 10% 0%, color-mix(in oklab, var(--color-primary) 14%, transparent), transparent 60%),
            radial-gradient(80% 50% at 100% 100%, color-mix(in oklab, var(--color-primary) 10%, transparent), transparent 55%),
            linear-gradient(155deg, oklch(0.14 0.012 130) 0%, oklch(0.18 0.028 145) 55%, oklch(0.13 0.010 130) 100%);
          border-right: 1px solid var(--color-border);
        }
        .login-grid {
          position: absolute; inset: 0; pointer-events: none;
          background-image:
            linear-gradient(to right, color-mix(in oklab, var(--color-foreground) 5%, transparent) 1px, transparent 1px),
            linear-gradient(to bottom, color-mix(in oklab, var(--color-foreground) 5%, transparent) 1px, transparent 1px);
          background-size: 44px 44px;
          mask-image: radial-gradient(ellipse at 30% 40%, black 30%, transparent 80%);
        }
        .login-glow {
          position: absolute; border-radius: 9999px; filter: blur(80px); pointer-events: none; opacity: 0.55;
        }
        .login-glow-a {
          width: 380px; height: 380px; top: -120px; right: -80px;
          background: color-mix(in oklab, var(--color-primary) 55%, transparent);
        }
        .login-glow-b {
          width: 320px; height: 320px; bottom: -120px; left: -60px;
          background: color-mix(in oklab, var(--color-primary) 30%, transparent);
        }
        .login-feature {
          display: flex; gap: 10px; align-items: flex-start;
          padding: 12px 14px;
          background: color-mix(in oklab, var(--color-foreground) 4%, transparent);
          border: 1px solid color-mix(in oklab, var(--color-foreground) 8%, transparent);
          border-radius: 12px;
          backdrop-filter: blur(6px);
          transition: border-color .15s, background .15s, transform .15s;
        }
        .login-feature:hover {
          border-color: color-mix(in oklab, var(--color-primary) 35%, transparent);
          background: color-mix(in oklab, var(--color-primary) 6%, transparent);
        }
        .login-feature-icon {
          height: 30px; width: 30px; border-radius: 8px; flex: 0 0 30px;
          display: flex; align-items: center; justify-content: center;
          background: color-mix(in oklab, var(--color-primary) 18%, transparent);
          color: var(--color-primary);
          border: 1px solid color-mix(in oklab, var(--color-primary) 35%, transparent);
        }
        .login-card {
          position: relative;
          padding: 32px;
          background: color-mix(in oklab, var(--color-card) 92%, transparent);
          border: 1px solid var(--color-border);
          border-radius: 18px;
          box-shadow:
            0 1px 0 color-mix(in oklab, var(--color-foreground) 6%, transparent) inset,
            0 30px 60px -30px rgba(0,0,0,.55),
            0 12px 30px -18px color-mix(in oklab, var(--color-primary) 35%, transparent);
        }
        .bi-input {
          width: 100%;
          height: 46px;
          padding: 0 14px;
          background: var(--color-input);
          border: 1px solid var(--color-border);
          border-radius: 10px;
          color: var(--color-foreground);
          font-size: 14px;
          outline: none;
          transition: border-color .15s, box-shadow .15s, background .15s;
        }
        .bi-input:hover { border-color: color-mix(in oklab, var(--color-foreground) 18%, transparent); }
        .bi-input:focus {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 4px color-mix(in oklab, var(--color-primary) 22%, transparent);
        }
        .bi-input::placeholder { color: color-mix(in oklab, var(--color-muted-foreground) 80%, transparent); }
        .login-submit {
          width: 100%;
          height: 48px;
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          border-radius: 10px;
          background: linear-gradient(180deg,
            color-mix(in oklab, var(--color-primary) 100%, white 6%) 0%,
            var(--color-primary) 100%);
          color: var(--color-primary-foreground);
          font-family: var(--font-display, inherit);
          font-weight: 700;
          font-size: 14px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          box-shadow:
            0 1px 0 rgba(255,255,255,.18) inset,
            0 10px 24px -10px color-mix(in oklab, var(--color-primary) 65%, transparent);
          transition: transform .12s ease, box-shadow .15s ease, opacity .15s ease;
        }
        .login-submit:hover:not(:disabled) { transform: translateY(-1px); }
        .login-submit:active:not(:disabled) { transform: translateY(0); }
        .login-submit:disabled { opacity: .55; cursor: not-allowed; }

        @media (max-width: 1023px) {
          .login-card { padding: 24px; border-radius: 16px; }
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
