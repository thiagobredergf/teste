-- Fase 21: GED (persistência dos documentos importados) + vencimento
-- estruturado do contrato de prestação de serviço do BPO.
--
-- Até aqui, "Importar documento" (Contas a Pagar/Receber, Lançamentos
-- Bancários, Transferências) só lia o arquivo no navegador pra IA extrair
-- os dados, e descartava o arquivo depois — se o operador deixasse o
-- lançamento pendente e trocasse de computador, perdia o arquivo
-- original (diferente de "Documentos Recebidos", que já guarda no
-- Storage desde a fase de upload sem login). Esta fase guarda também o
-- arquivo de origem dessas 4 telas, vinculado ao lançamento, e cria os
-- buckets/políticas pra exportar tudo de uma empresa num zip com link
-- temporário (fluxo de fim de contrato / LGPD).

alter table public.payables add column if not exists "documentoArquivoPath" text;
alter table public.receivables add column if not exists "documentoArquivoPath" text;
alter table public."bankEntries" add column if not exists "documentoArquivoPath" text;
alter table public.transfers add column if not exists "documentoArquivoPath" text;

-- O campo "Renovação" já existente (contratoRenovacao) é texto livre
-- ("anual", "indeterminado") — não dá pra gerar alerta de vencimento a
-- partir dele. Este campo é a data de verdade.
alter table public.empresas add column if not exists "contratoVencimento" date;

-- Bucket dos arquivos que o operador importa direto pra um lançamento —
-- path sempre começa com o empresaId (igual ao padrão de
-- documentos-recebidos), pra reaproveitar has_empresa_access. Diferente
-- de documentos-recebidos (que só recebe insert via Edge Function com
-- service role), aqui o upload acontece direto do navegador do
-- operador/gestor logado, então precisa de policy de insert também.
insert into storage.buckets (id, name, public)
values ('documentos-lancamentos', 'documentos-lancamentos', false)
on conflict (id) do nothing;

drop policy if exists documentos_lancamentos_select on storage.objects;
create policy documentos_lancamentos_select on storage.objects
  for select using (bucket_id = 'documentos-lancamentos' and public.has_empresa_access(auth.uid(), (storage.foldername(name))[1]));

drop policy if exists documentos_lancamentos_insert on storage.objects;
create policy documentos_lancamentos_insert on storage.objects
  for insert with check (bucket_id = 'documentos-lancamentos' and public.is_staff(auth.uid()) and public.has_empresa_access(auth.uid(), (storage.foldername(name))[1]));

drop policy if exists documentos_lancamentos_delete on storage.objects;
create policy documentos_lancamentos_delete on storage.objects
  for delete using (bucket_id = 'documentos-lancamentos' and public.is_staff(auth.uid()) and public.has_empresa_access(auth.uid(), (storage.foldername(name))[1]));

-- Bucket só do zip de exportação (fim de contrato) — o link entregue ao
-- dono é assinado (createSignedUrl), então quem recebe não precisa de
-- login nenhum pra baixar; as policies abaixo só valem pra quem GERA o
-- zip (gestor, autenticado, dentro do ESEK).
insert into storage.buckets (id, name, public)
values ('documentos-export', 'documentos-export', false)
on conflict (id) do nothing;

drop policy if exists documentos_export_select on storage.objects;
create policy documentos_export_select on storage.objects
  for select using (bucket_id = 'documentos-export' and public.is_staff(auth.uid()) and public.has_empresa_access(auth.uid(), (storage.foldername(name))[1]));

drop policy if exists documentos_export_insert on storage.objects;
create policy documentos_export_insert on storage.objects
  for insert with check (bucket_id = 'documentos-export' and public.is_staff(auth.uid()) and public.has_empresa_access(auth.uid(), (storage.foldername(name))[1]));

drop policy if exists documentos_export_delete on storage.objects;
create policy documentos_export_delete on storage.objects
  for delete using (bucket_id = 'documentos-export' and public.is_staff(auth.uid()) and public.has_empresa_access(auth.uid(), (storage.foldername(name))[1]));
