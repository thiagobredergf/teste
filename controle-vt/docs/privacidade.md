# Privacidade: onde ficam os dados

## Resumo

**Os dados reais (nomes, CPF, cartões, saldos) nunca ficam no GitHub nem na página.** A página é só o programa, vazio. Quem usa
carrega os arquivos do RH e da Global Mob no próprio navegador, e o resultado fica em um arquivo no computador dessa pessoa.

| O quê | Onde fica | Quem pode ver |
|---|---|---|
| Código do programa | GitHub (repositório) | Hoje, qualquer pessoa (repositório público) |
| A página do aplicativo | Endereço de hospedagem (GitHub Pages ou servidor da prefeitura) | Quem tiver o endereço. **É um programa vazio, sem dados** |
| Relação do RH, PDF da Global Mob | Computador do analista | Quem usa o computador |
| Arquivo de dados do VT (`.json`) | Computador do analista | Só quem tiver o arquivo **e** a senha (cifrado com AES-256-GCM) |
| Relatórios e CSV exportados | Computador do analista | Quem tiver o arquivo. **Têm nomes e cartões**: tratar como dado pessoal |

## Garantias técnicas

1. **A página não consegue se conectar a nada.** Uma política de segurança aplicada pelo navegador (`connect-src 'none'`, no início do
   código da página) proíbe qualquer conexão de rede, imagens externas e envio de formulários. A TI pode conferir abrindo o
   código-fonte. Há um teste automatizado que tenta enviar dados e confirma o bloqueio.
2. **O arquivo de dados é cifrado** com a senha escolhida. Sem a senha, é ilegível.
3. **O `.gitignore` da raiz impede** que arquivos de dados, PDFs de saldo, relações do RH, planilhas e relatórios exportados sejam
   enviados ao repositório por engano.
4. **O relatório não traz CPF.**

## O que isso NÃO protege

- Alguém com o **arquivo de dados e a senha**.
- O **computador** sem bloqueio de tela ou sem cifragem de disco (BitLocker).
- **Relatórios e CSV exportados** guardados em pastas compartilhadas ou enviados por e-mail.
- Uma versão **adulterada da página**: quem controla a hospedagem controla o código. Por isso a hospedagem deve ser de confiança
  (idealmente o servidor da prefeitura).

## Tornar o repositório privado

No GitHub: repositório → **Settings → General** → rolar até **Danger Zone** → **Change repository visibility** → **Change to private**.

Efeitos, para decidir antes:

- **O repositório inclui também o ESEK** (outro projeto). Torná-lo privado esconde o código e as migrações do ESEK também.
- **O GitHub Pages**: no plano gratuito, até onde se sabe, só publica de repositórios públicos (confira em Settings → Pages). E o site
  publicado é público mesmo quando o repositório é privado em planos pagos. Privar o repositório protege o **código e o histórico**,
  não o endereço da página.
- O site do ESEK no Vercel **deve continuar no ar** (o Vercel acessa o repositório pela própria autorização); confira depois.
- O histórico (inclusive 5 números de cartão de exemplo que foram trocados por fictícios) passa a ser visível só a quem tem acesso.
- Quem já copiou o repositório enquanto era público mantém a cópia.

## Onde hospedar a página

| Opção | Prós | Contras |
|---|---|---|
| Servidor da prefeitura (TI hospeda `controle-vt.html`) | Controle total, acesso só pela rede interna | Depende da TI |
| Repositório **separado e público**, só com o HTML, no GitHub Pages | Simples e gratuito; repositório principal fica privado | A página (vazia) fica pública |
| Pages no repositório atual (público) | Já está pronto em `docs/` | Repositório continua público |
