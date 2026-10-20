import { diasUteisEntre, diasEntre } from './datas.mjs';

export const PARAMETROS_PADRAO = {
  projecao_modo: 'conservador',   // 'conservador' | 'nenhum'
  saldo_max_idade_dias: 45,
  recarga_minima_centavos: 0,
  recarga_multiplo_centavos: 1,
  recargas_modo: 'ignorar',       // coluna RECARGAS da Global Mob: 'ignorar' | 'somar' (se for crédito lançado e ainda não disponível). Significado a confirmar.
  saldo_alto_multiplo: 3,         // política administrativa do RH: alerta se saldo projetado > N × saldo inicial (null = sem alerta)
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
  return Math.max(0, Math.min(consumo, saldoCentavos)); // saldo negativo: nada a consumir; o débito entra no repasse
}

const arredondarParaCima = (valor, multiplo) => (multiplo > 1 ? Math.ceil(valor / multiplo) * multiplo : valor);

/**
 * Calcula o repasse de um servidor em uma competência.
 * entrada: { situacao, cartao: {status}|null, beneficio: {valor_diario_centavos, dias_semana, saldo_inicial_centavos, desconto_centavos}|null,
 *            diasBase, ocorrencias, regras, saldo: {valor_centavos, recargas_centavos, lido_em}|null, dataCredito, feriados }
 */
export function calcularRepasse(entrada, parametros = {}) {
  const p = { ...PARAMETROS_PADRAO, ...parametros };
  const { situacao, cartao, beneficio, diasBase, ocorrencias, regras, saldo, dataCredito, feriados } = entrada;
  const sinal = [];
  const base = {
    valor_diario_centavos: null, recargas_centavos: null, dias_base: diasBase ?? null, dias_descontados: null, dias_efetivos: null,
    direito_centavos: 0, saldo_lido_centavos: null, saldo_lido_em: null, consumo_estimado_centavos: null,
    saldo_projetado_centavos: null, repasse_centavos: 0, desconto_centavos: null,
  };
  const pronto = (regra) => ({ ...base, regra_aplicada: regra, sinalizadores: sinal });

  if (situacao !== 'ativo') { sinal.push('SERVIDOR_' + String(situacao ?? 'SEM_SITUACAO').toUpperCase()); return pronto('sem_direito_situacao'); }
  if (!beneficio) { sinal.push('SEM_BENEFICIO'); return pronto('sem_beneficio'); }
  if (!cartao) sinal.push('SEM_CARTAO');
  else if (cartao.status !== 'ativo') sinal.push('CARTAO_' + cartao.status.toUpperCase());

  const { descontados, efetivos } = calcularDiasEfetivos({ diasBase, ocorrencias, regras });
  const direito = efetivos * beneficio.valor_diario_centavos;
  Object.assign(base, {
    desconto_centavos: beneficio.desconto_centavos ?? null, valor_diario_centavos: beneficio.valor_diario_centavos, dias_descontados: descontados, dias_efetivos: efetivos,
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
    base.recargas_centavos = saldo.recargas_centavos ?? 0;
    if (base.recargas_centavos > 0) sinal.push('RECARGA_PENDENTE_NA_GLOBALMOB');
    if (saldo.valor_centavos < 0) sinal.push('SALDO_NEGATIVO'); // a recarga cobre o débito do cartão além do direito do mês
    const saldoBase = saldo.valor_centavos + (p.recargas_modo === 'somar' ? base.recargas_centavos : 0);
    const idade = diasEntre(saldo.lido_em.slice(0, 10), dataCredito);
    if (idade > p.saldo_max_idade_dias) {
      sinal.push('SALDO_ANTIGO');
      regra = 'direito_cheio_saldo_antigo';
    } else {
      const consumo = estimarConsumo({
        saldoCentavos: saldoBase, lidoEm: saldo.lido_em, dataCredito,
        valorDiarioCentavos: beneficio.valor_diario_centavos, diasSemana: beneficio.dias_semana,
        modo: p.projecao_modo, feriados,
      });
      base.consumo_estimado_centavos = consumo;
      saldoProjetado = saldoBase - consumo;
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
  // O repasse complementar nunca leva o cartão além do direito, então o limite de N× não altera o valor:
  // ele só dispara o alerta de acúmulo (candidato a bloqueio/investigação pelo RH).
  // A base é o "saldo inicial" que vem na relação do RH (pode ser reajustado; nunca se deduz do histórico de recargas).
  if (p.saldo_alto_multiplo != null && base.saldo_projetado_centavos !== null) {
    const inicial = beneficio.saldo_inicial_centavos;
    if (!inicial) sinal.push('SEM_SALDO_INICIAL');
    else if (saldoProjetado > p.saldo_alto_multiplo * inicial) sinal.push('SALDO_ALTO');
  }
  base.repasse_centavos = repasse;

  // Desconto em folha: vem pronto no relatório do RH (6% do vencimento); aqui só se sinalizam os casos que exigem decisão.
  // A política (descontar quando a recarga é menor que o desconto) aguarda o jurídico: não se altera o valor.
  if (base.desconto_centavos == null) sinal.push('SEM_DESCONTO_INFORMADO');
  else if (base.desconto_centavos > direito) sinal.push('DESCONTO_ACIMA_DO_DIREITO');
  else if (repasse < base.desconto_centavos) sinal.push('DESCONTO_ACIMA_DA_RECARGA');
  return pronto(regra);
}
