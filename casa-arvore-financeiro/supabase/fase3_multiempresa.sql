-- ============================================================================
-- Fase 3: rearquitetura multiempresa — schema relacional + RLS por dono
-- ============================================================================
-- Rode isso inteiro de uma vez no SQL Editor do Supabase (projeto
-- casa-da-arvore-platform, ojnxvxfkebsiztilnafz). É seguro rodar mesmo com
-- dado real já cadastrado — os dados de financeiro_app_data são copiados
-- pras tabelas novas, e a tabela antiga NÃO é apagada (fica de backup).
--
-- Antes de rodar, troque o e-mail abaixo pelo e-mail que deve virar o
-- primeiro "gestor" (administrador, vê todas as empresas):
--   log.aragutti@gmail.com
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tabelas
-- ---------------------------------------------------------------------------
create table if not exists public.empresas (
  id text primary key,
  nome text not null,
  cor text,
  "logoUrl" text,
  created_at timestamptz not null default now()
);

create table if not exists public.accounts (
  id text primary key,
  "empresaId" text not null references public.empresas(id) on delete cascade,
  nome text not null,
  tipo text,
  banco text,
  agencia text,
  "contaNum" text,
  "saldoInicial" numeric not null default 0,
  "dataInicial" date,
  created_at timestamptz not null default now()
);

