-- Fase 29: Centro de Custo deixa de ser texto livre e vira cadastro de
-- verdade por empresa (igual Plano de Contas) — evita o mesmo problema
-- que "Projeto" tinha (texto livre sem normalização, "Delivery" e
-- "delivery" contando separado no relatório de Rentabilidade).
--
-- Lançamentos continuam guardando "centroCusto" como texto solto em
-- payables/receivables (não é FK) — o cadastro aqui só alimenta o
-- dropdown do formulário, pra escrever sempre do mesmo jeito.
create table public.cost_centers (
  id text primary key,
  "empresaId" text not null references public.empresas(id) on delete cascade,
  nome text not null,
  created_at timestamptz not null default now(),
  unique ("empresaId", nome)
);

alter table public.cost_centers enable row level security;

-- Leitura: qualquer um com acesso à empresa (dono inclusive) — precisa
-- pra popular o select nos formulários de lançamento.
create policy cost_centers_read on public.cost_centers
  for select using (public.has_empresa_access(auth.uid(), "empresaId"));

-- Escrita: só gestor — mesma política do Plano de Contas (estrutura
-- padronizada pelo BPO, o cliente não edita).
create policy cost_centers_write on public.cost_centers
  for insert with check (public.is_gestor(auth.uid()));
create policy cost_centers_update on public.cost_centers
  for update using (public.is_gestor(auth.uid()));
create policy cost_centers_delete on public.cost_centers
  for delete using (public.is_gestor(auth.uid()));
