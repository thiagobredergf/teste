import { PARAMETROS_PADRAO } from '../../core/calculo.mjs';
import { CARGOS_PADRAO } from '../../core/cargos.mjs';

// SQLite em memória (sql.js). O arquivo de dados é o export deste banco, cifrado ou não (ver arquivo.js).
const DDL = `
create table meta (chave text primary key, valor text);
create table contexto (chave text primary key, valor text);
create table servidor (
  matricula text primary key, nome text not null, cpf text, cargo text, unidade text, cartao text,
  valor_diario_centavos integer, dias_semana integer, saldo_inicial_centavos integer, desconto_centavos integer,
  situacao text not null default 'ativo' check (situacao in ('ativo','suspenso','cancelado')),
  criado_em text not null default (datetime('now')), atualizado_em text
);
create table evento (
  id integer primary key autoincrement, matricula text not null, tipo text not null
    check (tipo in ('inclusao','suspensao','reativacao','cancelamento','alteracao','observacao')),
  motivo_tipo text not null, data_efeito text not null, ate text, motivo text, origem text,
  criado_em text not null default (datetime('now')), quem text
);
create table competencia (
  ym text primary key, data_credito text not null, data_leitura text, feriados text not null default '[]',
  tabela_dias text not null, parametros text not null default '{}', status text not null default 'aberta' check (status in ('aberta','fechada'))
);
create table cargo_regra (cargo text primary key, dias_semana integer);
create table regra_ocorrencia (tipo text primary key, descricao text not null, desconta_vt integer not null);
create table ocorrencia (
  id integer primary key autoincrement, ym text not null, matricula text not null, tipo text not null references regra_ocorrencia(tipo),
  dias integer not null check (dias > 0), observacao text, ativo integer not null default 1, criado_em text not null default (datetime('now')), quem text
);
create table saldo (
  id integer primary key autoincrement, cartao text not null, cpf text, valor_centavos integer not null, recargas_centavos integer,
  status_cartao text, lido_em text not null, fonte text not null, arquivo text, unique (cartao, lido_em)
);
create table contestacao (id integer primary key autoincrement, ym text not null, matricula text not null, texto text not null, criado_em text not null default (datetime('now')), quem text);
create table desconto_decisao (ym text not null, matricula text not null, decisao text not null check (decisao in ('descontar','nao_descontar')), primary key (ym, matricula));
create table perfil_importacao (nome text primary key, formato text not null, mapa text not null);
create table fechamento (ym text primary key, criado_em text not null default (datetime('now')), resumo text not null, linhas text not null);
create table auditoria (id integer primary key autoincrement, em text not null default (datetime('now')), acao text not null, detalhe text, quem text);
create trigger evento_quem after insert on evento begin update evento set quem = (select valor from contexto where chave = 'operador') where id = new.id; end;
create trigger ocorrencia_quem after insert on ocorrencia begin update ocorrencia set quem = (select valor from contexto where chave = 'operador') where id = new.id; end;
create trigger contestacao_quem after insert on contestacao begin update contestacao set quem = (select valor from contexto where chave = 'operador') where id = new.id; end;
create trigger auditoria_quem after insert on auditoria begin update auditoria set quem = (select valor from contexto where chave = 'operador') where id = new.id; end;
create trigger ocorrencia_fechada before insert on ocorrencia
  when (select status from competencia where ym = new.ym) = 'fechada'
  begin select raise(abort, 'competência fechada: não é possível lançar ocorrência'); end;
create trigger ocorrencia_fechada_upd before update on ocorrencia
  when (select status from competencia where ym = new.ym) = 'fechada'
  begin select raise(abort, 'competência fechada: não é possível alterar ocorrência'); end;
`;

let SQL = null;
let db = null;
let alterado = false;

export async function iniciarMotor() {
  if (SQL) return;
  SQL = await window.initSqlJs(); // build em JavaScript puro (asm.js): não depende de WebAssembly, que políticas de segurança podem bloquear
}

