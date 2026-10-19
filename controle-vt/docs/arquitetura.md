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
6. Sem perfis de acesso. Registra-se apenas o nome de quem lançou.

## Persistência

- Abrir arquivo → trabalhar em memória → cada ação confirmada grava no arquivo.
- Cópia de segurança datada na pasta escolhida pelo usuário a cada fechamento e a cada abertura.
- Plano B sem API de arquivos: "Salvar" baixa o arquivo; "Abrir" seleciona o arquivo.

## O que se reaproveita

`core/` (cálculo e importação de saldo) é JavaScript puro e roda como está dentro da página.
O esquema `db/001_schema.sql` (PostgreSQL) serve de referência de modelo; a versão em SQLite será
escrita junto com o aplicativo.
