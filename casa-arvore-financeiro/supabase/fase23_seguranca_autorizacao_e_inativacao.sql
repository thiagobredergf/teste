-- Fase 23: duas travas de segurança que até agora só existiam na tela
-- (fácil de contornar por quem chama a API do Supabase direto, fora do
-- app) — pedido explícito do gestor depois de mapear o que faltava pra
-- fechar a v1.0.

-- 1) "Autorizar pagamento" só pro Dono, agora de verdade no banco.
-- A UI já escondia o botão "Autorizar" de quem não é dono (PayablesView),
-- mas nada impedia um Gestor/Operador de fazer o mesmo UPDATE via API. O
-- gate certo é na transição de status pra "Autorizado" (é exatamente o
-- que o botão Autorizar grava), não a tabela inteira — Gestor/Operador
-- continuam podendo agendar, dar baixa direto, cancelar agendamento etc.
create or replace function public.is_owner_of_empresa(uid uuid, emp_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.empresa_owners eo where eo.user_id = uid and eo."empresaId" = emp_id
  )
$$;

create or replace function public.enforce_payable_autorizacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.status = 'Autorizado' and (OLD.status is distinct from 'Autorizado') then
    if not public.is_owner_of_empresa(auth.uid(), NEW."empresaId") then
      raise exception 'Só o dono da empresa pode autorizar pagamento';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_enforce_payable_autorizacao on public.payables;
create trigger trg_enforce_payable_autorizacao
  before update on public.payables
  for each row execute function public.enforce_payable_autorizacao();

-- 2) Empresa inativada (quebra de contrato antes do prazo ou fim normal)
-- corta o acesso do login "Dono" vinculado a ela. Gestor/Operador NÃO são
-- afetados — a equipe do BPO precisa continuar enxergando a empresa
-- inativa pra auditoria/histórico (é por isso que "Inativar" nunca
-- excluiu nada). Só o braço "else" (dono) de has_empresa_access passa a
-- exigir empresa ativa; o braço do staff continua igual.
create or replace function public.has_empresa_access(uid uuid, emp_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when public.is_staff(uid) then
        not exists (select 1 from public.staff_empresa_access where user_id = uid)
        or exists (select 1 from public.staff_empresa_access where user_id = uid and "empresaId" = emp_id)
      else exists (
        select 1 from public.empresa_owners eo
        join public.empresas e on e.id = eo."empresaId"
        where eo.user_id = uid and eo."empresaId" = emp_id and e.ativa = true
      )
    end
$$;
