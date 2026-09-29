---
name: fase2-roadmap
description: Mapa do que falta na Fase 2 (relatórios) do ESEK depois da Onda 1 — Onda 2 (itens que precisam de campo/cadastro novo pequeno, mas são viáveis) e Backlog (itens que exigem conversa de escopo antes de começar, como Churn, CMV com estoque de verdade, Ponto de Equilíbrio). Use esta skill sempre que o usuário mencionar continuar a Fase 2, "Onda 2", ou pedir especificamente MRR/ARR, receita recorrente, CMV, orçado vs. realizado, ponto de equilíbrio ou churn — mesmo que ele não use esses termos exatos (ex.: "quanto cada cliente me dá de receita mensal fixa" = MRR; "quanto tá custando comida em relação ao que vendo" = CMV). Também use quando ele perguntar "o que falta nos relatórios" ou "o que vem depois da onda 1".
---

# Roteiro da Fase 2 — Onda 2 e Backlog

Esta skill existe pra eu (Claude) não precisar re-derivar essa análise do
zero numa sessão futura, nem o usuário ter que reexplicar tudo de novo.
A Onda 1 (DRE por competência, DFC realizado, Indicadores, Rentabilidade
por Projeto, Cronograma de Desembolso, Faturamento por Dia da Semana) já
foi entregue — o que segue é só o que ficou de fora dela.

**Antes de implementar qualquer coisa daqui**, releia `CLAUDE.md` na raiz
do projeto pra reaprender a arquitetura (padrão de persistência,
migrações via Supabase MCP, convenção de `REPORT_TABS`/`ReportCard` em
`src/App.jsx`) — esta skill não repete isso, só o que é específico de
cada relatório.

## Onda 2 — viável, mas precisa de campo/cadastro novo (pequeno)

Ao contrário da Onda 1 (que só usou dado que já existia), estes três
exigem uma migração leve antes do relatório em si. Trate cada um como um
par: (1) schema + campo no formulário, (2) o relatório que lê esse campo
— dois commits, como já foi feito pros outros itens desta fase.

### 1. MRR / ARR (Receita Recorrente Mensal / Anual)

Segmento: Prestação de Serviços. Hoje não existe nada que marque uma
conta a receber como "assinatura/recorrente" depois de salva — o
`recorrente`/`repetirMeses` do formulário só serve pra criar N parcelas
de uma vez e é descartado antes de gravar (`stripInstallmentMeta`).

- **Campo novo**: `receivables."receitaRecorrente"` (boolean, default
  `false`) — checkbox simples no `ReceivableModal`, ao lado de
  categoria/projeto.
- **MRR**: soma do `valor` de receivables com `receitaRecorrente = true`
  cujo `vencimento` cai no mês corrente (ou no mês selecionado, se o
  relatório tiver navegação por mês).
- **ARR**: MRR × 12 (aproximação simples, não soma contrato por
  contrato).
- Vale mostrar também: nº de clientes recorrentes ativos, e a evolução
  de MRR mês a mês do ano (reusa o padrão de gráfico já usado no DFC).

### 2. CMV aproximado (sem controle de estoque)

Segmento: Restaurantes. **Antes de modelar campo novo**, confira se dá
pra calcular só com o que já existe: `PLANO_CONTAS_GRUPOS` já tem um
grupo "Custos Diretos (CMV / Serviços Prestados)" — se as categorias
desse grupo já cobrem o que o cliente lança como compra de insumo, o
relatório pode sair **sem nenhuma migração**, só:

- CMV% = soma de `payables.valor` cuja `categoria` pertence ao grupo de
  Custos Diretos, no período, ÷ soma de `receivables.valor` (receita de
  vendas) no mesmo período.
- Deixe bem explícito no subtítulo do relatório que isso é uma
  **aproximação** (compra ≠ consumo — não desconta estoque parado nem
  perda), pra não passar segurança que o sistema não tem.

### 3. Orçado vs. Realizado por Evento

Segmento: Eventos. Hoje só existem lançamentos realizados — não tem
conceito de valor planejado/orçado em lugar nenhum do sistema.

- **Cadastro novo, leve**: uma tabela `project_budgets` (`id`,
  `empresaId`, `projeto` texto — mesmo valor livre usado em
  payables/receivables —, `valorOrcado` numeric, `categoria` opcional).
  Não precisa de tela própria: dá pra encaixar como um campo editável
  direto dentro do relatório "Cronograma de Desembolso" (que já agrupa
  por projeto), com um "Definir orçamento" por grupo.
- **Relatório**: por projeto, `valorOrcado` (do cadastro novo) vs.
  `valorRealizado` (soma de payables com aquele projeto, como já faz a
  Rentabilidade por Projeto) — mostra sobra/estouro.

## Backlog — não começar sem conversar o escopo primeiro

Estes três são maiores ou dependem de decisão de produto que só o
usuário pode tomar. Se ele pedir um destes diretamente, **não
implemente de cabeça** — faça as perguntas de escopo primeiro (listadas
abaixo de cada um) antes de tocar em código.

### Taxa de Churn

Exige um conceito de "cliente" com ciclo de vida (ativo/inativo),
que hoje não existe — `contacts` é só um cadastro solto (nome, CPF/CNPJ,
contato), sem status.

Perguntas antes de modelar: o que conta como "cliente perdido" — fim
explícito de contrato, ou X meses seguidos sem nenhum lançamento novo
daquele contato? Churn é por quantidade de clientes ou por receita
perdida (ou os dois)? Isso decide se basta um campo de status em
`contacts` ou se precisa de uma entidade "contrato" própria com data de
início/fim.

### CMV de verdade (com estoque)

Diferente do CMV aproximado da Onda 2, isso exige um módulo de estoque
inteiro: compra de insumo, ficha técnica/receita por prato, baixa de
estoque na venda, registro de perda/quebra. É desproporcional a um
"relatório" — na prática é uma fase própria do sistema, não um item
avulso.

Pergunta antes de sequer cotar escopo: o cliente-tipo do BPO realmente
precisa de controle de estoque de verdade, ou o CMV aproximado (Onda 2)
já resolve o que ele quer saber? Vale confirmar isso antes de dimensionar
o esforço.

### Ponto de Equilíbrio do Evento

Encadeado no item 3 da Onda 2 (Orçado vs. Realizado) — só faz sentido
depois dele existir — e precisa também de uma classificação custo
fixo/variável que não existe em lugar nenhum hoje (nem em
`PLANO_CONTAS_GRUPOS`, nem por lançamento).

Pergunta antes de modelar: a classificação fixo/variável seria por
categoria (todo lançamento daquela categoria é sempre fixo ou sempre
variável) ou por lançamento individual? A primeira é bem mais simples de
implementar mas menos precisa.
