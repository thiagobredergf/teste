-- Fase 20: CNAB240 — remessa de pagamentos (escopo combinado com o
-- usuário: só remessa agora; retorno de cobrança fica mapeado pro
-- backlog, não implementado aqui).
--
-- CNAB é um leiaute de arquivo-texto padronizado pela Febraban, não uma
-- API — gerar a remessa não exige credencial bancária nem certificado
-- digital custodiado pelo ESEK: é o mesmo modelo já usado pra OFX (o
-- operador baixa o arquivo e sobe manualmente no internet banking). Por
-- isso, diferente da captura de XML de nota fiscal (fase19), aqui dá pra
-- construir direto, sem provedor terceiro.
--
-- Dados que faltavam pra viabilizar (nenhum dos dois existia antes):
--   - "convenioCnab"/"proximoNumeroRemessaCnab" na conta pagadora — o
--     código de convênio é atribuído pelo banco pra identificar a
--     empresa no arquivo; o NSA (Número Sequencial do Arquivo) precisa
--     incrementar a cada remessa gerada por aquela conta.
--   - Dados bancários do fornecedor (banco/agência/conta) em Contacts —
--     sem isso não tem como montar a instrução de pagamento (Segmento
--     A do CNAB240). CPF/CNPJ do favorecido (Segmento B) já existe
--     (contacts.documento) — não precisou de campo novo pra isso.
alter table public.accounts add column if not exists "convenioCnab" text;
alter table public.accounts add column if not exists "proximoNumeroRemessaCnab" integer not null default 1;

alter table public.contacts add column if not exists "bancoCnab" text;
alter table public.contacts add column if not exists "agenciaCnab" text;
alter table public.contacts add column if not exists "contaCnab" text;
alter table public.contacts add column if not exists "contaCnabDigito" text;
alter table public.contacts add column if not exists "tipoContaCnab" text default 'CC';

-- Rastreio de "enviado ao banco" — não é baixa (isso continua manual,
-- no fluxo de sempre), é só visibilidade: o operador vê quais contas
-- autorizadas já saíram num arquivo, e cruza com o status atual (segue
-- Autorizado = ainda sem confirmação; virou Pago = já confirmado à mão
-- depois de checar o banco). É a resposta pro "preciso saber quais
-- foram pagas" sem depender do arquivo de retorno.
create table if not exists public.remessas_cnab (
  id text primary key,
  "empresaId" text references public.empresas(id) on delete cascade,
  "contaId" text references public.accounts(id) on delete cascade,
  "numeroArquivo" integer not null,
  "geradoEm" timestamptz not null default now(),
  "geradoPor" text,
  "quantidadeItens" integer not null,
  "valorTotal" numeric not null
);

alter table public.remessas_cnab enable row level security;

drop policy if exists remessas_cnab_select on public.remessas_cnab;
create policy remessas_cnab_select on public.remessas_cnab
  for select using (public.has_empresa_access(auth.uid(), "empresaId"));

drop policy if exists remessas_cnab_insert on public.remessas_cnab;
create policy remessas_cnab_insert on public.remessas_cnab
  for insert with check (public.has_empresa_access(auth.uid(), "empresaId"));

alter table public.payables add column if not exists "remessaCnabId" text references public.remessas_cnab(id) on delete set null;
alter table public.payables add column if not exists "remessaCnabEm" timestamptz;
