# Controle de Vale-Transporte — protótipo

Um único arquivo, `entrega/controle-vt.html`. Abra no **Edge ou Chrome** (duplo clique). Não instala nada e não usa internet.
Os dados ficam em um arquivo `.vtdb` no seu computador, protegido por senha.

> **Protótipo para teste.** Os números devem ser conferidos contra a planilha antes de qualquer uso real.

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
7. Teste também: salvar, fechar o navegador, abrir o arquivo de novo; **Cópia de segurança datada**; alterar a situação de alguém (**⚙**).

## O que observar

- **Coluna RECARGAS (Global Mob).** O protótipo a mostra ao lado do saldo e, por padrão, **não a soma** (Competência e regras → Parâmetros).
  Para descobrir o que ela é: anote um cartão com RECARGAS maior que zero e, no PDF seguinte, veja se esse valor passou para o SALDO.
- Servidores marcados **Revisar** não recebem recarga até o problema ser resolvido (sem cartão, sem dias por semana, cartão de outro CPF…).
- Se o **desconto** for maior que a recarga, o sistema pede a sua decisão (descontar ou não); a política depende do jurídico.

## O que o protótipo ainda NÃO faz

- As exportações de **recarga** e de **desconto para a folha** são provisórias: o layout da Global Mob e da folha ainda não é conhecido.
- Não lê o PDF/TXT da **relação do RH** (só TXT; o PDF do RH aguarda amostra). O TXT precisa ter linha de cabeçalho.
- Formulário com QR Code: não incluído.
- Painel básico (pizzas e linha por mês fechado). Sem filtros por unidade nos gráficos.
- Não foi testado no Edge real, nem com a API de gravação direta no arquivo (nos testes, o arquivo é baixado ao salvar).
- Foi testado com dados **fictícios** e com o PDF real de saldo; ainda não com a relação real do RH.

## Para desenvolvedores

```bash
cd app && npm install
npm run build     # gera dist/controle-vt.html
npm test          # build + teste de ponta a ponta no navegador (dados fictícios)
```

`entrega/controle-vt.html` é uma **cópia gerada** do build, mantida no repositório para quem não compila.
Depois de mudar o código, refaça o build e copie `dist/controle-vt.html` para `entrega/`.
