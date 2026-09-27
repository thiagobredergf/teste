-- Fase 14: Fechamento mensal — trava lançamentos de um mês já entregue ao
-- cliente, pra ninguém (nem o próprio analista, sem querer) editar/excluir/
-- baixar algo depois que o DRE/relatório daquele mês já saiu. Uma linha por
-- empresa+competência; reabrir não apaga a linha, só registra quando/quem
-- reabriu (histórico de auditoria), e fechar de novo reaproveita a mesma
-- linha.
create table public.period_locks (
  id text primary key,
  "empresaId" text not null references public.empresas(id) on delete cascade,
  competencia text not null check (competencia ~ '^\d{4}-\d{2}$'),
  "fechadoEm" timestamptz not null default now(),
  "fechadoPor" text not null,
  "reabertoEm" timestamptz,
  "reabertoPor" text,
  unique ("empresaId", competencia)
);

alter table public.period_locks enable row level security;

-- Leitura: qualquer usuário com acesso à empresa (pra Contas a Pagar/
-- Receber etc. saberem qual mês está travado). Escrita: só gestor — quem
-- decide fechar/reabrir o mês é o BPO, não o dono da empresa.
create policy period_locks_read on public.period_locks
  for select using (public.has_empresa_access(auth.uid(), "empresaId"));

create policy period_locks_write on public.period_locks
  for insert with check (public.is_gestor(auth.uid()));
create policy period_locks_update on public.period_locks
  for update using (public.is_gestor(auth.uid()));
create policy period_locks_delete on public.period_locks
  for delete using (public.is_gestor(auth.uid()));
