-- Rotina, item 3/5: checklist de tarefas recorrentes do BPO por empresa
-- (ex.: "conciliar extrato", "enviar DRE ao cliente", "cobrar fornecedor
-- X"). Uma tarefa recorrente não gera uma linha nova a cada ocorrência —
-- ela mesma avança a própria "próximaData" quando concluída, e volta pra
-- pendente. É bem mais simples que gerar N linhas futuras, e nesse caso
-- não perde nada: só interessa a PRÓXIMA ocorrência, não o histórico de
-- todas (isso já fica no created_at/updated de quem conclui, se um dia
-- precisar auditar).
--
-- Calendário Fiscal (fiscalObligations) NÃO é duplicado aqui — a tela de
-- Rotina só lê e mistura as obrigações fiscais junto das tarefas manuais
-- pra dar uma visão única do que precisa acontecer, mas concluir uma
-- obrigação fiscal continua sendo feito no Calendário Fiscal mesmo.
create table public.bpo_tasks (
  id text primary key,
  "empresaId" text not null references public.empresas(id) on delete cascade,
  titulo text not null,
  recorrencia text not null default 'pontual' check (recorrencia in ('pontual', 'diaria', 'semanal', 'mensal')),
  "proximaData" date not null,
  status text not null default 'pendente' check (status in ('pendente', 'concluida')),
  "concluidaEm" timestamptz,
  "concluidaPor" text,
  created_at timestamptz not null default now()
);

alter table public.bpo_tasks enable row level security;

create policy bpo_tasks_read on public.bpo_tasks
  for select using (public.has_empresa_access(auth.uid(), "empresaId"));

create policy bpo_tasks_write on public.bpo_tasks
  for insert with check (public.is_gestor(auth.uid()));
create policy bpo_tasks_update on public.bpo_tasks
  for update using (public.is_gestor(auth.uid()));
create policy bpo_tasks_delete on public.bpo_tasks
  for delete using (public.is_gestor(auth.uid()));
