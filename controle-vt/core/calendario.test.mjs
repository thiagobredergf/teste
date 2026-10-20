import test from 'node:test';
import assert from 'node:assert/strict';
import { diasLetivosBase, tabelaDiasPorSemana, compararTabelas } from './calendario.mjs';
import { lancarSaldoManual, saldoVigente, dataLeituraSugerida } from './historico_saldo.mjs';

test('novembro/2026: seg-sex menos Finados e Consciência Negra = 19 (valor usado pela planilha)', () => {
  assert.equal(diasLetivosBase(2026, 11, []), 21);
  assert.equal(diasLetivosBase(2026, 11, ['2026-11-02', '2026-11-20']), 19);
  assert.equal(diasLetivosBase(2026, 11, ['2026-11-15']), 21); // feriado em domingo não reduz
});

test('a tabela de dias da planilha NÃO é proporcional: a divergência fica visível', () => {
  const planilha = { 5: 19, 4: 17, 3: 13, 2: 9 };
  const proporcional = tabelaDiasPorSemana(19);
  assert.deepEqual(proporcional, { 1: 4, 2: 8, 3: 11, 4: 15, 5: 19 });
  assert.deepEqual(compararTabelas(proporcional, planilha).map((d) => [d.dias_semana, d.calculado, d.informado]), [[2, 8, 9], [3, 11, 13], [4, 15, 17]]);
  assert.deepEqual(tabelaDiasPorSemana(19, { tipo: 'manual', tabela: planilha })[3], 13);
});

test('saldo manual recebe data/hora automática e nunca sobrescreve', () => {
  let h = [];
  h = lancarSaldoManual(h, { cartao: '604007259613', valor_centavos: 57285, agora: new Date('2026-10-14T18:05:09Z') });
  h = lancarSaldoManual(h, { cartao: '604007259613', valor_centavos: 41000, agora: new Date('2026-10-20T11:00:00Z') });
  assert.equal(h.length, 2);
  assert.deepEqual(saldoVigente(h, '604007259613'), { cartao: '604007259613', valor_centavos: 41000, lido_em: '2026-10-20T11:00:00', fonte: 'manual' });
  assert.equal(saldoVigente(h, '000'), null);
});

test('data da leitura do PDF: propõe a do nome do arquivo, senão a dos metadados', () => {
  assert.deepEqual(dataLeituraSugerida({ nomeArquivo: 'SALDO_CARTAO_20-10-2026.pdf', criadoEmPdf: "D:20261019000000+00'00'" }), { data: '2026-10-20', fonte: 'nome_arquivo' });
  assert.deepEqual(dataLeituraSugerida({ nomeArquivo: 'saldo.pdf', criadoEmPdf: "D:20261020102521+00'00'" }), { data: '2026-10-20', fonte: 'metadados_pdf' });
  assert.deepEqual(dataLeituraSugerida({ nomeArquivo: 'saldo.pdf' }), { data: null, fonte: null });
});
