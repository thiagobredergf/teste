# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é

ESEK — sistema de gestão financeira multiempresa (modelo BPO/contabilidade
terceirizada). Cada cliente do BPO é cadastrado como uma "empresa" dentro do
sistema; a equipe do BPO (gestor/operador) opera todas as empresas por um
único login, e cada dono/sócio de empresa cliente pode ter um login próprio
restrito às empresas dele. Todo o texto de interface, comentários de código
e comunicação com o usuário são em português do Brasil — mantenha esse
idioma em qualquer código/copy novo.

## Comandos

```bash
npm install
cp .env.example .env.local   # preencher VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev                   # http://localhost:5173
npm run build                 # única forma de validação automática do projeto — não há suíte de testes nem lint configurado
npm run preview
```

Não existe lint nem suite de testes automatizados. `npm run build` (Vite)
é o que pega erro de sintaxe/import antes de qualquer commit — rode sempre
antes de commitar mudanças em `src/`.

## Arquitetura

### Frontend: um monólito único

`src/App.jsx` (10k+ linhas) contém praticamente todo o sistema — todas as
views, modais e componentes de UI, um por função, sem separação em
arquivos. Isso é deliberado (mais de 130 rodadas incrementais de features
foram entregues assim) — não proponha quebrar em múltiplos arquivos a
menos que explicitamente pedido.

Navegue pelo arquivo pelos marcadores de seção (`grep -n "^/\* -\{10,\}"`
dá a lista completa), cada um seguido do nome da área: "Contas a Pagar",
"Contas a Receber", "Lançamentos Bancários", "Relatórios", "Rotina",
"Documentos Recebidos", etc.

`src/lib/` tem só três arquivos:
- `storage.js` — camada de persistência genérica (ver abaixo).
- `supabaseClient.js` — cliente Supabase.
- `cnab240.js` — gerador de arquivo de remessa bancária CNAB240 (formato
  fixo de 240 caracteres por linha; `montarLinha()` lança erro se o
  tamanho não fechar exato — mantenha esse padrão em qualquer novo
  registro CNAB).

### Persistência: `persist(key, value, setter)` + `storageGet/storageSet`

Cada entidade (payables, receivables, contacts, accounts...) é uma tabela
Postgres real. O padrão em toda tela: um `useState` local + uma chamada
`onSave={(v) => persist("chave", v, setState)}` passada como prop. Por
baixo, `storageSet` (em `lib/storage.js`) recebe o array inteiro, calcula
diff contra o banco (upsert do que mudou, delete do que sumiu) —
componentes nunca fazem `supabase.from(...).insert/update` diretamente
pra CRUD normal.

Duas armadilhas já resolvidas que não devem ser reintroduzidas:
- **Upsert em lote do PostgREST exige colunas idênticas em todas as
  linhas de uma chamada.** `storageSet` agrupa por "assinatura de
  colunas" antes de fazer upsert — não simplifique isso pra um único
  `upsert(array)` (quebra ao misturar registro antigo com um novo que
  só tem os campos preenchidos no formulário).
- `created_at` nunca é enviado do cliente (deixa o Postgres aplicar o
  default).

`STORE_KEYS`/`TABLE_NAMES` em `storage.js` mapeia chave lógica → nome da
tabela. Toda entidade nova precisa de uma entrada ali.

### Papéis e controle de acesso

Três papéis (`profiles.role`): **gestor** (acesso total + ADM), **operador**
(rotina do BPO, acesso amplo por padrão), **owner/dono** (só vê as
empresas liberadas pra ele, menu reduzido — "Acompanhamento").

RLS no Postgres, não só no front:
- `is_gestor(uid)`, `is_staff(uid)` (gestor OU operador), `has_empresa_access(uid, empresaId)`.
- `staff_empresa_access`: allowlist **opt-in a partir de zero linhas = acesso total** (zero linhas pra um staff = vê tudo; qualquer linha = só o que estiver lá). Configurado em ADM → "Gerenciar acesso".
- `empresa_owners`: opt-in **a partir de zero acesso** (zero linhas = dono não vê nada; precisa de linha explícita por empresa). Criado via `manage-owner-login` (Edge Function), nunca pelo modal genérico de "Novo usuário" do ADM — dono nasce sempre vinculado a uma empresa específica, na tela Cadastros → Empresas ("Donos com acesso a esta empresa").

No frontend, `role` e `selectedEmpresa` (preferência de navegação, só
local no browser) decidem o que cada view mostra; quase toda tela filtra
seus dados por `empresaId === selectedEmpresa`.

### Supabase: migrações e Edge Functions

Não há stack local do Supabase — migrações em `supabase/faseN_*.sql` são
aplicadas direto no projeto (`project_id` no MCP Supabase) via
`mcp__Supabase__apply_migration`, uma por rodada de feature. Pra um
projeto novo do zero, `supabase/setup_conta_nova.sql` consolida tudo (não
rodar os `faseN_*.sql` individualmente num projeto novo — são histórico).

Edge Functions (`supabase/functions/`):
- `extract-document` — extração de dados via IA a partir de PDF/imagem/CSV, com prompt por contexto (`payable`, `receivable`, `bankEntry`, `transfer`, `statement`, `settlementReport`) definido em `CONTEXT_PROMPTS`. Todo "Importar documento" do app passa por aqui.
- `public-upload` — recebe arquivo sem login (link público por empresa, `?upload=<token>`), grava em `documentos-recebidos` com service role.
- `manage-staff-login` / `manage-owner-login` — criação/reset de senha de usuários staff (gestor/operador) e donos, respectivamente; nunca se sobrepõem (ver seção de papéis acima).
- `run-skill` — executa os prompts do "Hub de Skills".
- `crm-integration` — ponte server-to-server com um CRM externo (`casa-arvore-comercial`, hospedado à parte); autenticação por secret compartilhado (`CRM_INTEGRATION_SECRET`), não pela sessão do usuário.

Buckets do Storage (todos privados, política por `has_empresa_access` em
cima do primeiro segmento do path, que é sempre o `empresaId`):
- `documentos-recebidos` — arquivos enviados pelo cliente via link público (insert só pela Edge Function, com service role).
- `documentos-lancamentos` — arquivo original de um "Importar documento" que virou lançamento, path `{empresaId}/{payables|receivables|bankEntries|transfers}/{id}.{ext}` (insert direto do navegador do staff logado).
- `documentos-export` — zip temporário gerado no fluxo de exportação de documentos por fim de contrato/LGPD (ADM), com link assinado.

### Deploy

Produção em Vercel, deploy automático a cada push na branch `master`
(ver `README.md`). Não há ambiente de staging separado documentado.
