import test from 'node:test';
import assert from 'node:assert/strict';
import { lerTexto, aplicarMapa } from './mapeamento.mjs';
import { parseValorBR } from './dinheiro.mjs';

const mapa = {
  matricula: { coluna: 'MATRICULA', tipo: 'texto', obrigatorio: true },
  valor_diario_centavos: { coluna: 'VALOR', tipo: 'dinheiro', obrigatorio: true },
  dias_semana: { coluna: 'DIAS', tipo: 'inteiro', obrigatorio: true },
  desconto_centavos: { coluna: 'DESCONTO', tipo: 'dinheiro' },
};

test('TXT delimitado com cabeçalho', () => {
  const txt = 'MATRICULA;VALOR;DIAS;DESCONTO\n28465;16,70;5;113,56\n990010243;16.70;3;\n\n1;x;5;\n2;10,00;;\n';
  const { ok, rejeitadas } = aplicarMapa(lerTexto(txt, { tipo: 'delimitado', separador: ';', cabecalho: true }), mapa);
  assert.deepEqual(ok, [
    { matricula: '28465', valor_diario_centavos: 1670, dias_semana: 5, desconto_centavos: 11356 },
    { matricula: '990010243', valor_diario_centavos: 1670, dias_semana: 3, desconto_centavos: null },
  ]);
  assert.deepEqual(rejeitadas.map((r) => [r.linha, r.motivo]), [[5, 'valor inválido em valor_diario_centavos: "x"'], [6, 'campo obrigatório vazio: dias_semana']]);
});

test('TXT de largura fixa', () => {
  const txt = 'CABECALHO DO RELATORIO\n28465     0016,70 5 00113,56\n';
  const formato = { tipo: 'posicional', pular: 1, colunas: [
    { nome: 'MATRICULA', inicio: 0, tamanho: 10 }, { nome: 'VALOR', inicio: 10, tamanho: 7 },
    { nome: 'DIAS', inicio: 18, tamanho: 1 }, { nome: 'DESCONTO', inicio: 20, tamanho: 9 }] };
  const { ok } = aplicarMapa(lerTexto(txt, formato), mapa);
  assert.deepEqual(ok, [{ matricula: '28465', valor_diario_centavos: 1670, dias_semana: 5, desconto_centavos: 11356 }]);
});

test('coluna que não existe no arquivo é erro claro, não valor vazio', () => {
  const { rejeitadas } = aplicarMapa(lerTexto('A;B\n1;2', { tipo: 'delimitado', separador: ';', cabecalho: true }), mapa);
  assert.match(rejeitadas[0].motivo, /coluna "MATRICULA" não existe/);
});

test('ponto decimal x milhar', () => {
  assert.equal(parseValorBR('16.70').centavos, 1670);
  assert.equal(parseValorBR('1.030').centavos, 103000);
  assert.equal(parseValorBR('1.030,65').centavos, 103065);
});

test('vírgula como separador: valor entre aspas funciona; sem aspas é rejeitado com explicação', () => {
  const txt = 'MATRICULA,VALOR,DIAS,DESCONTO\n28465,"16,70",5,"113,56"\n990010243,16,70,3,\n';
  const { ok, rejeitadas } = aplicarMapa(lerTexto(txt, { tipo: 'delimitado', separador: ',', cabecalho: true }), mapa);
  assert.deepEqual(ok, [{ matricula: '28465', valor_diario_centavos: 1670, dias_semana: 5, desconto_centavos: 11356 }]);
  assert.equal(rejeitadas.length, 1);
  assert.match(rejeitadas[0].motivo, /esperadas 4 colunas, encontradas 5.*aspas/);
});

test('vírgula como separador com ponto decimal', () => {
  const txt = 'MATRICULA,VALOR,DIAS,DESCONTO\n28465,16.70,5,113.56\n';
  const { ok } = aplicarMapa(lerTexto(txt, { tipo: 'delimitado', separador: ',', cabecalho: true }), mapa);
  assert.equal(ok[0].desconto_centavos, 11356);
});

test('conversores de cartão e data/hora', () => {
  const m = { cartao: { coluna: 'C', tipo: 'cartao', obrigatorio: true }, lido_em: { coluna: 'D', tipo: 'datahora', obrigatorio: true } };
  const { ok, rejeitadas } = aplicarMapa(lerTexto('C;D\n699900000013;14/10/2026 18:30\n604007259614;2026-10-14\n60400;14/10/2026\n604007259615;31/02/2026', { tipo: 'delimitado', separador: ';', cabecalho: true }), m);
  assert.deepEqual(ok, [{ cartao: '699900000013', lido_em: '2026-10-14T18:30' }, { cartao: '604007259614', lido_em: '2026-10-14T00:00' }]);
  assert.equal(rejeitadas.length, 2);
});
