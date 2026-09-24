-- Fase 8: número do documento (nº da NF, nosso número do boleto etc.) em
-- Contas a Pagar e Contas a Receber — a IA já tenta ler esse número ao
-- importar um documento (ver supabase/functions/extract-document), mas
-- precisa de onde guardar.
-- Já aplicada direto no banco via MCP nesta sessão — este arquivo fica só
-- como registro, caso precise recriar o banco do zero.

alter table public.payables add column if not exists "numeroDocumento" text;
alter table public.receivables add column if not exists "numeroDocumento" text;
