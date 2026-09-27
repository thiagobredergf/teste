// Recebe um documento (boleto, comprovante, NF) e/ou uma mensagem de texto
// enviados por alguém SEM login no ESEK — o dono/sócio da empresa cliente,
// através de um link próprio (?upload=<token>) que ele recebeu do analista
// BPO. Por isso essa função é a única do projeto com verify_jwt desligado
// (ver deploy) e nunca confia em nada que vem do chamador além do "token":
// ela mesma resolve, com a service role key (que ignora RLS), a qual
// empresa esse token pertence, e é só essa empresa que recebe o
// arquivo/mensagem — o chamador nunca informa o empresaId diretamente.
//
// Duas operações, no mesmo endpoint:
//   - padrão (sem "action"): registra um novo chamado — arquivo e/ou
//     mensagem de texto (pelo menos um dos dois). Vira uma linha nova em
//     "documentUploads", status "pendente". A leitura/triagem por IA
//     continua acontecendo depois, de dentro do ESEK já autenticado.
//   - { action: "list" }: devolve o histórico de chamados dessa empresa
//     (mensagem do cliente + resposta do analista, se houver) — é o que
//     permite o cliente reabrir o mesmo link e ver a conversa, mesmo sem
//     login.
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

  const { token, action } = body as { token?: string; action?: string };
  if (!token) return jsonResponse({ error: "Link inválido — falta o token." }, 400);

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

  if (action === "list") {
    const { data: rows, error: listErr } = await admin
      .from("documentUploads")
      .select('id, "fileName", "mensagemCliente", "respostaGestor", "respostaEm", created_at')
      .eq("empresaId", empresa.id)
      .order("created_at", { ascending: true });
    if (listErr) {
      console.error("public-upload: falha ao listar chamados:", listErr);
      return jsonResponse({ error: "Falha ao carregar o histórico." }, 500);
    }
    return jsonResponse({ ok: true, empresaNome: empresa.nome, chamados: rows || [] }, 200);
  }

  const { fileBase64, mediaType, fileName, mensagemCliente } = body as {
    fileBase64?: string;
    mediaType?: string;
    fileName?: string;
    mensagemCliente?: string;
  };

  const temArquivo = !!(fileBase64 && mediaType);
  const temMensagem = !!(mensagemCliente && mensagemCliente.trim());
  if (!temArquivo && !temMensagem) {
    return jsonResponse({ error: "Envie um arquivo, uma mensagem, ou os dois." }, 400);
  }
  if (fileBase64 && !mediaType) {
    return jsonResponse({ error: "mediaType é obrigatório junto com o arquivo" }, 400);
  }
  if (temArquivo) {
    if (!ALLOWED_MEDIA_TYPES.has(mediaType!)) {
      return jsonResponse({ error: `Tipo de arquivo não aceito: ${mediaType}` }, 400);
    }
    if (fileBase64!.length > MAX_BASE64_LENGTH) {
      return jsonResponse({ error: "Arquivo grande demais (máximo ~10MB)." }, 400);
    }
  }

  let safeName: string | null = null;
  let storagePath: string | null = null;
  if (temArquivo) {
    safeName = (fileName || "documento").replace(/[^a-zA-Z0-9.\-_ ]/g, "_").slice(0, 120);
    storagePath = `${empresa.id}/${Date.now()}-${safeName}`;
    const bytes = Uint8Array.from(atob(fileBase64!), (c) => c.charCodeAt(0));
    const { error: uploadErr } = await admin.storage
      .from("documentos-recebidos")
      .upload(storagePath, bytes, { contentType: mediaType!, upsert: false });
    if (uploadErr) {
      console.error("public-upload: falha ao gravar no storage:", uploadErr);
      return jsonResponse({ error: "Falha ao guardar o arquivo. Tente de novo em instantes." }, 502);
    }
  }

  const { error: insertErr } = await admin.from("documentUploads").insert({
    id: `du-${crypto.randomUUID()}`,
    empresaId: empresa.id,
    ...(temArquivo ? { fileName: safeName, mediaType, storagePath } : {}),
    ...(temMensagem ? { mensagemCliente: mensagemCliente!.trim() } : {}),
    status: "pendente",
  });

  if (insertErr) {
    console.error("public-upload: falha ao registrar upload:", insertErr);
    return jsonResponse({ error: "Recebido, mas houve uma falha ao registrar. Avise seu analista." }, 502);
  }

  return jsonResponse({ ok: true, empresaNome: empresa.nome }, 200);
});
