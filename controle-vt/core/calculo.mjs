import { diasUteisEntre, diasEntre } from './datas.mjs';

export const PARAMETROS_PADRAO = {
  projecao_modo: 'conservador',   // 'conservador' | 'nenhum'
  saldo_max_idade_dias: 45,
  recarga_minima_centavos: 0,
  recarga_multiplo_centavos: 1,
  teto_cartao_centavos: null,
};

// dias efetivos = dias base da competência − dias de ocorrências que descontam VT (mínimo 0)
export function calcularDiasEfetivos({ diasBase, ocorrencias = [], regras }) {
  const descontados = ocorrencias.reduce((soma, o) => {
    const regra = regras[o.tipo];
    if (!regra) throw new Error(`tipo de ocorrência sem regra: ${o.tipo}`);
    return soma + (regra.desconta_vt ? o.dias : 0);
  }, 0);
  return { descontados, efetivos: Math.max(0, diasBase - descontados) };
}

// Consumo estimado do cartão entre a leitura do saldo e o crédito da recarga.
// Modo conservador: o servidor usou o cartão todos os dias úteis do intervalo (limitado ao saldo lido).
// Isso aumenta o repasse (erra para o lado do servidor), nunca o deixa sem crédito.
export function estimarConsumo({ saldoCentavos, lidoEm, dataCredito, valorDiarioCentavos, diasSemana, modo, feriados }) {
  if (modo === 'nenhum') return 0;
  const diasUteis = diasUteisEntre(lidoEm.slice(0, 10), dataCredito, feriados);
  const consumo = Math.round((diasUteis * valorDiarioCentavos * diasSemana) / 5);
  return Math.min(consumo, saldoCentavos);
}

const arredondarParaCima = (valor, multiplo) => (multiplo > 1 ? Math.ceil(valor / multiplo) * multiplo : valor);

/**
 * Calcula o repasse de um servidor em uma competência.
 * entrada: { situacao, cartao: {status}|null, beneficio: {valor_diario_centavos, dias_semana}|null,
 *            diasBase, ocorrencias, regras, saldo: {valor_centavos, lido_em}|null, dataCredito, feriados }
 */
export function calcularRepasse(entrada, parametros = {}) {
  const p = { ...PARAMETROS_PADRAO, ...parametros };
  const { situacao, cartao, beneficio, diasBase, ocorrencias, regras, saldo, dataCredito, feriados } = entrada;
  const sinal = [];
  const base = {
    valor_diario_centavos: null, dias_base: diasBase ?? null, dias_descontados: null, dias_efetivos: null,
    direito_centavos: 0, saldo_lido_centavos: null, saldo_lido_em: null, consumo_estimado_centavos: null,
    saldo_projetado_centavos: null, repasse_centavos: 0,
  };
  const pronto = (regra) => ({ ...base, regra_aplicada: regra, sinalizadores: sinal });

  if (situacao !== 'ativo') { sinal.push('SERVIDOR_' + String(situacao ?? 'SEM_SITUACAO').toUpperCase()); return pronto('sem_direito_situacao'); }
  if (!beneficio) { sinal.push('SEM_BENEFICIO'); return pronto('sem_beneficio'); }
  if (!cartao) sinal.push('SEM_CARTAO');
  else if (cartao.status !== 'ativo') sinal.push('CARTAO_' + cartao.status.toUpperCase());

  const { descontados, efetivos } = calcularDiasEfetivos({ diasBase, ocorrencias, regras });
  const direito = efetivos * beneficio.valor_diario_centavos;
  Object.assign(base, {
    valor_diario_centavos: beneficio.valor_diario_centavos, dias_descontados: descontados, dias_efetivos: efetivos,
    direito_centavos: direito,
  });
  if (efetivos === 0) { sinal.push('DIAS_ZERADOS'); return pronto('sem_dias_efetivos'); }
  if (sinal.some((s) => s === 'SEM_CARTAO' || s.startsWith('CARTAO_'))) return pronto('sem_cartao_utilizavel');

  // --- saldo
  let saldoProjetado = 0; // sem leitura utilizável, não se abate nada do direito
  let regra = 'direito_cheio_sem_saldo';
  if (!saldo) {
    sinal.push('SEM_SALDO');
  } else {
    base.saldo_lido_centavos = saldo.valor_centavos;
    base.saldo_lido_em = saldo.lido_em;
    const idade = diasEntre(saldo.lido_em.slice(0, 10), dataCredito);
    if (idade > p.saldo_max_idade_dias) {
      sinal.push('SALDO_ANTIGO');
      regra = 'direito_cheio_saldo_antigo';
    } else {
      const consumo = estimarConsumo({
        saldoCentavos: saldo.valor_centavos, lidoEm: saldo.lido_em, dataCredito,
        valorDiarioCentavos: beneficio.valor_diario_centavos, diasSemana: beneficio.dias_semana,
        modo: p.projecao_modo, feriados,
      });
      base.consumo_estimado_centavos = consumo;
      saldoProjetado = saldo.valor_centavos - consumo;
      base.saldo_projetado_centavos = saldoProjetado;
      regra = p.projecao_modo === 'nenhum' ? 'direito_menos_saldo_lido' : 'direito_menos_saldo_projetado';
    }
  }

  let repasse = Math.max(0, direito - saldoProjetado);
  if (repasse === 0 && saldoProjetado > 0) sinal.push('SALDO_COBRE_DIREITO');
  if (repasse > 0) {
    if (repasse < p.recarga_minima_centavos) repasse = p.recarga_minima_centavos;
    repasse = arredondarParaCima(repasse, p.recarga_multiplo_centavos);
  }
  if (p.teto_cartao_centavos != null && saldoProjetado + repasse > p.teto_cartao_centavos) sinal.push('ACIMA_DO_TETO');
  base.repasse_centavos = repasse;
  return pronto(regra);
}
