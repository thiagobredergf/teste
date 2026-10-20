# Controle de Vale-Transporte

Controle do repasse complementar de vale-transporte:

```
Repasse = max(0, Direito do mês − Saldo projetado do cartão na data do crédito)
Direito = dias efetivos (folha de ponto) × valor diário
```

Projeto independente. Documentação em `docs/`:

- `diagnostico-e-proposta.md` — problema, evidências e proposta
- `decisoes.md` — respostas do RH, implicações e perguntas abertas
- `amostra-globalmob.md` — análise do PDF real de saldo
- `layouts-txt.md` — layout provisório dos TXT de entrada
- `arquitetura.md` — ferramenta local de arquivo único (decisão, prova de viabilidade, regras)

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `db/001_schema.sql` | Esquema PostgreSQL (referência de modelo; a versão final será SQLite): cadastro permanente, eventos, competência, ocorrências do ponto, saldos, cálculo, fechamento imutável, auditoria |
| `app/` | **Protótipo**: página HTML única, offline. Veja `app/LEIA-ME.md` (roteiro de teste) |
| `spike/` | Prova de viabilidade (SQLite + PDF + cifra em HTML único): `cd spike && npm i && npm test` |
| `core/` | Motor de cálculo e importação de saldo, em JavaScript puro, sem dependências |

## Rodando

```bash
npm test                                   # testes do motor (node:test)
createdb vt && psql vt -f db/001_schema.sql   # PostgreSQL 15+ (precisa de pgcrypto e btree_gist)
```

## Princípios

- Dinheiro em **centavos inteiros**, nunca em ponto flutuante.
- O cadastro é permanente; **eventos** (inclusão, suspensão, cancelamento) são a fonte da situação do servidor (`situacao_em(servidor, data)`).
- Competência **fechada é imutável** (trigger no banco) e carrega hash do conteúdo.
- Toda alteração relevante entra em `auditoria`.
- Parâmetros de regra ficam na tabela `parametro`, não no código.

## Estado

Pronto: motor de cálculo, leitura do PDF da Global Mob, cruzamento por CPF, comparação da relação do RH, calendário e regras editáveis, protótipo offline (`app/`) com 22 verificações de ponta a ponta.
Falta: layouts reais de exportação (recarga, folha, cadastro RH), leitura do PDF do RH, formulário com QR Code, teste com a relação real do RH.
