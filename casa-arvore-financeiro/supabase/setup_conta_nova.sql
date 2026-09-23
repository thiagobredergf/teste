-- ============================================================================
-- Setup completo para um projeto Supabase NOVO (conta nova, sem dado prévio)
-- ============================================================================
-- Junta fase3_multiempresa + fase4_cnpj + fase4_calendario_fiscal + fase5 num
-- só script, sem a etapa de migração de `financeiro_app_data` (essa tabela
-- só existe no projeto antigo — aqui não tem nada pra migrar).
--
-- Como rodar:
-- 1. Crie o projeto no Supabase (dashboard.supabase.com → New project).
-- 2. Authentication → Users → Add user, com o e-mail que vai ser o primeiro
--    gestor (ajuste a linha marcada "PRIMEIRO GESTOR" abaixo se usar outro).
-- 3. SQL Editor → cole este arquivo inteiro → Run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tabelas
-- ---------------------------------------------------------------------------
create table if not exists public.empresas (
  id text primary key,
  nome text not null,
  cor text,
  "logoUrl" text,
  cnpj text,
  "razaoSocial" text,
  endereco text,
  segmento text,
  proprietario text,
  "contatoEmail" text,
  "contatoCelular" text,
  "regimeTributario" text,
  "uploadToken" text unique not null default gen_random_uuid()::text,
  ativa boolean not null default true,
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
  "contactId" text,
  categoria text,
  descricao text,
  valor numeric,
  "formaPgto" text,
  status text,
  "dataPgto" date,
  "valorPago" numeric,
  "contaPgtoId" text,
  conciliado boolean not null default false,
  "deletedAt" timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.receivables (
  id text primary key,
  "empresaId" text not null references public.empresas(id) on delete cascade,
  "dataLanc" date,
  vencimento date,
  cliente text,
  "contactId" text,
  categoria text,
  descricao text,
  valor numeric,
  "formaReceb" text,
  status text,
  "dataReceb" date,
  "valorRecebido" numeric,
  "contaRecebId" text,
  conciliado boolean not null default false,
  telefone text,
  "deletedAt" timestamptz,
  created_at timestamptz not null default now()
);

-- Cadastro único de terceiros (fornecedores e clientes juntos): a mesma
-- pessoa/empresa pode aparecer pagando (fornecedor de uma conta a pagar) e
-- recebendo (cliente de uma conta a receber) — não faz sentido duplicar.
-- Alimentado automaticamente pelo formulário de Contas a Pagar/Receber (ao
-- digitar um fornecedor/cliente novo, ou reconhecer um já cadastrado pelo
-- nome) e também editável direto na tela de Contatos.
create table if not exists public.contacts (
  id text primary key,
  "empresaId" text not null references public.empresas(id) on delete cascade,
  nome text not null,
  documento text,
  contato text,
  email text,
  "deletedAt" timestamptz,
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
  "deletedAt" timestamptz,
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
  "deletedAt" timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  codigo text primary key,
  nome text not null,
  natureza text not null check (natureza in ('receita', 'despesa'))
);

create table if not exists public."fiscalObligations" (
  id text primary key,
  "empresaId" text not null references public.empresas(id) on delete cascade,
  competencia text,
  vencimento date,
  tributo text,
  descricao text,
  valor numeric,
  status text not null default 'Pendente',
  "dataPagamento" date,
  "contaId" text,
  "deletedAt" timestamptz,
  created_at timestamptz not null default now()
);

-- Caixa de entrada de documentos recebidos via link público (sem login) —
-- ver supabase/functions/public-upload/index.ts.
create table if not exists public."documentUploads" (
  id text primary key,
  "empresaId" text not null references public.empresas(id) on delete cascade,
  "fileName" text not null,
  "mediaType" text not null,
  "storagePath" text not null,
  status text not null default 'pendente' check (status in ('pendente', 'processado')),
  created_at timestamptz not null default now()
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
alter table public.contacts enable row level security;
alter table public.categories enable row level security;
alter table public."fiscalObligations" enable row level security;
alter table public.profiles enable row level security;
alter table public.empresa_owners enable row level security;

-- select/update: qualquer um com acesso à empresa (dono ou gestor).
-- insert/delete: só gestor (dono não cria nem apaga a própria empresa).
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

drop policy if exists "contacts_access" on public.contacts;
create policy "contacts_access" on public.contacts for all to authenticated
  using (public.has_empresa_access(auth.uid(), "empresaId"))
  with check (public.has_empresa_access(auth.uid(), "empresaId"));

drop policy if exists "fiscal_obligations_access" on public."fiscalObligations";
create policy "fiscal_obligations_access" on public."fiscalObligations" for all to authenticated
  using (public.has_empresa_access(auth.uid(), "empresaId"))
  with check (public.has_empresa_access(auth.uid(), "empresaId"));

alter table public."documentUploads" enable row level security;
-- "for all" (não só select/update) porque o storageSet() do app faz upsert
-- (INSERT ... ON CONFLICT DO UPDATE) até pra atualizar uma linha existente,
-- e o Postgres exige a policy de INSERT nesse caminho também. Quem SEM
-- login manda um documento continua passando só pela Edge Function pública
-- public-upload, que usa a service role key (ignora RLS) — não precisa de
-- policy pra anônimo aqui.
drop policy if exists "document_uploads_access" on public."documentUploads";
create policy "document_uploads_access" on public."documentUploads" for all to authenticated
  using (public.has_empresa_access(auth.uid(), "empresaId"))
  with check (public.has_empresa_access(auth.uid(), "empresaId"));

-- Bucket privado pros arquivos recebidos via link de upload sem login —
-- leitura só pra quem tem acesso à empresa (o caminho do arquivo começa
-- com o id da empresa: "<empresaId>/arquivo").
insert into storage.buckets (id, name, public)
values ('documentos-recebidos', 'documentos-recebidos', false)
on conflict (id) do nothing;
drop policy if exists "documentos_recebidos_select" on storage.objects;
create policy "documentos_recebidos_select" on storage.objects for select to authenticated
  using (
    bucket_id = 'documentos-recebidos'
    and public.has_empresa_access(auth.uid(), (storage.foldername(name))[1])
  );

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
-- 4. Primeiro gestor — PRIMEIRO GESTOR (troque o e-mail se necessário)
-- ---------------------------------------------------------------------------
-- O usuário abaixo precisa já existir em Authentication → Users antes de
-- rodar este script, senão a linha não insere nada (sem erro, sem gestor).
insert into public.profiles (id, role, email)
select id, 'gestor', email from auth.users where email = 'thiagobredergf@gmail.com'
on conflict (id) do update set role = 'gestor';

-- ---------------------------------------------------------------------------
-- 5. Plano de contas padrão (só semeia se a tabela estiver vazia)
-- ---------------------------------------------------------------------------
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
-- 6. Backfill de contatos (cadastro único fornecedores/clientes)
-- ---------------------------------------------------------------------------
-- Num projeto novo isso não encontra nada pra fazer (payables/receivables
-- ainda vazios) — existe aqui só pra manter este script em dia com a
-- migração que já rodou no projeto ao vivo: cria um contato pra cada
-- fornecedor/cliente distinto já lançado (por empresa) e vincula os
-- lançamentos existentes a ele via "contactId". Idempotente: só cria
-- contato pra nome sem correspondente ainda, e só atualiza linhas com
-- "contactId" nulo.
insert into public.contacts (id, "empresaId", nome, documento, contato, email)
select
  'ct-' || md5(random()::text || clock_timestamp()::text),
  src."empresaId",
  src.nome,
  '', '', ''
from (
  select distinct "empresaId", trim(fornecedor) as nome from public.payables where fornecedor is not null and trim(fornecedor) <> ''
  union
  select distinct "empresaId", trim(cliente) as nome from public.receivables where cliente is not null and trim(cliente) <> ''
) src
where not exists (
  select 1 from public.contacts c
  where c."empresaId" = src."empresaId" and lower(trim(c.nome)) = lower(src.nome)
);

update public.payables p
set "contactId" = c.id
from public.contacts c
where p."contactId" is null
  and p.fornecedor is not null and trim(p.fornecedor) <> ''
  and c."empresaId" = p."empresaId"
  and lower(trim(c.nome)) = lower(trim(p.fornecedor));

update public.receivables r
set "contactId" = c.id
from public.contacts c
where r."contactId" is null
  and r.cliente is not null and trim(r.cliente) <> ''
  and c."empresaId" = r."empresaId"
  and lower(trim(c.nome)) = lower(trim(r.cliente));

-- ---------------------------------------------------------------------------
-- Pronto. Confira o resultado:
-- select * from public.empresas;
-- select * from public.profiles;
-- ---------------------------------------------------------------------------
