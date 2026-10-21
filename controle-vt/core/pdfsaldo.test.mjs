import test from 'node:test';
import assert from 'node:assert/strict';
import { extrairSaldoGlobalMob } from './pdfsaldo.mjs';

// Relatório fictício com a mesma geometria do PDF real da Global Mob.
const it = (s, x, y) => ({ s, x, y });
const cartao = (y, num, dv, status, saldo, recargas) => [
  it(num, 209, y), it(dv, 209, y - 11), it(status, 277, y),
  it('VALE', 358, y), it('TRANSPORT', 358, y - 11), it('E', 358, y - 22),
  ...(Array.isArray(saldo) ? saldo.map((t, k) => it(t, 427, y - 11 * k)) : [it(saldo, 427, y)]),
  ...(Array.isArray(recargas) ? recargas.map((t, k) => it(t, 479, y - 11 * k)) : [it(recargas, 479, y)]),
];
const pessoa = (y, nomes, doc) => [...nomes.map((n, k) => it(n, 59, y - 11 * k)), it(doc, 138, y)];
const cabecalho = [it('Saldo de cartões', 214, 707), ...['NOME', 'DOCUMENTO', 'Nº CARTÃO', 'STATUS', 'APLICAÇÃO', 'SALDO', 'RECARGAS'].map((t, k) => it(t, 85 + k * 60, 644))];
const rodape = (n) => [it('Página', 300, 30), it(`${n}/2`, 330, 30), it(' ', 462, 627)];

const pagina1 = [
  ...cabecalho,
  ...pessoa(627, ['MARIA DE', 'FULANA SILVA'], '52998224725'),
  ...cartao(627, '06.99.900000', '01-3', 'ATIVO', 'R$ 572,85', 'R$ 0,00'),
  ...cartao(590, '06.99.900000', '05-5', 'MIGRADO', 'R$ 0,00', 'R$ 0,00'),
  ...pessoa(553, ['JOAO TESTE'], '11144477735'),
  ...cartao(553, '06.99.900000', '04-4', 'ATIVO', '-R$ 4,30', ['R$', '1.085,50']),
  ...rodape(1),
];
const pagina2 = (total) => [
  ...cartao(627, '06.99.900000', '02-2', 'ATIVO', 'R$ 3,40', 'R$ 0,00'),         // continua a pessoa da página anterior
  ...pessoa(590, ['ANA EXEMPLO'], '12345678909'),
  ...cartao(590, '06.99.900000', '03-3', 'ATIVO', ['R$', '1.000,00'], 'R$ 0,00'),
  it('TOTAL', 358, 540), it(total, 427, 540),
  ...rodape(2),
];

test('extrai pessoas com vários cartões, quebras de linha, saldo negativo e continuação de página', () => {
  const r = extrairSaldoGlobalMob([pagina1, pagina2('R$ 1.571,95')]);
  assert.equal(r.cartoes.length, 5);
  assert.deepEqual(r.cartoes.map((c) => [c.cartao, c.status, c.saldo_centavos, c.recargas_centavos]), [
    ['699900000013', 'ATIVO', 57285, 0],
    ['699900000055', 'MIGRADO', 0, 0],
    ['699900000044', 'ATIVO', -430, 108550],      // "R$" / "1.085,50" em linhas separadas
    ['699900000022', 'ATIVO', 340, 0],
    ['699900000033', 'ATIVO', 100000, 0],
  ]);
  assert.deepEqual(r.cartoes.map((c) => c.nome), ['MARIA DE FULANA SILVA', 'MARIA DE FULANA SILVA', 'JOAO TESTE', 'JOAO TESTE', 'ANA EXEMPLO']);
  assert.equal(r.cartoes[3].documento, '11144477735'); // cartão da página 2 herdou a pessoa da página 1
  assert.equal(r.cartoes[0].cpf, '52998224725');
  assert.equal(r.total_impresso_centavos, 157195);
  assert.equal(r.confere, true);
  assert.deepEqual(r.avisos, []);
});

test('total impresso diferente da soma extraída vira aviso (extração não confiável)', () => {
  const r = extrairSaldoGlobalMob([pagina1, pagina2('R$ 1.600,00')]);
  assert.equal(r.confere, false);
  assert.match(r.avisos[0], /difere do total impresso/);
});

test('sem linha de TOTAL não há como conferir, e isso é dito', () => {
  const semTotal = pagina2('x').filter((i) => i.s !== 'TOTAL' && i.s !== 'x');
  const r = extrairSaldoGlobalMob([pagina1, semTotal]);
  assert.equal(r.confere, false);
  assert.match(r.avisos.join(' '), /TOTAL não encontrada/);
});
