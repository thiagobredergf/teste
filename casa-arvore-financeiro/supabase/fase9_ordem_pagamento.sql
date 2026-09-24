-- Fase 9: fluxo de ordem de pagamento em Contas a Pagar — o analista BPO
-- "agenda" (propõe) um pagamento pra uma data escolhida por ele (pode ser
-- futura), o dono da empresa autoriza, e só depois disso é que a baixa de
-- verdade acontece (e é conciliada com o extrato). "Agendado"/"Autorizado"
-- nunca mexem em valorPago/dataPgto/contaPgtoId — esses continuam
-- reservados pra baixa de verdade.
-- Já aplicada direto no banco via MCP nesta sessão — este arquivo fica só
-- como registro, caso precise recriar o banco do zero.

alter table public.payables add column if not exists "agendadoPara" date;
alter table public.payables add column if not exists "contaAgendadaId" text;
alter table public.payables add column if not exists "autorizadoPor" text;
alter table public.payables add column if not exists "autorizadoEm" timestamptz;
