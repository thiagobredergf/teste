-- Fase 38: Orçamento × Realizado (Relatórios) — orçamento por
-- categoria/mês, comparado contra o realizado já calculado pelo sistema
-- (não é skill de upload de planilha, é relatório nativo lendo o que já
-- está em payables/receivables).
create table if not exists public.budgets (
  id text primary key,
  "empresaId" text not null references public.empresas(id) on delete cascade,
  ano integer not null,
  mes integer not null check (mes between 1 and 12),
  categoria text not null,
  "valorOrcado" numeric not null default 0,
  created_at timestamptz not null default now(),
  unique ("empresaId", ano, mes, categoria)
);

alter table public.budgets enable row level security;

create policy budgets_read on public.budgets
  for select using (has_empresa_access(auth.uid(), "empresaId"));

create policy budgets_write on public.budgets
  for insert with check (is_gestor(auth.uid()));

create policy budgets_update on public.budgets
  for update using (is_gestor(auth.uid()));

create policy budgets_delete on public.budgets
  for delete using (is_gestor(auth.uid()));
