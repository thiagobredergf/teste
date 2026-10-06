-- Fase 27: Classificação de Contatos — tipo de pessoa (Jurídica/Física, pra
-- mostrar a máscara certa de CNPJ/CPF e habilitar a busca automática por
-- CNPJ) e tipo de contato (Cliente/Fornecedor/Sócio/Funcionário, pra
-- identificar melhor quem é quem quando o mesmo cadastro aparece em Contas
-- a Pagar). Nullable — contato já cadastrado continua válido sem reclassificar.
alter table public.contacts add column if not exists "tipoPessoa" text check ("tipoPessoa" in ('juridica', 'fisica'));
alter table public.contacts add column if not exists "tipoContato" text check ("tipoContato" in ('cliente', 'fornecedor', 'socio', 'funcionario'));
