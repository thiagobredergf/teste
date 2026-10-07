// run-skill: executa um prompt da Biblioteca de Skills (Hub de Skills) —
// já com as variáveis {{campo}} substituídas pelos dados que o gestor
// preencheu — contra a Anthropic API, e devolve o texto da análise pronta
// pra copiar/imprimir e usar numa reunião com o dono da empresa.
//
// Cada skill da biblioteca já vem com uma indicação de "modelo sugerido"
// (ex.: tarefa de classificação simples vs. raciocínio numérico em várias
// etapas) — o app traduz isso num "tier" (economico/padrao) que essa
// função usa pra escolher o modelo, sem o operador ter que escolher modelo
// manualmente toda vez.
//
// Exige login no ESEK (verify_jwt padrão do Supabase).
// Precisa do secret ANTHROPIC_API_KEY (mesmo já usado por extract-document).
import Anthropic from "npm:@anthropic-ai/sdk@0.68.0";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL_BY_TIER: Record<string, string> = {
  economico: "claude-haiku-4-5",
  padrao: "claude-sonnet-5",
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "método não suportado" }, 405);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return jsonResponse({ error: "ANTHROPIC_API_KEY não configurada nos secrets do projeto." }, 500);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "JSON inválido" }, 400);
  }

  const { prompt, tier } = body as { prompt?: string; tier?: string };
  if (!prompt || !prompt.trim()) return jsonResponse({ error: "prompt é obrigatório" }, 400);
  if (prompt.length > 60_000) return jsonResponse({ error: "Prompt grande demais." }, 400);

  const model = MODEL_BY_TIER[tier || "padrao"] || MODEL_BY_TIER.padrao;
  const client = new Anthropic({ apiKey });

  let response;
  try {
    response = await client.messages.create({
      model,
      // claude-sonnet-5 (tier "padrao") roda thinking adaptativo por padrão,
      // mesmo sem o parâmetro "thinking" — esse raciocínio consome parte do
      // max_tokens antes do texto final. Com 4096 (valor antigo), um prompt
      // mais longo (skill com vários campos de dado automático) podia gastar
      // o teto inteiro só pensando e devolver resposta sem bloco de texto
      // nenhum ("A IA não retornou texto."). 16000 é o default recomendado
      // pra chamada não-streaming.
      max_tokens: 16000,
      messages: [{ role: "user", content: prompt }],
    });
  } catch (err) {
    console.error("Falha ao chamar a Anthropic API:", err instanceof Error ? err.stack ?? err.message : err);
    const message = err instanceof Anthropic.APIError
      ? `Erro da IA (${err.status}): ${err.message}`
      : err instanceof Error
        ? `Falha ao chamar a IA: ${err.message}`
        : "Falha ao chamar a IA.";
    const status = err instanceof Anthropic.APIError ? err.status ?? 502 : 502;
    return jsonResponse({ error: message }, status);
  }

  const textBlock = (response.content ?? []).find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!textBlock) return jsonResponse({ error: `A IA não retornou texto (stop_reason: ${response.stop_reason}).` }, 502);

  return jsonResponse({ ok: true, resultado: textBlock.text }, 200);
});
