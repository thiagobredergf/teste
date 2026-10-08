-- Fase 32: "Novidades do sistema" — um changelog incremental, só daqui
-- pra frente (não documenta retroativamente as funcionalidades já
-- existentes), com um sino pra equipe do BPO saber o que mudou desde a
-- última vez que olhou. É aviso interno — dono (cliente) não vê isso.
--
-- "Lido/não-lido" aqui é só "até quando você já abriu a lista", não um
-- controle por item — cada usuário tem no máximo uma linha, marcar como
-- visto é um upsert dessa única linha.
create table public.system_updates (
  id text primary key,
  titulo text not null,
  descricao text not null,
  created_at timestamptz not null default now()
);

alter table public.system_updates enable row level security;

create policy system_updates_read on public.system_updates
  for select using (public.is_staff(auth.uid()));
create policy system_updates_write on public.system_updates
  for insert with check (public.is_gestor(auth.uid()));
create policy system_updates_update on public.system_updates
  for update using (public.is_gestor(auth.uid()));
create policy system_updates_delete on public.system_updates
  for delete using (public.is_gestor(auth.uid()));

create table public.system_update_reads (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

alter table public.system_update_reads enable row level security;

create policy system_update_reads_select on public.system_update_reads
  for select using (user_id = auth.uid());
create policy system_update_reads_insert on public.system_update_reads
  for insert with check (user_id = auth.uid());
create policy system_update_reads_update on public.system_update_reads
  for update using (user_id = auth.uid());
