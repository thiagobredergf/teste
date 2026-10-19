# Controle de Vale-Transporte

Controle do repasse complementar de vale-transporte:

```
Repasse = max(0, Direito do mês − Saldo projetado do cartão na data do crédito)
Direito = dias efetivos (folha de ponto) × valor diário
```

Projeto independente. Documentação em `docs/`:

- `diagnostico-e-proposta.md` — problema, evidências e proposta
- `decisoes.md` — respostas do RH, implicações e perguntas abertas

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `db/001_schema.sql` | Esquema PostgreSQL: cadastro permanente, eventos, competência, ocorrências do ponto, saldos, cálculo, fechamento imutável, auditoria |
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

Pronto: esquema, motor de cálculo, importação de saldo (formato canônico), testes.
Falta: adaptador do TXT/PDF da concessionária (aguarda amostra), importação de ponto e cadastro, telas, exportações (recarga, folha, cadastro RH), perfis de acesso (RLS) conforme a hospedagem.
