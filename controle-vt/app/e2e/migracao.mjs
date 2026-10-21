// Arquivo da versão 1 (sem "quem") abre, migra e passa a registrar o operador.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const initSqlJs = require('sql.js/dist/sql-asm-memory-growth.js');
globalThis.window = { initSqlJs: () => initSqlJs() };
const banco = await import('../src/db.js');
await banco.iniciarMotor();

const SQL = await initSqlJs();
const v1 = new SQL.Database();
v1.run(`create table meta (chave text primary key, valor text); insert into meta values ('versao','1');
  create table evento (id integer primary key autoincrement, matricula text not null, tipo text not null, motivo_tipo text not null, data_efeito text not null, ate text, motivo text, origem text, criado_em text not null default (datetime('now')));
  create table ocorrencia (id integer primary key autoincrement, ym text not null, matricula text not null, tipo text not null, dias integer not null, observacao text, ativo integer not null default 1, criado_em text not null default (datetime('now')));
  create table contestacao (id integer primary key autoincrement, ym text not null, matricula text not null, texto text not null, criado_em text not null default (datetime('now')));
  create table auditoria (id integer primary key autoincrement, em text not null default (datetime('now')), acao text not null, detalhe text);
  insert into auditoria (acao) values ('registro antigo');`);
banco.carregarBanco(v1.export());
assert.equal(banco.foiAlterado(), true, 'arquivo migrado precisa ser salvo de novo');
assert.equal(banco.q("select valor from meta where chave = 'versao'")[0].valor, '2');
banco.definirOperador('Operador Teste');
banco.auditar('acao nova', 'x');
const aud = banco.q('select acao, quem from auditoria order by id');
assert.deepEqual(aud, [{ acao: 'registro antigo', quem: null }, { acao: 'acao nova', quem: 'Operador Teste' }]);
banco.x("insert into evento (matricula, tipo, motivo_tipo, data_efeito) values ('1','alteracao','outro','2026-10-21')");
assert.equal(banco.q('select quem from evento')[0].quem, 'Operador Teste');
console.log('  ✓ migração v1 → v2: registros antigos preservados, novos carimbados com o operador');
