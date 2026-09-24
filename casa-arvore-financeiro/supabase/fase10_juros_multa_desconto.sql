-- Fase 10: quebra de juros/multa/desconto na baixa de Contas a Pagar e a
-- Receber — sem isso, um pagamento em atraso com juros/multa (ou um
-- recebimento com desconto por antecipação) só aparecia como uma
-- diferença muda entre "valor" e "valorPago"/"valorRecebido", sem
-- classificação nenhuma pra DRE/relatórios financeiros.
-- Já aplicada direto no banco via MCP nesta sessão — este arquivo fica só
-- como registro, caso precise recriar o banco do zero.

alter table public.payables add column if not exists juros numeric;
alter table public.payables add column if not exists multa numeric;
alter table public.payables add column if not exists desconto numeric;
alter table public.receivables add column if not exists juros numeric;
alter table public.receivables add column if not exists multa numeric;
alter table public.receivables add column if not exists desconto numeric;
