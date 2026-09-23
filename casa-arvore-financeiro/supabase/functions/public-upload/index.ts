// Recebe um documento (boleto, comprovante, NF) enviado por alguém SEM
// login no ESEK — o dono/sócio da empresa cliente, através de um link
// próprio (?upload=<token>) que ele recebeu do analista BPO. Por isso essa
// função é a única do projeto com verify_jwt desligado (ver deploy) e
// nunca confia em nada que vem do chamador além do "token": ela mesma
// resolve, com a service role key (que ignora RLS), a qual empresa esse
// token pertence, e é só essa empresa que recebe o arquivo — o chamador
// nunca informa o empresaId diretamente.
//
// O arquivo só é guardado (Storage + linha em "documentUploads", ambos com
// status "pendente"); a leitura/triagem por IA continua acontecendo depois,
// de dentro do ESEK já autenticado, na tela "Documentos recebidos" — essa
// função pública não chama a Anthropic API nem cria lançamento nenhum.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_MEDIA_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

// ~15MB em base64, mesmo limite do extract-document.
const MAX_BASE64_LENGTH = 15_000_000;

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "método não suportado" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Configuração do servidor incompleta." }, 500);
  }
  const admin = createClient(supabaseUrl, serviceRoleKey);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "JSON inválido" }, 400);
  }

  const { token, fileBase64, mediaType, fileName } = body as {
    token?: string;
    fileBase64?: string;
    mediaType?: string;
    fileName?: string;
  };

  if (!token) return jsonResponse({ error: "Link inválido — falta o token." }, 400);
  if (!fileBase64 || !mediaType) {
    return jsonResponse({ error: "fileBase64 e mediaType são obrigatórios" }, 400);
  }
  if (!ALLOWED_MEDIA_TYPES.has(mediaType)) {
    return jsonResponse({ error: `Tipo de arquivo não aceito: ${mediaType}` }, 400);
  }
  if (fileBase64.length > MAX_BASE64_LENGTH) {
    return jsonResponse({ error: "Arquivo grande demais (máximo ~10MB)." }, 400);
  }

  const { data: empresa, error: empresaErr } = await admin
    .from("empresas")
    .select("id, nome")
    .eq("uploadToken", token)
    .maybeSingle();

  if (empresaErr) {
    console.error("public-upload: falha ao validar token:", empresaErr);
    return jsonResponse({ error: "Falha ao validar o link." }, 500);
  }
  if (!empresa) {
    return jsonResponse({ error: "Link inválido ou expirado. Peça um link novo pro seu contador/analista." }, 404);
  }

  const safeName = (fileName || "documento").replace(/[^a-zA-Z0-9.\-_ ]/g, "_").slice(0, 120);
  const storagePath = `${empresa.id}/${Date.now()}-${safeName}`;

  const bytes = Uint8Array.from(atob(fileBase64), (c) => c.charCodeAt(0));
  const { error: uploadErr } = await admin.storage
    .from("documentos-recebidos")
    .upload(storagePath, bytes, { contentType: mediaType, upsert: false });

  if (uploadErr) {
    console.error("public-upload: falha ao gravar no storage:", uploadErr);
    return jsonResponse({ error: "Falha ao guardar o arquivo. Tente de novo em instantes." }, 502);
  }

  const { error: insertErr } = await admin.from("documentUploads").insert({
    id: `du-${crypto.randomUUID()}`,
    empresaId: empresa.id,
    fileName: safeName,
    mediaType,
    storagePath,
    status: "pendente",
  });

  if (insertErr) {
    console.error("public-upload: falha ao registrar upload:", insertErr);
    return jsonResponse({ error: "Arquivo recebido, mas houve uma falha ao registrar. Avise seu analista." }, 502);
  }

  return jsonResponse({ ok: true, empresaNome: empresa.nome }, 200);
});
