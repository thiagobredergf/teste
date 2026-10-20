# Layout de referência dos arquivos TXT

Provisório, até chegarem amostras anonimizadas do RH e da Global Mob. A regra adotada: **tudo entra em TXT**.
O operador pode ajustar o mapa de colunas na importação (perfil salvo); estes nomes são só o ponto de partida.

## Separador e valores em dinheiro

O RH informou que as colunas vêm separadas por **vírgula**. Em reais, a vírgula também é o decimal (`16,70`).
Sem cuidado, `28465,16,70,5` vira cinco colunas em vez de três. A ferramenta aceita:

| Forma | Exemplo | Resultado |
|---|---|---|
| Valor entre aspas | `28465,"16,70",5` | correto |
| Ponto decimal | `28465,16.70,5` | correto |
| Separador `;` | `28465;16,70;5` | correto |
| Vírgula decimal sem aspas | `28465,16,70,5` | **linha rejeitada** com explicação, nunca interpretada em silêncio |

**Confira com o RH como um valor aparece de fato no arquivo**: abra um TXT no Bloco de Notas e olhe uma linha com valor.

## Relação de beneficiários (RH)

| Campo | Tipo | Observação |
|---|---|---|
| matricula | texto | chave; vazia ou duplicada vai para conferência |
| nome | texto | |
| cargo | texto | |
| unidade | texto | escola/setor |
| valor_diario | dinheiro | pode ser reajustado |
| dias_semana | inteiro | |
| saldo_inicial | dinheiro | vem na relação; base do limite de saldo e do retorno de suspensão |
| desconto | dinheiro | **já calculado** pelo RH (6% do vencimento). Não enviar o salário: a ferramenta não precisa dele |
| cartao | texto (8–20 dígitos) | opcional, se o RH tiver |
| cpf | texto (11 dígitos) | **obrigatório**: é a chave que une a relação ao relatório da Global Mob |

## Saldo (Global Mob)

| Campo | Tipo | Observação |
|---|---|---|
| cartao | texto (8–20 dígitos) | chave |
| saldo | dinheiro | |
| data_hora | data/hora | `dd/mm/aaaa`, `dd/mm/aaaa hh:mm` ou `aaaa-mm-dd` |

O saldo vem **por cartão**, sem matrícula. O vínculo cartão ↔ servidor fica no cadastro (ver pergunta I em `decisoes.md`).
