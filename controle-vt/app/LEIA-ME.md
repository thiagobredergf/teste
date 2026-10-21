# Controle de Vale-Transporte — protótipo

Duas formas de usar, o mesmo aplicativo:

- **Link** (versão publicada): abre no navegador. Os dados que você digita ou carrega **ficam só no seu computador**; a página não tem permissão para enviá-los a lugar nenhum.
- **Arquivo `entrega/controle-vt.html`**: abra direto no **Edge ou Chrome** (duplo clique). Não instala nada e não usa internet.

Os dados ficam em um arquivo `.json` no seu computador, protegido por senha (o conteúdo é cifrado).
Na versão do link, cada **Salvar** baixa um arquivo novo (com data e hora) depois de pedir a sua confirmação: guarde o mais recente e apague os antigos.

> **Protótipo para teste.** Os números devem ser conferidos contra a planilha antes de qualquer uso real.

## Várias pessoas, uma senha

- A senha protege o **arquivo de dados**, não uma conta: não existem usuários. Quem tem o arquivo e a senha abre.
- Ao abrir ou criar, cada pessoa informa o **próprio nome**. Ele fica registrado em tudo o que fizer (histórico, contestações, relatório).
- Existe **um arquivo mestre**. Quem usa por último salva a versão mais recente; a próxima pessoa abre essa. **Nunca duas pessoas editando cópias ao mesmo tempo:** o aplicativo não consegue juntar duas cópias e uma delas se perde.
- Escolha uma senha longa (uma frase), de pelo menos 8 caracteres. **Não há como recuperar a senha:** se for perdida, os dados são perdidos. Guarde-a com uma segunda pessoa de confiança, e não a envie junto com o arquivo.

## Roteiro de teste (novembro/2026, em paralelo com a planilha)

1. **Arquivo → Novo arquivo de dados.** Defina uma senha e anote-a: não há como recuperá-la.
2. **Competência e regras → Criar competência** (mês 11, ano 2026). Informe a data prevista do crédito e os feriados
   (`2026-11-02;Finados` e `2026-11-20;Consciência Negra`), clique em **Usar a proporção do calendário** e ajuste a tabela de
   dias (a planilha usa 19, 17, 13 e 9). Salve.
3. **Relação do RH.** Escolha o TXT, o separador e confira o mapeamento das colunas. Aplique as inclusões.
4. **Saldo Global Mob.** Escolha o PDF. A leitura só é aceita se o total conferir. Confirme a data da leitura e guarde.
5. **Ocorrências do ponto.** Lance faltas, licenças e férias do mês.
6. **Resultado.** Compare a coluna **Recarga R$** com o que a planilha daria. Onde discordar, clique em **✎** e registre a contestação.
   Ao terminar, **Exportar contestações** e envie.
7. **Relatório** (para conferir e autorizar o repasse) e **Painel** (gráficos, filtros por unidade e cargo, e a comparação com o mês anterior depois do primeiro fechamento).
8. Teste também: salvar, fechar o navegador, abrir o arquivo de novo; **Cópia de segurança datada**; alterar a situação de alguém (**⚙**).

## O que observar

- **Coluna RECARGAS (Global Mob).** O protótipo a mostra ao lado do saldo e, por padrão, **não a soma** (Competência e regras → Parâmetros).
  Para descobrir o que ela é: anote um cartão com RECARGAS maior que zero e, no PDF seguinte, veja se esse valor passou para o SALDO.
- Servidores marcados **Revisar** não recebem recarga até o problema ser resolvido (sem cartão, sem dias por semana, cartão de outro CPF…).
- Se o **desconto** for maior que a recarga, o sistema pede a sua decisão (descontar ou não); a política depende do jurídico.

## O que o protótipo ainda NÃO faz

- As exportações de **recarga** e de **desconto para a folha** são provisórias: o layout da Global Mob e da folha ainda não é conhecido.
- Não lê o PDF/TXT da **relação do RH** (só TXT; o PDF do RH aguarda amostra). O TXT precisa ter linha de cabeçalho.
- Formulário com QR Code: não incluído.
- O relatório é baixado em HTML; para PDF, abra o arquivo e use Ctrl+P → "Salvar como PDF" (o link não consegue abrir a impressão).
- Não foi testado no Edge real, nem com a gravação direta no arquivo (só na versão em arquivo, e não foi exercitada). Na versão do link não existe gravação direta: cada salvamento é um download.
- Foi testado com dados **fictícios** e com o PDF real de saldo; ainda não com a relação real do RH.

## Como colocar no ar (endereço comum, sem conta no Claude)

O aplicativo é um arquivo estático e não contém dados. Em um endereço comum ele funciona melhor do que no link do Claude:
grava direto no arquivo escolhido (Edge/Chrome) e imprime o relatório.

> **Antes de ativar:** a página é pública e vazia (os dados nunca vão para ela), mas leia `docs/privacidade.md` para decidir se o repositório deve ficar público e onde hospedar.

**GitHub Pages** (só funciona de graça com repositório público):

1. No GitHub: repositório → **Settings → Pages**.
2. **Source:** *Deploy from a branch*. **Branch:** `claude/practical-fermi-nqbcrf` (ou `main`, depois de unir o trabalho), pasta **`/docs`**. Salve.
3. Em 1 a 2 minutos o endereço fica em `https://thiagobredergf.github.io/teste/`.

Outra opção: entregar `entrega/controle-vt.html` à TI para hospedar no servidor da prefeitura.

## Para desenvolvedores

```bash
cd app && npm install
npm run build     # gera dist/controle-vt.html e dist/artefato.html
npm run publicar  # build + copia para entrega/ e docs/ (GitHub Pages)
npm test          # build + teste de ponta a ponta no navegador (dados fictícios)
ARTEFATO=1 node e2e/e2e.mjs   # o mesmo teste sobre a versão publicável, sob política de segurança estrita
```

`dist/artefato.html` é a versão publicada como link (sem `<html>`/`<body>`, como a plataforma exige). `entrega/controle-vt.html` e `docs/index.html` são **cópias geradas** do build, mantidas no repositório para quem não compila.
Depois de mudar o código, rode `npm run publicar`.
