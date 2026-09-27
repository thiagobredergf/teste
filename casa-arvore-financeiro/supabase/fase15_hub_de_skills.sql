-- Fase 15: Hub de Skills — biblioteca de prompts prontos de gestão
-- financeira/contábil, organizados por nível e assunto, que o gestor do
-- BPO aciona sobre os dados reais de uma empresa pra gerar uma análise
-- (texto pronto) pra apresentar ao dono/sócio. É complementar aos
-- relatórios fixos (DRE, Fluxo de Caixa) — serve pra quando a rotina pede
-- um olhar diferente, fora do padrão mensal.
--
-- bpo_skills é um catálogo GLOBAL (não por empresa) — a biblioteca é do
-- BPO, reaproveitada em qualquer cliente. skill_runs é o histórico de
-- execuções, esse sim por empresa, guardando o snapshot do código/título
-- da skill usada e o resultado gerado (pra sobreviver mesmo se a skill for
-- editada ou apagada depois).
create table public.bpo_skills (
  id text primary key,
  codigo text not null unique,
  titulo text not null,
  nivel text not null check (nivel in ('Básico', 'Intermediário', 'Avançado')),
  tags text[] not null default '{}',
  campos text[] not null default '{}',
  resumo text not null,
  modelo_sugerido text,
  modelo_tier text not null default 'padrao' check (modelo_tier in ('economico', 'padrao')),
  prompt_template text not null,
  created_at timestamptz not null default now()
);

alter table public.bpo_skills enable row level security;

create policy bpo_skills_read on public.bpo_skills
  for select using (public.is_gestor(auth.uid()));
create policy bpo_skills_write on public.bpo_skills
  for insert with check (public.is_gestor(auth.uid()));
create policy bpo_skills_update on public.bpo_skills
  for update using (public.is_gestor(auth.uid()));
create policy bpo_skills_delete on public.bpo_skills
  for delete using (public.is_gestor(auth.uid()));

create table public.skill_runs (
  id text primary key,
  "empresaId" text not null references public.empresas(id) on delete cascade,
  "skillId" text,
  "skillCodigo" text not null,
  "skillTitulo" text not null,
  "camposPreenchidos" jsonb not null default '{}'::jsonb,
  resultado text not null,
  "userEmail" text not null,
  created_at timestamptz not null default now()
);

alter table public.skill_runs enable row level security;

create policy skill_runs_read on public.skill_runs
  for select using (public.is_gestor(auth.uid()));
create policy skill_runs_write on public.skill_runs
  for insert with check (public.is_gestor(auth.uid()));
create policy skill_runs_delete on public.skill_runs
  for delete using (public.is_gestor(auth.uid()));

-- ---------------------------------------------------------------------------
-- Seed: os 28 prompts (8 Básico, 14 Intermediário, 6 Avançado)
-- ---------------------------------------------------------------------------

insert into public.bpo_skills (id, codigo, titulo, nivel, tags, campos, resumo, modelo_sugerido, modelo_tier, prompt_template) values

('skill-b1', 'B1', 'Classificação gerencial de despesas por natureza e comportamento', 'Básico',
 ARRAY['despesas','classificação','plano-de-contas','fixo-variável'],
 ARRAY['lista_de_despesas','criterio_de_negocio','itens_duvidosos'],
 'As despesas do período reclassificadas por natureza e por comportamento (fixo, variável, semivariável), com os itens ambíguos separados para decisão.',
 'Um modelo de custo mais baixo já resolve bem — é classificação com regra clara, não análise de causa.',
 'economico',
$prompt$Você organiza despesas para uso gerencial, não para uso fiscal. O objetivo é que quem olhar o relatório depois saiba, sem abrir a régua de contas, o que é estrutura fixa e o que acompanha o volume de operação.

Despesas do período: {{lista_de_despesas}}
Critério de negócio para separar fixo de variável: {{criterio_de_negocio}}
Itens que já geraram dúvida antes: {{itens_duvidosos}}

Produza:
1. **Tabela de classificação** — cada despesa com natureza (pessoal, ocupação, comercial, tributária, financeira, outras) e comportamento (fixo, variável, semivariável).
2. **Itens ambíguos** — os que não se encaixam com segurança no critério informado, com as duas leituras possíveis para cada um.
3. **Concentração** — as três naturezas que mais pesam no total, em valor e em percentual.
4. **Perguntas para fechar a classificação** — o que falta saber para eliminar cada ambiguidade do item 2.

Restrições:
- Não decida sozinho um item ambíguo: apresente as duas leituras e peça a definição.
- Não converta a classificação gerencial em classificação fiscal — são propósitos diferentes.
- Todo valor citado precisa vir da lista informada, nunca estimado.$prompt$
),

('skill-b2', 'B2', 'Memória de cálculo de um tributo apurado', 'Básico',
 ARRAY['tributário','memória-de-cálculo','apuração','auditoria'],
 ARRAY['tributo','base_e_aliquota','deducoes_aplicadas','periodo_de_referencia'],
 'O passo a passo do cálculo do tributo, do jeito que sustenta uma auditoria, com os pontos que precisam de conferência na legislação vigente sinalizados à parte.',
 'Peça um modelo com boa aderência a cálculo passo a passo; o valor aqui está na rastreabilidade, não na criatividade.',
 'padrao',
$prompt$Você documenta a memória de cálculo de um tributo já apurado. O documento precisa reconstruir o resultado para quem vai auditar, sem que a pessoa precise perguntar nada para entender de onde veio cada número.

Tributo: {{tributo}}
Base de cálculo e alíquota aplicadas: {{base_e_aliquota}}
Deduções e créditos considerados: {{deducoes_aplicadas}}
Período de referência: {{periodo_de_referencia}}

Produza:
1. **Base de cálculo** — como ela foi formada, linha a linha, a partir dos dados informados.
2. **Aplicação da alíquota** — o cálculo explícito, sem pular etapa.
3. **Deduções e créditos** — cada um aplicado, com o efeito no valor final.
4. **Resultado apurado** — o valor final do tributo, batendo com a soma das etapas acima.
5. **Pontos a confirmar na legislação vigente** — qualquer alíquota, base ou dedução que possa ter mudado e precisa de checagem antes de usar este documento como definitivo.

Restrições:
- Nenhuma etapa pula direto para o resultado: todo número intermediário aparece.
- Não afirme que a alíquota ou a regra está atualizada — sinalize como premissa a confirmar.
- Não sugira otimização tributária aqui: o objetivo é documentar o que já foi apurado, não propor alternativa.$prompt$
),

