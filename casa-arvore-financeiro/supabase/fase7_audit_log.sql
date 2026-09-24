-- Fase 7: log de auditoria — registra quem deu ou cancelou uma baixa
-- (Contas a Pagar, Contas a Receber, Calendário Fiscal), quando e o quê.
-- É um log só de inserção: ninguém, nem o gestor, tem policy de update
-- ou delete, então o histórico não pode ser reescrito por dentro do app.
-- Rode no SQL Editor do Supabase (mesmo projeto das fases anteriores).

create table if not exists public."auditLog" (
  id text primary key,
  "empresaId" text references public.empresas(id) on delete cascade,
  entity text not null,
  "entityId" text not null,
  action text not null,
  detail text,
  "userEmail" text,
  created_at timestamptz not null default now()
);

alter table public."auditLog" enable row level security;

drop policy if exists "audit_log_select" on public."auditLog";
create policy "audit_log_select" on public."auditLog" for select to authenticated
  using (public.has_empresa_access(auth.uid(), "empresaId"));

drop policy if exists "audit_log_insert" on public."auditLog";
create policy "audit_log_insert" on public."auditLog" for insert to authenticated
  with check (public.has_empresa_access(auth.uid(), "empresaId"));