export function novoBanco() {
  db = new SQL.Database();
  db.run(DDL);
  db.run('insert into meta values (?, ?)', ['versao', '2']);
  const regras = [['falta', 'Falta não abonada', 1], ['licenca_medica', 'Licença médica', 1], ['licenca_maternidade', 'Licença maternidade', 1],
    ['licenca_premio', 'Licença prêmio', 1], ['ferias', 'Férias', 1], ['afastamento', 'Outros afastamentos', 1], ['abono', 'Falta abonada', 0]];
  for (const r of regras) db.run('insert into regra_ocorrencia values (?,?,?)', r);
  for (const [cargo, dias] of CARGOS_PADRAO) db.run('insert into cargo_regra values (?,?)', [cargo, dias]);
  alterado = true;
}

// Versão 1 -> 2: registra quem fez cada lançamento (vários operadores podem usar o mesmo arquivo).
const MIGRACOES = {
  1: `create table contexto (chave text primary key, valor text);
    alter table evento add column quem text; alter table ocorrencia add column quem text;
    alter table contestacao add column quem text; alter table auditoria add column quem text;
    create trigger evento_quem after insert on evento begin update evento set quem = (select valor from contexto where chave = 'operador') where id = new.id; end;
    create trigger ocorrencia_quem after insert on ocorrencia begin update ocorrencia set quem = (select valor from contexto where chave = 'operador') where id = new.id; end;
    create trigger contestacao_quem after insert on contestacao begin update contestacao set quem = (select valor from contexto where chave = 'operador') where id = new.id; end;
    create trigger auditoria_quem after insert on auditoria begin update auditoria set quem = (select valor from contexto where chave = 'operador') where id = new.id; end;
    update meta set valor = '2' where chave = 'versao';`,
};
const VERSAO_ATUAL = 2;

export function carregarBanco(bytes) {
  db = new SQL.Database(bytes);
  const v = q('select valor from meta where chave = ?', ['versao'])[0];
  if (!v) throw new Error('arquivo não reconhecido: não é um arquivo de dados do Controle de VT');
  const versao = Number(v.valor);
  if (versao > VERSAO_ATUAL) throw new Error('este arquivo foi criado por uma versão mais nova do aplicativo');
  for (let n = versao; n < VERSAO_ATUAL; n++) db.exec(MIGRACOES[n]);
  alterado = versao < VERSAO_ATUAL; // um arquivo migrado precisa ser salvo de novo
}

// Quem está usando o arquivo agora. Não marca o arquivo como alterado.
export function definirOperador(nome) {
  db.run("insert or replace into contexto (chave, valor) values ('operador', ?)", [nome]);
}
export const operadorAtual = () => q("select valor from contexto where chave = 'operador'")[0]?.valor ?? null;

export const temBanco = () => db !== null;
export const exportarBanco = () => db.export();
export const foiAlterado = () => alterado;
export const marcarSalvo = () => { alterado = false; };

export function q(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const linhas = [];
  while (stmt.step()) linhas.push(stmt.getAsObject());
  stmt.free();
  return linhas;
}

export function x(sql, params = []) {
  db.run(sql, params);
  alterado = true;
}

export function transacao(fn) {
  db.run('begin');
  try { fn(); db.run('commit'); alterado = true; } catch (e) { db.run('rollback'); throw e; }
}

export const auditar = (acao, detalhe = '') => x('insert into auditoria (acao, detalhe) values (?, ?)', [acao, detalhe]);

export function competencia(ym) {
  const c = q('select * from competencia where ym = ?', [ym])[0];
  if (!c) return null;
  return {
    ...c, feriados: JSON.parse(c.feriados), tabela_dias: JSON.parse(c.tabela_dias),
    parametros: { ...PARAMETROS_PADRAO, ...JSON.parse(c.parametros) },
  };
}

export const competencias = () => q('select ym, status from competencia order by ym desc');