create table if not exists public.payables (
  id text primary key,
  "empresaId" text not null references public.empresas(id) on delete cascade,
  "dataLanc" date,
  vencimento date,
  fornecedor text,
  categoria text,
  descricao text,
  valor numeric,
  "formaPgto" text,
  status text,
  "dataPgto" date,
  "valorPago" numeric,
  "contaPgtoId" text,
  conciliado boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.receivables (
  id text primary key,
  "empresaId" text not null references public.empresas(id) on delete cascade,
  "dataLanc" date,
  vencimento date,
  cliente text,
  categoria text,
  descricao text,
  valor numeric,
  "formaReceb" text,
  status text,
  "dataReceb" date,
  "valorRecebido" numeric,
  "contaRecebId" text,
  conciliado boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public."bankEntries" (
  id text primary key,
  "empresaId" text not null references public.empresas(id) on delete cascade,
  data date,
  "contaId" text,
  tipo text,
  categoria text,
  descricao text,
  valor numeric,
  conciliado boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.transfers (
  id text primary key,
  "empresaId" text not null references public.empresas(id) on delete cascade,
  data date,
  "contaOrigemId" text,
  "contaDestinoId" text,
  valor numeric,
  descricao text,
  conciliado boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  codigo text primary key,
  nome text not null,
  natureza text not null check (natureza in ('receita', 'despesa'))
);

-- role do usuário: 'gestor' vê tudo, 'owner' só vê as empresas atribuídas
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('gestor', 'owner')),
  email text,
  created_at timestamptz not null default now()
);

-- quais usuários (donos) têm acesso a qual empresa
-- (user_id referencia profiles, não auth.users direto — é o que deixa o
-- PostgREST juntar owners com o e-mail via embed "profiles(email)")
create table if not exists public.empresa_owners (
  "empresaId" text not null references public.empresas(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key ("empresaId", user_id)
);

-- ---------------------------------------------------------------------------
-- 2. Funções de acesso
-- ---------------------------------------------------------------------------
create or replace function public.is_gestor(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles p where p.id = uid and p.role = 'gestor')
$$;

create or replace function public.has_empresa_access(uid uuid, emp_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_gestor(uid) or exists(
    select 1 from public.empresa_owners eo where eo.user_id = uid and eo."empresaId" = emp_id
  )
$$;

-- gestor atribui um dono (usuário já criado no Authentication) a uma empresa
create or replace function public.assign_empresa_owner(p_empresa_id text, p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
begin
  if not public.is_gestor(auth.uid()) then
    raise exception 'só gestor pode atribuir dono';
  end if;
  select id into v_user_id from auth.users where email = p_email;
  if v_user_id is null then
    raise exception 'usuário não encontrado — crie o login dele no Supabase primeiro';
  end if;
  insert into public.profiles (id, role, email) values (v_user_id, 'owner', p_email)
    on conflict (id) do nothing;
  insert into public.empresa_owners ("empresaId", user_id) values (p_empresa_id, v_user_id)
    on conflict do nothing;
end;
$$;
grant execute on function public.assign_empresa_owner(text, text) to authenticated;

create or replace function public.remove_empresa_owner(p_empresa_id text, p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
begin
  if not public.is_gestor(auth.uid()) then
    raise exception 'só gestor pode remover dono';
  end if;
  select id into v_user_id from auth.users where email = p_email;
  delete from public.empresa_owners where "empresaId" = p_empresa_id and user_id = v_user_id;
end;
$$;
grant execute on function public.remove_empresa_owner(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------------
alter table public.empresas enable row level security;
alter table public.accounts enable row level security;
alter table public.payables enable row level security;
alter table public.receivables enable row level security;
alter table public."bankEntries" enable row level security;
alter table public.transfers enable row level security;
alter table public.categories enable row level security;
alter table public.profiles enable row level security;
alter table public.empresa_owners enable row level security;

-- select/update: qualquer um com acesso à empresa (dono ou gestor).
-- insert/delete: só gestor (dono não cria nem apaga a própria empresa).
drop policy if exists "empresas_access" on public.empresas;
drop policy if exists "empresas_select" on public.empresas;
create policy "empresas_select" on public.empresas for select to authenticated
  using (public.has_empresa_access(auth.uid(), id));
drop policy if exists "empresas_update" on public.empresas;
create policy "empresas_update" on public.empresas for update to authenticated
  using (public.has_empresa_access(auth.uid(), id)) with check (public.has_empresa_access(auth.uid(), id));
drop policy if exists "empresas_insert" on public.empresas;
create policy "empresas_insert" on public.empresas for insert to authenticated
  with check (public.is_gestor(auth.uid()));
drop policy if exists "empresas_delete" on public.empresas;
create policy "empresas_delete" on public.empresas for delete to authenticated
  using (public.is_gestor(auth.uid()));

drop policy if exists "accounts_access" on public.accounts;
create policy "accounts_access" on public.accounts for all to authenticated
  using (public.has_empresa_access(auth.uid(), "empresaId"))
  with check (public.has_empresa_access(auth.uid(), "empresaId"));

drop policy if exists "payables_access" on public.payables;
create policy "payables_access" on public.payables for all to authenticated
  using (public.has_empresa_access(auth.uid(), "empresaId"))
  with check (public.has_empresa_access(auth.uid(), "empresaId"));

drop policy if exists "receivables_access" on public.receivables;
create policy "receivables_access" on public.receivables for all to authenticated
  using (public.has_empresa_access(auth.uid(), "empresaId"))
  with check (public.has_empresa_access(auth.uid(), "empresaId"));

drop policy if exists "bank_entries_access" on public."bankEntries";
create policy "bank_entries_access" on public."bankEntries" for all to authenticated
  using (public.has_empresa_access(auth.uid(), "empresaId"))
  with check (public.has_empresa_access(auth.uid(), "empresaId"));

drop policy if exists "transfers_access" on public.transfers;
create policy "transfers_access" on public.transfers for all to authenticated
  using (public.has_empresa_access(auth.uid(), "empresaId"))
  with check (public.has_empresa_access(auth.uid(), "empresaId"));

-- plano de contas é global (compartilhado por todas as empresas do BPO);
-- todo mundo lê, só gestor edita
drop policy if exists "categories_read" on public.categories;
create policy "categories_read" on public.categories for select to authenticated using (true);
drop policy if exists "categories_write" on public.categories;
create policy "categories_write" on public.categories for insert to authenticated with check (public.is_gestor(auth.uid()));
drop policy if exists "categories_update" on public.categories;
create policy "categories_update" on public.categories for update to authenticated using (public.is_gestor(auth.uid()));
drop policy if exists "categories_delete" on public.categories;
create policy "categories_delete" on public.categories for delete to authenticated using (public.is_gestor(auth.uid()));

drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_gestor(auth.uid()));
drop policy if exists "profiles_write" on public.profiles;
create policy "profiles_write" on public.profiles for all to authenticated
  using (public.is_gestor(auth.uid())) with check (public.is_gestor(auth.uid()));

drop policy if exists "empresa_owners_read" on public.empresa_owners;
create policy "empresa_owners_read" on public.empresa_owners for select to authenticated
  using (public.is_gestor(auth.uid()) or user_id = auth.uid());
drop policy if exists "empresa_owners_write" on public.empresa_owners;
create policy "empresa_owners_write" on public.empresa_owners for all to authenticated
  using (public.is_gestor(auth.uid())) with check (public.is_gestor(auth.uid()));

-- ---------------------------------------------------------------------------
-- 4. Primeiro gestor (troque o e-mail se necessário)
-- ---------------------------------------------------------------------------
insert into public.profiles (id, role, email)
select id, 'gestor', email from auth.users where email = 'log.aragutti@gmail.com'
on conflict (id) do update set role = 'gestor';

-- ---------------------------------------------------------------------------
-- 5. Migração dos dados que já existem em financeiro_app_data
-- ---------------------------------------------------------------------------
insert into public.empresas (id, nome, cor, "logoUrl")
select elem->>'id', elem->>'nome', elem->>'cor', elem->>'logoUrl'
from public.financeiro_app_data, jsonb_array_elements(value) as elem
where key = 'empresas'
on conflict (id) do nothing;

insert into public.accounts (id, "empresaId", nome, tipo, banco, agencia, "contaNum", "saldoInicial", "dataInicial")
select elem->>'id', elem->>'empresaId', elem->>'nome', elem->>'tipo', elem->>'banco', elem->>'agencia', elem->>'contaNum',
       coalesce(nullif(elem->>'saldoInicial', '')::numeric, 0), nullif(elem->>'dataInicial', '')::date
from public.financeiro_app_data, jsonb_array_elements(value) as elem
where key = 'accounts'
on conflict (id) do nothing;

insert into public.payables (id, "empresaId", "dataLanc", vencimento, fornecedor, categoria, descricao, valor,
       "formaPgto", status, "dataPgto", "valorPago", "contaPgtoId", conciliado)
select elem->>'id', elem->>'empresaId', nullif(elem->>'dataLanc', '')::date, nullif(elem->>'vencimento', '')::date,
       elem->>'fornecedor', elem->>'categoria', elem->>'descricao', nullif(elem->>'valor', '')::numeric,
       elem->>'formaPgto', elem->>'status', nullif(elem->>'dataPgto', '')::date, nullif(elem->>'valorPago', '')::numeric,
       elem->>'contaPgtoId', coalesce((elem->>'conciliado')::boolean, false)
from public.financeiro_app_data, jsonb_array_elements(value) as elem
where key = 'payables'
on conflict (id) do nothing;

insert into public.receivables (id, "empresaId", "dataLanc", vencimento, cliente, categoria, descricao, valor,
       "formaReceb", status, "dataReceb", "valorRecebido", "contaRecebId", conciliado)
select elem->>'id', elem->>'empresaId', nullif(elem->>'dataLanc', '')::date, nullif(elem->>'vencimento', '')::date,
       elem->>'cliente', elem->>'categoria', elem->>'descricao', nullif(elem->>'valor', '')::numeric,
       elem->>'formaReceb', elem->>'status', nullif(elem->>'dataReceb', '')::date, nullif(elem->>'valorRecebido', '')::numeric,
       elem->>'contaRecebId', coalesce((elem->>'conciliado')::boolean, false)
from public.financeiro_app_data, jsonb_array_elements(value) as elem
where key = 'receivables'
on conflict (id) do nothing;

insert into public."bankEntries" (id, "empresaId", data, "contaId", tipo, categoria, descricao, valor, conciliado)
select elem->>'id', elem->>'empresaId', nullif(elem->>'data', '')::date, elem->>'contaId', elem->>'tipo',
       elem->>'categoria', elem->>'descricao', nullif(elem->>'valor', '')::numeric, coalesce((elem->>'conciliado')::boolean, false)
from public.financeiro_app_data, jsonb_array_elements(value) as elem
where key = 'bankEntries'
on conflict (id) do nothing;

insert into public.transfers (id, "empresaId", data, "contaOrigemId", "contaDestinoId", valor, descricao, conciliado)
select elem->>'id', elem->>'empresaId', nullif(elem->>'data', '')::date, elem->>'contaOrigemId', elem->>'contaDestinoId',
       nullif(elem->>'valor', '')::numeric, elem->>'descricao', coalesce((elem->>'conciliado')::boolean, false)
from public.financeiro_app_data, jsonb_array_elements(value) as elem
where key = 'transfers'
on conflict (id) do nothing;

insert into public.categories (codigo, nome, natureza)
select elem->>'codigo', elem->>'nome', 'receita'
from public.financeiro_app_data, jsonb_array_elements(value->'receitas') as elem
where key = 'categories'
on conflict (codigo) do nothing;

insert into public.categories (codigo, nome, natureza)
select elem->>'codigo', elem->>'nome', 'despesa'
from public.financeiro_app_data, jsonb_array_elements(value->'despesas') as elem
where key = 'categories'
on conflict (codigo) do nothing;

-- se não veio nenhuma categoria (conta nova, sem dado prévio), semeia o padrão
insert into public.categories (codigo, nome, natureza)
select * from (values
  ('R01','Vendas de Produtos','receita'), ('R02','Prestação de Serviços','receita'),
  ('R03','Aluguéis Recebidos','receita'), ('R04','Juros Recebidos','receita'), ('R05','Outros Recebimentos','receita'),
  ('D01','Fornecedores / Compras','despesa'), ('D02','Salários e Pró-labore','despesa'), ('D03','Aluguel','despesa'),
  ('D04','Energia Elétrica','despesa'), ('D05','Água e Saneamento','despesa'), ('D06','Internet e Telefone','despesa'),
  ('D07','Contabilidade','despesa'), ('D08','Impostos e Taxas','despesa'), ('D09','Manutenção e Reparos','despesa'),
  ('D10','Material de Escritório','despesa'), ('D11','Marketing e Publicidade','despesa'), ('D12','Frete e Logística','despesa'),
  ('D13','Combustível e Transporte','despesa'), ('D14','Seguros','despesa'), ('D15','Empréstimos e Financiamentos','despesa'),
  ('D16','Despesas Bancárias','despesa'), ('D17','Outras Despesas','despesa')
) as defaults(codigo, nome, natureza)
where not exists (select 1 from public.categories)
on conflict (codigo) do nothing;

-- ---------------------------------------------------------------------------
-- Pronto. Confira o resultado:
-- select * from public.empresas;
-- select * from public.profiles;
-- ---------------------------------------------------------------------------