('skill-b3', 'B3', 'Tradução do resultado do período para quem não é da área financeira', 'Básico',
 ARRAY['resultado','comunicação','gestor','resposta'],
 ARRAY['numeros_do_periodo','publico','decisao_em_jogo'],
 'O resultado do período contado em linguagem de negócio — o que aconteceu, por que é relevante e o que isso pede de decisão — sem jargão contábil.',
 'Qualquer modelo com boa escrita em português coloquial atende; a dificuldade aqui é de tradução, não de cálculo.',
 'economico',
$prompt$Você traduz números financeiros para alguém que não trabalha com finanças, mas que precisa decidir algo com base neles.

Números do período: {{numeros_do_periodo}}
Quem vai ler (cargo/área): {{publico}}
Decisão que essa pessoa precisa tomar: {{decisao_em_jogo}}

Produza:
1. **O resumo em três frases** — o que aconteceu no período, sem número solto, sem jargão.
2. **Por que isso importa para a decisão em jogo** — a ponte direta entre o número e a escolha que a pessoa precisa fazer.
3. **O que pode dar errado se a decisão ignorar este resultado** — o risco concreto, não genérico.
4. **Uma pergunta que a pessoa deveria fazer de volta** — algo que mostra que ela entendeu o suficiente para desafiar o número.

Restrições:
- Zero termos técnicos sem explicação ao lado (nada de "margem de contribuição" sem dizer o que isso significa na prática).
- Não simplifique a ponto de esconder um risco real.
- Não tome a decisão pela pessoa — o prompt entrega leitura, não veredito.$prompt$
),

('skill-b4', 'B4', 'Checklist de fechamento contábil do mês', 'Básico',
 ARRAY['fechamento','checklist','contábil','rotina'],
 ARRAY['etapas_atuais_do_fechamento','responsaveis','prazo_final'],
 'O checklist de fechamento por etapa, com responsável, prazo em dias úteis e o que trava o fechamento se não for cumprido.',
 'Tarefa de organização, qualquer modelo atual resolve com qualidade equivalente.',
 'economico',
$prompt$Você organiza o fechamento contábil do mês em um checklist que a equipe consegue seguir sem depender de alguém explicar de novo todo mês.

Etapas que hoje fazem parte do fechamento: {{etapas_atuais_do_fechamento}}
Responsáveis disponíveis: {{responsaveis}}
Prazo final do fechamento: {{prazo_final}}

Produza:
1. **Sequência do checklist** — cada etapa na ordem em que precisa acontecer, com dependência explícita (o que precisa estar pronto antes).
2. **Responsável e prazo por etapa** — em dias úteis antes do prazo final, não em datas fixas.
3. **Etapas que travam o fechamento** — as que, se atrasarem, atrasam tudo depois — e o motivo.
4. **O que fazer diante de atraso em uma etapa crítica** — o plano B mínimo para não perder o prazo final.

Restrições:
- Não invente etapa que não foi informada; se faltar uma etapa óbvia do fechamento, aponte a ausência em vez de preencher por conta própria.
- Prazos em dias úteis, sempre relativos ao prazo final informado.
- Não distribua responsável para quem não está na lista informada.$prompt$
),

('skill-b5', 'B5', 'Organização de pendências de conciliação bancária', 'Básico',
 ARRAY['conciliação','bancária','pendências','extrato'],
 ARRAY['lista_de_pendencias','contas_envolvidas'],
 'As pendências de conciliação agrupadas por causa provável, ordenadas por valor, com o caminho de resolução sugerido para cada grupo.',
 'Tarefa de agrupamento e priorização; qualquer modelo atual dá conta bem.',
 'economico',
$prompt$Você organiza pendências de conciliação bancária para que a pessoa que for resolver saiba por onde começar.

Pendências em aberto: {{lista_de_pendencias}}
Contas bancárias envolvidas: {{contas_envolvidas}}

Produza:
1. **Agrupamento por causa provável** — lançamento duplicado, lançamento não registrado no livro-caixa, diferença de data, taxa não prevista, e outras causas que aparecerem nos dados.
2. **Ordenação por valor** — do maior para o menor impacto financeiro, dentro de cada grupo.
3. **Caminho de resolução por grupo** — o que precisa ser verificado ou solicitado para fechar cada grupo, não item por item.
4. **Pendências sem causa clara** — as que não se encaixam em nenhum padrão, separadas para investigação manual.

Restrições:
- Não concilie de fato os valores — o prompt organiza para decisão humana, não substitui a conferência.
- Não assuma que uma diferença pequena pode ser ignorada; toda pendência aparece em algum grupo.
- Causas vêm só do padrão observado nos dados informados, nunca de suposição genérica de "erro do banco".$prompt$
),

('skill-b6', 'B6', 'Pauta de reunião de resultados', 'Básico',
 ARRAY['reunião','pauta','resultado','comunicação'],
 ARRAY['temas_candidatos','duracao_da_reuniao','decisoes_pendentes'],
 'A pauta com os temas na ordem de prioridade de decisão, o tempo de cada bloco e as perguntas que precisam sair respondidas da reunião.',
 'Tarefa de organização e priorização; qualquer modelo atual atende.',
 'economico',
$prompt$Você monta a pauta de uma reunião de resultados que não pode terminar sem que as decisões pendentes sejam endereçadas.

Temas candidatos à pauta: {{temas_candidatos}}
Duração total da reunião: {{duracao_da_reuniao}}
Decisões que precisam sair desta reunião: {{decisoes_pendentes}}

Produza:
1. **Pauta ordenada** — os temas na ordem de quem depende de decisão primeiro, não na ordem em que foram listados.
2. **Tempo por bloco** — dividindo a duração total de forma realista, com folga para discussão nos temas de decisão.
3. **Pergunta que cada bloco precisa responder** — uma por tema, objetiva, que define quando aquele ponto pode ser encerrado.
4. **Risco de a reunião estourar o tempo** — qual tema é o mais provável de travar, e o que cortar primeiro se isso acontecer.

Restrições:
- Toda decisão pendente informada aparece na pauta; nenhuma fica de fora.
- Não adicione tema que não foi informado, mesmo que pareça relevante — sinalize como sugestão à parte, não como item da pauta.
- Tempo por bloco sempre soma exatamente a duração total informada.$prompt$
),

