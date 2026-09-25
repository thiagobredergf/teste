// Captura inteligente de documento: recebe um boleto/NF/comprovante (PDF ou
// imagem) em base64, manda pro Claude ler e devolve um rascunho estruturado
// (contraparte, valor, vencimento, descrição, categoria sugerida) pro
// operador confirmar no modal de "Novo lançamento" — nunca cria o
// lançamento sozinha.
//
// Usada em seis contextos (parâmetro "context" no corpo da requisição):
//   - "payable"    (Contas a Pagar): contraparte = fornecedor/beneficiário.
//   - "receivable" (Contas a Receber): contraparte = cliente/pagador.
//   - "bankEntry"  (Lançamentos Bancários): comprovante de um movimento só
//     (TED, PIX, tarifa, juros, IOF, rendimento) — sempre 1 parcela, com
//     tipo_lancamento indicando Entrada ou Saída.
//   - "transfer"   (Transferências): comprovante de TED/PIX entre duas
//     contas da própria empresa — sem contraparte/categoria, só valor,
//     data e uma descrição citando os bancos de origem/destino.
// Os quatro acima usam o mesmo formato de resposta (RESPONSE_SHAPE, um
// documento = "parcelas"). Os dois abaixo devolvem uma LISTA SOLTA de
// linhas em vez de "um documento, uma ou mais parcelas":
//   - "statement"        (Conciliação Bancária): extrato/fatura com várias
//     linhas de movimento — usada quando o arquivo não é CSV/OFX (que já
//     são lidos sem IA, de graça, no próprio navegador) e sim PDF/imagem.
//   - "settlementReport" (Repasses de Terceiros): relatório de repasse de
//     adquirente de cartão ou plataforma de delivery — cada linha vem com
//     valor bruto, cada dedução (comissão, taxa, publicidade...) e valor
//     líquido, pra depois auditar contra a taxa contratada com o parceiro.
//     Aceita CSV/planilha como texto (não precisa ser imagem) porque é o
//     formato mais comum de export desses relatórios.
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
  "text/csv",
  "text/plain",
]);

// Base64 -> texto UTF-8 (atob puro corrompe acento; passa pelos bytes certo).
function base64ToText(b64: string): string {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

// ~15MB em base64 (arquivo original bem menor) — generoso pra boleto/NF,
// evita payload absurdo indo pro modelo por engano.
const MAX_BASE64_LENGTH = 15_000_000;

const RESPONSE_SHAPE = `{
  "contraparte": string ou null,
  "documento_contraparte": string ou null,
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
- "documento_contraparte": o CPF ou CNPJ do beneficiário/emitente (pra quem o usuário vai pagar), exatamente como aparece no documento (com ou sem pontuação); senão null. NUNCA ponha um CPF/CNPJ em "numero_documento" — é sempre aqui.
- "categoria_sugerida": um palpite de categoria financeira de DESPESA (ex: "Aluguel", "Impostos e Taxas"), só se o documento deixar claro; senão null.
- "tipo_lancamento": sempre null (não se aplica a conta a pagar).
- "tipo_documento": "boleto", "nota_fiscal", "carne_parcelado" ou "outro".
- "numero_documento": o número que identifica o documento em si — nº da nota fiscal/NF-e/cupom fiscal, nosso número ou linha digitável do boleto, nº do carnê. NUNCA um CPF/CNPJ (isso vai em "documento_contraparte") — se o único identificador visível for uma Inscrição Estadual (IE), use ela só como último recurso; senão null.
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
- "documento_contraparte": o CPF ou CNPJ do pagador/destinatário (de quem o usuário vai receber), exatamente como aparece no documento (com ou sem pontuação); senão null. NUNCA ponha um CPF/CNPJ em "numero_documento" — é sempre aqui.
- "categoria_sugerida": um palpite de categoria financeira de RECEITA (ex: "Vendas de Produtos", "Prestação de Serviços"), só se o documento deixar claro; senão null.
- "tipo_lancamento": sempre null (não se aplica a conta a receber).
- "tipo_documento": "boleto", "nota_fiscal", "carne_parcelado" ou "outro".
- "numero_documento": o número que identifica o documento em si — nº da nota fiscal/NF-e/cupom fiscal, nosso número ou linha digitável do boleto, nº do carnê. NUNCA um CPF/CNPJ (isso vai em "documento_contraparte") — se o único identificador visível for uma Inscrição Estadual (IE), use ela só como último recurso; senão null.
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
- "documento_contraparte": sempre null (não se aplica a lançamento bancário avulso).
- "categoria_sugerida": um palpite de categoria financeira (ex: "Despesas Bancárias", "Juros Recebidos"), só se o documento deixar claro; senão null.
- "tipo_documento": "comprovante_pix", "comprovante_ted", "tarifa_bancaria", "outro".
- "tipo_lancamento": "Entrada" se o dinheiro ENTROU na conta do usuário, "Saida" se SAIU. Baseie-se no que o comprovante mostra (ex: "PIX enviado" = Saida, "PIX recebido" = Entrada, tarifa/juros pagos = Saida, rendimento recebido = Entrada).
- "numero_documento": sempre null (não se aplica a lançamento bancário avulso).
- "parcelas": comprovante bancário é SEMPRE um evento único — retorne exatamente 1 item no array, com o valor e a data exatos do comprovante (campo "vencimento" aqui representa a DATA DO MOVIMENTO, não um vencimento futuro).
- "descricao" da parcela: breve, ex: "PIX enviado - <contraparte>" ou "Tarifa de manutenção de conta".
- Se não tiver certeza de um campo, retorne null — nunca invente ou estime.`,

  transfer: `Você lê comprovantes brasileiros de TED/PIX/DOC e extrai dados pra um lançamento de TRANSFERÊNCIA ENTRE CONTAS DA MESMA EMPRESA — as duas pontas (origem e destino) já são contas do próprio usuário, não há fornecedor/cliente envolvido.

Responda APENAS com um objeto JSON, sem markdown, sem explicação, no formato exato:
${RESPONSE_SHAPE}

Regras:
- "contraparte": sempre null (não se aplica — as duas contas já são do usuário).
- "documento_contraparte": sempre null.
- "categoria_sugerida": sempre null (transferência entre contas não é receita nem despesa).
- "tipo_lancamento": sempre null.
- "tipo_documento": "comprovante_pix", "comprovante_ted", "comprovante_doc" ou "outro".
- "numero_documento": sempre null.
- "parcelas": SEMPRE 1 item, com o valor e a data exatos do comprovante (campo "vencimento" aqui representa a DATA DO MOVIMENTO, não um vencimento futuro).
- "descricao" da parcela: breve, citando os bancos/contas de origem e destino se aparecerem no comprovante, ex: "Transferência Itaú → Bradesco".
- Se não tiver certeza de um campo, retorne null — nunca invente ou estime.`,
};

