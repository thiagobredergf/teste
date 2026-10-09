// Leitor do arquivo de RETORNO de cobrança no leiaute CNAB240 (Febraban)
// — o banco devolve esse arquivo depois que um boleto registrado é
// pago/baixado/alterado, e aqui a gente lê cada linha pra sugerir qual
// conta a receber do ESEK corresponde a qual pagamento. Nunca baixa
// nada sozinho — só gera sugestões pra revisar na tela (ver
// RetornoCnabModal em App.jsx).
//
// Diferente da remessa de pagamento (lib/cnab240.js), que o ESEK monta do
// zero e por isso controla 100% do leiaute, aqui o arquivo vem DE FORA
// (de um banco que o ESEK não escolhe o leiaute) — e o ESEK nunca teve
// uma "remessa de cobrança" própria (o boleto é registrado direto no
// internet banking), então não existe aqui o "Nosso Número" gerado pelo
// sistema pra casar com certeza absoluta.
//
// Posições 1-14 de QUALQUER registro de detalhe CNAB240 (banco + lote +
// tipo de registro + sequencial + código de segmento) são padrão
// Febraban fixo em qualquer arquivo, remessa ou retorno, de qualquer
// banco — isso já está em uso (e testado) no gerador de remessa. A
// partir da posição 15, cada segmento (aqui, T e U — dados do título
// cobrado e seus valores) tem seus próprios campos, e a posição exata
// do "Nosso Número" varia um pouco de banco pra banco (a Febraban
// padroniza o SIGNIFICADO de cada segmento, não necessariamente a
// coluna exata — children bancos adaptam o detalhe). Por isso:
//   - o pareamento busca o Nosso Número cadastrado como TRECHO dentro
//     de uma janela ampla da linha (não corta uma coluna fixa) — assim,
//     mesmo que a coluna exata do seu banco seja um pouco diferente, o
//     número continua aparecendo em algum lugar dessa janela;
//   - valor e data lidos são só uma SUGESTÃO pré-preenchida (editável)
//     na tela de revisão — nunca é gravado sem o gestor confirmar, e a
//     linha bruta do arquivo fica sempre visível ao lado pra conferir.

const REGISTRO_DETALHE = "3";
const SEGMENTO_TITULO = "T"; // dados do título: nosso número, ocorrência, datas, valor
const SEGMENTO_VALORES = "U"; // valores: juros, desconto, valor pago, valor líquido

// Janela (índices 0-based) onde se busca o Nosso Número dentro da linha
// do Segmento T — cobre a faixa onde os leiautes de banco consultados
// (Itaú, Santander, BB) colocam esse campo.
const JANELA_NOSSO_NUMERO = [14, 100];

// Código de ocorrência (posições 16-17, 1-based = índices 15-17) é o
// campo mais estável entre bancos no Segmento T — confirmado em mais de
// uma fonte. Os códigos abaixo são os mais citados como "título
// liquidado" — qualquer código fora dessa lista ainda aparece pra
// revisão, só não vem pré-marcado como sugestão de baixa (o gestor
// decide olhando a descrição e a linha bruta).
const OCORRENCIAS_LIQUIDACAO = new Set(["06", "09", "17"]);
const OCORRENCIA_LABELS = {
  "02": "Confirmação de entrada do título",
  "03": "Confirmação de pedido de alteração",
  "06": "Liquidação normal",
  "09": "Baixado automaticamente via arquivo",
  "10": "Baixado conforme instruções",
  "11": "Título em ser (arquivo de pendentes)",
  "12": "Confirmação de abatimento",
  "13": "Confirmação de cancelamento de abatimento",
  "14": "Confirmação de alteração de vencimento",
  "15": "Liquidação em cartório",
  "17": "Liquidação após baixa ou título não registrado",
  "19": "Confirmação de instrução de protesto",
  "20": "Confirmação de sustação/cancelamento de protesto",
  "23": "Remessa a cartório",
  "27": "Confirmação de pedido de desconto",
  "28": "Débito de tarifas/custas",
};

function onlyDigits(s) {
  return String(s ?? "").replace(/\D/g, "");
}

