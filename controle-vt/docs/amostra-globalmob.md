# Amostra real: relatório "Saldo de cartões" (Global Mob), 20/10/2026

Análise do PDF de 78 páginas recebido do RH. Este documento tem só contagens: nenhum nome, CPF ou número de cartão.

## Formato

- **PDF com texto** (não é imagem): leitura direta, sem OCR.
- Colunas: NOME, DOCUMENTO (CPF completo, 11 dígitos), Nº CARTÃO, STATUS, APLICAÇÃO, SALDO, RECARGAS.
- Uma linha por **pessoa**, com um ou mais **cartões** empilhados. Nome, número do cartão e valores longos quebram em várias linhas
  (`R$` / `1.085,50`). Um cartão pode continuar na página seguinte sem repetir a pessoa.
- Rodapé "Página N/78" e **linha de TOTAL** no fim.

## Leitura (`core/pdfsaldo.mjs`)

| Medida | Resultado |
|---|---|
| Cartões extraídos | 1.254 (de 1.048 pessoas) |
| Soma dos saldos extraída × total impresso | R$ 397.576,76 nos dois: **confere ao centavo** |
| Linhas não interpretadas | 0 |
| CPFs válidos | todos |
| Tempo no navegador (pdf.js, aberto por `file://`) | ≈ 2,5 s |

A conferência com o total impresso é obrigatória: se a soma não bater, a importação é bloqueada (ver `arquitetura.md`, regra 1).

## Data da leitura

O texto do PDF **não traz data**. Há duas pistas: o nome do arquivo (`SALDO_CARTAO_20-10-2026.pdf`) e os metadados (criado em
20/10/2026 10:25). A importação propõe a data do nome do arquivo e o operador confirma (`core/historico_saldo.mjs`).

## O que o PDF revelou

1. **Saldo negativo existe** (um cartão com −R$ 4,30). O esquema rejeitava; corrigido.
2. **Status do cartão:** ATIVO (846), MIGRADO (388, todos com saldo zero), AGUARDANDO (20). Cartão migrado é o antigo; a pessoa
   tem outro, ativo. 156 pessoas têm mais de um cartão.
3. **O PDF cobre muito mais gente que a relação do VT:** 1.048 pessoas, contra 569 servidores na planilha. A ferramenta deve
   guardar **só os cartões vinculados aos beneficiários** e descartar o resto (minimização de dados pessoais).
4. **RECARGAS:** 39 cartões ativos têm valor em RECARGAS (soma R$ 45.944,95), os demais zero. O significado não é conhecido
   (recarga lançada e ainda não creditada no cartão?). **Se for crédito pendente, o saldo disponível é saldo + recargas**, e ignorar
   isso faria recarregar quem já tem crédito a caminho. Pergunta K em `decisoes.md`.
5. **Chave cartão:** o PDF mostra `06.04.007259 61-3` (13 dígitos); a planilha tem `604007259613` (o Excel perdeu o zero).
   A chave canônica é só dígitos, sem zeros à esquerda (`core/identificadores.mjs`).

## Cruzamento com a planilha de novembro (569 servidores)

| Situação | Servidores |
|---|---|
| Cartão encontrado no PDF e nome confere | 141 |
| Cartão encontrado, nome com variação (abreviado/truncado) | 63 (58 claramente a mesma pessoa) |
| Cartão **não** encontrado, mas o nome existe no PDF com **outro cartão ativo** | 164 |
| Cartão não encontrado, nome existe sem cartão ativo | 7 |
| Nem cartão nem nome idêntico no PDF | 178 |
| Sem cartão na planilha e sem nome no PDF | 16 |

**Só 141 de 569 (25%) casam de forma limpa.** O número do cartão da planilha não é uma chave confiável (cartões trocados/migrados),
e o nome sozinho também não. A chave que une as duas fontes é o **CPF**, que o PDF traz completo e a planilha traz mascarado.
Pergunta L em `decisoes.md`.
