import test from 'node:test';
import assert from 'node:assert/strict';
import { compararRelacao } from './relacao.mjs';

const c = (matricula, extra = {}) => ({ matricula, nome: 'N' + matricula, situacao: 'ativo', valor_diario_centavos: 1670, dias_semana: 5, cartao: '60400' + matricula, desconto_centavos: 11356, saldo_inicial_centavos: 30000, ...extra });
const r = (matricula, extra = {}) => { const { situacao, ...resto } = c(matricula); return { ...resto, ...extra }; };

test('entrada, saída, reativação e alteração em uma única comparação', () => {
  const cadastro = [c('1'), c('2'), c('3'), c('4', { situacao: 'suspenso' }), c('5', { situacao: 'cancelado' })];
  const nova = [r('1'), r('3', { dias_semana: 4, desconto_centavos: 9000 }), r('4'), r('5'), r('6')];
  const d = compararRelacao(nova, cadastro);
  assert.deepEqual(d.entradas.map((e) => [e.matricula, e.evento_sugerido]), [['5', 'reativacao'], ['6', 'inclusao']]); // 4 está suspenso e continua na relação: não é entrada
  assert.deepEqual(d.saidas.map((s) => s.matricula), ['2']);
  assert.deepEqual(d.alteracoes.map((a) => [a.matricula, a.campo, a.de, a.para]),
    [['3', 'dias_semana', 5, 4], ['3', 'desconto_centavos', 11356, 9000]]);
  assert.equal(d.inalterados, 2);   // 1 e 4
  assert.equal(d.resumo.servidores_com_alteracao, 1);
});

test('matrícula duplicada ou vazia na relação vai para conferência e não é comparada', () => {
  const d = compararRelacao([r('1'), r('1'), r(''), r('2')], [c('1'), c('2')]);
  assert.deepEqual(d.duplicadas, [{ matricula: '1', ocorrencias: 2 }]);
  assert.equal(d.semMatricula.length, 1);
  assert.deepEqual(d.saidas, []);   // a matrícula 1 duplicada não vira "saída" por engano
  assert.equal(d.inalterados, 1);
});

test('matrícula numérica e texto são a mesma pessoa', () => {
  const d = compararRelacao([r(28465)], [c('28465')]);
  assert.equal(d.entradas.length + d.saidas.length, 0);
});

test('movimento mensal em % sobre os ativos', () => {
  const cadastro = Array.from({ length: 10 }, (_, i) => c(String(i + 1)));
  const nova = [...cadastro.slice(1).map((x) => r(x.matricula)), r('99')];
  assert.equal(compararRelacao(nova, cadastro).resumo.movimento_pct, 20);
});

test('reajuste do saldo inicial na relação do RH aparece como alteração', () => {
  const d = compararRelacao([r('1', { saldo_inicial_centavos: 33000 })], [c('1')]);
  assert.deepEqual(d.alteracoes.map((a) => [a.campo, a.de, a.para]), [['saldo_inicial_centavos', 30000, 33000]]);
});

test('suspenso que some da relação também é saída a classificar', () => {
  const d = compararRelacao([r('1')], [c('1'), c('2', { situacao: 'suspenso' }), c('3', { situacao: 'cancelado' })]);
  assert.deepEqual(d.saidas.map((s) => s.matricula), ['2']);
});
