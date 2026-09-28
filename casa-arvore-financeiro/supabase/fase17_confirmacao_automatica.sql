-- Fase 17 (Etapa 4 do redesenho de papéis): itens pendentes do "Meu Dinheiro
-- Web" que ainda não tinham equivalente no sistema —
--
--   1) Confirmação automática na data prevista: contas cujo valor e data já
--      são certos (assinatura, mensalidade, aluguel) podem ser marcadas pra
--      dar baixa sozinhas no vencimento, numa conta padrão escolhida no
--      cadastro — sem o operador precisar lembrar de clicar "Dar baixa"
--      todo mês. "Vencidos sempre visíveis" já era o comportamento padrão
--      (Contas a Pagar/Receber e Pendências listam tudo, sem filtro de
--      status escondendo atrasado) — não precisou de coluna nova.
--
--   2) Centro de Custo e Projeto como dimensões separadas da Categoria: a
--      Categoria (Plano de Contas) responde "que tipo de receita/despesa é
--      isso", Centro de Custo/Projeto respondem "de qual área/obra/cliente
--      interno" — são cortes ortogonais, por isso campos de texto livre
--      próprios, não mais uma subdivisão dentro do Plano de Contas.
alter table public.payables add column if not exists "confirmarAutomaticamente" boolean not null default false;
alter table public.payables add column if not exists "contaPadraoId" text;
alter table public.payables add column if not exists "centroCusto" text;
alter table public.payables add column if not exists "projeto" text;

alter table public.receivables add column if not exists "confirmarAutomaticamente" boolean not null default false;
alter table public.receivables add column if not exists "contaPadraoId" text;
alter table public.receivables add column if not exists "centroCusto" text;
alter table public.receivables add column if not exists "projeto" text;
