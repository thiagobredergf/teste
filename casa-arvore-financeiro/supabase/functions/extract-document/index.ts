// Captura inteligente de documento: recebe um boleto/NF/comprovante (PDF ou
// imagem) em base64, manda pro Claude ler e devolve um rascunho estruturado
// (contraparte, valor, vencimento, descrição, categoria sugerida) pro
// operador confirmar no modal de "Novo lançamento" — nunca cria o
// lançamento sozinha.
//
// Usada em três contextos (parâmetro "context" no corpo da requisição), que
// mudam só o que a IA deve procurar no documento — o formato de resposta é
// o mesmo nos três:
//   - "payable"    (Contas a Pagar): contraparte = fornecedor/beneficiário.
//   - "receivable" (Contas a Receber): contraparte = cliente/pagador.
//   - "bankEntry"  (Lançamentos Bancários): comprovante de um movimento só
//     (TED, PIX, tarifa, juros, IOF, rendimento) — sempre 1 parcela, com
//     tipo_lancamento indicando Entrada ou Saída.
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

const RESPONSE_SHAPE = `{
  "contraparte": string ou null,
  "categoria_sugerida": string ou null,
  "tipo_documento": string,
  "tipo_lancamento": "Entrada" ou "Saida" ou null,
  "numero_documento": string ou null,
  "parcelas": [
    { "numero": number ou null, "valor": number ou null, "vencimento": "AAAA-MM-DD" ou null, "descricao": string ou null }
  ]
}`;

