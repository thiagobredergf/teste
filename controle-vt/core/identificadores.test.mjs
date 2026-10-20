import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarCartao, formatarCartao, normalizarCpf, mascararCpf } from './identificadores.mjs';
import { parseValorBR } from './dinheiro.mjs';

test('o mesmo cartão em formatos diferentes tem uma chave só', () => {
  assert.equal(normalizarCartao('06.04.007259 61-3'), '604007259613'); // PDF da Global Mob
  assert.equal(normalizarCartao(604007259613), '604007259613');        // planilha (Excel perdeu o zero)
  assert.equal(formatarCartao('604007259613'), '06.04.007259 61-3');
  assert.equal(normalizarCartao('123'), null);
});

test('CPF completo e válido; mascarado ou inválido não serve de chave', () => {
  assert.equal(normalizarCpf('529.982.247-25'), '52998224725');
  assert.equal(normalizarCpf('74xxxxxx-02'), null);
  assert.equal(normalizarCpf('11111111111'), null);
  assert.equal(normalizarCpf('52998224726'), null);
  assert.equal(mascararCpf('52998224725'), '529.***.***-25');
});

test('saldo negativo do cartão', () => {
  assert.equal(parseValorBR('-R$ 4,30').centavos, -430);
  assert.equal(parseValorBR('R$ -4,30').centavos, -430);
  assert.equal(parseValorBR('R$ 4,30').centavos, 430);
});
