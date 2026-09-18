# Casa da Árvore · Financeiro

Sistema de gestão financeira multiempresa (modelo BPO), com login e dados
compartilhados em tempo real via Supabase.

## Como rodar localmente

Pré-requisito: [Node.js](https://nodejs.org) versão 18 ou mais recente instalado.

```bash
cd casa-arvore-financeiro
npm install
cp .env.example .env.local   # preencha com a URL e a anon key do projeto Supabase
npm run dev
```

O terminal vai mostrar um endereço, algo como `http://localhost:5173`.

Em produção, o site fica publicado em [casa-arvore-financeiro.vercel.app](https://casa-arvore-financeiro.vercel.app), com deploy automático a cada `git push` na branch `master`.

## Onde ficam os dados

Tudo fica num banco Postgres real (projeto Supabase `casa-da-arvore-platform`,
tabelas `empresas`, `accounts`, `payables`, `receivables`, `bankEntries`,
`transfers`, `categories`) — compartilhado entre todo mundo que tem acesso,
de qualquer lugar. Não depende mais do navegador.

Não há cadastro público — o acesso é liberado manualmente:

- **gestor**: cria empresas, vê e edita tudo, dá acesso a donos.
- **dono**: só vê/edita as empresas que o gestor liberou pra ele (tabela
  `empresa_owners`), com os mesmos poderes do gestor dentro delas.

O SQL que cria esse schema (tabelas, RLS por dono e migração do formato
antigo) está em `supabase/fase3_multiempresa.sql`.

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
├── supabase/fase3_multiempresa.sql → schema relacional + RLS + migração
├── index.html
├── package.json
└── vite.config.js
```
