-- Fase 19 (dentro da Fase 1 — item identificado na apostila "Financeiro do
-- Zero"): estrutura os 3 campos que faltavam pra reconhecer documento fiscal
-- como profissional — tipo (NF-e/NFS-e/CT-e), chave de acesso (ou código de
-- verificação, no caso de NFS-e), e o certificado digital da empresa
-- (tipo + validade, pra avisar antes de vencer, como a apostila recomenda).
--
-- Decisão explícita (confirmada com o usuário): NÃO é captura automática de
-- XML via SEFAZ/prefeitura — isso exigiria custodiar o certificado digital
-- do cliente (risco de segurança/LGPD) ou contratar um provedor terceiro
-- pago. Aqui só organizamos o que já chega pelo Documentos Recebidos,
-- inclusive extraindo tipo/chave automaticamente via IA quando o documento
-- já está sendo lido de qualquer forma.
alter table public.payables add column if not exists "tipoDocumento" text;
alter table public.payables add column if not exists "chaveAcesso" text;

alter table public.receivables add column if not exists "tipoDocumento" text;
alter table public.receivables add column if not exists "chaveAcesso" text;

alter table public."documentUploads" add column if not exists "tipoDocumento" text;
alter table public."documentUploads" add column if not exists "chaveAcesso" text;

alter table public.empresas add column if not exists "certificadoDigitalTipo" text;
alter table public.empresas add column if not exists "certificadoDigitalValidade" date;
