-- Fase 4 (só CNPJ): novas colunas em empresas pra guardar o que a BrasilAPI devolve.
-- Rode no SQL Editor do Supabase (mesmo projeto da fase 3).

alter table public.empresas add column if not exists cnpj text;
alter table public.empresas add column if not exists "razaoSocial" text;
alter table public.empresas add column if not exists endereco text;