('skill-b7', 'B7', 'Resposta a cliente sobre divergência em cobrança', 'Básico',
 ARRAY['cobrança','cliente','comunicação','resposta'],
 ARRAY['historico_da_cobranca','reclamacao_do_cliente','o_que_procede'],
 'A resposta ao cliente com a conta aberta item a item, o reconhecimento do que for procedente e o encaminhamento com prazo.',
 'Tarefa de redação factual; qualquer modelo atual com boa escrita em português atende.',
 'economico',
$prompt$Você redige a resposta a um cliente que contestou uma cobrança. O objetivo é resolver a divergência sem parecer defensivo nem ceder o que não procede.

Histórico da cobrança: {{historico_da_cobranca}}
O que o cliente reclamou: {{reclamacao_do_cliente}}
O que, checado internamente, procede: {{o_que_procede}}

Produza:
1. **Abertura da conta** — os valores cobrados, item a item, ligados ao histórico informado.
2. **O que procede** — reconhecido de forma direta, sem rodeio, com o ajuste correspondente.
3. **O que não procede** — explicado com base no histórico, sem soar como acusação ao cliente.
4. **Encaminhamento** — o próximo passo concreto, com prazo, e quem faz o quê.

Restrições:
- Nunca negue algo que os dados informados confirmam que procede.
- Tom cordial e direto — sem jargão jurídico, sem se desculpar em excesso.
- Todo prazo mencionado precisa ser um prazo real, não "em breve" ou "o mais rápido possível".$prompt$
),

('skill-b8', 'B8', 'Resumo do extrato bancário em movimentações relevantes', 'Básico',
 ARRAY['extrato','bancária','resumo','fluxo-de-caixa'],
 ARRAY['extrato_do_periodo','o_que_e_esperado'],
 'O extrato reduzido ao que importa — entradas e saídas relevantes, recorrências identificadas e o que não bate com o esperado.',
 'Tarefa de leitura e síntese de muitos lançamentos; um modelo com boa janela de contexto ajuda quando o extrato é longo.',
 'padrao',
$prompt$Você resume um extrato bancário para alguém que não tem tempo de ler lançamento por lançamento, mas precisa saber o que se moveu de relevante.

Extrato do período: {{extrato_do_periodo}}
O que era esperado acontecer neste período: {{o_que_e_esperado}}

Produza:
1. **Entradas relevantes** — as maiores e mais incomuns, com valor e origem quando identificável.
2. **Saídas relevantes** — mesma lógica, do lado das saídas.
3. **Recorrências** — lançamentos que se repetem em padrão (mesmo valor, mesma contraparte, mesma periodicidade).
4. **O que não bate com o esperado** — qualquer movimentação que destoa do que foi informado como esperado para o período.

Restrições:
- "Relevante" é definido por valor ou por padrão incomum, nunca por achismo.
- Não classifique uma movimentação como erro — aponte que destoa do esperado e deixe a conclusão para quem vai investigar.
- Todo valor citado precisa existir literalmente no extrato informado.$prompt$
),

('skill-i1', 'I1', 'Leitura da demonstração de resultado com isolamento dos desvios do período', 'Intermediário',
 ARRAY['dre','análise','desvio','resultado','variação'],
 ARRAY['dre_do_periodo','dre_comparativo','orcamento_do_periodo','mudancas_na_operacao'],
 'A leitura vertical e horizontal da demonstração de resultado, os desvios que mais pesam isolados e decompostos, e o que fica invisível numa DRE.',
 'Um modelo forte em raciocínio numérico em várias etapas ajuda a manter a decomposição consistente do início ao fim.',
 'padrao',
$prompt$Você lê uma demonstração de resultado para apoiar decisão de gestão. A tarefa não é descrever a DRE — é achar onde o resultado se afastou do esperado e separar causa de coincidência.

DRE do período: {{dre_do_periodo}}
DRE do período comparativo: {{dre_comparativo}}
Orçamento ou expectativa para o período: {{orcamento_do_periodo}}
O que mudou na operação neste intervalo: {{mudancas_na_operacao}}

Produza:
1. **Leitura em cinco linhas** — o que a DRE conta sobre o período, sem citar número solto.
2. **Análise vertical** — cada linha como percentual da receita líquida, ao lado do mesmo percentual no comparativo.
3. **Análise horizontal** — variação absoluta e percentual linha a linha, contra o comparativo e contra o orçamento.
4. **Os três desvios que mais explicam a diferença de resultado** — ordenados por impacto em reais, com o peso de cada um.
5. **Decomposição de cada desvio** — preço, volume, mix, custo unitário ou despesa nova; onde não der para decompor com os dados informados, diga o que falta.
6. **O que a DRE não mostra** — caixa, prazo de recebimento, estoque, e qualquer outro efeito que fica fora desta demonstração.

Restrições:
- Todo percentual e toda variação vêm com a conta explícita de origem.
- Coincidência de tempo não é causa: mudança de operação no período é sempre hipótese concorrente, nunca conclusão automática.
- Não compare com benchmark de mercado — use só o histórico e o orçamento informados.$prompt$
),

('skill-i2', 'I2', 'Avaliação da inadimplência da carteira por faixa de atraso', 'Intermediário',
 ARRAY['inadimplência','carteira','cobrança','crédito'],
 ARRAY['carteira_por_cliente','regua_de_cobranca_atual','concentracao_de_risco'],
 'A carteira lida por faixa de atraso e por concentração, com a régua de cobrança avaliada e os casos que já exigem decisão além da régua padrão.',
 'Um modelo com boa capacidade de agrupar e comparar muitos registros ajuda quando a carteira é extensa.',
 'padrao',
$prompt$Você analisa a inadimplência de uma carteira de clientes para apoiar decisão de cobrança e de crédito.

Carteira, por cliente, valor e dias de atraso: {{carteira_por_cliente}}
Régua de cobrança em uso hoje: {{regua_de_cobranca_atual}}
Concentração de risco conhecida (poucos clientes grandes, setor, região): {{concentracao_de_risco}}

Produza:
1. **Distribuição por faixa de atraso** — quantidade de clientes e valor total em cada faixa (a definir a partir dos dados: por exemplo até 30, 31-60, 61-90, acima de 90 dias).
2. **Concentração** — o quanto das faixas mais críticas está concentrado em poucos clientes, nomeando os que mais pesam.
3. **Aderência da régua atual** — onde a régua de cobrança informada já não é suficiente para o perfil de atraso encontrado.
4. **Casos que exigem decisão individual** — os que, pelo valor ou pelo padrão, não devem seguir o fluxo padrão da régua.
5. **Sinais de piora ou melhora** — comparando o padrão desta carteira com o que seria esperado se nada tivesse mudado (com base apenas no que foi informado).

Restrições:
- Faixas de atraso vêm dos dados reais da carteira informada, não de um padrão de mercado genérico.
- Não recomende negativação, protesto ou ação judicial — isso é decisão jurídica, fora do escopo deste prompt.
- Todo cliente citado individualmente precisa estar na carteira informada.$prompt$
),

