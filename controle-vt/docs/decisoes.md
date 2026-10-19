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

## Perguntas ainda abertas

- **A.** Para cada situação do ponto (falta, falta abonada, licença médica, licença prêmio, férias, outros afastamentos): desconta o VT? Desconta dia a dia ou o mês inteiro? Uma licença que começa no meio do mês zera o direito dali em diante?
- **B.** Hospedagem: onde o sistema vai rodar? Há CPF e licença médica; a secretaria pode ter exigência de infraestrutura própria ou do município.
- **C.** Feriados municipais da competência (entram no cálculo de consumo estimado).
- **D.** A concessionária tem recarga mínima ou múltiplo obrigatório? Há teto de saldo no cartão?
- **E.** Dá para pedir a concessionária uma segunda leitura de saldo perto do crédito (por exemplo, 3 dias antes)? Isso elimina a estimativa de consumo.
