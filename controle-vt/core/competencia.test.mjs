import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularCompetencia } from './competencia.mjs';
import { validarTabelaDias, diasLetivosBase } from './calendario.mjs';

const regras = { falta: { desconta_vt: true }, licenca_medica: { desconta_vt: true } };
const tabelaDias = { 5: 19, 4: 17, 3: 13, 2: 9, 1: 5 };
const srv = (matricula, extra = {}) => ({ matricula, nome: 'N' + matricula, cpf: '52998224725', cargo: 'ASG ', unidade: 'EM X', cartao: '600000000001',
  valor_diario_centavos: 1670, dias_semana: null, saldo_inicial_centavos: 30000, desconto_centavos: 11356, situacao: 'ativo', ...extra });
const cruz = (matricula, extra = {}) => ({ matricula, cartao_usado: '600000000001', saldo_centavos: 5000, recargas_centavos: 0, cartao_sugerido: null, flags: [], ...extra });
const comum = { cargos: { ASG: 5, DOCENTE: null }, tabelaDias, regras, dataCredito: '2026-10-30', dataLeitura: '2026-10-20' };

test('cargo define os dias por semana; docente sem padrão exige informar', () => {
  const r = calcularCompetencia({ ...comum, servidores: [srv('1'), srv('2', { cargo: 'DOCENTE' }), srv('3', { cargo: 'DOCENTE', dias_semana: 3 })], cruzamento: [cruz('1'), cruz('2'), cruz('3')] });
  assert.equal(r[0].dias_semana, 5);
  assert.equal(r[0].direito_centavos, 19 * 1670);
  assert.ok(r[1].sinalizadores.includes('SEM_DIAS_SEMANA'));
  assert.equal(r[1].acao, 'REVISAR');
  assert.equal(r[2].dias_semana, 3);
  assert.equal(r[2].direito_centavos, 13 * 1670);   // dias do servidor tem prioridade sobre o cargo
});

test('faixa de saldo e ação do mês', () => {
  const lista = [srv('1'), srv('2'), srv('3'), srv('4', { situacao: 'suspenso' }), srv('5')];
  const r = calcularCompetencia({ ...comum, servidores: lista, cruzamento: [
    cruz('1', { saldo_centavos: 1000 }),             // projetado 0 → mínimo, recarregar
    cruz('2', { saldo_centavos: 60000 }),            // projetado 41.630 → médio (entre 1× e 3× de 30.000)
    cruz('3', { saldo_centavos: 150000 }),           // alto
    cruz('4'), cruz('5', { cartao_usado: null, saldo_centavos: null, cartao_sugerido: '600000000009', flags: ['CARTAO_NAO_ENCONTRADO'] })] });
  assert.deepEqual(r.map((x) => x.faixa_saldo), ['minimo', 'medio', 'alto', null, null]);
  assert.deepEqual(r.map((x) => x.acao), ['RECARREGAR', 'NAO_RECARREGAR', 'NAO_RECARREGAR', 'NAO_RECARREGAR', 'REVISAR']);
  assert.ok(r[2].sinalizadores.includes('SALDO_ALTO'));
  assert.equal(r[4].cartao_sugerido, '600000000009');
  assert.equal(r[0].cpf_mascarado, '529.***.***-25');
});

test('ocorrências do ponto reduzem os dias e o direito', () => {
  const r = calcularCompetencia({ ...comum, servidores: [srv('1')], cruzamento: [cruz('1')], ocorrencias: [{ matricula: '1', tipo: 'falta', dias: 2 }] });
  assert.equal(r[0].dias_efetivos, 17);
});

test('tabela de dias editável: validação pega erro de digitação', () => {
  assert.deepEqual(validarTabelaDias({ 5: 19, 4: 17, 3: 13, 2: 9, 1: 5 }, 19, 30), []);
  assert.match(validarTabelaDias({ 5: 19, 4: 17, 3: 130, 2: 9, 1: 5 }, 19, 30)[0].texto, /mais do que o mês tem/);
  assert.match(validarTabelaDias({ 5: 19, 4: 17, 3: 18, 2: 9, 1: 5 }, 19, 30)[0].texto, /3 dia\(s\)\/semana \(18\) não pode ter mais dias que 4/);
  assert.equal(validarTabelaDias({ 5: 20, 4: 17, 3: 13, 2: 9, 1: 5 }, 19, 30)[0].nivel, 'aviso');
  assert.equal(diasLetivosBase(2026, 11, ['2026-11-02', '2026-11-20']), 19);
});