('skill-i3', 'I3', 'Apuração de margem por produto ou serviço com critério de rateio explícito', 'Intermediário',
 ARRAY['margem','custos','rateio','produto'],
 ARRAY['receita_e_custo_por_item','custos_indiretos','criterio_de_rateio'],
 'A margem apurada item a item, com o critério de rateio dos custos indiretos explícito, e os itens que destroem resultado identificados.',
 'Raciocínio numérico com múltiplos itens; um modelo com boa aderência a cálculo estruturado evita erro de arredondamento acumulado.',
 'padrao',
$prompt$Você apura a margem por produto ou serviço para mostrar onde o negócio ganha e onde perde dinheiro, item a item.

Receita e custo direto por item: {{receita_e_custo_por_item}}
Custos indiretos do período: {{custos_indiretos}}
Critério de rateio a aplicar: {{criterio_de_rateio}}

Produza:
1. **Margem direta por item** — receita menos custo direto, em valor e percentual.
2. **Rateio dos custos indiretos** — aplicado item a item segundo o critério informado, com a conta de como cada item chegou ao seu valor de rateio.
3. **Margem final por item** — depois do rateio, ordenada da maior para a menor.
4. **Itens que destroem resultado** — os que ficam com margem negativa ou abaixo de um limiar saudável, com o motivo (preço baixo, custo direto alto, ou peso do rateio).
5. **Sensibilidade ao critério de rateio** — o que muda na leitura se o critério fosse outro razoável, para deixar claro o quanto a conclusão depende dessa escolha.

Restrições:
- O critério de rateio usado é sempre o informado; se parecer inadequado para algum item, diga isso no item 5, não troque por conta própria.
- Nenhum item aparece sem seu componente de custo direto e indireto discriminado.
- Não recomende descontinuar um item só pela margem negativa — aponte o fato, a decisão de portfólio é de quem lê.$prompt$
),

('skill-i4', 'I4', 'Comparação entre orçado e realizado com decomposição de causa', 'Intermediário',
 ARRAY['orçamento','variação','planejamento','controladoria'],
 ARRAY['orcado_do_periodo','realizado_do_periodo','premissas_do_orcamento'],
 'A variação entre orçado e realizado com cada desvio decomposto em causa, separando erro de premissa de desvio de execução.',
 'Tarefa de comparação numérica com julgamento qualitativo; um modelo forte em raciocínio em múltiplas etapas sustenta melhor a separação de causas.',
 'padrao',
$prompt$Você compara o orçado com o realizado para dizer, linha a linha, se o desvio veio de premissa errada no orçamento ou de execução diferente do planejado.

Orçado do período: {{orcado_do_periodo}}
Realizado do período: {{realizado_do_periodo}}
Premissas usadas para montar o orçamento: {{premissas_do_orcamento}}

Produza:
1. **Variação linha a linha** — absoluta e percentual, orçado contra realizado.
2. **As linhas que mais pesam na diferença total** — ordenadas por impacto em reais.
3. **Classificação de cada desvio relevante** — erro de premissa (a premissa em si estava errada) ou desvio de execução (a premissa era razoável, a execução que fugiu).
4. **Evidência de cada classificação** — por que este desvio é premissa e aquele é execução, com base nas premissas informadas.
5. **O que revisar no próximo ciclo de orçamento** — as premissas que já se mostraram frágeis, a partir do que foi encontrado.

Restrições:
- Toda classificação de causa cita a premissa correspondente; nenhuma fica sem essa referência.
- Não classifique como execução um desvio que a premissa informada já não sustentava — isso é erro de premissa.
- Não sugira corte de meta ou de orçamento; o prompt entrega diagnóstico, não a decisão de ajuste.$prompt$
),

('skill-i5', 'I5', 'Parecer técnico sobre dúvida de enquadramento tributário', 'Intermediário',
 ARRAY['tributário','parecer','enquadramento','fiscal'],
 ARRAY['situacao_concreta','enquadramentos_possiveis','o_que_ja_foi_verificado'],
 'O parecer com a dúvida delimitada, as interpretações possíveis e o que precisa ser confirmado na legislação vigente antes de decidir.',
 'Tarefa que pede estrutura argumentativa clara; qualquer modelo atual com bom raciocínio textual atende, desde que as premissas de legislação sejam sempre tratadas como a confirmar.',
 'economico',
$prompt$Você redige um parecer técnico sobre uma dúvida de enquadramento tributário, para uso interno, antes de uma decisão que ainda vai ser tomada por quem tem autoridade para isso.

Situação concreta que gerou a dúvida: {{situacao_concreta}}
Enquadramentos que estão sendo considerados: {{enquadramentos_possiveis}}
O que já foi verificado até agora: {{o_que_ja_foi_verificado}}

Produza:
1. **Delimitação da dúvida** — o que exatamente está em aberto, em uma frase.
2. **Interpretações possíveis** — cada enquadramento considerado, com o raciocínio que sustenta cada um.
3. **Pontos a favor e contra de cada interpretação** — com base no que já foi verificado, sem inventar fundamentação que não foi informada.
4. **O que falta confirmar na legislação vigente** — a lista específica do que precisa ser checado antes de qualquer decisão.
5. **Recomendação de encaminhamento** — não qual enquadramento escolher, mas o próximo passo (consulta a especialista, consulta formal ao órgão, revisão de norma específica).

Restrições:
- Nunca afirme que um enquadramento é o correto — este parecer aponta caminhos, a decisão final exige confirmação jurídica/tributária específica.
- Toda interpretação vem com sua base de raciocínio explícita, nunca como afirmação solta.
- Não cite artigo de lei ou norma que não tenha sido informado como já verificado.$prompt$
),

('skill-i6', 'I6', 'Procedimento financeiro para a equipe executar', 'Intermediário',
 ARRAY['procedimento','processo','equipe','controles'],
 ARRAY['processo_atual','papeis_envolvidos','excecoes_conhecidas'],
 'O procedimento em passos, com responsável, alçada, prazo e o que fazer quando a exceção aparece.',
 'Tarefa de estruturação de processo; qualquer modelo atual atende bem.',
 'economico',
$prompt$Você documenta um procedimento financeiro para que a equipe execute sem precisar perguntar a cada exceção.

Como o processo funciona hoje: {{processo_atual}}
Papéis e alçadas envolvidos: {{papeis_envolvidos}}
Exceções que já aconteceram: {{excecoes_conhecidas}}

Produza:
1. **Passo a passo do processo padrão** — cada etapa, o responsável e o prazo, na ordem de execução.
2. **Alçada por etapa** — quem aprova o quê, e a partir de que valor ou condição a alçada muda.
3. **Exceções mapeadas** — cada exceção conhecida, com o que fazer quando ela aparece, sem parar o processo principal.
4. **O que fazer diante de uma exceção não mapeada** — a regra geral para quando nenhuma das exceções listadas se aplica.

Restrições:
- Todo papel citado precisa estar na lista informada; não invente cargo ou área.
- Exceções vêm apenas das informadas — para uma exceção nova, o item 4 cobre o caso, não se inventa uma regra específica.
- Alçadas e valores citados vêm exatamente do que foi informado, sem arredondar ou supor faixa.$prompt$
),

