# Arquitetura: ferramenta local de arquivo único

## Decisão

Uma **página HTML única**, aberta direto do disco no Edge ou Chrome, sem servidor, sem
instalação e sem internet. Os dados ficam em **um único arquivo cifrado com senha**
(SQLite dentro). Um usuário opera; os demais recebem relatórios.

## Por quê

- A TI resiste a instalar executáveis → navegador é o único ambiente garantido.
- Um operador só → não há concorrência a resolver.
- Os arquivos de entrada (RH e Global Mob) são PDF ou TXT → leitura local, sem integração.
- O hardware pode ficar exposto → o arquivo de dados é cifrado (AES-256-GCM, chave derivada da
  senha por PBKDF2); recomenda-se também a cifragem de disco do Windows (BitLocker).

## Prova de viabilidade (pasta `spike/`)

Abrindo `spike.html` por `file://` no Chromium, sem rede:

| Capacidade | Resultado |
|---|---|
| SQLite (sql.js, WASM embutido): criar, gravar, exportar e reabrir banco | Funcionou |
| Cifra do arquivo com senha; senha errada é rejeitada | Funcionou |
| Leitura de texto de PDF (pdf.js, com worker embutido) | Funcionou |
| API de arquivos do navegador (abrir/salvar no mesmo arquivo) | Presente; **seletores não exercitados** |
| Tamanho do arquivo único | ≈ 2,3 MB |

**Não provado:**
- A leitura de um PDF **real** da Global Mob ou do RH (a amostra foi gerada por nós, com texto simples).
- Se uma política da TI desabilita a API de arquivos do Edge/Chrome. Nesse caso o fluxo cai para
  "abrir arquivo" / "baixar arquivo" (funciona sempre, com um passo manual a mais).
- Edge/Chrome nas versões da prefeitura.

## Regras de projeto

1. **Nenhum dado extraído de PDF entra direto.** Toda importação passa por uma prévia com totais de
   controle (quantidade de linhas e soma dos valores) e uma lista do que foi rejeitado. O usuário confirma.
2. **PDF só se for texto.** PDF escaneado (imagem) não é lido: pede-se TXT/CSV à origem. OCR para valor
   em dinheiro é fonte de erro e fica fora do escopo.
3. **Cruzamento na recepção:** RH × Global Mob × cadastro (sem cartão, cartão sem dono, suspenso com
   cartão ativo, matrícula duplicada).
4. **O mês é uma lista de mudanças** sobre um cadastro quase fixo: eventos, ocorrências do ponto e
   calendário. Comparação com o mês anterior destaca variações.
5. **Histórico e fechamento** continuam: quem mudou o quê, mês fechado imutável, cópia de segurança datada.
6. Sem perfis de acesso. Cada operador informa o nome ao abrir o arquivo; ele é carimbado em eventos, ocorrências, contestações e no histórico (gatilhos no banco). Arquivos antigos são migrados ao abrir.

## Fluxo mensal (como o trabalho acontece)

1. O RH registra as adesões e gera o **relatório de beneficiários** (com o valor descontado). O operador do VT recebe o arquivo.
2. **Recepção:** o operador carrega a relação do RH e o saldo da Global Mob.
3. **Comparação:** a ferramenta compara a relação com o cadastro e mostra só as mudanças: entradas (inclusão ou
   reativação), saídas a classificar (desligamento, desistência), alterações de valor/dias/cartão/desconto, matrículas
   duplicadas. O operador confirma cada mudança; as confirmadas viram eventos no histórico. Quem está na relação mas
   suspenso (saldo alto, licença, bloqueio a pedido) **não aparece como saída**: é revisado na etapa de suspensões.
4. **Ponto e calendário:** lança ocorrências (faltas, licenças, férias) e confere a tabela de dias do mês.
5. **Suspensões:** a ferramenta lista licenças com prazo vencido ou sem prazo e suspensões por saldo alto que podem ser reativadas.
6. **Cálculo:** direito − saldo projetado = repasse, com alertas (sem cartão, saldo antigo, saldo alto).
7. **Fechamento:** congela o mês e gera os relatórios de saída.

O desconto em folha vem do relatório do RH e é apenas carregado; o sistema não o calcula.

## Persistência

- Abrir arquivo → trabalhar em memória → cada ação confirmada grava no arquivo.
- Cópia de segurança datada na pasta escolhida pelo usuário a cada fechamento e a cada abertura.
- Plano B sem API de arquivos: "Salvar" baixa o arquivo; "Abrir" seleciona o arquivo.

## O que se reaproveita

`core/` (cálculo e importação de saldo) é JavaScript puro e roda como está dentro da página.
O esquema `db/001_schema.sql` (PostgreSQL) serve de referência de modelo; a versão em SQLite será
escrita junto com o aplicativo.

## Publicação como link (artefato) e restrições da plataforma

A mesma página roda como link em um visualizador com regras próprias. O que mudou por causa delas:

| Restrição do visualizador | Como o aplicativo lida |
|---|---|
| Downloads iniciados pela página são ignorados; só a permissão `downloads` salva, com confirmação do usuário | Toda saída de arquivo passa por uma função única (`entregar`). Se o ambiente não permitir, avisa e indica a versão em arquivo |
| Só extensões como `json`, `csv`, `html`, `pdf`, `xlsx` podem ser baixadas | Arquivo de dados em `.json` (conteúdo cifrado em base64). Arquivos `.vtdb` antigos ainda abrem |
| `confirm()`, `prompt()` e `alert()` não funcionam | Diálogos feitos na própria página |
| `window.print()` não abre a impressão | Relatório baixado em HTML; PDF por Ctrl+P no arquivo baixado |
| Política de segurança estrita (sem `eval`, sem rede, workers só por `blob:`) | SQLite em JavaScript puro (sem WebAssembly); código do leitor de PDF executado na própria página, sem worker; `isEvalSupported: false` |
| API de arquivos do navegador não funciona em iframe | Detecta e usa abrir/baixar comum |

Verificado com o teste de ponta a ponta sobre o fragmento embrulhado sob uma política estrita simulada (`ARTEFATO=1`).
O teste simulado achou uma falha real: o leitor de PDF dependia de um `blob:` bloqueado pela política.
**Não verificado:** o comportamento no visualizador real; a política simulada é uma aproximação.
