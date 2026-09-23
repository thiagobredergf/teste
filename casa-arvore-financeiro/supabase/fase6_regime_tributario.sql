-- Fase 6: regime tributário da empresa — usado pra sugerir automaticamente
-- as obrigações fiscais que se aplicam a ela (Simples só paga DAS, já o
-- Lucro Presumido/Real também têm IRPJ/CSLL/PIS/COFINS/INSS separados,
-- por exemplo). Rode no SQL Editor do Supabase (mesmo projeto das fases
-- anteriores).

alter table public.empresas add column if not exists "regimeTributario" text;