('skill-i7', 'I7', 'Plano de contas gerencial da empresa', 'Intermediário',
 ARRAY['plano-de-contas','estrutura','gerencial','controladoria'],
 ARRAY['contas_atuais','decisoes_que_o_plano_precisa_sustentar'],
 'O plano de contas gerencial com regra de uso por conta, evitando as contas genéricas demais para permitir análise depois.',
 'Tarefa de estruturação; qualquer modelo atual atende bem.',
 'economico',
$prompt$Você estrutura um plano de contas gerencial pensado para sustentar decisão, não só para registrar lançamento.

Contas usadas hoje: {{contas_atuais}}
Decisões que este plano de contas precisa sustentar (ex.: margem por produto, custo por área): {{decisoes_que_o_plano_precisa_sustentar}}

Produza:
1. **Estrutura proposta** — as contas organizadas em grupos e subgrupos, com nome claro o suficiente para não precisar de glossário.
2. **Regra de uso por conta** — o que entra e o que não entra em cada uma, para evitar que virem contas genéricas demais.
3. **Contas atuais problemáticas** — as que hoje misturam naturezas diferentes e inviabilizam a análise pretendida, com a sugestão de separação.
4. **Ligação com as decisões informadas** — para cada decisão que o plano precisa sustentar, quais contas alimentam essa análise.

Restrições:
- Nenhuma conta pode ficar sem regra de uso — "diversos" ou "outros" só é aceitável se vier com critério explícito do que cabe ali.
- A estrutura parte das contas atuais informadas; não descarte histórico sem justificar.
- Não proponha nomenclatura específica de sistema contábil — isto é plano de contas gerencial, não parametrização de ERP.$prompt$
),

('skill-i8', 'I8', 'Relatório gerencial mensal padronizado', 'Intermediário',
 ARRAY['relatório','gerencial','mensal','resultado'],
 ARRAY['numeros_do_mes','comparativos','riscos_identificados'],
 'O relatório mensal padronizado — números, leitura, riscos e encaminhamentos — no formato que se repete todo mês.',
 'Tarefa de síntese e redação recorrente; qualquer modelo atual com boa escrita atende.',
 'economico',
$prompt$Você monta o relatório gerencial mensal que precisa ser lido em poucos minutos por quem decide.

Números do mês: {{numeros_do_mes}}
Comparativos disponíveis (mês anterior, mesmo mês ano anterior, orçado): {{comparativos}}
Riscos já identificados no período: {{riscos_identificados}}

Produza:
1. **Resumo executivo** — três a cinco linhas com o que definiu o mês.
2. **Números-chave com comparativo** — os indicadores mais relevantes, cada um ao lado do comparativo disponível.
3. **Leitura** — o porquê por trás dos números, não só a descrição da variação.
4. **Riscos** — os informados, mais qualquer risco que a leitura dos números tenha revelado.
5. **Encaminhamentos** — as ações que decorrem do mês, com responsável quando possível.

Restrições:
- O resumo executivo nunca contém número sem explicação — é leitura, não tabela reduzida.
- Riscos revelados pela análise vêm claramente separados dos riscos já informados.
- Formato estável mês a mês: esta estrutura de cinco blocos não muda de um relatório para o outro.$prompt$
),

('skill-i9', 'I9', 'Cálculo da necessidade de capital de giro e do ciclo financeiro', 'Intermediário',
 ARRAY['capital-de-giro','ciclo-financeiro','liquidez'],
 ARRAY['prazos_de_recebimento_pagamento_estoque','volume_de_operacao'],
 'A necessidade de capital de giro calculada, com o ciclo financeiro aberto e as alavancas que o encurtam.',
 'Cálculo estruturado em várias etapas; um modelo forte em raciocínio numérico evita erro de fórmula.',
 'padrao',
$prompt$Você calcula a necessidade de capital de giro para mostrar quanto a operação exige de caixa e onde esse número pode ser reduzido.

Prazos médios de recebimento, pagamento e giro de estoque: {{prazos_de_recebimento_pagamento_estoque}}
Volume de operação (receita ou custo do período usado como base): {{volume_de_operacao}}

Produza:
1. **Ciclo operacional** — prazo de estoque mais prazo de recebimento, com a fórmula à mostra.
2. **Ciclo financeiro** — ciclo operacional menos prazo de pagamento, com a fórmula à mostra.
3. **Necessidade de capital de giro** — o ciclo financeiro aplicado sobre o volume de operação informado, com a conta explícita.
4. **Alavancas que encurtam o ciclo** — o que aconteceria com a necessidade de capital de giro se cada prazo (recebimento, pagamento, estoque) mudasse isoladamente.
5. **Prioridade entre as alavancas** — qual delas, pelo tamanho do efeito calculado, vale mais a pena atacar primeiro.

Restrições:
- Toda fórmula aparece explícita, com os números substituídos, não só o resultado.
- Não recomende renegociar prazo com fornecedor ou cliente como se fosse simples — aponte o efeito calculado, a viabilidade de negociar é outra análise.
- Números vêm apenas dos informados; nenhuma suposição de prazo de mercado.$prompt$
),

('skill-i10', 'I10', 'Orçamento anual por centro de custo', 'Intermediário',
 ARRAY['orçamento','centro-de-custo','planejamento','sazonalidade'],
 ARRAY['historico_por_centro_de_custo','premissas_de_crescimento','sazonalidade_conhecida'],
 'O orçamento por centro de custo com premissas explícitas, sazonalidade considerada e os pontos que precisam de decisão da diretoria.',
 'Raciocínio numérico com múltiplos centros de custo; um modelo com boa consistência em cálculos repetidos ajuda a manter uniformidade entre os centros.',
 'padrao',
$prompt$Você monta o orçamento anual por centro de custo, distribuído por mês, com premissas que quem for aprovar consegue questionar porque estão explícitas.

Histórico por centro de custo: {{historico_por_centro_de_custo}}
Premissas de crescimento ou redução para o próximo ano: {{premissas_de_crescimento}}
Sazonalidade já conhecida: {{sazonalidade_conhecida}}

Produza:
1. **Orçamento por centro de custo** — valor mensal projetado, partindo do histórico e aplicando as premissas informadas.
2. **Premissa aplicada em cada centro** — qual premissa de crescimento/redução foi usada e por quê, ligada a cada centro.
3. **Distribuição da sazonalidade** — como o padrão sazonal informado foi distribuído mês a mês, não uniformemente.
4. **Centros com maior incerteza** — os que dependem mais fortemente de uma premissa específica, e o que muda se ela não se confirmar.
5. **Pontos que exigem decisão da diretoria** — onde a premissa é, na prática, uma escolha estratégica e não um cálculo técnico.

Restrições:
- Toda linha do orçamento é rastreável até o histórico e a premissa aplicada — nada de número que "parece razoável".
- Sazonalidade usada é sempre a informada; não assuma padrão de mercado genérico.
- Este prompt não decide entre premissas concorrentes — o item 5 existe exatamente para isolar o que precisa de decisão humana.$prompt$
),

