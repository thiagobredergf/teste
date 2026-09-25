// Cria (ou reseta a senha de) o login de um dono de empresa direto pelo
// app — sem isso, o gestor ficava travado toda vez que cadastrava uma
// empresa nova: "Dar acesso" só funcionava se o usuário já existisse no
// Supabase Auth, e criar esse usuário só era possível manualmente no
// painel do Supabase (fora do app).
//
// Duas operações, no mesmo endpoint:
//   - padrão: garante que o login existe (cria com senha temporária se
//     não existir; se já existir, só concede acesso à empresa) e chama a
//     RPC assign_empresa_owner já existente pra vincular à empresa.
//   - { resetPassword: true }: gera uma senha temporária NOVA pra um
//     login que já existe (dono esqueceu a senha, por exemplo) — não
//     precisa de empresaId.
//
// Só gestor pode chamar (mesma regra de assign_empresa_owner). A senha
// temporária só é devolvida uma vez, na resposta desta função — o app
// mostra ela pro gestor repassar ao dono (por WhatsApp, o canal que o
// resto do sistema já usa) e não a guarda em lugar nenhum.
//
// Depende de SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY
// — os três são injetados automaticamente em toda Edge Function, não
// precisa configurar secret nenhum pra isso funcionar.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

// Senha temporária legível: 10 caracteres de um alfabeto sem 0/O/1/l/I
// (evita confusão na hora de repassar por WhatsApp/telefone).
function generateTempPassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "método não suportado" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return jsonResponse({ error: "Configuração do Supabase incompleta nesta função." }, 500);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "JSON inválido" }, 400);
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const empresaId = typeof body.empresaId === "string" ? body.empresaId : "";
  const resetPassword = body.resetPassword === true;
  if (!email || (!resetPassword && !empresaId)) {
    return jsonResponse({ error: "email e empresaId são obrigatórios" }, 400);
  }

  // Cliente "como quem chamou" — pra checar o papel dele com a mesma
  // regra de RLS de sempre, e pra chamar assign_empresa_owner com a
  // identidade certa (a RPC já checa is_gestor internamente).
  const authHeader = req.headers.get("Authorization") || "";
  const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData } = await callerClient.auth.getUser();
  if (!userData?.user) return jsonResponse({ error: "Não autenticado." }, 401);
  const { data: callerProfile } = await callerClient.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
  if (callerProfile?.role !== "gestor") return jsonResponse({ error: "Só gestor pode gerenciar login de dono." }, 403);

  const admin = createClient(supabaseUrl, serviceKey);

  if (resetPassword) {
    const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
    if (!existing) return jsonResponse({ error: "Esse e-mail não tem login criado ainda." }, 404);
    const tempPassword = generateTempPassword();
    const { error: updErr } = await admin.auth.admin.updateUserById(existing.id, { password: tempPassword });
    if (updErr) return jsonResponse({ error: updErr.message }, 400);
    return jsonResponse({ ok: true, createdNew: false, tempPassword });
  }

  let tempPassword: string | null = generateTempPassword();
  const { error: createErr } = await admin.auth.admin.createUser({ email, email_confirm: true, password: tempPassword });
  if (createErr) {
    const jaExiste = /already.*registered|already.*exists/i.test(createErr.message);
    if (!jaExiste) return jsonResponse({ error: createErr.message }, 400);
    tempPassword = null; // login já existia — não alteramos a senha de ninguém
  }

  const { error: assignErr } = await callerClient.rpc("assign_empresa_owner", { p_empresa_id: empresaId, p_email: email });
  if (assignErr) return jsonResponse({ error: assignErr.message }, 400);

  return jsonResponse({ ok: true, createdNew: tempPassword !== null, tempPassword });
});
