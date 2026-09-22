# ESEK

Sistema de gestão financeira multiempresa (modelo BPO), com login e dados
compartilhados em tempo real via Supabase. Cada cliente do BPO é cadastrado
como uma empresa dentro do sistema.

## Como rodar localmente

Pré-requisito: [Node.js](https://nodejs.org) versão 18 ou mais recente instalado.

```bash
cd casa-arvore-financeiro
npm install
cp .env.example .env.local   # preencha com a URL e a anon key do projeto Supabase
npm run dev
```

O terminal vai mostrar um endereço, algo como `http://localhost:5173`.

### Criando um projeto Supabase novo (conta própria)

1. Crie a conta em [supabase.com](https://supabase.com/dashboard) e uma
   organização (se pedir), depois **New project**.
2. **Authentication → Users → Add user**: cadastre o e-mail que vai ser o
   primeiro gestor.
3. **SQL Editor**: cole o conteúdo de `supabase/setup_conta_nova.sql`
   inteiro e rode. Ele cria todo o schema (tabelas, funções, RLS) e já marca
   como gestor o e-mail configurado no script — troque a linha marcada
   "PRIMEIRO GESTOR" se usar outro e-mail.
4. **Project Settings → API**: copie a **Project URL** e a **anon public
   key** para o seu `.env.local` (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`).

(`supabase/fase3_multiempresa.sql`, `fase4_*.sql` e `fase5_*.sql` documentam
o histórico de migrações do projeto original e não devem ser rodados num
projeto novo — use `setup_conta_nova.sql`, que já reúne tudo sem depender de
dado legado.)

Em produção, o site fica publicado em [casa-arvore-financeiro.vercel.app](https://casa-arvore-financeiro.vercel.app), com deploy automático a cada `git push` na branch `master`.

## Onde ficam os dados

Tudo fica num banco Postgres real (projeto Supabase configurado no seu
`.env.local`, tabelas `empresas`, `accounts`, `payables`, `receivables`,
`bankEntries`, `transfers`, `categories`, `fiscalObligations`) —
compartilhado entre todo mundo que tem acesso, de qualquer lugar. Não
depende mais do navegador.

Não há cadastro público — o acesso é liberado manualmente:

- **gestor**: cria empresas, vê e edita tudo, dá acesso a donos.
- **dono**: só vê/edita as empresas que o gestor liberou pra ele (tabela
  `empresa_owners`), com os mesmos poderes do gestor dentro delas.

O SQL que cria esse schema (tabelas, funções e RLS por dono) está em
`supabase/setup_conta_nova.sql` (ver seção acima). `fase3_multiempresa.sql`
em diante documentam o histórico de migrações do projeto original.

Pra criar um novo usuário: Supabase Dashboard → Authentication → Users →
Add user. Depois, um gestor dá acesso a ele numa empresa em **Empresas →
Donos com acesso**.

## Estrutura do projeto

```
casa-arvore-financeiro/
├── src/
│   ├── App.jsx                 → todo o sistema (painel, contas, lançamentos, relatórios etc.)
│   ├── lib/storage.js          → camada de dados (Supabase, RLS filtra por dono automaticamente)
│   ├── lib/supabaseClient.js   → cliente Supabase (lê VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
│   ├── main.jsx                → ponto de entrada do React
│   └── index.css               → estilos (Tailwind)
├── supabase/setup_conta_nova.sql → schema completo p/ projeto Supabase novo
├── supabase/fase3_multiempresa.sql → histórico: schema relacional + RLS + migração
├── index.html
├── package.json
└── vite.config.js
```