('skill-i11', 'I11', 'Projeção de fluxo de caixa das próximas semanas', 'Intermediário',
 ARRAY['fluxo-de-caixa','projeção','liquidez','planejamento'],
 ARRAY['saldo_atual','entradas_previstas','saidas_previstas'],
 'A projeção semana a semana, com o ponto de aperto de caixa identificado e as alavancas que o resolvem.',
 'Cálculo sequencial acumulado; qualquer modelo atual com boa aderência numérica atende.',
 'economico',
$prompt$Você projeta o fluxo de caixa das próximas semanas para antecipar qualquer aperto antes que ele vire um problema de última hora.

Saldo de caixa atual: {{saldo_atual}}
Entradas previstas, por semana: {{entradas_previstas}}
Saídas previstas, por semana: {{saidas_previstas}}

Produza:
1. **Projeção semana a semana** — saldo inicial, entradas, saídas e saldo final de cada semana, em sequência acumulada.
2. **Ponto de aperto** — a semana em que o saldo fica mais baixo, e o quanto falta ou sobra naquele ponto.
3. **Origem do aperto** — se vem de concentração de saída, atraso de entrada, ou os dois juntos.
4. **Alavancas disponíveis** — o que os dados informados sugerem como possível (antecipar uma entrada, postergar uma saída) e o efeito de cada alavanca no ponto de aperto.
5. **Cenário sem nenhuma alavanca acionada** — para deixar claro qual é o risco se nada for feito.

Restrições:
- O saldo acumulado nunca "pula" uma semana — toda semana informada aparece na sequência.
- Alavancas sugeridas só usam entradas e saídas que já constam nos dados informados; não invente uma nova fonte de caixa.
- Não afirme que uma alavanca é "fácil" de executar — aponte o efeito numérico, a viabilidade é avaliação de quem decide.$prompt$
),

('skill-i12', 'I12', 'Resposta a uma intimação fiscal recebida', 'Intermediário',
 ARRAY['fiscal','intimação','resposta','documentação'],
 ARRAY['teor_da_intimacao','documentacao_disponivel','prazo_de_resposta'],
 'A resposta estruturada item a item, com o que a documentação disponível sustenta e o que precisa ser levantado antes do prazo.',
 'Tarefa de redação factual com organização de evidência; qualquer modelo atual com bom raciocínio estruturado atende.',
 'economico',
$prompt$Você estrutura a resposta a uma intimação fiscal, organizando o que já pode ser respondido com o que ainda precisa ser levantado.

Teor da intimação (o que está sendo questionado): {{teor_da_intimacao}}
Documentação disponível hoje: {{documentacao_disponivel}}
Prazo de resposta: {{prazo_de_resposta}}

Produza:
1. **Itens questionados** — cada ponto da intimação, isolado, na ordem em que aparece.
2. **O que a documentação disponível já sustenta** — item a item, com o documento correspondente citado.
3. **O que ainda precisa ser levantado** — os pontos sem documentação suficiente, com o que buscar e onde.
4. **Rascunho de resposta para os itens já sustentados** — texto formal, pronto para revisão, apenas para o que tem base documental.
5. **Cronograma até o prazo** — o que precisa ser resolvido em quanto tempo para não perder o prazo informado.

Restrições:
- Nenhum item é respondido sem documento de suporte citado; onde não houver, o item entra na lista de pendências, não na resposta.
- Não elabore argumento jurídico de mérito — isto organiza fato e documento, a tese cabe a quem assina a resposta.
- O cronograma nunca ultrapassa o prazo informado.$prompt$
),

('skill-i13', 'I13', 'Preparação de respostas para questionamentos de auditoria', 'Intermediário',
 ARRAY['auditoria','evidência','resposta','controles'],
 ARRAY['perguntas_da_auditoria','evidencias_disponiveis'],
 'As perguntas da auditoria respondidas com a evidência correspondente apontada, e as que exigem posicionamento separadas para decisão.',
 'Organização de evidência e resposta factual; qualquer modelo atual com bom raciocínio estruturado atende.',
 'economico',
$prompt$Você prepara as respostas para os questionamentos de uma auditoria, ligando cada resposta à evidência que a sustenta.

Perguntas recebidas da auditoria: {{perguntas_da_auditoria}}
Evidências disponíveis (documentos, relatórios, sistemas): {{evidencias_disponiveis}}

Produza:
1. **Resposta a cada pergunta com evidência sustentada** — só as perguntas que a evidência disponível já resolve, com a evidência citada.
2. **Perguntas que exigem posicionamento** — as que pedem uma decisão de interpretação, não apenas um fato, separadas das anteriores.
3. **Lacunas de evidência** — perguntas sem evidência suficiente hoje, com o que buscar.
4. **Risco de cada lacuna** — o que a ausência de evidência pode sinalizar para o auditor, e a urgência de resolver antes da entrega.

Restrições:
- Nenhuma resposta é dada sem evidência citada; sem evidência, a pergunta vai para a lista de lacunas.
- Perguntas que pedem posicionamento não recebem resposta pronta — o prompt separa, quem decide é a pessoa responsável.
- Não minimize uma lacuna para "fechar" a lista — o risco de cada lacuna é reportado como está.$prompt$
),

