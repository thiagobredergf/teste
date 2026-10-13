-- Fase 35: renegociação de Contas a Receber inadimplentes.
--
-- Diferente de "Antecipado" (reaproveita "agendadoPara"/"contaAgendadaId",
-- usado quando o valor ainda vai entrar antes do previsto), aqui a conta
-- já está vencida — o vencimento original fica intocado (histórico) e o
-- novo acordo (data, valor, condição) vai em campos à parte, pra
-- "cancelar renegociação" só precisar limpá-los.
alter table public.receivables add column if not exists "renegociadoPara" date;
alter table public.receivables add column if not exists "valorRenegociado" numeric;
alter table public.receivables add column if not exists "obsRenegociacao" text;
