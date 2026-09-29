// Gerador de arquivo de REMESSA no leiaute CNAB240 (Febraban) — pagamento a
// fornecedor via TED, Segmento A + Segmento B por item.
//
// CNAB240 é um arquivo de texto de largura fixa: cada linha tem exatamente
// 240 caracteres, sem separador nenhum — a posição de cada caractere é o
// que identifica o campo. Não existe API nem certificado digital envolvido
// aqui: o operador baixa esse arquivo e sobe manualmente no internet
// banking, do mesmo jeito que já faz hoje com CSV/OFX na Conciliação
// Bancária — por isso deu pra construir direto, sem contratar um provedor
// terceiro (diferente da captura de XML de nota fiscal, que exigiria
// custodiar o certificado digital do cliente).
//
// Estrutura de registros de um arquivo com N pagamentos:
//   0 — Header de Arquivo        (1 linha)
//   1 — Header de Lote           (1 linha)
//   3 — Segmento A (por item)    (N linhas) — dados bancários + valor
//   3 — Segmento B (por item)    (N linhas) — CPF/CNPJ do favorecido
//   5 — Trailer de Lote          (1 linha)
//   9 — Trailer de Arquivo       (1 linha)
// Total: 2*N + 4 linhas.
//
// Só cobre Segmento A/B com forma de lançamento "41" (TED) — é a forma que
// funciona de banco pra banco sem exigir que o favorecido esteja no mesmo
// banco do pagador, e é a que a apostila do curso recomenda pra valores
// altos/quando o fornecedor exige confirmação. Boleto (Segmento J) e PIX
// por chave (Segmento B específico de PIX) ficam de fora deste primeiro
// recorte — cada um tem seu próprio segmento no padrão Febraban.
//
// Limitação conhecida e proposital: o endereço do favorecido (Segmento B) e
// o endereço da empresa (Header de Lote) saem em branco — o ESEK ainda não
// coleta endereço estruturado de fornecedor nem da empresa. A maioria dos
// bancos aceita o arquivo mesmo assim (endereço deixou de ser bloqueante
// pra TED na prática bancária recente), mas vale confirmar com o banco
// específico antes do primeiro envio real.

const onlyDigits = (s) => String(s ?? "").replace(/\D/g, "");

// Maiúsculas, sem acento, só o alfabeto que CNAB aceita — alinhado à
// esquerda, preenchido com espaço até o tamanho, cortado se passar.
function alpha(value, len) {
  const clean = String(value ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 .,/-]/g, " ");
  return clean.slice(0, len).padEnd(len, " ");
}

// Só dígitos, alinhado à direita, preenchido com zero — cortado se passar
// (nunca deveria passar, mas corta em vez de gerar linha com tamanho errado).
function num(value, len) {
  const digits = onlyDigits(value).slice(-len);
  return digits.padStart(len, "0");
}

// Valor em reais -> inteiro em centavos, sem ponto/vírgula (é assim que
// todo campo monetário do CNAB é representado).
function money(value, len) {
  const cents = Math.round((Number(value) || 0) * 100);
  return String(cents).padStart(len, "0").slice(-len);
}

function blank(len) {
  return " ".repeat(len);
}

function zeros(len) {
  return "0".repeat(len);
}

// "AAAA-MM-DD" -> "DDMMAAAA" (ou zeros se não vier data).
function dateDDMMAAAA(iso) {
  if (!iso || iso.length < 10) return zeros(8);
  const [y, m, d] = iso.split("-");
  return `${d}${m}${y}`;
}

