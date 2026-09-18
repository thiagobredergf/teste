-- Fase 4: Calendário Fiscal — obrigações (DAS, ISS, INSS, FGTS...) por empresa.
-- Rode no SQL Editor do Supabase (mesmo projeto das fases anteriores).

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
  created_at timestamptz not null default now()
);

alter table public."fiscalObligations" enable row level security;

drop policy if exists "fiscal_obligations_access" on public."fiscalObligations";
create policy "fiscal_obligations_access" on public."fiscalObligations" for all to authenticated
  using (public.has_empresa_access(auth.uid(), "empresaId"))
  with check (public.has_empresa_access(auth.uid(), "empresaId"));
