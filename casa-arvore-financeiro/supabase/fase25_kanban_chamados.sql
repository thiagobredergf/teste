-- Fase 25: Kanban de Chamados/Documentos Recebidos. "processado" continua
-- sendo o nome do estágio final (várias telas já checam !== "processado"
-- pra contar pendência — manter o nome evita precisar revisitar todas).
-- Só ganha 2 estágios intermediários entre "pendente" e "processado".
alter table public."documentUploads" drop constraint "documentUploads_status_check";
alter table public."documentUploads" add constraint "documentUploads_status_check"
  check (status = any (array['pendente', 'em_analise', 'aguardando_cliente', 'processado']));
