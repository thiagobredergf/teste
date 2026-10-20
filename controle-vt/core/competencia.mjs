import { calcularRepasse } from './calculo.mjs';
import { normalizarCargo } from './cargos.mjs';
import { normalizarCpf, mascararCpf } from './identificadores.mjs';

// Orquestra o cálculo do mês para todos os servidores.
//  servidores: [{ matricula, nome, cpf, cargo, unidade, cartao, valor_diario_centavos, dias_semana, saldo_inicial_centavos, desconto_centavos, situacao }]
//  cruzamento: saída de cruzarSaldos(servidores, cartoes).servidores
//  cargos:     { 'ASG': 5, 'DOCENTE': null }      tabelaDias: { 5: 19, 4: 17, ... }
//  ocorrencias: [{ matricula, tipo, dias }]       regras: { falta: { desconta_vt: true }, ... }
export function calcularCompetencia({ servidores, cruzamento, ocorrencias = [], cargos = {}, tabelaDias, regras, parametros = {}, dataCredito, dataLeitura, feriados = [] }) {
  const cruz = new Map(cruzamento.map((c) => [c.matricula, c]));
  const ocorPor = new Map();
  for (const o of ocorrencias) ocorPor.set(o.matricula, [...(ocorPor.get(o.matricula) ?? []), o]);
  const multiplo = parametros.saldo_alto_multiplo === undefined ? 3 : parametros.saldo_alto_multiplo;

  return servidores.map((s) => {
    const c = cruz.get(s.matricula) ?? { flags: [], cartao_usado: null, saldo_centavos: null, recargas_centavos: null, cartao_sugerido: null };
    const diasSemana = s.dias_semana ?? cargos[normalizarCargo(s.cargo)] ?? null;
    const extras = [];
    if (!diasSemana) extras.push('SEM_DIAS_SEMANA');
    if (!s.valor_diario_centavos) extras.push('SEM_VALOR_DIARIO');
    const beneficio = diasSemana && s.valor_diario_centavos
      ? { valor_diario_centavos: s.valor_diario_centavos, dias_semana: diasSemana, saldo_inicial_centavos: s.saldo_inicial_centavos ?? null, desconto_centavos: s.desconto_centavos ?? null }
      : null;
    const r = calcularRepasse({
      situacao: s.situacao ?? 'ativo',
      cartao: c.cartao_usado ? { status: 'ativo' } : null,
      beneficio, diasBase: diasSemana ? tabelaDias[diasSemana] : undefined,
      ocorrencias: ocorPor.get(s.matricula) ?? [], regras,
      saldo: c.saldo_centavos == null ? null : { valor_centavos: c.saldo_centavos, recargas_centavos: c.recargas_centavos ?? 0, lido_em: c.lido_em ?? `${dataLeitura}T00:00` },
      dataCredito, feriados,
    }, parametros);

    const sinalizadores = [...new Set([...extras, ...c.flags, ...r.sinalizadores])];
    const inicial = s.saldo_inicial_centavos;
    const proj = r.saldo_projetado_centavos;
    let faixa = null;
    if (proj !== null && inicial) faixa = proj <= inicial ? 'minimo' : multiplo != null && proj > multiplo * inicial ? 'alto' : 'medio';
    const bloqueios = ['SEM_CARTAO', 'SEM_DIAS_SEMANA', 'SEM_VALOR_DIARIO', 'SEM_BENEFICIO'];
    const acao = r.regra_aplicada === 'sem_direito_situacao' ? 'NAO_RECARREGAR'
      : r.repasse_centavos > 0 ? 'RECARREGAR'
        : sinalizadores.some((f) => bloqueios.includes(f) || f.startsWith('CARTAO_')) ? 'REVISAR' : 'NAO_RECARREGAR';
    return {
      matricula: s.matricula, nome: s.nome, cpf_mascarado: normalizarCpf(s.cpf) ? mascararCpf(normalizarCpf(s.cpf)) : null,
      cargo: s.cargo, unidade: s.unidade, cartao: c.cartao_usado ?? s.cartao ?? null, cartao_sugerido: c.cartao_sugerido,
      situacao: s.situacao ?? 'ativo', dias_semana: diasSemana, faixa_saldo: faixa, acao, ...r, sinalizadores,
    };
  });
}
