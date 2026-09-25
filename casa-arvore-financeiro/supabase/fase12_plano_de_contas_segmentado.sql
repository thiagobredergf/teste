-- Fase 12: Plano de Contas passa a ser POR EMPRESA (com um nível de
-- "grupo" pra agrupar contas na DRE), em vez de uma lista global
-- compartilhada por todas as empresas do BPO. Fazia sentido enquanto só
-- existiam clínicas cadastradas, mas quebra assim que entrar o primeiro
-- cliente de outro segmento (ex.: restaurante) — os dois passariam a
-- disputar a mesma lista de categorias.
--
-- Taxonomia de grupo é a mesma pros dois segmentos modelados (só a lista
-- de contas analíticas dentro de cada grupo muda) — de propósito, pra
-- manter a DRE comparável entre empresas de segmentos diferentes:
--   Receita:  Receita Operacional / Outras Receitas Operacionais / Receitas Financeiras
--   Despesa:  Deduções e Impostos sobre Vendas / Custos Diretos (CMV) /
--             Despesas com Pessoal / Despesas de Ocupação /
--             Serviços de Terceiros e Tecnologia / Marketing e Comercial /
--             Despesas Financeiras / Outras Despesas
--
-- Ficaram de fora (de propósito) os ramos de Ativo/Passivo/Patrimônio
-- Líquido e Investimentos/Movimentações de Capital dos modelos originais
-- (caixa, bancos, estoque, imobilizado, distribuição de lucro,
-- amortização de empréstimo) — o ESEK já representa isso estruturalmente
-- via Contas, Contas a Pagar/Receber e saldo, não como "categoria" de um
-- lançamento; misturar os dois conceitos duplicaria informação e
-- confundiria a DRE (que é só receita x despesa realizada).
--
-- Só existiam 26 linhas na tabela antiga (todas de teste, de uma única
-- clínica) — recria do zero em vez de tentar migrar incrementalmente.
-- As duas empresas já cadastradas (CENTRO DA IMAGEM, COI - CENTRO
-- ORTOPEDICO ICARAI) são resemeadas com o modelo "Clínica / Consultório"
-- abaixo, que já incorpora as customizações que existiam na lista antiga
-- ("Medicina Ocupacional" e "Contratos de Gestão / Parcerias").
--
-- Lançamentos antigos guardam a categoria como texto solto (não é FK) —
-- continuam mostrando o nome antigo nos relatórios normalmente, mesmo
-- sem mais aparecer como opção no formulário. Nenhum dado de
-- payables/receivables/bankEntries precisa ser tocado por essa migração.

drop table if exists public.categories cascade;

create table public.categories (
  id text primary key,
  "empresaId" text not null references public.empresas(id) on delete cascade,
  grupo text not null,
  codigo text not null,
  nome text not null,
  natureza text not null check (natureza in ('receita', 'despesa')),
  created_at timestamptz not null default now(),
  unique ("empresaId", codigo)
);

alter table public.categories enable row level security;

-- Leitura: qualquer um com acesso à empresa (dono inclusive) — precisa
-- pra popular os selects de categoria nos formulários de lançamento.
create policy categories_read on public.categories
  for select using (public.has_empresa_access(auth.uid(), "empresaId"));

-- Escrita: só gestor — o Plano de Contas é um entregável padronizado do
-- BPO, o cliente (dono) não edita a própria estrutura de contas.
create policy categories_write on public.categories
  for insert with check (public.is_gestor(auth.uid()));
create policy categories_update on public.categories
  for update using (public.is_gestor(auth.uid()));
create policy categories_delete on public.categories
  for delete using (public.is_gestor(auth.uid()));

