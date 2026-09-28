-- Fase 18: controle de acesso por empresa pra Gestor e Operador (não só pra
-- Dono, que já tinha isso via empresa_owners) — o gestor master consegue
-- dividir a carteira de clientes entre os analistas (ex.: Operador 1 com 4
-- empresas, Operador 2 com 3), sem cada um enxergar a base inteira.
--
-- Design "opt-in por restrição": ninguém tem linha nenhuma aqui hoje, então
-- has_empresa_access continua liberando acesso total pra todo gestor/
-- operador existente (comportamento de antes, preservado). O gestor passa a
-- poder restringir um usuário específico cadastrando as empresas dele em
-- staff_empresa_access — a partir da primeira linha, aquele usuário passa a
-- só ver as empresas listadas (allowlist). Sem nenhuma linha = acesso total
-- (é assim que o "gestor master" nunca precisa de tratamento especial: ele
-- simplesmente nunca é restringido).
create table if not exists public.staff_empresa_access (
  user_id uuid not null references auth.users(id) on delete cascade,
  "empresaId" text not null references public.empresas(id) on delete cascade,
  "createdAt" timestamptz not null default now(),
  primary key (user_id, "empresaId")
);

alter table public.staff_empresa_access enable row level security;

drop policy if exists staff_empresa_access_select on public.staff_empresa_access;
create policy staff_empresa_access_select on public.staff_empresa_access
  for select using (public.is_gestor(auth.uid()));

create or replace function public.has_empresa_access(uid uuid, emp_id text)
returns boolean
language sql
security definer
stable
as $$
  select
    case
      when public.is_staff(uid) then
        not exists (select 1 from public.staff_empresa_access where user_id = uid)
        or exists (select 1 from public.staff_empresa_access where user_id = uid and "empresaId" = emp_id)
      else exists (
        select 1 from public.empresa_owners eo where eo.user_id = uid and eo."empresaId" = emp_id
      )
    end
$$;

-- Substitui de uma vez a lista de empresas de um usuário — chamado do ADM
-- pelo gestor master. is_gestor(auth.uid()) confere de novo aqui dentro (não
-- confia só na UI), igual o padrão já usado em upsert_staff_profile.
create or replace function public.set_staff_empresa_access(p_user_id uuid, p_empresa_ids text[])
returns void
language plpgsql
security definer
as $$
begin
  if not public.is_gestor(auth.uid()) then
    raise exception 'só gestor pode gerenciar acesso por empresa';
  end if;
  delete from public.staff_empresa_access where user_id = p_user_id;
  if p_empresa_ids is not null and array_length(p_empresa_ids, 1) > 0 then
    insert into public.staff_empresa_access (user_id, "empresaId")
    select p_user_id, e from unnest(p_empresa_ids) as e;
  end if;
end;
$$;