const STATEMENT_RESPONSE_SHAPE = `{
  "linhas": [
    { "data": "AAAA-MM-DD", "descricao": string, "valor": number, "tipo": "Entrada" ou "Saida" }
  ]
}`;

const STATEMENT_SYSTEM_PROMPT = `Você lê um extrato bancário, fatura de cartão de crédito ou relatório de repasse de maquininha/plataforma de delivery (em PDF, imagem ou tabela) e extrai TODAS as linhas de movimento que conseguir identificar com confiança.

Responda APENAS com um objeto JSON, sem markdown, sem explicação, no formato exato:
${STATEMENT_RESPONSE_SHAPE}

Regras:
- Uma entrada em "linhas" pra CADA movimento do documento — não pule, não resuma, não agrupe linhas parecidas em uma só.
- "data": a data do movimento, sempre no formato AAAA-MM-DD.
- "valor": sempre um número POSITIVO — o sentido (entrada/saída) vai só no campo "tipo", nunca use sinal negativo aqui.
- "tipo": "Entrada" se o dinheiro entrou na conta/recebível, "Saida" se saiu.
- "descricao": o texto da linha como aparece no documento (histórico, favorecido, nome do produto/pedido), breve.
- NUNCA inclua linha de saldo (saldo anterior, saldo do dia, saldo final, total) — isso não é um movimento, é um resumo.
- Documento com muitas páginas ou centenas de linhas: extraia o máximo que conseguir ler com confiança, mesmo que não seja tudo.
- Se não tiver certeza da data ou do valor de uma linha específica, PULE essa linha em vez de adivinhar — é melhor faltar uma linha do que inventar um valor errado.`;

const SETTLEMENT_RESPONSE_SHAPE = `{
  "linhas": [
    {
      "data": "AAAA-MM-DD",
      "bruto": number,
      "liquido": number,
      "dataRepasse": "AAAA-MM-DD" ou null,
      "deducoes": [ { "tipo": string, "valor": number } ]
    }
  ]
}`;

