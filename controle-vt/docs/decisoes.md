# Decisões e premissas

Registro das respostas do RH e do que cada uma implica no sistema.

| # | Pergunta | Resposta do RH | Implicação no projeto |
|---|---|---|---|
| 1 | Formato do saldo da concessionária | PDF ou TXT | Sem API. Importação por arquivo. TXT é preferível; PDF só se for texto extraível (não imagem). Um adaptador converte o layout deles para o formato canônico (`core/saldo.mjs`). **Pendente: amostra anonimizada dos dois formatos.** |
| 2 | Folha de ponto | Cada situação deve ser vista separada | Ocorrências por tipo (`ocorrencia_ponto`), cada uma com regra própria (`regra_ocorrencia.desconta_vt`). Faltam as regras por situação: ver pergunta A. |
| 3 | Data de corte | Até o dia 10 do mês anterior | Saldo lido ~dia 10–14 e crédito no fim do mês anterior: há 2–3 semanas de consumo sem leitura. O motor estima esse consumo (`projecao_modo = conservador`). |
| 4 | Validação jurídica | Aguardando a equipe jurídica da secretaria | `politica_desconto_folha = pendente_juridico`. O sistema não calcula desconto em folha até a decisão. |
| 5 | Usuários | 4 pessoas; escolas sem acesso | **Revisto:** na prática um único operador controla o processo. Sem perfis; registra-se só quem lançou. |
| 6 | Instalação | TI resiste a executáveis | Página HTML única no navegador (ver `arquitetura.md`). |
| 7 | Arquivos de entrada | RH e Global Mob em PDF ou TXT | Leitura local; prévia com totais de controle antes de gravar. |
| 8 | Dados pessoais | CPF pode vir mascarado ou ser digitado; licença só como situação e prazo | Campo CPF opcional e editável; licença sem detalhe clínico. |
| 9 | Origem do desconto e da relação | Um funcionário do RH registra a adesão; o relatório do RH traz o valor descontado; outro funcionário do VT importa a relação e calcula o saldo do mês | A relação mensal é a fonte de quem tem o benefício e de quanto é descontado. O sistema **recebe** o desconto, não o calcula. |
| 10 | Limite de saldo | Sem norma; política administrativa de até 3× o saldo inicial | Parâmetro `saldo_alto_multiplo = 3`. Gera alerta `SALDO_ALTO`; **não altera o repasse** (o repasse já nunca leva o cartão além do direito). Ver observação abaixo. |
| 11 | Movimento mensal | Cerca de 10% entram e saem a cada mês | A ferramenta compara a relação do mês com o cadastro e mostra só as mudanças (`core/relacao.mjs`): entradas, saídas, alterações, duplicadas. |
| 12 | Natureza do limite de 3× | Não é norma: política administrativa, **não rígida**, sujeita a futura regulamentação | Parâmetro ajustável + alerta que o operador pode **aceitar com justificativa** (`alerta_aceito`). Os parâmetros usados ficam gravados em cada fechamento (`fechamento.parametros_usados`), então regulamentar depois não reescreve meses fechados. |
| 13 | Saída da relação | Em geral a pessoa **não sai da relação**, salvo desligamento ou desistência de descontar; o saldo permanece no cartão (o benefício é calculado antes da folha, não há como retirar depois) | Separar **adesão** (estar na relação) de **elegibilidade à recarga** (suspensão por saldo alto, licença, bloqueio a pedido). O saldo residual de quem saiu é só informativo, sem rotina de recolhimento. |
| 14 | Layout dos relatórios | Relatório do RH em PDF e TXT, colunas não conhecidas | Leitor de TXT configurável (delimitado ou posicional) com mapa de colunas guardado como perfil (`core/mapeamento.mjs`). O PDF depende de amostra. |
| 15 | Retorno da suspensão por saldo alto | Quando o saldo atinge o limite mínimo, que é a recarga inicial (não o valor do 1º lançamento, que pode sofrer reajuste) | Regra confirmada (`saldo_alto_desbloqueio_multiplo = 1`) sobre o **saldo inicial** da relação. O saldo inicial nunca é deduzido do histórico de recargas. |
| 16 | Saldo inicial | Vem na relação do RH, por servidor | Campo `beneficio.saldo_inicial_centavos`. É a base do limite de 3× e do retorno. Reajuste aparece como alteração na comparação mensal. **Corrige** a base que o motor usava (direito mensal). |
| 18 | Entrada do saldo | PDF real da Global Mob (texto, 78 páginas) | Lido por `core/pdfsaldo.mjs`, conferido pelo TOTAL impresso. Ver `amostra-globalmob.md`. |
| 17 | Formato de entrada | TXT por vírgula, até haver amostras | Ver `layouts-txt.md`. Vírgula decimal sem aspas é rejeitada com aviso. |

