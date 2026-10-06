-- Fase 28 — Aviso automático ao Dono quando um pagamento é agendado
--
-- "notificadoDonoEm" marca o instante em que um payable agendado já foi
-- incluído numa mensagem de WhatsApp pro dono (automática ou manual) —
-- sem isso não dá pra saber quais "Agendado" já foram avisados e quais
-- ainda estão esperando, pra montar uma mensagem consolidada sem repetir
-- nem esquecer item.
alter table public.payables
  add column if not exists "notificadoDonoEm" timestamptz;
