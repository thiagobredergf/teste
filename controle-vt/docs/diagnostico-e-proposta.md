# Controle de Vale-Transporte — Diagnóstico e Proposta

Projeto independente (sem relação com o ESEK). Base da análise: planilha
"VALE TRANSPORTE – novembro 2026" (569 servidores, 5 abas). Este documento
não contém nomes, CPFs ou matrículas — apenas contagens.

## 1. O problema em uma frase

Hoje o repasse mensal é calculado sobre um **direito teórico** (tabela fixa de
dias × valor diário), sem enxergar **quanto o servidor ainda tem no cartão** nem
**quantos dias ele realmente trabalhou**. O controle que existe é uma planilha
em que o mesmo fato (suspensão, saldo alto, licença) é registrado em até quatro
lugares diferentes, em texto livre.

## 2. Diagnóstico da planilha (evidências)

| Área | Achado | Quantidade |
|---|---|---|
| Saldo do cartão | Preenchido só para parte dos servidores | 131 de 569 |
| | Guardado como texto com data embutida (ex.: `R$ 572,85 - 14/10`) | 16 de 131 |
| | O mesmo "saldo alto" escrito de 3 formas (`SALDO ALTO`, `SALDO ALTO␠`, `SALDO ALDO`) | 107 |
| Direito mensal | Fórmula presa a uma tabela fixa de dias (19/17/13/9), sem ligação com a folha de ponto | 562 fórmulas |
| | Valor diário e dias/semana inválidos (`*`, vazio) | 4 e 2 |
| | Valor diário com ruído de ponto flutuante (ex.: `16,7000000000003`) | 58 de 565 |
| Desconto em folha | Guardado como texto (`R$ 113,56`), alguns com quebra de linha | 479 de 515 |
| | Sem valor | 54 |
| Datas de férias | Colunas "mês de férias" com mês/ano interpretado como dia/mês (ex.: "1/25" virou 25/01/2026) | 346 de 346 e 237 de 246 |
| Identificação | Cartão ausente | 35 |
| | Matrícula vazia / duplicada | 2 / 1 |
| | Cartão repetido | 2 |
| | CPF mascarado em todos — não serve de chave | 569 |
| Situação do servidor | Campo "status" preenchido | 11 de 569 |
| | Situação escrita em observação livre ("FORMULARIO OK", "NÃO PREENCHEU", licença, bloqueio…) | 560 |
| | Observações com datas embutidas no texto | 264 |
| | Aba EXCLUSÃO tem 38 linhas; só 2 servidores estão marcados "INATIVO" no cadastro | 38 vs 2 |
| Higiene | Aba "Cópia de VALOR DO DESCONTO MAIO" vazia; área usada da aba principal declarada até a linha 3017 | — |

**Leitura:** não é um problema de digitação, é de modelo. A planilha mistura
cadastro, evento, cálculo e anotação na mesma linha. Qualquer saldo ou data
hoje depende de quem escreveu e de quando escreveu.

## 3. Por que isso importa

1. **Pagamento sem referência real.** Sem saldo com data e sem dias efetivos, o
   repasse não pode ser calculado de forma defensável.
2. **Risco de crédito duplicado ou ausente.** A própria planilha registra casos
   de recarga urgente por falta de crédito e de bloqueio por saldo alto.
3. **Sem trilha de auditoria.** Não dá para responder "por que esse servidor
   recebeu X em novembro?" nem "quem mudou?".
4. **Dado pessoal sem controle de acesso** (CPF, lotação, licença médica).

> Ordem de grandeza (não usar como "economia prometida"): somando o direito dos
> 565 servidores com valor e dias válidos (≈ R$ 155,8 mil) e abatendo apenas os
> saldos que estavam em formato numérico (≈ R$ 36,9 mil), o repasse cairia cerca
> de 24%. Os saldos são uma foto de 14/10 e os textos ficaram de fora da conta;
> o número real só sairá de um mês rodado em paralelo.

## 4. Proposta (Opção B): sistema pequeno com cadastro permanente

### 4.1 Princípio

Os nomes quase não mudam de mês a mês. Então:

- **Cadastro permanente** de servidores e cartões.
- **Eventos pontuais** alteram o cadastro (inclusão, suspensão, cancelamento,
  licença, retorno), cada um com data, motivo e autor.
- **Competência mensal** é calculada em cima do cadastro vigente + ponto +
  saldo. Não se reimporta a lista.

### 4.2 Fórmula

```
Repasse = max(0, Direito do mês − Saldo projetado na data da recarga)
Direito = dias efetivos (folha de ponto) × valor diário
```

O saldo projetado vem do saldo lido na concessionária, com data e hora, mais
uma regra configurável de consumo entre a leitura e a recarga.

### 4.3 Camadas

1. **Importação** — ponto, cadastro RH e saldos da concessionária entram por
   arquivo (CSV/XLSX), com validação e tela de rejeitados.
2. **Modelo de dados** — `servidor`, `cartão`, `benefício` (valor diário em
   centavos), `evento`, `ponto_resumo` (por competência), `saldo_cartão`
   (valor + data/hora + fonte), `cálculo` (direito, saldo, repasse, regra
   aplicada, sinalizadores), `fechamento`, `auditoria`.
3. **Motor de regras** — calcula e marca exceções: sem cartão, matrícula
   duplicada, saldo velho, licença, férias, saldo acima do teto.
4. **Fechamento mensal** — congela os números (instantâneo imutável), registra
   quem aprovou e gera as saídas abaixo.

### 4.4 Saídas do fechamento

| Saída | Conteúdo | Pendência |
|---|---|---|
| Arquivo de recarga | Cartão + valor a creditar, no layout da concessionária | Layout a obter |
| Folha de pagamento | Matrícula + rubrica de desconto (limite de 6% do vencimento básico, conforme norma aplicável) + competência | Layout e rubrica a obter com a folha |
| Cadastro do RH | Eventos aplicados no mês (inativações, inclusões, licenças) para atualizar o cadastro de origem | Formato a combinar com o RH |

**Decisão de política (precisa ser tomada por quem responde pelo benefício):**
quando o repasse é menor que o direito por causa de saldo, o desconto em folha
continua sobre o direito cheio ou é proporcional? O sistema suporta as duas;
a escolha deve ser validada por jurídico/controle interno.

### 4.5 Segurança e LGPD

Controle de acesso por perfil, CPF e dados de licença restritos, log de quem
viu e alterou, retenção definida. Dados de licença médica guardados só como
"situação" (sem CID ou detalhe clínico).

## 5. Fases

| Fase | Entrega | Critério de pronto |
|---|---|---|
| 0 | Mês em paralelo na planilha, com saldo datado e dias do ponto | Diferença entre repasse calculado e pago medida |
| 1 | MVP: cadastro + eventos + importação de saldo e ponto + cálculo + fechamento + exportações | Um fechamento real conferido pelo RH |
| 2 | Automação de importação, alertas, painel | Redução do trabalho manual medida |
| 3 | Integração por API com a concessionária, se existir | Disponibilidade confirmada por eles |

## 6. Perguntas em aberto

1. Como a concessionária entrega o saldo (portal, arquivo, API), com que
   frequência e atraso?
2. Qual o formato da folha de ponto e como diferencia falta, licença e férias?
3. Qual a data de corte entre leitura do saldo e crédito da recarga?
4. Qual o layout de importação da folha e a rubrica do desconto?
5. Como o RH quer receber as alterações de cadastro?
6. Validação jurídica do modelo complementar e do desconto de 6%.
7. Quantos usuários e quais perfis de acesso.