### Suspensões: o que a planilha chama de "exclusão"

Das 38 linhas da aba EXCLUSÃO de novembro: **23 saldo alto, 8 licenças (7 médicas, 1 prêmio), 7 bloqueios a pedido do servidor**.
Ou seja, 31 de 38 são suspensões **derivadas de dado** (saldo e prazo de licença), não saídas da relação. A ferramenta pode
detectá-las e, principalmente, avisar quando revisar: licença com prazo vencido, licença sem prazo informado e
saldo alto que voltou ao normal (`core/suspensoes.mjs`).

### Observação sobre o limite de 3×

Conferi a política contra a planilha de novembro (131 servidores com saldo e direito válidos). A marca
"SALDO ALTO" da planilha **não segue 3× o direito mensal**: 23 dos 94 marcados estão abaixo de 3× (o menor em 1,6×)
e 19 sem marca estão acima. Duas explicações possíveis: a marca é de meses anteriores e não acompanha o saldo
atual, ou "saldo inicial" não significa o direito mensal. Precisa ser esclarecido (pergunta F).

## Perguntas ainda abertas

- **A.** Para cada situação do ponto (falta, falta abonada, licença médica, licença prêmio, férias, outros afastamentos): desconta o VT? Desconta dia a dia ou o mês inteiro? Uma licença que começa no meio do mês zera o direito dali em diante?
- **B.** Hospedagem: onde o sistema vai rodar? Há CPF e licença médica; a secretaria pode ter exigência de infraestrutura própria ou do município.
- **C.** Feriados municipais da competência (entram no cálculo de consumo estimado).
- **D.** A concessionária tem recarga mínima ou múltiplo obrigatório? Há teto de saldo no cartão?
- **E.** Dá para pedir a concessionária uma segunda leitura de saldo perto do crédito (por exemplo, 3 dias antes)? Isso elimina a estimativa de consumo.
- ~~F.~~ Respondida: o saldo inicial vem na relação do RH.
- ~~F2.~~ Respondida: retorno quando o saldo atinge o saldo inicial.
- ~~G.~~ Respondida: o saldo fica no cartão e não é recolhido.
- ~~H.~~ Parcial: vem em PDF e TXT, por vírgula. Colunas ainda desconhecidas (ver `layouts-txt.md`).
- **I.** O número do cartão vem na relação do RH? O saldo da Global Mob vem por cartão, sem matrícula; se a relação não traz o cartão, o vínculo cartão ↔ servidor precisa ser mantido na ferramenta (novo cartão, troca por perda).
- **J.** Como o valor em dinheiro aparece nos TXT (ex.: `16,70` entre aspas, `16.70`, `1670` em centavos)?
- **K.** No relatório da Global Mob, o que é a coluna RECARGAS? Crédito já lançado e ainda não disponível no cartão? Se for, o saldo disponível é SALDO + RECARGAS.
- **L.** A relação do RH traz o **CPF completo**? É a única chave que une RH e Global Mob com segurança (cartão e nome falham em boa parte dos casos).
- **M.** O que significa cartão MIGRADO e AGUARDANDO? Quem troca o cartão no cadastro do VT quando a pessoa migra?
