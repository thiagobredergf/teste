-- Ficha da empresa ampliada (Rotina, item 2/5): dados operacionais do BPO
-- que hoje só existem na cabeça do analista ou espalhados em WhatsApp —
-- resumo do contrato, contabilidade responsável e observações/POPs.
--
-- Propositalmente NÃO existe campo de senha/credencial aqui: guardar senha
-- de cliente em texto puro numa tabela (mesmo com RLS) é risco desnecessário.
-- "observacoesOperacionais" é o lugar pra uma REFERÊNCIA ("senha do Simples
-- está no cofre X"), nunca a senha em si.
alter table public.empresas
  add column if not exists "contratoValorMensal" numeric,
  add column if not exists "contratoInicio" date,
  add column if not exists "contratoRenovacao" text,
  add column if not exists "contabilidadeNome" text,
  add column if not exists "contabilidadeContato" text,
  add column if not exists "observacoesOperacionais" text;