function timeHHMMSS(date) {
  const p = (n) => String(n).padStart(2, "0");
  return `${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}

// Junta os pedaços de um registro e confere que fechou em exatamente 240 —
// se algum campo veio com tamanho errado, prefere quebrar alto (erro
// explícito) a gerar um arquivo silenciosamente corrompido que o banco
// rejeitaria sem dizer por quê.
function montarLinha(pedacos, contexto) {
  const linha = pedacos.join("");
  if (linha.length !== 240) {
    throw new Error(`Erro interno ao montar CNAB240 (${contexto}): linha com ${linha.length} posições, deveria ter 240.`);
  }
  return linha;
}

function headerArquivo({ codigoBanco, empresa, conta, dataGeracao, agora, numeroArquivo }) {
  return montarLinha([
    num(codigoBanco, 3),
    zeros(4),
    "0",
    blank(9),
    "2", // tipo de inscrição: 2 = CNPJ
    num(empresa.cnpj, 14),
    alpha(conta.convenioCnab, 20),
    num(conta.agencia, 5),
    blank(1),
    num(conta.contaNum, 12),
    blank(1),
    blank(1),
    alpha(empresa.nome, 30),
    alpha(conta.banco, 30),
    blank(10),
    "1", // 1 = arquivo de remessa
    dateDDMMAAAA(dataGeracao),
    timeHHMMSS(agora),
    num(numeroArquivo, 6),
    "103", // versão de layout mais usada; alguns bancos pedem outra — ajustável se o banco rejeitar
    "01600",
    blank(20),
    blank(20),
    blank(29),
  ], "header de arquivo");
}

function headerLote({ codigoBanco, empresa, conta }) {
  return montarLinha([
    num(codigoBanco, 3),
    "0001",
    "1",
    "C", // tipo de operação: crédito
    "20", // tipo de serviço: pagamento a fornecedor
    "41", // forma de lançamento: TED
    "040",
    blank(1),
    "2",
    num(empresa.cnpj, 14),
    alpha(conta.convenioCnab, 20),
    num(conta.agencia, 5),
    blank(1),
    num(conta.contaNum, 12),
    blank(1),
    blank(1),
    alpha(empresa.nome, 30),
    blank(40), // mensagem
    blank(30), // logradouro da empresa — endereço estruturado não coletado ainda
    blank(5),
    blank(15),
    blank(20),
    blank(5),
    blank(3),
    blank(2),
    blank(8),
    blank(10),
  ], "header de lote");
}

function segmentoA({ codigoBanco, numeroSequencial, favorecido, payable }) {
  return montarLinha([
    num(codigoBanco, 3),
    "0001",
    "3",
    num(numeroSequencial, 5),
    "A",
    "0", // tipo de movimento: inclusão
    "00", // código de instrução: inclusão de registro
    "000", // código da câmara centralizadora (não se aplica a TED)
    num(favorecido.bancoCnab, 3),
    num(favorecido.agenciaCnab, 5),
    blank(1),
    num(favorecido.contaCnab, 12),
    alpha(favorecido.contaCnabDigito, 1),
    blank(1),
    alpha(favorecido.nome, 30),
    alpha(payable.numeroDocumento, 20),
    dateDDMMAAAA(payable.agendadoPara || payable.vencimento),
    "BRL",
    zeros(15), // quantidade de moeda — não usado em BRL
    money(payable.valor, 15),
    blank(20), // número do documento atribuído pelo banco
    zeros(8), // data real da efetivação — o banco preenche no retorno
    zeros(15), // valor real efetivado — o banco preenche no retorno
    alpha(payable.descricao, 40),
    "00001", // finalidade da TED: crédito em conta (código genérico)
    blank(2), // finalidade complementar
    blank(3),
    "2", // aviso ao favorecido: 2 = não emitir aviso
    blank(10),
    blank(2),
  ], "segmento A");
}

function segmentoB({ codigoBanco, numeroSequencial, favorecido }) {
  const documento = onlyDigits(favorecido.documento);
  const tipoInscricao = documento.length > 11 ? "2" : "1"; // 1 = CPF, 2 = CNPJ
  return montarLinha([
    num(codigoBanco, 3),
    "0001",
    "3",
    num(numeroSequencial, 5),
    "B",
    blank(3),
    tipoInscricao,
    num(documento, 14),
    blank(30), // logradouro do favorecido — endereço estruturado não coletado ainda
    blank(5),
    blank(15),
    blank(15),
    blank(20),
    blank(5),
    blank(3),
    blank(2),
    zeros(8), // data de vencimento — não se aplica a TED
    zeros(15),
    zeros(15),
    zeros(15),
    zeros(15),
    zeros(15),
    blank(15),
    "2", // aviso ao favorecido: 2 = não emitir
    blank(10),
    blank(4),
  ], "segmento B");
}

function trailerLote({ codigoBanco, quantidadeRegistrosLote, valorTotal }) {
  return montarLinha([
    num(codigoBanco, 3),
    "0001",
    "5",
    blank(9),
    num(quantidadeRegistrosLote, 6),
    money(valorTotal, 18),
    zeros(18),
    zeros(6),
    blank(165),
    blank(10),
  ], "trailer de lote");
}

function trailerArquivo({ codigoBanco, quantidadeRegistrosArquivo }) {
  return montarLinha([
    num(codigoBanco, 3),
    "9999",
    "9",
    blank(9),
    "000001",
    num(quantidadeRegistrosArquivo, 6),
    zeros(6),
    blank(205),
  ], "trailer de arquivo");
}

// itens: [{ payable, favorecido }], favorecido = contato com documento,
// nome, bancoCnab, agenciaCnab, contaCnab, contaCnabDigito já validados
// (ver validarItensCnab abaixo) antes de chegar aqui.
export function buildCnab240Remessa({ empresa, conta, codigoBanco, itens, dataGeracao = todayISODate(), agora = new Date() }) {
  const numeroArquivo = conta.proximoNumeroRemessaCnab || 1;
  const linhas = [
    headerArquivo({ codigoBanco, empresa, conta, dataGeracao, agora, numeroArquivo }),
    headerLote({ codigoBanco, empresa, conta }),
  ];
  itens.forEach(({ payable, favorecido }, i) => {
    const seq = i * 2 + 1;
    linhas.push(segmentoA({ codigoBanco, numeroSequencial: seq, favorecido, payable }));
    linhas.push(segmentoB({ codigoBanco, numeroSequencial: seq + 1, favorecido }));
  });
  const valorTotal = itens.reduce((s, { payable }) => s + Number(payable.valor || 0), 0);
  const quantidadeRegistrosLote = itens.length * 2 + 2; // segmentos + header/trailer de lote
  linhas.push(trailerLote({ codigoBanco, quantidadeRegistrosLote, valorTotal }));
  linhas.push(trailerArquivo({ codigoBanco, quantidadeRegistrosArquivo: linhas.length + 1 }));

  return {
    conteudo: linhas.join("\r\n") + "\r\n",
    numeroArquivo,
    quantidadeItens: itens.length,
    valorTotal,
  };
}

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

// Confere, item a item, se tem o mínimo pra entrar no arquivo — devolve a
// lista de motivos de bloqueio (vazia = pode gerar). Verificar isso ANTES
// de montar o arquivo evita gerar uma remessa incompleta que o banco rejeita
// sem dizer exatamente qual fornecedor tem o problema.
export function validarItensCnab({ empresa, conta, itens }) {
  const erros = [];
  if (!onlyDigits(empresa?.cnpj) || onlyDigits(empresa?.cnpj).length !== 14) {
    erros.push("A empresa precisa ter um CNPJ válido cadastrado (Cadastros → Editar empresa).");
  }
  if (!conta?.convenioCnab) {
    erros.push(`A conta "${conta?.nome || ""}" precisa do código de Convênio CNAB cadastrado (Contas → editar conta).`);
  }
  if (!conta?.agencia || !conta?.contaNum) {
    erros.push(`A conta "${conta?.nome || ""}" precisa de agência e número de conta cadastrados.`);
  }
  itens.forEach(({ payable, favorecido }) => {
    if (!favorecido) {
      erros.push(`"${payable.fornecedor}" não tem cadastro de contato vinculado — edite o lançamento e selecione o fornecedor pelo cadastro de Contatos.`);
      return;
    }
    if (!favorecido.bancoCnab || !favorecido.agenciaCnab || !favorecido.contaCnab) {
      erros.push(`"${favorecido.nome}" está sem dados bancários (banco/agência/conta) — cadastre em Contatos → editar.`);
    }
    if (!onlyDigits(favorecido.documento)) {
      erros.push(`"${favorecido.nome}" está sem CPF/CNPJ cadastrado — obrigatório pro Segmento B do CNAB.`);
    }
  });
  return erros;
}
