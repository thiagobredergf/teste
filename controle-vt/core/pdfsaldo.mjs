import { parseValorBR } from './dinheiro.mjs';
import { normalizarCartao, normalizarCpf } from './identificadores.mjs';

// Extrai o relatório "Saldo de cartões" (Global Mob, PDF com texto) a partir dos itens de texto de cada página.
// Cada item: { s: texto, x, y } (coordenadas do PDF, y cresce para cima). Independe de biblioteca de PDF.
//
// Estrutura observada na amostra real (78 páginas):
//   - uma linha por PESSOA (nome, documento) com um ou mais CARTÕES empilhados (status, saldo, recargas);
//   - nome e número do cartão quebram em várias linhas; valores longos também ("R$" / "1.085,50");
//   - cartão pode continuar na página seguinte, sem repetir a pessoa;
//   - rodapé "Página N/M" em cada página e linha de TOTAL no fim (usada como conferência).
export const COLUNAS_GLOBAL_MOB = [['nome', 0, 130], ['documento', 130, 195], ['cartao', 195, 270], ['status', 270, 350], ['aplicacao', 350, 420], ['saldo', 420, 474], ['recargas', 474, 9999]];
const STATUS = /^(ATIVO|MIGRADO|AGUARDANDO|BLOQUEADO|CANCELADO|INATIVO)$/;

export function extrairSaldoGlobalMob(paginas, colunas = COLUNAS_GLOBAL_MOB) {
  const col = (x) => colunas.find(([, a, b]) => x >= a && x < b)[0];
  const cartoes = [];
  const avisos = [];
  let totalImpresso = null;
  let pessoaAnterior = { nome: '', documento: '' };

  paginas.forEach((itensBrutos, idx) => {
    const pagina = idx + 1;
    let it = itensBrutos.map((i) => ({ s: i.s.trim(), x: i.x, y: i.y })).filter((i) => i.s && i.s !== 'Página' && !/^\d+\/\d+$/.test(i.s));

    const total = it.find((i) => i.s === 'TOTAL');
    if (total) {
      const valor = it.filter((i) => Math.abs(i.y - total.y) < 3 && /^R\$ [\d.]+,\d{2}$/.test(i.s)).sort((a, b) => b.x - a.x)[0];
      if (valor) totalImpresso = parseValorBR(valor.s).centavos;
      it = it.filter((i) => i !== total && i !== valor);
    }

    const docs = it.filter((i) => col(i.x) === 'documento' && /^\d{11}$/.test(i.s)).sort((a, b) => b.y - a.y);
    const status = it.filter((i) => col(i.x) === 'status' && STATUS.test(i.s)).sort((a, b) => b.y - a.y);
    const faixa = (lista, k) => ({ sup: lista[k].y + 6, inf: k + 1 < lista.length ? lista[k + 1].y + 6 : -Infinity });
    const pessoas = docs.map((d, k) => {
      const { sup, inf } = faixa(docs, k);
      const nome = it.filter((i) => col(i.x) === 'nome' && i.y <= sup && i.y > inf).sort((a, b) => b.y - a.y).map((i) => i.s).join(' ');
      return { documento: d.s, nome, sup, inf };
    });

    status.forEach((st, k) => {
      const { sup, inf } = faixa(status, k);
      const em = (c) => it.filter((i) => col(i.x) === c && i.y <= sup && i.y > inf).sort((a, b) => b.y - a.y || a.x - b.x).map((i) => i.s).join(' ');
      const pessoa = pessoas.find((p) => st.y <= p.sup && st.y > p.inf) ?? pessoaAnterior; // cartão que continua da página anterior
      pessoaAnterior = pessoa;
      const saldo = parseValorBR(em('saldo'));
      const recargas = parseValorBR(em('recargas'));
      const cartao = normalizarCartao(em('cartao'));
      if (!saldo || !recargas || !cartao || !pessoa.documento)
        avisos.push(`página ${pagina}: linha de cartão não interpretada (cartão "${em('cartao')}", saldo "${em('saldo')}", recargas "${em('recargas')}")`);
      cartoes.push({
        pagina, nome: pessoa.nome, cpf: normalizarCpf(pessoa.documento), documento: pessoa.documento, cartao,
        status: st.s, saldo_centavos: saldo?.centavos ?? null, recargas_centavos: recargas?.centavos ?? null,
      });
    });
  });

  const somaSaldos = cartoes.reduce((acc, c) => acc + (c.saldo_centavos ?? 0), 0);
  const confere = totalImpresso !== null && totalImpresso === somaSaldos;
  if (totalImpresso === null) avisos.push('linha de TOTAL não encontrada: não foi possível conferir a extração');
  else if (!confere) avisos.push(`soma dos saldos extraídos (${somaSaldos}) difere do total impresso (${totalImpresso}) em ${somaSaldos - totalImpresso} centavos`);
  return { cartoes, total_impresso_centavos: totalImpresso, soma_saldos_centavos: somaSaldos, confere, avisos };
}

// Itens de texto de um PDF carregado com pdf.js (navegador ou Node). `pdfjsLib` é injetado para o núcleo não depender dele.
export async function lerPaginasPdfjs(pdfjsLib, dados) {
  const doc = await pdfjsLib.getDocument({ data: dados }).promise;
  const paginas = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const tc = await (await doc.getPage(n)).getTextContent();
    paginas.push(tc.items.map((i) => ({ s: i.str, x: i.transform[4], y: i.transform[5] })));
  }
  return paginas;
}
