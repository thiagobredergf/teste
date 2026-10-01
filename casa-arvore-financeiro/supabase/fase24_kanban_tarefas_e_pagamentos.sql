-- Fase 24: suporte a quadro Kanban em Tarefas (Rotina BPO) e Ordem de
-- Pagamento (Contas a Pagar) — pedido do gestor depois de conhecer a
-- metodologia Kanban. Contas a Pagar já tinha estágios reais no banco
-- (A Pagar/Agendado/Autorizado/Pago) e não precisou de migração; Tarefas
-- só tinha 2 estados (pendente/concluída), então ganha um estágio
-- intermediário "em_andamento" e um responsável opcional.

alter table public.bpo_tasks drop constraint bpo_tasks_status_check;
alter table public.bpo_tasks add constraint bpo_tasks_status_check
  check (status = any (array['pendente', 'em_andamento', 'concluida']));

-- Responsável pela tarefa (e-mail do staff) — opcional, pra aparecer como
-- "dono do cartão" no quadro. Null = sem atribuição ainda.
alter table public.bpo_tasks add column if not exists "responsavelEmail" text;