function parseDataDDMMAAAA(trecho) {
  const d = onlyDigits(trecho);
  if (d.length !== 8 || d === "00000000") return null;
  const dia = d.slice(0, 2), mes = d.slice(2, 4), ano = d.slice(4, 8);
  const iso = `${ano}-${mes}-${dia}`;
  const data = new Date(iso);
  if (Number.isNaN(data.getTime()) || data.getUTCFullYear() !== Number(ano)) return null;
  return iso;
}

// Campo monetário CNAB: inteiro em centavos, sem ponto/vírgula. Só
// aceita se o resultado for um valor plausível (evita que um trecho mal
// interpretado vire um valor absurdo na tela de revisão).
function parseValorCentavos(trecho) {
  const d = onlyDigits(trecho);
  if (!d) return null;
  const valor = Number(d) / 100;
  if (!Number.isFinite(valor) || valor <= 0 || valor > 10_000_000) return null;
  return valor;
}

// Lê um arquivo de retorno inteiro e devolve as linhas de Segmento T
// (uma por título) já com Segmento U (se existir, mesmo nosso número)
// combinado — e, pra cada uma, a sugestão de valor/data já calculada.
export function parseRetornoCnab240(texto) {
  const linhasBrutas = texto.split(/\r\n|\r|\n/).filter((l) => l.trim().length > 0);
  const titulos = [];
  let tituloAtual = null;

  linhasBrutas.forEach((linha) => {
    if (linha.length < 14) return;
    const tipoRegistro = linha[7];
    if (tipoRegistro !== REGISTRO_DETALHE) return;
    const segmento = linha[13];

    if (segmento === SEGMENTO_TITULO) {
      const codigoOcorrencia = linha.slice(15, 17);
      const dataOcorrencia = parseDataDDMMAAAA(linha.slice(17, 25)) || parseDataDDMMAAAA(linha.slice(73, 81));
      const valorTitulo = parseValorCentavos(linha.slice(81, 96));
      tituloAtual = {
        linhaT: linha,
        linhaU: null,
        codigoOcorrencia,
        ocorrenciaLabel: OCORRENCIA_LABELS[codigoOcorrencia] || `Código ${codigoOcorrencia}`,
        provavelLiquidacao: OCORRENCIAS_LIQUIDACAO.has(codigoOcorrencia),
        dataOcorrencia,
        valorTitulo,
        valorPago: valorTitulo, // sobrescrito pelo Segmento U quando existir
        juros: 0,
        desconto: 0,
      };
      titulos.push(tituloAtual);
    } else if (segmento === SEGMENTO_VALORES && tituloAtual) {
      tituloAtual.linhaU = linha;
      const juros = parseValorCentavos(linha.slice(17, 32));
      const desconto = parseValorCentavos(linha.slice(32, 47));
      const valorPago = parseValorCentavos(linha.slice(77, 92));
      const dataCredito = parseDataDDMMAAAA(linha.slice(137, 145));
      if (juros != null) tituloAtual.juros = juros;
      if (desconto != null) tituloAtual.desconto = desconto;
      if (valorPago != null) tituloAtual.valorPago = valorPago;
      if (dataCredito) tituloAtual.dataOcorrencia = dataCredito;
    }
  });

  return { linhas: titulos, totalLinhasArquivo: linhasBrutas.length };
}

// Casa cada título lido do arquivo com a conta a receber (em aberto, da
// empresa selecionada) que tiver o mesmo Nosso Número cadastrado — por
// TRECHO (ver JANELA_NOSSO_NUMERO acima), nunca por posição exata nem
// por valor/data (isso a Conciliação Bancária já faz, de forma mais
// genérica, pra todo tipo de lançamento — aqui o pareamento é
// propositalmente mais estrito, porque a consequência de casar errado
// é baixar a conta a receber errada como recebida).
export function casarComRecebiveis(linhasRetorno, receivablesAbertos) {
  const comNossoNumero = receivablesAbertos.filter((r) => (r.nossoNumero || "").trim().length >= 3);
  return linhasRetorno.map((linha) => {
    const janela = linha.linhaT.slice(JANELA_NOSSO_NUMERO[0], JANELA_NOSSO_NUMERO[1]);
    const candidatos = comNossoNumero.filter((r) => janela.includes(r.nossoNumero.trim()));
    return {
      ...linha,
      receivable: candidatos.length === 1 ? candidatos[0] : null,
      ambiguo: candidatos.length > 1,
    };
  });
}
