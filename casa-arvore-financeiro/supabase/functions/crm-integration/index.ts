// Ponte server-to-server entre o CRM (casa-arvore-comercial, Railway) e o
// Financeiro (este projeto). O CRM nunca recebe a service role key do
// Supabase — só esse segredo próprio (CRM_INTEGRATION_SECRET), que só serve
// pra criar/atualizar um lançamento (payable/receivable). Ver
// docs da sessão: "Aragutti/Azevedo — integração CRM x Financeiro".
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "método não suportado" }), { status: 405 });
  }

  const expected = `Bearer ${Deno.env.get("CRM_INTEGRATION_SECRET")}`;
  if (req.headers.get("authorization") !== expected) {
    return new Response(JSON.stringify({ error: "não autorizado" }), { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }

  const { tipo, empresaId, dataLanc, vencimento, contraparte, contraparteTelefone, categoria, descricao, valor, status } = body as {
    tipo?: string;
    empresaId?: string;
    dataLanc?: string;
    vencimento?: string;
    contraparte?: string;
    contraparteTelefone?: string;
    categoria?: string;
    descricao?: string;
    valor?: number;
    status?: string;
  };

  if (tipo !== "receivable" && tipo !== "payable") {
    return new Response(JSON.stringify({ error: "tipo precisa ser 'receivable' ou 'payable'" }), { status: 400 });
  }
  if (!empresaId || !descricao || typeof valor !== "number") {
    return new Response(JSON.stringify({ error: "empresaId, descricao e valor (number) são obrigatórios" }), { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const table = tipo === "receivable" ? "receivables" : "payables";
  const partyField = tipo === "receivable" ? "cliente" : "fornecedor";
  const hoje = new Date().toISOString().slice(0, 10);

  // Idempotência: a "descricao" carrega uma chave estável (ex: "CRM #123 — ...")
  // definida pelo CRM. Se já existe lançamento com essa descrição pra essa
  // empresa, atualiza em vez de duplicar — o CRM pode chamar de novo sem medo
  // (ex: retry de rede, ou reprocessar o mesmo dia de custo de anúncio).
  const { data: existing, error: selErr } = await supabase
    .from(table)
    .select("id")
    .eq("empresaId", empresaId)
    .eq("descricao", descricao)
    .limit(1);
  if (selErr) return new Response(JSON.stringify({ error: selErr.message }), { status: 500 });

  const row: Record<string, unknown> = {
    empresaId,
    dataLanc: dataLanc ?? hoje,
    vencimento: vencimento ?? dataLanc ?? hoje,
    categoria: categoria ?? null,
    descricao,
    valor,
    status: status ?? "pendente",
    conciliado: false,
    [partyField]: contraparte ?? null,
  };
  // Telefone só existe na tabela receivables por enquanto (ver
  // fase5_telefone_receivable.sql) — payables (fornecedor) não tem essa
  // coluna, e o CRM não manda telefone de fornecedor hoje de qualquer forma.
  if (tipo === "receivable" && contraparteTelefone) row.telefone = contraparteTelefone;

  if (existing && existing.length > 0) {
    const { error } = await supabase.from(table).update(row).eq("id", existing[0].id);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    return new Response(JSON.stringify({ ok: true, action: "updated", id: existing[0].id }), { status: 200 });
  }

  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  const { error } = await supabase.from(table).insert({ id, ...row });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ ok: true, action: "created", id }), { status: 201 });
});