const SETTLEMENT_SYSTEM_PROMPT = `Você lê um relatório de repasse de adquirente de cartão (Cielo, Rede, Stone, GetNet, PagSeguro...) ou de plataforma de delivery (iFood, Rappi, Uber Eats...) — pode vir como CSV, planilha, PDF ou foto — e extrai cada linha de venda/lote com o valor bruto, cada dedução aplicada e o valor líquido resultante.

Responda APENAS com um objeto JSON, sem markdown, sem explicação, no formato exato:
${SETTLEMENT_RESPONSE_SHAPE}

Regras:
- Uma entrada por venda OU por lote de repasse, replicando a granularidade do próprio relatório — se ele já vem agrupado por dia/lote, uma entrada por grupo; se vem por transação individual, uma entrada por transação. Não invente agrupamento que o relatório não tem.
- "bruto": valor da venda antes de qualquer dedução.
- "liquido": valor que efetivamente foi (ou vai ser) depositado, depois de todas as deduções dessa linha.
- "dataRepasse": a data em que o valor cai (ou vai cair) na conta bancária — normalmente diferente da data da venda. Se o relatório não informar, retorne null.
- "deducoes": uma entrada pra CADA tipo de taxa/desconto aplicado, com "tipo" descrevendo o que é (ex.: "Comissão", "Taxa de Pagamento Online", "Publicidade", "Antecipação de Recebíveis", "Taxa de Cartão de Débito") e "valor" o valor em R$ descontado (sempre positivo, nunca negativo). Se o relatório só mostrar o percentual, calcule o valor em R$ a partir do bruto.
- Se bruto menos a soma das deduções não bater exatamente com líquido, reporte os três valores do jeito que estão no relatório mesmo assim — o objetivo é auditar depois se veio errado, nunca ajuste um número pra fazer a conta fechar.
- NUNCA inclua linha de resumo/total do relatório como se fosse uma venda.
- Se não tiver certeza de um valor específico, PULE essa linha em vez de estimar.`;

// Resposta grande demais corta o JSON no meio (max_tokens estourado) antes
// de fechar o array "linhas" — em vez de jogar tudo fora, varre o texto a
// partir do "[" contando chaves e recorta só os objetos que fecharam por
// completo, descartando o último (que ficou pela metade). Cada "linha" é
// sempre um objeto raso o suficiente (sem aninhamento alem de "deducoes",
// que é uma lista de pares tipo/valor) — contar chaves ainda é seguro
// porque cada "deducoes" abre e fecha dentro do próprio objeto da linha.
function salvageLinhasArray(text: string): unknown[] | null {
  const arrStart = text.indexOf("[");
  if (arrStart === -1) return null;
  let depth = 0;
  let lastCompleteEnd = -1;
  for (let i = arrStart; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) lastCompleteEnd = i;
    }
  }
  if (lastCompleteEnd === -1) return null;
  try {
    return JSON.parse(text.slice(arrStart, lastCompleteEnd + 1) + "]");
  } catch {
    return null;
  }
}

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

  // "statement" (extrato/fatura, Conciliação Bancária) e "settlementReport"
  // (relatório de repasse de adquirente/delivery) devolvem uma lista solta
  // de linhas em vez de "um documento, uma ou mais parcelas" — usam formato
  // de resposta próprio e podem ser grandes o bastante pra estourar
  // max_tokens (ver salvageLinhasArray).
  const usesLinhasShape = context === "statement" || context === "settlementReport";
  const systemPrompt = context === "statement"
    ? STATEMENT_SYSTEM_PROMPT
    : context === "settlementReport"
      ? SETTLEMENT_SYSTEM_PROMPT
      : (CONTEXT_PROMPTS[context || "payable"] || CONTEXT_PROMPTS.payable);

  const isTextMedia = mediaType === "text/csv" || mediaType === "text/plain";
  const documentBlock = isTextMedia
    ? { type: "text" as const, text: base64ToText(fileBase64) }
    : mediaType === "application/pdf"
      ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: fileBase64 } }
      : { type: "image" as const, source: { type: "base64" as const, media_type: mediaType as "image/jpeg" | "image/png" | "image/webp", data: fileBase64 } };

  const client = new Anthropic({ apiKey });

  // Extrato/relatório de repasse pode ter dezenas/centenas de linhas — um
  // boleto/comprovante normal cabe folgado em 2048 tokens de resposta, uma
  // fatura ou relatório de repasse inteiro não.
  let response;
  try {
    response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: usesLinhasShape ? 8192 : 2048,
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
  let truncated = false;
  try {
    // A IA às vezes envolve o JSON em ```json ... ``` mesmo quando instruída a
    // não fazer isso — tira a cerca de código antes de tentar parsear.
    const cleaned = textBlock.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
    extracted = JSON.parse(cleaned);
  } catch {
    // Extrato/relatório grande (muitas páginas/linhas) pode estourar
    // max_tokens e cortar o JSON no meio de um objeto — em vez de
    // descartar tudo, aproveita as linhas que fecharam por completo antes
    // do corte.
    const salvaged = usesLinhasShape ? salvageLinhasArray(textBlock.text) : null;
    if (salvaged && salvaged.length > 0) {
      extracted = { linhas: salvaged };
      truncated = true;
    } else {
      console.error("Não consegui interpretar a resposta da IA como JSON. Início:", textBlock.text.slice(0, 300), "| Fim:", textBlock.text.slice(-300));
      return new Response(JSON.stringify({ error: "Não consegui interpretar a resposta da IA como JSON." }), {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ ok: true, extracted, truncated }), {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});
