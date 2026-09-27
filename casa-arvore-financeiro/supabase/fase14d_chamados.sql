-- Rotina, item 4/5: "Chamados" — evolui a caixa de entrada de documentos
-- (documentUploads) pra virar um canal de mão dupla, sem o cliente
-- precisar de login e sem o cliente nunca tocar no financeiro:
--   - cliente manda mensagem de texto e/ou arquivo pelo mesmo link público
--     que já existia só pra arquivo;
--   - analista responde de dentro do ESEK (mesma tela "Documentos
--     Recebidos"), e a resposta é enviada por WhatsApp (mesmo padrão
--     zero-custo já usado no resto do sistema — wa.me, sem API paga);
--   - o cliente pode reabrir o mesmo link e ver o histórico da conversa.
--
-- fileName/mediaType/storagePath deixam de ser obrigatórios (agora dá pra
-- mandar só uma mensagem, sem arquivo) — mas pelo menos um dos dois
-- (arquivo OU mensagem) tem que existir, garantido pelo check abaixo.
alter table public."documentUploads"
  alter column "fileName" drop not null,
  alter column "mediaType" drop not null,
  alter column "storagePath" drop not null,
  add column if not exists "mensagemCliente" text,
  add column if not exists "respostaGestor" text,
  add column if not exists "respostaEm" timestamptz,
  add column if not exists "respostaPor" text;

alter table public."documentUploads" drop constraint if exists document_uploads_conteudo_check;
alter table public."documentUploads"
  add constraint document_uploads_conteudo_check check ("storagePath" is not null or "mensagemCliente" is not null);
