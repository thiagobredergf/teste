import * as banco from './db.js';
import { cruzarSaldos } from '../../core/cruzamento.mjs';
import { calcularCompetencia } from '../../core/competencia.mjs';
import { normalizarCartao } from '../../core/identificadores.mjs';
import { cartoesDoBanco } from './tela_saldo.js';

// Calcula (ou recupera, se fechada) o resultado do mês.
export function calcularMes(ym) {
  const c = banco.competencia(ym);
  if (c.status === 'fechada') {
    const f = banco.q('select resumo, linhas from fechamento where ym = ?', [ym])[0];
    return { comp: c, linhas: JSON.parse(f.linhas), fechada: true };
  }
  const servidores = banco.q("select * from servidor where situacao <> 'cancelado' order by nome");
  const cruz = cruzarSaldos(servidores.map((s) => ({ matricula: s.matricula, cpf: s.cpf, cartao: normalizarCartao(s.cartao) })), cartoesDoBanco());
  const regras = Object.fromEntries(banco.q('select * from regra_ocorrencia').map((r) => [r.tipo, { desconta_vt: !!r.desconta_vt }]));
  const cargos = Object.fromEntries(banco.q('select cargo, dias_semana from cargo_regra').map((r) => [r.cargo, r.dias_semana]));
  const linhas = calcularCompetencia({
    servidores, cruzamento: cruz.servidores, cargos, regras, parametros: c.parametros, tabelaDias: c.tabela_dias,
    ocorrencias: banco.q('select matricula, tipo, dias from ocorrencia where ym = ? and ativo = 1', [ym]),
    dataCredito: c.data_credito, dataLeitura: c.data_leitura ?? c.data_credito, feriados: c.feriados.map((f) => f.data),
  });
  return { comp: c, linhas, fechada: false };
}

export const totais = (linhas) => ({
  servidores: linhas.length,
  direito: linhas.reduce((a, l) => a + (l.direito_centavos ?? 0), 0),
  repasse: linhas.reduce((a, l) => a + (l.repasse_centavos ?? 0), 0),
  recarregar: linhas.filter((l) => l.acao === 'RECARREGAR').length,
  revisar: linhas.filter((l) => l.acao === 'REVISAR').length,
});