('skill-i14', 'I14', 'Tradução do balancete em leitura de gestor', 'Intermediário',
 ARRAY['balancete','leitura','gestor','contábil'],
 ARRAY['balancete_do_periodo','balancete_comparativo'],
 'O balancete lido em linguagem de negócio, com as contas que se movimentaram fora do padrão sinalizadas.',
 'Leitura comparativa de muitas contas; um modelo com boa consistência ao comparar listas longas ajuda.',
 'padrao',
$prompt$Você lê um balancete para alguém que decide com base nele, mas não lê balancete no dia a dia.

Balancete do período: {{balancete_do_periodo}}
Balancete comparativo (período anterior): {{balancete_comparativo}}

Produza:
1. **Leitura por grupo** — ativo, passivo e patrimônio líquido, cada um em uma frase sobre o que mudou.
2. **Contas que se movimentaram fora do padrão** — variação muito acima ou abaixo do que o restante do grupo apresentou, listadas com o valor da variação.
3. **O que essas movimentações podem significar em negócio** — não em termos contábeis, em termos do que aconteceu na operação.
4. **Perguntas para confirmar a leitura** — o que vale confirmar com a contabilidade antes de tratar esta leitura como definitiva.

Restrições:
- "Fora do padrão" é definido pela comparação com o próprio balancete informado, nunca por um padrão externo.
- A leitura em negócio é sempre apresentada como hipótese a confirmar, nunca como fato encerrado.
- Nenhuma conta citada pode estar fora dos dois balancetes informados.$prompt$
),

('skill-a1', 'A1', 'Viabilidade de investimento com cenários e ponto de virada', 'Avançado',
 ARRAY['viabilidade','investimento','cenários','payback'],
 ARRAY['investimento_inicial','fluxos_esperados','taxa_minima_de_atratividade','variaveis_de_incerteza'],
 'A análise de viabilidade com payback, retorno e cenários, mais o ponto exato em que a decisão de investir muda de lado.',
 'Raciocínio numérico com múltiplos cenários simultâneos; vale usar um modelo com boa capacidade de manter consistência entre cálculos paralelos.',
 'padrao',
$prompt$Você analisa a viabilidade de um investimento considerando cenários, não um único número de retorno.

Investimento inicial: {{investimento_inicial}}
Fluxos de caixa esperados, período a período: {{fluxos_esperados}}
Taxa mínima de atratividade exigida: {{taxa_minima_de_atratividade}}
Variáveis com maior incerteza (ex.: preço, demanda, custo de insumo): {{variaveis_de_incerteza}}

Produza:
1. **Payback simples e descontado** — o cálculo de cada um, com a fórmula explícita.
2. **Retorno no cenário base** — usando os fluxos esperados informados, contra a taxa mínima exigida.
3. **Cenários otimista e pessimista** — variando as variáveis de maior incerteza informadas, com o efeito no retorno de cada cenário.
4. **Ponto de virada** — o valor de cada variável de incerteza a partir do qual o investimento deixa de valer a pena, isolando uma variável por vez.
5. **Leitura final** — em que condições o investimento se sustenta e em que condições ele não se sustenta, sem recomendar "sim" ou "não" de forma genérica.

Restrições:
- Toda taxa e todo fluxo usados vêm dos dados informados; nenhuma taxa de desconto de mercado é assumida sem ter sido informada.
- O ponto de virada isola uma variável por vez — não combine duas incertezas na mesma análise de sensibilidade sem deixar isso explícito.
- A leitura final não decide pelo leitor: aponta a condição de virada e deixa a decisão de apetite a risco para quem lê.$prompt$
),

('skill-a2', 'A2', 'Consolidação do resultado do grupo por empresa com eliminação de operações intercompany', 'Avançado',
 ARRAY['consolidação','grupo','intercompany','resultado'],
 ARRAY['resultado_por_empresa','operacoes_intercompany','participacoes_societarias'],
 'O consolidado com as eliminações identificadas, o resultado por empresa isolado e os subsídios cruzados entre empresas do grupo que ficavam invisíveis olhando cada uma separadamente.',
 'Consolidação com múltiplas eliminações; um modelo forte em rastrear várias transações relacionadas ao mesmo tempo reduz erro de dupla contagem.',
 'padrao',
$prompt$Você consolida o resultado de um grupo de empresas, eliminando o que é apenas transação interna, para mostrar o resultado real do grupo perante terceiros.

Resultado individual de cada empresa do grupo: {{resultado_por_empresa}}
Operações entre empresas do grupo (intercompany): {{operacoes_intercompany}}
Participações societárias entre as empresas: {{participacoes_societarias}}

Produza:
1. **Resultado somado, antes de eliminação** — a soma simples dos resultados individuais informados.
2. **Eliminações identificadas** — cada operação intercompany que precisa ser eliminada, com o valor e o efeito no resultado consolidado.
3. **Resultado consolidado** — depois das eliminações, com a conta explícita de como se chegou a esse número a partir do resultado somado.
4. **Resultado por empresa dentro do consolidado** — a contribuição real de cada empresa, descontada a parte que era apenas transferência interna.
5. **Subsídios cruzados** — onde uma empresa do grupo está, na prática, sustentando o resultado de outra através de preço de transferência ou condição interna, e o tamanho desse efeito.

Restrições:
- Toda eliminação cita a operação intercompany de origem informada; nenhuma eliminação aparece sem essa referência.
- Participação societária usada é sempre a informada — não assuma controle integral quando a participação informada é minoritária.
- Não avalie se o preço de transferência praticado está adequado do ponto de vista fiscal — isso é análise tributária separada, fora deste escopo.$prompt$
),

('skill-a3', 'A3', 'Modelo de valuation por fluxo de caixa descontado', 'Avançado',
 ARRAY['valuation','fcd','projeção','premissas'],
 ARRAY['fluxos_historicos','premissas_de_projecao','taxa_de_desconto','valor_terminal'],
 'O modelo de valuation com premissas auditáveis, a projeção período a período, a faixa de valor resultante e o teste de sensibilidade das premissas que mais pesam.',
 'Modelagem financeira em várias etapas encadeadas; um modelo com bom raciocínio numérico sequencial evita erro acumulado entre os períodos projetados.',
 'padrao',
$prompt$Você constrói um modelo de valuation por fluxo de caixa descontado, com toda premissa exposta para que possa ser auditada por outra pessoa depois.

Fluxos de caixa históricos: {{fluxos_historicos}}
Premissas de projeção (crescimento, margem, investimento): {{premissas_de_projecao}}
Taxa de desconto a aplicar: {{taxa_de_desconto}}
Critério para o valor terminal: {{valor_terminal}}

Produza:
1. **Projeção de fluxo de caixa** — período a período, partindo do histórico informado e aplicando as premissas de projeção, com cada premissa citada na linha em que age.
2. **Valor terminal** — calculado segundo o critério informado, com a fórmula explícita.
3. **Desconto a valor presente** — cada fluxo projetado e o valor terminal trazidos a valor presente pela taxa informada, com o cálculo à mostra.
4. **Faixa de valor** — o valor central resultante, mais uma faixa (não um único número), refletindo a incerteza natural das premissas.
5. **Teste de sensibilidade** — o efeito no valor final de variar isoladamente a taxa de desconto e a premissa de crescimento, mostrando quais premissas mais movem o resultado.
6. **Premissas mais frágeis** — as que, pelo teste de sensibilidade, merecem mais escrutínio antes de qualquer decisão baseada neste valuation.

Restrições:
- Toda premissa usada na projeção precisa estar listada nas premissas informadas; nenhuma premissa de mercado é assumida por conta própria.
- O resultado nunca é apresentado como um único número fechado — sempre como faixa, dado que valuation é estimativa, não fato.
- Não compare o valor encontrado com múltiplos de mercado ou transações comparáveis — isso é outro método de valuation, fora deste prompt.$prompt$
),

