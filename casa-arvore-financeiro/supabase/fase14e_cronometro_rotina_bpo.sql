-- Rotina, item 5/5: cronômetro por empresa — controle INTERNO de
-- eficiência (tempo do analista por cliente), sem nenhuma ligação com
-- cobrança: o cliente nunca vê isso, é só pro gestor enxergar onde o
-- tempo do time está indo.
--
-- Cada "sessão" é um bloco contínuo de trabalho (início/fim) numa empresa,
-- por um usuário. Pausar = fechar a sessão aberta (fim = now); retomar =
-- abrir uma nova. Não existe "uma sessão com pausas internas" de propósito
-- — é mais simples somar vários blocos fechados do que controlar offset de
-- pausa dentro de uma linha só.
create table public.time_sessions (
  id text primary key,
  "empresaId" text not null references public.empresas(id) on delete cascade,
  "userEmail" text not null,
  inicio timestamptz not null default now(),
  fim timestamptz,
  observacao text,
  created_at timestamptz not null default now()
);

alter table public.time_sessions enable row level security;

create policy time_sessions_read on public.time_sessions
  for select using (public.has_empresa_access(auth.uid(), "empresaId"));

create policy time_sessions_write on public.time_sessions
  for insert with check (public.is_gestor(auth.uid()));
create policy time_sessions_update on public.time_sessions
  for update using (public.is_gestor(auth.uid()));
create policy time_sessions_delete on public.time_sessions
  for delete using (public.is_gestor(auth.uid()));
