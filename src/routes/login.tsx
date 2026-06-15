import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity, ShieldCheck, Send, ArrowRight, Eye, EyeOff, Lock } from "lucide-react";
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

  return (
    <div className="auth-shell min-h-dvh w-full flex flex-col">
      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-5">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-[#ff6a13] flex items-center justify-center shadow-[0_6px_18px_-6px_rgba(255,106,19,.55)]">
            <Activity className="h-5 w-5 text-white" strokeWidth={2.8} />
          </div>
          <div className="leading-none">
            <div className="font-display text-[15px] font-bold tracking-tight text-slate-900">BI GLOBO PHARMA</div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500 mt-1">Inteligência Comercial</div>
          </div>
        </div>
        <div className="hidden sm:inline-flex items-center gap-1.5 text-[12px] text-slate-600">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          Conexão segura
        </div>
      </header>

      {/* Center area */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-5 py-6 sm:py-10">
        <div className="w-full max-w-[420px]">
          <div className="auth-card">
            {mode === "solicitar" && enviado ? (
              <div className="text-center py-2">
                <div className="mx-auto h-14 w-14 rounded-full bg-emerald-50 flex items-center justify-center mb-5 ring-1 ring-emerald-200">
                  <Send className="h-6 w-6 text-emerald-600" />
                </div>
                <h1 className="font-display text-[22px] font-bold tracking-tight text-slate-900">
                  Solicitação enviada
                </h1>
                <p className="mt-3 text-[14px] text-slate-600 leading-relaxed">
                  Sua solicitação foi recebida. Um administrador irá analisar e liberar seu acesso.
                </p>
                <button
                  type="button"
                  onClick={() => { setEnviado(false); setMode("login"); }}
                  className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#ff6a13] hover:underline"
                >
                  Voltar para o login <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <>
                <div className="text-center">
                  <h1 className="font-display text-[26px] sm:text-[28px] font-bold tracking-tight text-slate-900 leading-tight">
                    {mode === "login" ? "Acesse sua conta" : "Solicitar acesso"}
                  </h1>
                  <p className="mt-2 text-[13.5px] text-slate-500">
                    {mode === "login"
                      ? "Entre com suas credenciais corporativas."
                      : "Preencha seus dados para análise."}
                  </p>
                </div>

                <form onSubmit={onSubmit} className="mt-7 space-y-4">
                  {mode === "login" ? (
                    <>
                      <Field label="Usuário ou e-mail">
                        <input
                          value={identificador}
                          onChange={(e) => setIdentificador(e.target.value)}
                          required
                          autoComplete="username"
                          className="auth-input"
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
                            className="auth-input pr-11"
                            placeholder="••••••••"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSenha((v) => !v)}
                            className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-slate-700"
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
                          className="auth-input"
                          placeholder="Seu nome"
                        />
                      </Field>
                      <Field label="E-mail">
                        <input
                          type="email"
                          value={emailSolic}
                          onChange={(e) => setEmailSolic(e.target.value)}
                          required
                          className="auth-input"
                          placeholder="voce@empresa.com"
                        />
                      </Field>
                      <Field label="Telefone (opcional)">
                        <input
                          value={telefone}
                          onChange={(e) => setTelefone(e.target.value)}
                          className="auth-input"
                          placeholder="(11) 99999-9999"
                        />
                      </Field>
                    </>
                  )}

                  <button type="submit" disabled={loading} className="auth-submit">
                    {loading
                      ? "Aguarde..."
                      : mode === "login"
                      ? "Entrar"
                      : "Enviar solicitação"}
                    {!loading && <ArrowRight className="h-4 w-4" />}
                  </button>
                </form>

                <div className="mt-6 text-center text-[13px] text-slate-600">
                  {mode === "login" ? (
                    <>
                      Ainda não tem acesso?{" "}
                      <button
                        type="button"
                        onClick={() => setMode("solicitar")}
                        className="font-semibold text-[#ff6a13] hover:underline"
                      >
                        Solicitar novo acesso
                      </button>
                    </>
                  ) : (
                    <>
                      Já tem uma conta?{" "}
                      <button
                        type="button"
                        onClick={() => setMode("login")}
                        className="font-semibold text-[#ff6a13] hover:underline"
                      >
                        Entrar
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[11.5px] text-slate-500">
            <Lock className="h-3 w-3" />
            Protegido por autenticação corporativa
          </p>
        </div>
      </main>

      <footer className="relative z-10 py-5 text-center text-[11px] text-slate-500">
        © {new Date().getFullYear()} Grupo Avanti · BI GLOBO PHARMA
      </footer>

      <style>{`
        .auth-shell {
          background:
            radial-gradient(60% 50% at 85% 0%, rgba(255,106,19,.10), transparent 60%),
            radial-gradient(50% 40% at 10% 100%, rgba(255,106,19,.07), transparent 60%),
            linear-gradient(180deg, #f7f8fb 0%, #eef1f6 100%);
          color: #0f172a;
        }
        .auth-card {
          position: relative;
          padding: 36px 32px;
          background: #ffffff;
          border: 1px solid #e6e8ee;
          border-radius: 16px;
          box-shadow:
            0 1px 2px rgba(15,23,42,.04),
            0 20px 50px -25px rgba(15,23,42,.18),
            0 8px 22px -14px rgba(255,106,19,.18);
        }
        .auth-input {
          width: 100%;
          height: 44px;
          padding: 0 14px;
          background: #ffffff;
          border: 1px solid #d6dae3;
          border-radius: 10px;
          color: #0f172a;
          font-size: 14px;
          outline: none;
          transition: border-color .15s, box-shadow .15s;
        }
        .auth-input::placeholder { color: #94a3b8; }
        .auth-input:hover { border-color: #b9bfcc; }
        .auth-input:focus {
          border-color: #ff6a13;
          box-shadow: 0 0 0 4px rgba(255,106,19,.16);
        }
        .auth-submit {
          width: 100%;
          height: 46px;
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          border-radius: 10px;
          background: linear-gradient(180deg, #ff7a2a 0%, #ff6a13 100%);
          color: #ffffff;
          font-weight: 600;
          font-size: 14.5px;
          letter-spacing: 0.01em;
          box-shadow:
            0 1px 0 rgba(255,255,255,.25) inset,
            0 10px 22px -10px rgba(255,106,19,.55);
          transition: transform .12s ease, box-shadow .15s ease, opacity .15s ease;
        }
        .auth-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 14px 26px -12px rgba(255,106,19,.6); }
        .auth-submit:active:not(:disabled) { transform: translateY(0); }
        .auth-submit:disabled { opacity: .6; cursor: not-allowed; }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block mb-1.5 text-[12px] font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}
