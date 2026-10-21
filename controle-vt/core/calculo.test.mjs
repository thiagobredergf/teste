import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularRepasse, calcularDiasEfetivos } from './calculo.mjs';
import { diasUteisEntre } from './datas.mjs';
import { parseValorBR } from './dinheiro.mjs';
import { parseSaldoCanonico } from './saldo.mjs';

const regras = {
  falta: { desconta_vt: true }, licenca_medica: { desconta_vt: true }, ferias: { desconta_vt: true }, abono: { desconta_vt: false },
};
const base = {
  situacao: 'ativo', cartao: { status: 'ativo' }, beneficio: { valor_diario_centavos: 1670, dias_semana: 5, saldo_inicial_centavos: 30000, desconto_centavos: 11356 },
  diasBase: 19, ocorrencias: [], regras, saldo: null, dataCredito: '2026-10-30', feriados: [],
};

test('dias úteis entre 14/10 e 30/10/2026 (extremos excluídos)', () => {
  assert.equal(diasUteisEntre('2026-10-14', '2026-10-30'), 11);
  assert.equal(diasUteisEntre('2026-10-14', '2026-10-30', ['2026-10-15']), 10);
});

test('sem saldo: repasse = direito cheio, com sinalizador', () => {
  const r = calcularRepasse(base);
  assert.equal(r.direito_centavos, 31730);
  assert.equal(r.repasse_centavos, 31730);
  assert.deepEqual(r.sinalizadores, ['SEM_SALDO']);
});

test('saldo alto cobre o direito: repasse zero', () => {
  const r = calcularRepasse({ ...base, saldo: { valor_centavos: 57285, lido_em: '2026-10-14T18:00' } });
  // consumo estimado 11 dias × 16,70 = 183,70; projetado 389,15 > direito 317,30
  assert.equal(r.consumo_estimado_centavos, 18370);
  assert.equal(r.saldo_projetado_centavos, 38915);
  assert.equal(r.repasse_centavos, 0);
  assert.ok(r.sinalizadores.includes('SALDO_COBRE_DIREITO'));
});

test('saldo parcial: repasse = direito − saldo projetado', () => {
  const r = calcularRepasse({ ...base, saldo: { valor_centavos: 30000, lido_em: '2026-10-14T18:00' } });
  assert.equal(r.saldo_projetado_centavos, 11630);
  assert.equal(r.repasse_centavos, 31730 - 11630);
  assert.equal(r.regra_aplicada, 'direito_menos_saldo_projetado');
});

test('projeção conservadora nunca deixa saldo negativo', () => {
  const r = calcularRepasse({ ...base, saldo: { valor_centavos: 5000, lido_em: '2026-10-14T18:00' } });
  assert.equal(r.saldo_projetado_centavos, 0);
  assert.equal(r.repasse_centavos, 31730);
});

test('modo "nenhum" usa o saldo como lido', () => {
  const r = calcularRepasse({ ...base, saldo: { valor_centavos: 30000, lido_em: '2026-10-14T18:00' } }, { projecao_modo: 'nenhum' });
  assert.equal(r.repasse_centavos, 1730);
});

test('saldo velho é ignorado e sinalizado', () => {
  const r = calcularRepasse({ ...base, saldo: { valor_centavos: 90000, lido_em: '2026-08-01T10:00' } });
  assert.equal(r.repasse_centavos, 31730);
  assert.ok(r.sinalizadores.includes('SALDO_ANTIGO'));
});

test('ocorrências: cada tipo segue sua regra (abono não desconta)', () => {
  const { descontados, efetivos } = calcularDiasEfetivos({
    diasBase: 19, regras, ocorrencias: [{ tipo: 'falta', dias: 2 }, { tipo: 'abono', dias: 3 }, { tipo: 'ferias', dias: 5 }],
  });
  assert.equal(descontados, 7);
  assert.equal(efetivos, 12);
});

test('tipo de ocorrência sem regra falha em vez de passar em silêncio', () => {
  assert.throws(() => calcularDiasEfetivos({ diasBase: 19, regras, ocorrencias: [{ tipo: 'misterio', dias: 1 }] }));
});

test('suspenso, sem benefício, sem cartão e dias zerados não geram repasse', () => {
  assert.equal(calcularRepasse({ ...base, situacao: 'suspenso' }).repasse_centavos, 0);
  assert.deepEqual(calcularRepasse({ ...base, beneficio: null }).sinalizadores, ['SEM_BENEFICIO']);
  const sc = calcularRepasse({ ...base, cartao: null });
  assert.equal(sc.repasse_centavos, 0);
  assert.ok(sc.sinalizadores.includes('SEM_CARTAO'));
  assert.ok(calcularRepasse({ ...base, ocorrencias: [{ tipo: 'licenca_medica', dias: 30 }] }).sinalizadores.includes('DIAS_ZERADOS'));
});

test('mínimo e múltiplo da recarga', () => {
  const s = { saldo: { valor_centavos: 30000, lido_em: '2026-10-14T18:00' } };
  assert.equal(calcularRepasse({ ...base, ...s }, { recarga_multiplo_centavos: 500 }).repasse_centavos, 20500);
  assert.equal(calcularRepasse({ ...base, ...s, diasBase: 7 }, { recarga_minima_centavos: 5000 }).repasse_centavos, 5000);
});

