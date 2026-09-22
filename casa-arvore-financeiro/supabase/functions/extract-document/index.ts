// Captura inteligente de documento: recebe um boleto/NF (PDF ou imagem) em
// base64, manda pro Claude ler e devolve um rascunho estruturado (fornecedor,
// valor, vencimento, descrição, categoria sugerida) pro operador confirmar
// no modal de "Nova conta a pagar" — nunca cria o lançamento sozinha.
//
// Exige login no ESEK (verify_jwt padrão do Supabase) — não tem segredo
// próprio como a crm-integration, porque quem chama é sempre um usuário
// autenticado no navegador, não um sistema externo.
//
// Precisa do secret ANTHROPIC_API_KEY configurado em
// Project Settings → Edge Functions → Secrets.
import Anthropic from "npm:@anthropic-ai/sdk@0.68.0";

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

// ~15MB em base64 (arquivo original bem menor) — generoso pra boleto/NF,
// evita payload absurdo indo pro modelo por engano.
const MAX_BASE64_LENGTH = 15_000_000;

const EXTRACTION_SYSTEM_PROMPT = `Você lê documentos financeiros brasileiros (boleto, nota fiscal ou carnê/parcelamento como IPTU) e extrai dados pra lançamentos de conta a pagar.

Responda APENAS com um objeto JSON, sem markdown, sem explicação, no formato exato:
{
  "fornecedor": string ou null,
  "categoria_sugerida": string ou null,
  "tipo_documento": "boleto" ou "nota_fiscal" ou "carne_parcelado" ou "outro",
  "parcelas": [
    { "numero": number ou null, "valor": number ou null, "vencimento": "AAAA-MM-DD" ou null, "descricao": string ou null }
  ]
}

Regras:
- "fornecedor": nome do beneficiário/cedente (boleto) ou emitente (NF), comum a todas as parcelas.
- "categoria_sugerida": um palpite de categoria financeira (ex: "Aluguel", "Impostos e Taxas"), só se o documento deixar claro; senão null.
- "parcelas": UMA ENTRADA PRA CADA PARCELA IMPRESSA NO DOCUMENTO, com o valor e vencimento EXATOS de cada uma, lidos diretamente do documento.
  - Documentos de pagamento único (boleto normal, NF): "parcelas" tem só 1 item.
  - Documentos parcelados (ex: carnê de IPTU com várias cotas): liste TODAS as parcelas visíveis, cada uma com seu próprio valor e vencimento — os valores costumam ser DIFERENTES entre parcelas (ex: 1ª parcela com desconto, demais com juros), e os vencimentos são datas específicas, não um intervalo fixo de dias.
  - NUNCA calcule um valor dividindo o total pela quantidade de parcelas, e NUNCA calcule um vencimento somando dias/meses a partir de outro — use apenas o que está escrito.
  - Se o documento mostrar só uma parcela (as demais "consulte o site"), retorne só essa parcela — não invente as que faltam.
- "descricao" de cada parcela: breve, ex: "IPTU 2026 - Parcela 3/11" ou "Boleto - <fornecedor>".
- Se não tiver certeza de um campo, retorne null — nunca invente ou estime.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "método não suportado" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada nos secrets do projeto." }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const { fileBase64, mediaType } = body as { fileBase64?: string; mediaType?: string };

  if (!fileBase64 || !mediaType) {
    return new Response(JSON.stringify({ error: "fileBase64 e mediaType são obrigatórios" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
  if (!ALLOWED_MEDIA_TYPES.has(mediaType)) {
    return new Response(
      JSON.stringify({ error: `mediaType precisa ser um de: ${[...ALLOWED_MEDIA_TYPES].join(", ")}` }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }
  if (fileBase64.length > MAX_BASE64_LENGTH) {
    return new Response(JSON.stringify({ error: "Arquivo grande demais." }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const documentBlock = mediaType === "application/pdf"
    ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: fileBase64 } }
    : { type: "image" as const, source: { type: "base64" as const, media_type: mediaType as "image/jpeg" | "image/png" | "image/webp", data: fileBase64 } };

  const client = new Anthropic({ apiKey });

  let response;
  try {
    response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [documentBlock, { type: "text", text: "Extraia os dados deste documento." }],
        },
      ],
    });
  } catch (err) {
    // Loga o erro completo (aparece nos logs da função no Supabase) —
    // a resposta pro navegador só leva uma versão resumida, mas isso
    // aqui é o que a gente consulta pra diagnosticar de verdade.
    console.error("Falha ao chamar a Anthropic API:", err instanceof Error ? err.stack ?? err.message : err);
    const message = err instanceof Anthropic.APIError
      ? `Erro da IA (${err.status}): ${err.message}`
      : err instanceof Error
        ? `Falha ao chamar a IA: ${err.message}`
        : "Falha ao chamar a IA.";
    const status = err instanceof Anthropic.APIError ? err.status ?? 502 : 502;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const textBlock = (response.content ?? []).find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!textBlock) {
    return new Response(JSON.stringify({ error: "A IA não retornou texto." }), {
      status: 502,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  let extracted: unknown;
  try {
    // A IA às vezes envolve o JSON em ```json ... ``` mesmo quando instruída a
    // não fazer isso — tira a cerca de código antes de tentar parsear.
    const cleaned = textBlock.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
    extracted = JSON.parse(cleaned);
  } catch {
    return new Response(JSON.stringify({ error: "Não consegui interpretar a resposta da IA como JSON." }), {
      status: 502,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, extracted }), {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});
