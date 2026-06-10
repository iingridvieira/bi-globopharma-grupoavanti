import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AprovarInput = {
  requestId: string;
  username: string;
  password: string;
  role?: "viewer" | "editor";
};

export const aprovarSolicitacaoAcesso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AprovarInput) => {
    const username = (input.username ?? "").trim();
    if (username.length < 2 || username.length > 100) throw new Error("Nome de usuário inválido");
    if ((input.password ?? "").length < 6) throw new Error("A senha deve ter ao menos 6 caracteres");
    if (!input.requestId || typeof input.requestId !== "string") throw new Error("Solicitação inválida");
    return {
      requestId: input.requestId,
      username,
      password: input.password,
      role: input.role === "editor" ? ("editor" as const) : ("viewer" as const),
    };
  })
  .handler(async ({ data, context }) => {
    // Apenas administradores podem aprovar/criar usuários
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Apenas administradores podem aprovar novos usuários");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: req, error: reqErr } = await supabaseAdmin
      .from("access_requests")
      .select("*")
      .eq("id", data.requestId)
      .single();
    if (reqErr || !req) throw new Error("Solicitação não encontrada");
    if (req.status !== "pendente") throw new Error("Esta solicitação já foi processada");

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: req.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nome: req.nome },
    });
    if (createErr) throw new Error(`Erro ao criar usuário: ${createErr.message}`);

    const uid = created.user.id;
    await supabaseAdmin.from("profiles").upsert({
      id: uid,
      nome: req.nome,
      email: req.email,
      username: data.username,
    });
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: uid, role: data.role }, { onConflict: "user_id,role", ignoreDuplicates: true });
    await supabaseAdmin.from("access_requests").update({ status: "aprovado" }).eq("id", data.requestId);

    return { ok: true };
  });