test('lê os formatos sujos de saldo da planilha legada', () => {
  assert.deepEqual(parseValorBR('R$ 572,85 - 14/10'), { centavos: 57285, data: '14/10' });
  assert.deepEqual(parseValorBR(' R$ 543,00 - 14/10'), { centavos: 54300, data: '14/10' });
  assert.deepEqual(parseValorBR('R$ 845,9 - 14/10'), { centavos: 84590, data: '14/10' });
  assert.deepEqual(parseValorBR('R$ 640,00 -14/10'), { centavos: 64000, data: '14/10' });
  assert.deepEqual(parseValorBR('R$ 1.030,65'), { centavos: 103065, data: null });
  assert.deepEqual(parseValorBR('\n R$ 117,53'), { centavos: 11753, data: null });
  assert.equal(parseValorBR('abc'), null);
});

test('importação de saldo: aceita linhas boas e rejeita com motivo', () => {
  const r = parseSaldoCanonico([
    'numero_cartao;valor;data_hora_leitura',
    '699900000013;572,85;2026-10-14T18:00',
    '60400;10,00;2026-10-14T18:00',
    '604007259614;xx;2026-10-14T18:00',
    '604007259615;10,00;14/10/2026',
    '699900000013;572,85;2026-10-14T18:00',
  ].join('\n'));
  assert.equal(r.ok.length, 1);
  assert.deepEqual(r.rejeitadas.map((x) => x.motivo), [
    'número de cartão inválido', 'valor inválido', 'data/hora inválida (use AAAA-MM-DDTHH:MM)', 'cartão repetido na mesma leitura',
  ]);
});

test('saldo alto: alerta acima de 3× o saldo inicial da relação do RH, sem alterar o repasse', () => {
  // saldo inicial 300,00 → limite 900,00 (e o direito é 317,30: a base NÃO é o direito)
  const lido = '2026-10-14T18:00';
  const acima = calcularRepasse({ ...base, saldo: { valor_centavos: 120000, lido_em: lido } });
  assert.ok(acima.sinalizadores.includes('SALDO_ALTO'));   // projetado 1.016,30 > 900,00
  assert.equal(acima.repasse_centavos, 0);
  const dentro = calcularRepasse({ ...base, saldo: { valor_centavos: 90000, lido_em: lido } });
  assert.ok(!dentro.sinalizadores.includes('SALDO_ALTO')); // projetado 716,30 ≤ 900,00
  const semPolitica = calcularRepasse({ ...base, saldo: { valor_centavos: 120000, lido_em: lido } }, { saldo_alto_multiplo: null });
  assert.ok(!semPolitica.sinalizadores.includes('SALDO_ALTO'));
});

test('sem saldo inicial na relação, o alerta não é avaliado e isso é sinalizado', () => {
  const r = calcularRepasse({ ...base, beneficio: { valor_diario_centavos: 1670, dias_semana: 5 }, saldo: { valor_centavos: 120000, lido_em: '2026-10-14T18:00' } });
  assert.ok(r.sinalizadores.includes('SEM_SALDO_INICIAL'));
  assert.ok(!r.sinalizadores.includes('SALDO_ALTO'));
});

test('desconto em folha: só sinaliza, não altera o repasse (política aguarda o jurídico)', () => {
  const lido = '2026-10-14T18:00';
  const semSaldo = calcularRepasse(base);
  assert.deepEqual(semSaldo.sinalizadores, ['SEM_SALDO']);       // repasse 317,30 ≥ desconto 113,56
  assert.equal(semSaldo.desconto_centavos, 11356);
  const saldoAlto = calcularRepasse({ ...base, saldo: { valor_centavos: 57285, lido_em: lido } });
  assert.equal(saldoAlto.repasse_centavos, 0);
  assert.ok(saldoAlto.sinalizadores.includes('DESCONTO_ACIMA_DA_RECARGA'));
  const acima = calcularRepasse({ ...base, beneficio: { ...base.beneficio, desconto_centavos: 40000 } });
  assert.ok(acima.sinalizadores.includes('DESCONTO_ACIMA_DO_DIREITO'));
  const sem = calcularRepasse({ ...base, beneficio: { valor_diario_centavos: 1670, dias_semana: 5, saldo_inicial_centavos: 30000 } });
  assert.ok(sem.sinalizadores.includes('SEM_DESCONTO_INFORMADO'));
});

test('RECARGAS da Global Mob: ignorar (padrão) ou somar ao saldo, sempre sinalizando', () => {
  const saldo = { valor_centavos: 10000, recargas_centavos: 20000, lido_em: '2026-10-14T18:00' };
  const ign = calcularRepasse({ ...base, saldo });
  assert.ok(ign.sinalizadores.includes('RECARGA_PENDENTE_NA_GLOBALMOB'));
  assert.equal(ign.recargas_centavos, 20000);
  assert.equal(ign.saldo_projetado_centavos, 0);          // 100,00 − consumo estimado 183,70, limitado ao saldo
  assert.equal(ign.repasse_centavos, 31730);
  const som = calcularRepasse({ ...base, saldo }, { recargas_modo: 'somar' });
  assert.equal(som.saldo_projetado_centavos, 30000 - 18370);
  assert.equal(som.repasse_centavos, 31730 - 11630);
});

test('saldo negativo no cartão: a recarga cobre o débito além do direito, e isso é sinalizado', () => {
  const r = calcularRepasse({ ...base, saldo: { valor_centavos: -430, lido_em: '2026-10-14T18:00' } });
  assert.equal(r.consumo_estimado_centavos, 0);
  assert.equal(r.saldo_projetado_centavos, -430);
  assert.equal(r.repasse_centavos, 31730 + 430);
  assert.ok(r.sinalizadores.includes('SALDO_NEGATIVO'));
});
