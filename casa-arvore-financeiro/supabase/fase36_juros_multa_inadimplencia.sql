-- Fase 36: taxas de juros/multa por atraso, configuráveis por empresa.
--
-- Opcional (fica null pra quem não usa, ex.: restaurante) — quando
-- preenchido, a tela de renegociação de Contas a Receber (fase 35) usa
-- essas taxas pra pré-calcular uma sugestão de juros/multa com base nos
-- dias de atraso. A sugestão grava nos mesmos campos "juros"/"multa" que
-- a baixa já usa (ver confirmReceipt/SettleModal) — não é um valor novo,
-- só chega pré-preenchido quando o gestor finalmente dá baixa, e por
-- causa disso já entra nos relatórios gerenciais (DRE/KPIs) do jeito que
-- sempre entraram juros/multa digitados à mão.
alter table public.empresas add column if not exists "jurosMoraMensal" numeric;
alter table public.empresas add column if not exists "multaAtraso" numeric;
