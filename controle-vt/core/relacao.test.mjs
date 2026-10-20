import test from 'node:test';
import assert from 'node:assert/strict';
import { compararRelacao } from './relacao.mjs';

const c = (matricula, extra = {}) => ({ matricula, nome: 'N' + matricula, situacao: 'ativo', valor_diario_centavos: 1670, dias_semana: 5, cartao: '60400' + matricula, desconto_centavos: 11356, ...extra });
const r = (matricula, extra = {}) => { const { situacao, ...resto } = c(matricula); return { ...resto, ...extra }; };

test('entrada, saída, reativação e alteração em uma única comparação', () => {
  const cadastro = [c('1'), c('2'), c('3'), c('4', { situacao: 'suspenso' }), c('5', { situacao: 'cancelado' })];
  const nova = [r('1'), r('3', { dias_semana: 4, desconto_centavos: 9000 }), r('4'), r('6')];
  const d = compararRelacao(nova, cadastro);
  assert.deepEqual(d.entradas.map((e) => [e.matricula, e.evento_sugerido]), [['4', 'reativacao'], ['6', 'inclusao']]);
  assert.deepEqual(d.saidas.map((s) => s.matricula), ['2']);          // 5 já estava cancelado: não é saída nova
  assert.deepEqual(d.alteracoes.map((a) => [a.matricula, a.campo, a.de, a.para]),
    [['3', 'dias_semana', 5, 4], ['3', 'desconto_centavos', 11356, 9000]]);
  assert.equal(d.inalterados, 1);
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
