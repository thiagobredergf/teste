-- Fase 11: antecipação de recebíveis em Contas a Receber — mesma ideia do
-- "Agendado" de Contas a Pagar, só que do lado de receber: o analista
-- marca que solicitou a antecipação (cartão, duplicata...) pra uma data e
-- conta previstas, sem que isso conte como "A Receber"/"Próximo" comuns.
-- Reaproveita os nomes de coluna "agendadoPara"/"contaAgendadaId" que já
-- existem em payables, pra herdar de graça o pré-preenchimento que
-- SettleModal já faz na hora de dar baixa (a baixa real, com o deságio da
-- antecipação lançado no campo "Desconto" que já existe).
-- Já aplicada direto no banco via MCP nesta sessão — este arquivo fica só
-- como registro, caso precise recriar o banco do zero.

alter table public.receivables add column if not exists "agendadoPara" date;
alter table public.receivables add column if not exists "contaAgendadaId" text;
