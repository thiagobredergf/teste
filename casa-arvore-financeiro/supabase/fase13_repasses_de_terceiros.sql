-- Fase 13: cadastro de "Parceiros de Repasse" (adquirente de cartão como
-- Cielo/Rede/Stone, ou plataforma de delivery como iFood/Rappi) — o BPO
-- precisa registrar a régua de taxa CONTRATADA de cada um pra conseguir
-- auditar o relatório de repasse deles (a adquirente/plataforma às vezes
-- cobra taxa diferente da contratada, e isso só se pega comparando).
--
-- "regras" fica solto em jsonb (em vez de colunas fixas de percentual) de
-- propósito — cada parceiro tem um conjunto diferente de taxas (Cielo é só
-- taxa de débito/crédito; iFood tem comissão + taxa de pagamento online +
-- publicidade + antecipação), então uma lista de { tipo, percentual } dá
-- pra registrar qualquer combinação sem precisar de coluna nova por taxa.
--
-- Os relatórios de repasse importados NÃO são persistidos brutos — seguem
-- o mesmo padrão já usado pro extrato bancário (parseado em memória no
-- navegador, e só o que o operador confirma lançar entra em payables/
-- receivables). Fica só o cadastro do parceiro e da régua contratada.

create table public.settlement_partners (
  id text primary key,
  "empresaId" text not null references public.empresas(id) on delete cascade,
  nome text not null,
  tipo text not null check (tipo in ('adquirente', 'delivery', 'convenio', 'outro')),
  regras jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique ("empresaId", nome)
);

alter table public.settlement_partners enable row level security;

-- Leitura: qualquer usuário com acesso à empresa (mesmo padrão de sempre).
-- Escrita: só gestor — a tela de Repasses de Terceiros lança Contas a
-- Pagar/Receber em lote e audita a taxa contratada, então fica no mesmo
-- grupo de "cadastro padronizado do BPO" que o Plano de Contas (categories),
-- não algo que o dono da empresa deva editar.
create policy settlement_partners_read on public.settlement_partners
  for select using (public.has_empresa_access(auth.uid(), "empresaId"));

create policy settlement_partners_write on public.settlement_partners
  for insert with check (public.is_gestor(auth.uid()));
create policy settlement_partners_update on public.settlement_partners
  for update using (public.is_gestor(auth.uid()));
create policy settlement_partners_delete on public.settlement_partners
  for delete using (public.is_gestor(auth.uid()));
