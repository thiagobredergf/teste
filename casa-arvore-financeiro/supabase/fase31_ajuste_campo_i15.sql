-- Fase 31: ajuste de granularidade no campo "comparativo_mes_anterior" da
-- skill I15 (fase 30).
--
-- Motivo: ao planejar o auto-preenchimento dos campos do Hub de Skills a
-- partir dos dados reais da empresa (fase 32), ficou claro que esse campo
-- pedia comparação mês a mês, mas os relatórios do ESEK que alimentam o
-- fechamento (Indicadores, DRE) são todos recortados por ANO (seletor de
-- ano em Relatórios), não por mês — não existe um "indicadores de março"
-- isolado hoje. Preencher esse campo automaticamente de forma honesta só
-- é possível comparando ano atual com ano anterior. Em vez de criar uma
-- segunda trilha de cálculo mês a mês só pra esta skill, ajustamos o
-- campo (e a redação do prompt) pra refletir o que o sistema realmente
-- calcula: comparativo entre períodos (anos), não entre meses.
update public.bpo_skills
set
  campos = array['indicadores_do_mes', 'comparativo_periodo_anterior', 'pendencias_em_aberto', 'decisoes_candidatas'],
  prompt_template = replace(
    prompt_template,
    'Comparativo com o mês anterior: {{comparativo_mes_anterior}}',
    'Comparativo com o período anterior (ano anterior — o fechamento do ESEK compara ano a ano, não mês a mês): {{comparativo_periodo_anterior}}'
  )
where codigo = 'I15';
