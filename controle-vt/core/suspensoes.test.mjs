import test from 'node:test';
import assert from 'node:assert/strict';
import { revisarSuspensoes } from './suspensoes.mjs';

const ctx = {
  inicioCompetencia: '2026-11-01',
  saldoProjetado: new Map([['1', 20000], ['2', 90000], ['3', null]]),
  saldoInicial: new Map([['1', 25000], ['2', 25000], ['3', 25000]]),
};

test('licença com prazo vencido, licença sem prazo e saldo alto que voltou ao normal', () => {
  const r = revisarSuspensoes([
    { matricula: '1', motivo_tipo: 'saldo_alto' },
    { matricula: '2', motivo_tipo: 'saldo_alto' },
    { matricula: '3', motivo_tipo: 'saldo_alto' },
    { matricula: '4', motivo_tipo: 'licenca_medica', ate: '2026-10-20' },
    { matricula: '5', motivo_tipo: 'licenca_medica', ate: '2026-12-29' },
    { matricula: '6', motivo_tipo: 'licenca_premio' },
    { matricula: '7', motivo_tipo: 'bloqueio_solicitado' },
  ], ctx);
  assert.deepEqual(r.reativacaoSugerida.map((x) => x.matricula), ['1']);   // 200,00 ≤ saldo inicial 250,00; 900,00 continua alto; sem saldo não sugere
  assert.deepEqual(r.prazoVencido.map((x) => x.matricula), ['4']);
  assert.deepEqual(r.semPrazo.map((x) => x.matricula), ['6']);             // bloqueio a pedido nunca é revisado automaticamente
});
