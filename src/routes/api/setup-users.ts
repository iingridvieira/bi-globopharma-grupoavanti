import { createFileRoute } from "@tanstack/react-router";

// Rota temporária de configuração — removida após o uso.
const TOKEN = "setup-bi-globo-7f3a9c1e-2026";

export const Route = createFileRoute("/api/setup-users")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (request.headers.get("x-setup-token") !== TOKEN) {
          return new Response("forbidden", { status: 403 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const results: Record<string, string> = {};

        const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
        if (listErr) return Response.json({ error: listErr.message }, { status: 500 });

        const updates = [
          { email: "avantipharma.comercial@gmail.com", password: "Av@nti0912" },
          { email: "avantipharma.alexandre@gmail.com", password: "Av@ntiAle" },
          { email: "avantipharma.comercial2@gmail.com", password: "Av@ntiEdu" },
        ];
        for (const u of updates) {
          const found = list.users.find((x) => (x.email ?? "").toLowerCase() === u.email);
          if (!found) { results[u.email] = "não encontrado"; continue; }
          const { error } = await supabaseAdmin.auth.admin.updateUserById(found.id, { password: u.password });
          results[u.email] = error ? `erro: ${error.message}` : "senha atualizada";
        }

        const pauloEmail = "paulo.colella@biglobopharma.app";
        const exists = list.users.find((x) => (x.email ?? "").toLowerCase() === pauloEmail);
        let pauloId = exists?.id ?? null;
        if (!pauloId) {
          const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
            email: pauloEmail,
            password: "Av@anti1914",
            email_confirm: true,
            user_metadata: { nome: "Paulo Colella" },
          });
          if (error) return Response.json({ error: error.message, results }, { status: 500 });
          pauloId = created.user.id;
          results[pauloEmail] = "criado";
        } else {
          const { error } = await supabaseAdmin.auth.admin.updateUserById(pauloId, { password: "Av@anti1914" });
          results[pauloEmail] = error ? `erro: ${error.message}` : "senha atualizada";
        }

        const { error: profErr } = await supabaseAdmin.from("profiles").upsert({
          id: pauloId,
          nome: "Paulo Colella",
          email: pauloEmail,
          username: "Paulo Colella",
        });
        if (profErr) results["profile"] = `erro: ${profErr.message}`;
        const { error: roleErr } = await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: pauloId, role: "viewer" }, { onConflict: "user_id,role", ignoreDuplicates: true });
        if (roleErr) results["role"] = `erro: ${roleErr.message}`;

        return Response.json({ ok: true, results });
      },
    },
  },
});
