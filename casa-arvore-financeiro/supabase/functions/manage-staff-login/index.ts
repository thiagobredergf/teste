// Cria (ou reseta a senha de) o login de um funcionário do BPO — gestor
// ou operador — irmã da manage-owner-login, mas sem vínculo a nenhuma
// empresa específica (gestor e operador enxergam todas as empresas do
// BPO, via is_staff/has_empresa_access).
//
// Três operações, no mesmo endpoint:
//   - padrão: garante que o login existe (cria com senha temporária se
//     não existir) e chama a RPC upsert_staff_profile (já existente) pra
//     gravar papel/nome/CPF. Se o login já existia, não mexe na senha.
//   - { resetPassword: true }: gera uma senha temporária NOVA pra um
//     login que já existe.
//   - Também serve pra só TROCAR o papel de alguém que já tem login: o
//     RPC upsert_staff_profile pode ser chamado direto do cliente pelo
//     gestor (sem passar por aqui) — essa função só entra em cena quando
//     precisa criar login novo ou resetar senha, que exigem a service
//     role key.
//
// Só gestor pode chamar (a própria RPC upsert_staff_profile confere
// is_gestor(auth.uid()) de novo, então a garantia não depende só desta
// função).
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
  const nome = typeof body.nome === "string" ? body.nome.trim() : null;
  const cpf = typeof body.cpf === "string" ? body.cpf.trim() : null;
  const role = typeof body.role === "string" ? body.role : "";
  const resetPassword = body.resetPassword === true;
  if (!email) return jsonResponse({ error: "email é obrigatório" }, 400);
  if (!resetPassword && !["gestor", "operador"].includes(role)) {
    return jsonResponse({ error: "papel precisa ser gestor ou operador" }, 400);
  }

  // Cliente "como quem chamou" — pra checar o papel dele e pra chamar a
  // RPC com a identidade certa (ela confere is_gestor internamente).
  const authHeader = req.headers.get("Authorization") || "";
  const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData } = await callerClient.auth.getUser();
  if (!userData?.user) return jsonResponse({ error: "Não autenticado." }, 401);
  const { data: callerProfile } = await callerClient.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
  if (callerProfile?.role !== "gestor") return jsonResponse({ error: "Só gestor pode gerenciar usuários." }, 403);

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

  const { error: rpcErr } = await callerClient.rpc("upsert_staff_profile", { p_email: email, p_role: role, p_nome: nome, p_cpf: cpf });
  if (rpcErr) return jsonResponse({ error: rpcErr.message }, 400);

  return jsonResponse({ ok: true, createdNew: tempPassword !== null, tempPassword });
});