('skill-a4', 'A4', 'Alternativas de organização tributária do grupo', 'Avançado',
 ARRAY['tributário','estrutura','grupo','alternativas','risco'],
 ARRAY['estrutura_atual_do_grupo','objetivo_da_reorganizacao','restricoes_conhecidas'],
 'As alternativas de organização tributária mapeadas com efeito estimado, requisitos e riscos, mais a lista do que precisa ser confirmado antes de qualquer decisão.',
 'Raciocínio comparativo entre múltiplas alternativas com trade-offs; um modelo forte em manter várias linhas de raciocínio paralelas sem misturá-las ajuda aqui.',
 'padrao',
$prompt$Você mapeia alternativas de organização tributária para um grupo de empresas, sem escolher entre elas — a decisão final exige validação jurídica e tributária específica.

Estrutura societária e tributária atual do grupo: {{estrutura_atual_do_grupo}}
Objetivo da reorganização: {{objetivo_da_reorganizacao}}
Restrições conhecidas (societárias, contratuais, operacionais): {{restricoes_conhecidas}}

Produza:
1. **Alternativas mapeadas** — cada configuração possível que atende ao objetivo informado, descrita de forma que alguém sem o mesmo histórico do grupo consiga entender.
2. **Efeito estimado de cada alternativa** — em direção (redução ou aumento de carga, simplificação ou complexidação), não em valor exato, salvo se os dados informados permitirem o cálculo.
3. **Requisitos de cada alternativa** — o que precisa existir ou mudar na estrutura atual para viabilizá-la.
4. **Riscos de cada alternativa** — societário, tributário, operacional, incluindo o risco de a alternativa ser questionada por falta de propósito negocial.
5. **O que precisa ser confirmado antes de decidir** — pareceres, validações ou levantamentos específicos, para cada alternativa.

Restrições:
- Nenhuma alternativa é apresentada como recomendação final — este prompt organiza opções, a decisão exige validação profissional específica.
- Toda alternativa respeita as restrições informadas; se violar alguma, isso aparece explicitamente no requisito, não é omitido.
- Efeito estimado nunca vem como número fechado sem que os dados informados sustentem o cálculo — nesse caso, use direção e ordem de grandeza qualitativa.$prompt$
),

('skill-a5', 'A5', 'Business case de uma decisão para a diretoria', 'Avançado',
 ARRAY['business-case','diretoria','decisão','risco'],
 ARRAY['problema_a_resolver','opcoes_em_avaliacao','numeros_disponiveis'],
 'O business case completo — problema, opções comparadas, números, riscos e o que se compromete a entregar — pronto para decisão da diretoria.',
 'Síntese de informação heterogênea em argumento estruturado; qualquer modelo atual com bom raciocínio argumentativo atende.',
 'economico',
$prompt$Você monta o business case de uma decisão que vai para a diretoria aprovar ou recusar.

Problema a resolver: {{problema_a_resolver}}
Opções em avaliação: {{opcoes_em_avaliacao}}
Números disponíveis sobre cada opção: {{numeros_disponiveis}}

Produza:
1. **O problema em uma frase** — sem rodeio, o que precisa ser resolvido e por que agora.
2. **Opções comparadas lado a lado** — cada uma com custo, benefício esperado e prazo, na mesma tabela para comparação direta.
3. **Recomendação** — qual opção o business case sustenta, com o porquê ligado diretamente aos números do item 2.
4. **Riscos da opção recomendada** — o que pode dar errado, e o que mitigaria cada risco.
5. **O que se compromete a entregar** — o resultado mensurável e o prazo, se a diretoria aprovar.

Restrições:
- A recomendação só pode se apoiar em números que estão no item 2 — nenhum argumento novo aparece fora da tabela comparativa.
- Toda opção descartada recebe o motivo do descarte, não apenas silêncio sobre ela.
- O compromisso de entrega do item 5 precisa ser algo verificável depois, nunca uma promessa vaga como "melhorar o resultado".$prompt$
),

('skill-a6', 'A6', 'Proposta de renegociação de dívida com credores', 'Avançado',
 ARRAY['dívida','renegociação','credores','capacidade-de-pagamento'],
 ARRAY['mapa_da_divida','capacidade_real_de_pagamento','prioridades_por_credor'],
 'O mapa da dívida com a capacidade real de pagamento e a proposta por credor, com o limite de concessão já definido antes da conversa.',
 'Raciocínio numérico combinado com estratégia de negociação; um modelo forte em manter múltiplas restrições simultâneas ajuda a manter a proposta consistente entre credores.',
 'padrao',
$prompt$Você prepara a proposta de renegociação de dívida com múltiplos credores, definindo o limite de concessão antes de qualquer conversa começar.

Mapa da dívida (credor, valor, condição atual, vencimento): {{mapa_da_divida}}
Capacidade real de pagamento no período: {{capacidade_real_de_pagamento}}
Prioridades entre credores (estratégicos, garantias, relacionamento): {{prioridades_por_credor}}

Produza:
1. **Mapa consolidado da dívida** — total por credor e por vencimento, com a condição atual de cada um.
2. **Capacidade de pagamento confrontada com o vencimento atual** — onde o vencimento atual excede a capacidade real informada, e por quanto.
3. **Proposta por credor** — prazo e condição propostos, coerentes com a capacidade de pagamento total (a soma das propostas não pode exceder a capacidade informada).
4. **Limite de concessão por credor** — até onde é possível ceder em prazo ou taxa antes de a proposta deixar de fazer sentido, definido antes da negociação.
5. **Ordem de prioridade na conversa** — com quais credores negociar primeiro, segundo as prioridades informadas, e por quê.

Restrições:
- A soma das propostas por credor nunca ultrapassa a capacidade real de pagamento informada.
- O limite de concessão é definido antes da negociação e não muda dentro deste documento — é o teto interno, não a oferta inicial.
- Nenhum credor recebe tratamento fora do que as prioridades informadas justificam; qualquer exceção precisa de justificativa explícita.$prompt$
);
