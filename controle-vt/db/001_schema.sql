-- Controle de Vale-Transporte — esquema inicial (PostgreSQL 15+)
-- Valores monetários sempre em centavos (integer). Datas em date; leituras de saldo em timestamptz.
-- Cadastro permanente + eventos; o cálculo mensal é gravado por competência e congelado no fechamento.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- ---------------------------------------------------------------- acesso
create table usuario (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  email     text not null unique,
  perfil    text not null check (perfil in ('admin', 'analista', 'auditor')),
  ativo     boolean not null default true,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------- cadastro
create table unidade (
  id   uuid primary key default gen_random_uuid(),
  nome text not null unique
);

create table servidor (
  id         uuid primary key default gen_random_uuid(),
  matricula  text not null unique,
  nome       text not null,
  cargo      text,
  unidade_id uuid references unidade(id),
  cpf        text,                       -- dado pessoal: restringir por perfil
  criado_em  timestamptz not null default now()
);

create table cartao (
  id          uuid primary key default gen_random_uuid(),
  servidor_id uuid not null references servidor(id),
  numero      text not null unique check (numero ~ '^[0-9]{8,20}$'),
  status      text not null default 'ativo' check (status in ('ativo', 'bloqueado', 'cancelado')),
  criado_em   timestamptz not null default now()
);
-- no máximo um cartão ativo/bloqueado por servidor
create unique index cartao_um_vigente_por_servidor on cartao (servidor_id) where status <> 'cancelado';

-- histórico do benefício (valor diário, dias por semana), sem sobreposição de vigência
create table beneficio (
  id                          uuid primary key default gen_random_uuid(),
  servidor_id                 uuid not null references servidor(id),
  valor_diario_centavos       integer not null check (valor_diario_centavos > 0),
  dias_semana                 smallint not null check (dias_semana between 1 and 7),
  desconto_referencia_centavos integer check (desconto_referencia_centavos >= 0), -- informado pela folha (6%); política aguarda o jurídico
  vigente_de                  date not null,
  vigente_ate                 date,
  check (vigente_ate is null or vigente_ate > vigente_de),
  exclude using gist (servidor_id with =, daterange(vigente_de, vigente_ate, '[)') with &&)
);

-- fonte da verdade da situação do servidor
create table evento (
  id          uuid primary key default gen_random_uuid(),
  servidor_id uuid not null references servidor(id),
  tipo        text not null check (tipo in
              ('inclusao', 'suspensao', 'reativacao', 'cancelamento', 'bloqueio_cartao', 'desbloqueio_cartao', 'observacao')),
  data_efeito date not null,
  motivo      text not null,            -- ex.: saldo alto, licença médica, pedido do servidor
  origem      text,                     -- e-mail, formulário, processo nº…
  criado_por  uuid references usuario(id),
  criado_em   timestamptz not null default now()
);
create index evento_servidor_data on evento (servidor_id, data_efeito desc);

create function situacao_em(p_servidor uuid, p_data date) returns text
language sql stable as $$
  select case tipo
           when 'inclusao' then 'ativo'
           when 'reativacao' then 'ativo'
           when 'suspensao' then 'suspenso'
           when 'cancelamento' then 'cancelado'
         end
  from evento
  where servidor_id = p_servidor
    and data_efeito <= p_data
    and tipo in ('inclusao', 'reativacao', 'suspensao', 'cancelamento')
  order by data_efeito desc, criado_em desc
  limit 1
$$;

-- ---------------------------------------------------------------- competência
create table competencia (
  id                     uuid primary key default gen_random_uuid(),
  ano                    smallint not null,
  mes                    smallint not null check (mes between 1 and 12),
  data_corte             date not null,    -- limite para entrada de dados (dia 10 do mês anterior)
  data_credito_prevista  date not null,    -- data em que a recarga será creditada
  status                 text not null default 'aberta' check (status in ('aberta', 'calculada', 'fechada')),
  unique (ano, mes)
);

-- substitui a aba "Dias Letivos": dias base da competência por nº de dias/semana
create table calendario_dias (
  competencia_id uuid not null references competencia(id) on delete cascade,
  dias_semana    smallint not null check (dias_semana between 1 and 7),
  dias_base      smallint not null check (dias_base between 0 and 31),
  primary key (competencia_id, dias_semana)
);

-- cada situação do ponto é tratada separadamente, com regra própria
create table regra_ocorrencia (
  tipo        text primary key,
  descricao   text not null,
  desconta_vt boolean not null
);
insert into regra_ocorrencia (tipo, descricao, desconta_vt) values
  ('falta',          'Falta não abonada',  true),
  ('licenca_medica', 'Licença médica',     true),
  ('licenca_premio', 'Licença prêmio',     true),
  ('ferias',         'Férias',             true),
  ('afastamento',    'Outros afastamentos', true),
  ('abono',          'Falta abonada',      false);

create table ocorrencia_ponto (
  id             uuid primary key default gen_random_uuid(),
  servidor_id    uuid not null references servidor(id),
  competencia_id uuid not null references competencia(id),
  tipo           text not null references regra_ocorrencia(tipo),
  dias           smallint not null check (dias > 0),
  observacao     text,
  fonte          text,
  criado_em      timestamptz not null default now()
);
create index ocorrencia_competencia on ocorrencia_ponto (competencia_id, servidor_id);

-- ---------------------------------------------------------------- saldo
create table importacao (
  id                 uuid primary key default gen_random_uuid(),
  tipo               text not null check (tipo in ('saldo', 'ponto', 'cadastro')),
  competencia_id     uuid references competencia(id),
  nome_arquivo       text not null,
  hash_sha256        text not null,
  linhas_total       integer not null,
  linhas_ok          integer not null,
  linhas_rejeitadas  integer not null,
  criado_por         uuid references usuario(id),
  criado_em          timestamptz not null default now(),
  unique (tipo, hash_sha256)            -- o mesmo arquivo não entra duas vezes
);

create table importacao_rejeicao (
  id            bigserial primary key,
  importacao_id uuid not null references importacao(id) on delete cascade,
  linha         integer not null,
  motivo        text not null,
  conteudo      text
);

create table saldo_cartao (
  id             uuid primary key default gen_random_uuid(),
  cartao_id      uuid not null references cartao(id),
  valor_centavos integer not null check (valor_centavos >= 0),
  lido_em        timestamptz not null,      -- data/hora da leitura na concessionária
  fonte          text not null check (fonte in ('txt', 'pdf', 'manual', 'legado')),
  importacao_id  uuid references importacao(id),
  criado_em      timestamptz not null default now(),
  unique (cartao_id, lido_em)
);
create index saldo_cartao_recente on saldo_cartao (cartao_id, lido_em desc);

-- ---------------------------------------------------------------- parâmetros
create table parametro (
  chave     text primary key,
  valor     jsonb not null,
  descricao text not null
);
insert into parametro (chave, valor, descricao) values
  ('projecao_modo',        '"conservador"',  'conservador: assume consumo integral entre a leitura e o crédito; nenhum: usa o saldo como lido'),
  ('saldo_max_idade_dias', '45',             'saldo mais antigo que isso (contado até o crédito) é ignorado e sinalizado'),
  ('recarga_minima_centavos', '0',           'repasse positivo abaixo disso é elevado ao mínimo (0 = sem mínimo)'),
  ('recarga_multiplo_centavos', '1',         'arredonda o repasse para cima a múltiplos deste valor'),
  ('teto_cartao_centavos', 'null',           'se saldo projetado + repasse passar disso, sinaliza (null = sem teto)'),
  ('politica_desconto_folha', '"pendente_juridico"', 'direito_cheio | proporcional | pendente_juridico');

-- ---------------------------------------------------------------- cálculo e fechamento
create table calculo (
  id                         uuid primary key default gen_random_uuid(),
  competencia_id             uuid not null references competencia(id),
  servidor_id                uuid not null references servidor(id),
  cartao_id                  uuid references cartao(id),
  valor_diario_centavos      integer,
  dias_base                  smallint,
  dias_descontados           smallint,
  dias_efetivos              smallint,
  direito_centavos           integer not null,
  saldo_lido_centavos        integer,
  saldo_lido_em              timestamptz,
  consumo_estimado_centavos  integer,
  saldo_projetado_centavos   integer,
  repasse_centavos           integer not null check (repasse_centavos >= 0),
  regra_aplicada             text not null,
  sinalizadores              text[] not null default '{}',
  unique (competencia_id, servidor_id)
);

create table fechamento (
  id              uuid primary key default gen_random_uuid(),
  competencia_id  uuid not null unique references competencia(id),
  fechado_por     uuid not null references usuario(id),
  fechado_em      timestamptz not null default now(),
  n_servidores    integer not null,
  total_direito   bigint not null,
  total_repasse   bigint not null,
  hash_conteudo   text not null          -- hash do conjunto de cálculos no momento do fechamento
);

-- cálculo de competência fechada é imutável
create function bloquear_competencia_fechada() returns trigger language plpgsql as $$
declare v_comp uuid; v_status text;
begin
  v_comp := coalesce(new.competencia_id, old.competencia_id);
  select status into v_status from competencia where id = v_comp;
  if v_status = 'fechada' then
    raise exception 'competência % está fechada: % não permitido em %', v_comp, tg_op, tg_table_name;
  end if;
  return coalesce(new, old);
end $$;
create trigger calculo_imutavel before insert or update or delete on calculo
  for each row execute function bloquear_competencia_fechada();
create trigger ocorrencia_imutavel before insert or update or delete on ocorrencia_ponto
  for each row execute function bloquear_competencia_fechada();

-- ---------------------------------------------------------------- auditoria
create table auditoria (
  id          bigserial primary key,
  tabela      text not null,
  registro_id text,
  acao        text not null,
  antes       jsonb,
  depois      jsonb,
  usuario     text,                      -- definido pela aplicação: set_config('app.usuario', ..., true)
  em          timestamptz not null default now()
);

create function auditar() returns trigger language plpgsql as $$
begin
  insert into auditoria (tabela, registro_id, acao, antes, depois, usuario)
  values (tg_table_name,
          coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id', to_jsonb(new) ->> 'chave', to_jsonb(old) ->> 'chave'),
          tg_op,
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end,
          current_setting('app.usuario', true));
  return coalesce(new, old);
end $$;

create trigger audit_servidor    after insert or update or delete on servidor         for each row execute function auditar();
create trigger audit_cartao      after insert or update or delete on cartao           for each row execute function auditar();
create trigger audit_beneficio   after insert or update or delete on beneficio        for each row execute function auditar();
create trigger audit_evento      after insert or update or delete on evento           for each row execute function auditar();
create trigger audit_ocorrencia  after insert or update or delete on ocorrencia_ponto for each row execute function auditar();
create trigger audit_parametro   after insert or update or delete on parametro        for each row execute function auditar();
create trigger audit_competencia after insert or update or delete on competencia      for each row execute function auditar();
create trigger audit_fechamento  after insert or update or delete on fechamento       for each row execute function auditar();
