-- Fase 22: rastreio do arquivo de contrato anexado a um parceiro de
-- repasse (item 1 da lista combinada com o usuário — IA lê o contrato e
-- pré-preenche as taxas contratadas). Reaproveita o bucket
-- documentos-lancamentos (fase 21) e o mesmo helper de upload já usado
-- pra Contas a Pagar/Receber/Bancário/Transferências — só muda o "tipo"
-- na pasta (settlementPartners em vez de payables/receivables/...).
alter table public.settlement_partners add column if not exists "contratoArquivoPath" text;
