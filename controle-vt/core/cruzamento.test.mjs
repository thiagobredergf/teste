import test from 'node:test';
import assert from 'node:assert/strict';
import { cruzarSaldos } from './cruzamento.mjs';
import { normalizarCpf } from './identificadores.mjs';

// CPFs fictícios válidos, gerados pelo mesmo algoritmo de validação
const cpf = (base) => { let d = String(base).padStart(9, '0'); for (const n of [10, 11]) { const r = ([...d].reduce((a, x, i) => a + Number(x) * (n - i), 0) * 10) % 11; d += r === 10 ? 0 : r; } return d; };
const [A, B, C, D, E] = [111222333, 222333444, 333444555, 444555666, 555666777].map(cpf);
assert.ok([A, B, C, D, E].every((x) => normalizarCpf(x)));

const gm = (c, cartao, status, saldo = 0) => ({ cpf: c, cartao, status, saldo_centavos: saldo, recargas_centavos: 0 });

test('cruza por CPF: cartão ativo, migrado com sucessor, de outra pessoa, ausente e ambíguo', () => {
  const cartoes = [
    gm(A, '600000000001', 'ATIVO', 5000),
    gm(B, '600000000002', 'MIGRADO'), gm(B, '600000000003', 'ATIVO', 7000),   // cadastro tem o migrado
    gm(C, '600000000004', 'ATIVO', 9999),                                      // cadastro de D aponta para o cartão de C
    gm(E, '600000000005', 'ATIVO'), gm(E, '600000000006', 'ATIVO'),            // dois ativos
    gm(cpf(999888777), '600000000007', 'ATIVO'),                               // pessoa que não é beneficiária
  ];
  const servidores = [
    { matricula: '1', cpf: A, cartao: '600000000001' },
    { matricula: '2', cpf: B, cartao: '600000000002' },
    { matricula: '3', cpf: D, cartao: '600000000004' },
    { matricula: '4', cpf: C, cartao: '600000000099' },          // cartão do cadastro não existe na Global Mob
    { matricula: '5', cpf: E, cartao: null },
    { matricula: '6', cpf: '74xxxxxx-02', cartao: '600000000001' }, // CPF mascarado
  ];
  const r = cruzarSaldos(servidores, cartoes);
  const por = Object.fromEntries(r.servidores.map((s) => [s.matricula, s]));
  assert.deepEqual([por[1].cartao_usado, por[1].saldo_centavos, por[1].flags], ['600000000001', 5000, []]);
  assert.deepEqual([por[2].cartao_usado, por[2].cartao_sugerido, por[2].flags], [null, '600000000003', ['CARTAO_NAO_ATIVO']]);
  assert.deepEqual([por[3].cartao_usado, por[3].saldo_centavos], [null, null]);          // saldo de outra pessoa nunca é usado
  assert.ok(por[3].flags.includes('CARTAO_DE_OUTRA_PESSOA'));
  assert.deepEqual([por[4].cartao_sugerido, por[4].flags], ['600000000004', ['CARTAO_NAO_ENCONTRADO']]);
  assert.deepEqual(por[5].flags, ['SEM_CARTAO_NO_CADASTRO', 'VARIOS_CARTOES_ATIVOS']);
  assert.ok(por[6].flags.includes('CPF_AUSENTE'));
  assert.equal(por[6].cartao_usado, '600000000001');          // sem CPF, vale só o número do cartão
});

test('guarda só os cartões vinculados aos beneficiários', () => {
  const cartoes = [gm(A, '600000000001', 'ATIVO'), gm(cpf(1), '600000000008', 'ATIVO'), gm(cpf(2), '600000000009', 'ATIVO')];
  const r = cruzarSaldos([{ matricula: '1', cpf: A, cartao: '600000000001' }], cartoes);
  assert.equal(r.cartoes_relevantes.length, 1);
  assert.equal(r.cartoes_descartados, 2);
});
