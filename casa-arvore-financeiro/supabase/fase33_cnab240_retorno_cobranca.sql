-- Fase 33: leitura do arquivo de RETORNO de cobrança CNAB240 (Contas a
-- Receber) — item de backlog adiado desde a fase 20 (só a remessa de
-- pagamento a fornecedor tinha sido construída).
--
-- Avaliação que mudou o escopo original: o ESEK nunca teve uma "remessa
-- de cobrança" (registro de boleto no banco via arquivo) — o boleto é
-- registrado fora do sistema (internet banking ou outra plataforma). Ou
-- seja, não existe aqui o "Nosso Número" que o banco atribui ao boleto
-- no momento do registro — sem ele não dá pra casar uma linha do
-- retorno com a conta a receber certa. Por isso este pacote:
--   1. Dá ao gestor um campo pra anotar esse Nosso Número no lançamento
--      (preenchido à mão, uma vez, quando o boleto é registrado no
--      banco — não é gerado pelo ESEK).
--   2. Lê o arquivo de retorno que o banco devolve e casa cada linha
--      com a conta a receber que tiver o mesmo Nosso Número.
-- O pareamento é só sugestão — nada é baixado sem o gestor revisar e
-- confirmar na tela (mesmo padrão de toda sugestão automática do
-- sistema: confiança + revisão, nunca escrita direta).
alter table public.receivables add column if not exists "nossoNumero" text;
alter table public.receivables add column if not exists "retornoCnabId" text;

-- Rastreio de "arquivo de retorno já processado" — mesmo papel que
-- remessas_cnab tem do lado de Contas a Pagar: visibilidade de quando
-- cada arquivo foi lido e quantas baixas ele gerou.
create table if not exists public.retornos_cnab (
  id text primary key,
  "empresaId" text references public.empresas(id) on delete cascade,
  "contaId" text references public.accounts(id) on delete cascade,
  "nomeArquivo" text,
  "processadoEm" timestamptz not null default now(),
  "processadoPor" text,
  "quantidadeLinhas" integer not null,
  "quantidadeBaixas" integer not null
);

alter table public.retornos_cnab enable row level security;

create policy retornos_cnab_select on public.retornos_cnab
  for select using (public.has_empresa_access(auth.uid(), "empresaId"));

create policy retornos_cnab_insert on public.retornos_cnab
  for insert with check (public.has_empresa_access(auth.uid(), "empresaId"));

alter table public.receivables add constraint receivables_retorno_cnab_fk
  foreign key ("retornoCnabId") references public.retornos_cnab(id) on delete set null;
