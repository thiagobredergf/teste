-- Fase 30: nova skill no Hub de Skills — "Diagnóstico semáforo e
-- relatório de fechamento para o dono".
--
-- Origem: material de um treinamento de certificação (BPO Academy) que o
-- usuário trouxe — um roteiro de 13+4 etapas que recria, via chat e por
-- upload manual de PDF/Excel num Projeto do claude.ai, todo o fechamento
-- de uma empresa (leitura de documento, classificação, conciliação,
-- DFC, indicadores, semáforo, relatório, painel, tarefa programada).
--
-- Avaliação: a maior parte dessas 17 etapas já é uma tela de verdade no
-- ESEK, com dado estruturado em banco em vez de chat reconstruindo tudo
-- do zero todo mês — portar o roteiro inteiro seria pedir pra IA refazer
-- pior, via prompt solto, o que o sistema já faz de graça e de forma
-- confiável:
--   Etapa 1 (ler documentos) / 2 (classificar)  -> Edge Function
--     extract-document, já ligada a "Importar documento" em Contas a
--     Pagar/Receber/Lançamentos Bancários.
--   Etapa 3 (fatura do cartão, pesquisa de fornecedor)  -> mesma
--     extração + sugestão de contraparte já existente na Conciliação
--     Bancária.
--   Etapa 5 (conciliar com banco)  -> tela Conciliação Bancária.
--   Etapa 7 (planilha com prova de fechamento)  -> Fechamento mensal
--     (period_locks) + Inconsistência/Pendências.
--   Etapa 8 (DFC)  -> relatório DFC (Realizado), já no sistema.
--   Etapa 9 (indicadores)  -> relatório Indicadores, já no sistema.
--   Aula 2 (a skill / a base viva / o painel / a tarefa programada)  ->
--     o próprio Hub de Skills, o banco Postgres (muito mais robusto que
--     uma planilha auditada à mão) e os relatórios/Dashboard (que já
--     leem dado vivo, sem precisar gerar artefato novo todo mês).
--
-- O que sobra como genuinamente novo, e cabe no Hub (prompt que dá "um
-- olhar diferente" sobre número que o gestor já tem em mãos, não um
-- substituto de tela): a Etapa 10 (semáforo) + Etapa 11 (relatório em
-- PDF sem jargão) do material, fundidas numa skill só. O gestor cola os
-- números que o próprio ESEK já calculou (Indicadores, DFC,
-- Inconsistência/Pendências) e recebe de volta o diagnóstico priorizado
-- por cor + o texto pronto pra mandar ao dono — isso o sistema não
-- gera sozinho hoje, porque exige julgamento sobre o que é urgente e
-- redação em linguagem de quem não é contador, não só o número cru.

insert into public.bpo_skills (id, codigo, titulo, nivel, tags, campos, resumo, modelo_sugerido, modelo_tier, prompt_template) values

('skill-i15', 'I15', 'Diagnóstico semáforo e relatório de fechamento para o dono', 'Intermediário',
 ARRAY['fechamento','semáforo','relatório','comunicação','dono'],
 ARRAY['indicadores_do_mes','comparativo_mes_anterior','pendencias_em_aberto','decisoes_candidatas'],
 'O mês fechado traduzido em três coisas: um diagnóstico por cor priorizado por urgência, até três decisões com prazo, e o relatório já pronto pra mandar ao dono, sem jargão contábil.',
 'Síntese de números já prontos em diagnóstico priorizado e redação para leigo; um modelo com bom raciocínio em várias etapas mantém a classificação de cor consistente entre as áreas.',
 'padrao',
$prompt$Você é o analista do BPO fechando o mês para um dono de negócio que não é contador. Os números abaixo já saíram fechados do sistema — sua tarefa não é recalcular nada, é priorizar o que importa e traduzir em decisão.

Indicadores do mês (os que o fechamento já calculou — margem, resultado, inadimplência, prazos, geração de caixa, o que fizer sentido para este negócio): {{indicadores_do_mes}}
Comparativo com o mês anterior: {{comparativo_mes_anterior}}
Pendências em aberto (vencidos, não conciliados, sem categoria, o que a auditoria do fechamento já apontou): {{pendencias_em_aberto}}
Decisões que já estão no radar, mesmo sem número fechado ainda (opcional): {{decisoes_candidatas}}

Produza:
1. **Leitura em três frases** — o que definiu o mês, sem citar número solto.
2. **Análise semáforo** — cada área relevante (caixa, resultado/margem, inadimplência ou atraso de recebimento, despesa fixa, pendências em aberto, disciplina de pagamento, e qualquer outra que os dados informados sustentarem) classificada em VERDE (dentro do esperado), AMARELO (acompanhar no próximo mês) ou VERMELHO (decisão do dono agora) — com indicador, valor, cor, o motivo da cor e a ação recomendada com prazo. Tabela ordenada do vermelho para o verde: o dono lê as três primeiras linhas e já sabe o que fazer.
3. **Até três decisões** — cada uma com o número dos indicadores informados que a justifica e um prazo real, nunca "em breve" ou "o quanto antes".
4. **Relatório para o dono** — texto corrido, pronto para copiar e enviar (e-mail ou WhatsApp), com: o mês em números essenciais, o semáforo resumido (só as linhas amarela e vermelha), as decisões do item 3, e — se houver pendência em aberto — o impacto dela em reais no caixa do mês seguinte.

Restrições:
- Vermelho é só para o que ameaça caixa ou resultado no curto prazo; nenhuma cor aparece sem um número dos dados informados que a justifique.
- Se todas as áreas saírem verdes, revise o critério antes de entregar — provavelmente está frouxo demais.
- Nenhum indicador, prazo ou valor é estimado: se faltar dado para avaliar uma área, diga que falta em vez de supor.
- Relatório para o dono sem nenhum termo contábil sem explicação ao lado, e sem tabela com mais de 8 linhas.
- Se os dados informados indicarem retirada pessoal de sócio ou despesa pessoal misturada ao resultado da empresa, relate o valor com neutralidade — é transparência, não acusação.$prompt$
);