-- Resemeia as duas empresas já cadastradas (ambas "Clínica / Consultório")
-- com o modelo padrão do segmento.
insert into public.categories (id, "empresaId", grupo, codigo, nome, natureza)
select e.id || '-' || t.codigo, e.id, t.grupo, t.codigo, t.nome, t.natureza
from public.empresas e
cross join (values
  ('Receita Operacional', 'R1.01', 'Consultas Particulares', 'receita'),
  ('Receita Operacional', 'R1.02', 'Consultas via Convênios / Planos de Saúde', 'receita'),
  ('Receita Operacional', 'R1.03', 'Procedimentos Médicos e Cirurgias', 'receita'),
  ('Receita Operacional', 'R1.04', 'Exames e Diagnósticos', 'receita'),
  ('Receita Operacional', 'R1.05', 'Medicina Ocupacional', 'receita'),
  ('Outras Receitas Operacionais', 'R2.01', 'Locação de Salas / Consultórios', 'receita'),
  ('Outras Receitas Operacionais', 'R2.02', 'Venda de Vacinas / Medicamentos', 'receita'),
  ('Outras Receitas Operacionais', 'R2.03', 'Contratos de Gestão / Parcerias', 'receita'),
  ('Receitas Financeiras', 'R3.01', 'Rendimentos de Aplicações Financeiras', 'receita'),
  ('Receitas Financeiras', 'R3.02', 'Descontos Obtidos', 'receita'),
  ('Deduções e Impostos sobre Vendas', 'D1.01', 'Simples Nacional (DAS)', 'despesa'),
  ('Deduções e Impostos sobre Vendas', 'D1.02', 'ISS (Imposto Sobre Serviços)', 'despesa'),
  ('Deduções e Impostos sobre Vendas', 'D1.03', 'PIS / COFINS', 'despesa'),
  ('Deduções e Impostos sobre Vendas', 'D1.04', 'IRPJ / CSLL', 'despesa'),
  ('Deduções e Impostos sobre Vendas', 'D1.05', 'Tarifas de Cartão de Crédito / Débito', 'despesa'),
  ('Deduções e Impostos sobre Vendas', 'D1.06', 'Tarifas de Boletos Bancários', 'despesa'),
  ('Deduções e Impostos sobre Vendas', 'D1.07', 'Glosas de Convênios', 'despesa'),
  ('Custos Diretos (CMV / Serviços Prestados)', 'D2.01', 'Repasse a Médicos Parceiros / Plantonistas (PF)', 'despesa'),
  ('Custos Diretos (CMV / Serviços Prestados)', 'D2.02', 'Prestadores de Serviços Médicos (PJ)', 'despesa'),
  ('Custos Diretos (CMV / Serviços Prestados)', 'D2.03', 'Comissões da Recepção / Vendas', 'despesa'),
  ('Custos Diretos (CMV / Serviços Prestados)', 'D2.04', 'Descartáveis (Luvas, Seringas, Agulhas, Gazes)', 'despesa'),
  ('Custos Diretos (CMV / Serviços Prestados)', 'D2.05', 'Medicamentos e Anestésicos', 'despesa'),
  ('Custos Diretos (CMV / Serviços Prestados)', 'D2.06', 'Material de Higienização e Esterilização', 'despesa'),
  ('Custos Diretos (CMV / Serviços Prestados)', 'D2.07', 'Serviços de Lavanderia Hospitalar', 'despesa'),
  ('Custos Diretos (CMV / Serviços Prestados)', 'D2.08', 'Descarte de Lixo Hospitalar', 'despesa'),
  ('Despesas com Pessoal', 'D3.01', 'Salários e Ordenados (Recepção, Enfermagem, Administração)', 'despesa'),
  ('Despesas com Pessoal', 'D3.02', 'Pró-labore', 'despesa'),
  ('Despesas com Pessoal', 'D3.03', 'Encargos Sociais (INSS, FGTS)', 'despesa'),
  ('Despesas com Pessoal', 'D3.04', 'Benefícios (Vale-Transporte, Vale-Refeição, Plano de Saúde)', 'despesa'),
  ('Despesas com Pessoal', 'D3.05', 'Rescisões e Férias', 'despesa'),
  ('Despesas de Ocupação', 'D4.01', 'Aluguel do Imóvel', 'despesa'),
  ('Despesas de Ocupação', 'D4.02', 'Condomínio e IPTU', 'despesa'),
  ('Despesas de Ocupação', 'D4.03', 'Energia Elétrica e Água', 'despesa'),
  ('Despesas de Ocupação', 'D4.04', 'Telefone, Internet e Links de Dados', 'despesa'),
  ('Despesas de Ocupação', 'D4.05', 'Limpeza, Copa e Consumo Diário', 'despesa'),
  ('Despesas de Ocupação', 'D4.06', 'Manutenção de Infraestrutura', 'despesa'),
  ('Serviços de Terceiros e Tecnologia', 'D5.01', 'Assessoria Contábil', 'despesa'),
  ('Serviços de Terceiros e Tecnologia', 'D5.02', 'Assessoria Jurídica', 'despesa'),
  ('Serviços de Terceiros e Tecnologia', 'D5.03', 'Licença de Software de Gestão Médica (Prontuário/ERP)', 'despesa'),
  ('Serviços de Terceiros e Tecnologia', 'D5.04', 'Serviços de TI e Hospedagem em Nuvem', 'despesa'),
  ('Serviços de Terceiros e Tecnologia', 'D5.05', 'Licenças Médicas e Vigilância Sanitária (Anvisa, CRM, Alvarás)', 'despesa'),
  ('Marketing e Comercial', 'D6.01', 'Anúncios (Google Ads, Meta Ads)', 'despesa'),
  ('Marketing e Comercial', 'D6.02', 'Agência de Marketing / Redes Sociais', 'despesa'),
  ('Marketing e Comercial', 'D6.03', 'Identidade Visual e Material Impresso', 'despesa'),
  ('Despesas Financeiras', 'D7.01', 'Tarifas de Manutenção de Conta', 'despesa'),
  ('Despesas Financeiras', 'D7.02', 'Juros de Empréstimos e Financiamentos', 'despesa'),
  ('Despesas Financeiras', 'D7.03', 'Multas e Juros por Atraso', 'despesa'),
  ('Outras Despesas', 'D8.01', 'Aquisição de Equipamentos Médicos e Maquinário', 'despesa'),
  ('Outras Despesas', 'D8.02', 'Reformas e Benfeitorias no Imóvel', 'despesa')
) as t(grupo, codigo, nome, natureza)
where e.segmento = 'Clínica / Consultório';