const CONTEXT_PROMPTS: Record<string, string> = {
  payable: `Você lê documentos financeiros brasileiros (boleto, nota fiscal ou carnê/parcelamento como IPTU) e extrai dados pra lançamentos de CONTA A PAGAR (o usuário é quem vai pagar).

Responda APENAS com um objeto JSON, sem markdown, sem explicação, no formato exato:
${RESPONSE_SHAPE}

Regras:
- "contraparte": nome do beneficiário/cedente (boleto) ou emitente (NF) — pra quem o usuário vai pagar. Comum a todas as parcelas.
- "categoria_sugerida": um palpite de categoria financeira de DESPESA (ex: "Aluguel", "Impostos e Taxas"), só se o documento deixar claro; senão null.
- "tipo_lancamento": sempre null (não se aplica a conta a pagar).
- "tipo_documento": "boleto", "nota_fiscal", "carne_parcelado" ou "outro".
- "numero_documento": o número impresso no documento que identifica ele (nº da nota fiscal/NF-e, nosso número ou linha de referência do boleto, nº do carnê) — só se estiver visível; senão null.
- "parcelas": UMA ENTRADA PRA CADA PARCELA IMPRESSA NO DOCUMENTO, com o valor e vencimento EXATOS de cada uma, lidos diretamente do documento.
  - Documentos de pagamento único (boleto normal, NF): "parcelas" tem só 1 item.
  - Documentos parcelados (ex: carnê de IPTU com várias cotas): liste TODAS as parcelas visíveis, cada uma com seu próprio valor e vencimento — os valores costumam ser DIFERENTES entre parcelas (ex: 1ª parcela com desconto, demais com juros), e os vencimentos são datas específicas, não um intervalo fixo de dias.
  - NUNCA calcule um valor dividindo o total pela quantidade de parcelas, e NUNCA calcule um vencimento somando dias/meses a partir de outro — use apenas o que está escrito.
  - Se o documento mostrar só uma parcela (as demais "consulte o site"), retorne só essa parcela — não invente as que faltam.
- "descricao" de cada parcela: breve, ex: "IPTU 2026 - Parcela 3/11" ou "Boleto - <contraparte>".
- Se não tiver certeza de um campo, retorne null — nunca invente ou estime.`,

  receivable: `Você lê documentos financeiros brasileiros (boleto emitido, nota fiscal de venda/serviço ou carnê/parcelamento) e extrai dados pra lançamentos de CONTA A RECEBER (o usuário é quem vai receber).

Responda APENAS com um objeto JSON, sem markdown, sem explicação, no formato exato:
${RESPONSE_SHAPE}

Regras:
- "contraparte": nome do pagador/sacado (boleto) ou destinatário/cliente (NF) — de quem o usuário vai receber. Comum a todas as parcelas.
- "categoria_sugerida": um palpite de categoria financeira de RECEITA (ex: "Vendas de Produtos", "Prestação de Serviços"), só se o documento deixar claro; senão null.
- "tipo_lancamento": sempre null (não se aplica a conta a receber).
- "tipo_documento": "boleto", "nota_fiscal", "carne_parcelado" ou "outro".
- "numero_documento": o número impresso no documento que identifica ele (nº da nota fiscal/NF-e, nosso número ou linha de referência do boleto, nº do carnê) — só se estiver visível; senão null.
- "parcelas": UMA ENTRADA PRA CADA PARCELA IMPRESSA NO DOCUMENTO, com o valor e vencimento EXATOS de cada uma, lidos diretamente do documento.
  - Documentos de pagamento único (boleto normal, NF): "parcelas" tem só 1 item.
  - Documentos parcelados: liste TODAS as parcelas visíveis, cada uma com seu próprio valor e vencimento reais — nunca calculados por divisão ou soma de meses.
  - Se o documento mostrar só uma parcela (as demais "consulte o site"), retorne só essa parcela — não invente as que faltam.
- "descricao" de cada parcela: breve, ex: "Venda #123 - Parcela 2/3" ou "Serviço prestado - <contraparte>".
- Se não tiver certeza de um campo, retorne null — nunca invente ou estime.`,

  bankEntry: `Você lê comprovantes bancários brasileiros (comprovante de PIX/TED/DOC, extrato de tarifa, juros, IOF, rendimento ou recibo de operação bancária) e extrai dados pra um LANÇAMENTO BANCÁRIO avulso (um movimento simples de entrada ou saída, sem vínculo com fornecedor/cliente cadastrado).

Responda APENAS com um objeto JSON, sem markdown, sem explicação, no formato exato:
${RESPONSE_SHAPE}

Regras:
- "contraparte": nome de quem enviou ou recebeu o valor, se aparecer no comprovante (ex: nome do favorecido de um PIX); senão null.
- "categoria_sugerida": um palpite de categoria financeira (ex: "Despesas Bancárias", "Juros Recebidos"), só se o documento deixar claro; senão null.
- "tipo_documento": "comprovante_pix", "comprovante_ted", "tarifa_bancaria", "outro".
- "tipo_lancamento": "Entrada" se o dinheiro ENTROU na conta do usuário, "Saida" se SAIU. Baseie-se no que o comprovante mostra (ex: "PIX enviado" = Saida, "PIX recebido" = Entrada, tarifa/juros pagos = Saida, rendimento recebido = Entrada).
- "numero_documento": sempre null (não se aplica a lançamento bancário avulso).
- "parcelas": comprovante bancário é SEMPRE um evento único — retorne exatamente 1 item no array, com o valor e a data exatos do comprovante (campo "vencimento" aqui representa a DATA DO MOVIMENTO, não um vencimento futuro).
- "descricao" da parcela: breve, ex: "PIX enviado - <contraparte>" ou "Tarifa de manutenção de conta".
- Se não tiver certeza de um campo, retorne null — nunca invente ou estime.`,
};

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

  const { fileBase64, mediaType, context } = body as { fileBase64?: string; mediaType?: string; context?: string };

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

  const systemPrompt = CONTEXT_PROMPTS[context || "payable"] || CONTEXT_PROMPTS.payable;

  const documentBlock = mediaType === "application/pdf"
    ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: fileBase64 } }
    : { type: "image" as const, source: { type: "base64" as const, media_type: mediaType as "image/jpeg" | "image/png" | "image/webp", data: fileBase64 } };

  const client = new Anthropic({ apiKey });

  let response;
  try {
    response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      system: systemPrompt,
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
