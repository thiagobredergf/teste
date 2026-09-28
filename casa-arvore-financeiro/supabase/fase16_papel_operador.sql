-- Fase 16: novo papel "operador" — funcionário do BPO que trabalha nas
-- telas transacionais do dia a dia (Contas a Pagar/Receber, Lançamentos
-- Bancários, Transferências, Conciliação, Repasses de Terceiros,
-- Documentos Recebidos), mas não tem acesso a Análise (Fechamento, Hub de
-- Skills, Relatórios) nem ao ADM.
--
-- "is_staff" junta gestor+operador: ambos são time do BPO, não do cliente
-- — por isso o acesso deles a empresa é amplo (igual gestor já era),
-- diferente de "owner" (dono do cliente), que só enxerga a própria
-- empresa via empresa_owners. has_empresa_access passa a usar is_staff no
-- lugar de is_gestor sozinho, então todo RLS que já dependia dela (a
-- maioria das tabelas do sistema) libera operador automaticamente, sem
-- precisar reescrever policy por policy.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('gestor', 'owner', 'operador'));

create or replace function public.is_staff(uid uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists(select 1 from public.profiles p where p.id = uid and p.role in ('gestor', 'operador'))
$$;

create or replace function public.has_empresa_access(uid uuid, emp_id text)
returns boolean
language sql
security definer
stable
as $$
  select public.is_staff(uid) or exists(
    select 1 from public.empresa_owners eo where eo.user_id = uid and eo."empresaId" = emp_id
  )
$$;

-- Repasse de Terceiros passa a ser trabalho de rotina do operador (não
-- mais só do gestor) — relaxa a escrita de settlement_partners de
-- is_gestor pra is_staff. Plano de Contas, Fechamento, Tarefas,
-- Cronômetro e Hub de Skills continuam só-gestor (não mudam aqui).
drop policy if exists settlement_partners_write on public.settlement_partners;
drop policy if exists settlement_partners_update on public.settlement_partners;
drop policy if exists settlement_partners_delete on public.settlement_partners;

create policy settlement_partners_write on public.settlement_partners
  for insert with check (public.is_staff(auth.uid()));
create policy settlement_partners_update on public.settlement_partners
  for update using (public.is_staff(auth.uid()));
create policy settlement_partners_delete on public.settlement_partners
  for delete using (public.is_staff(auth.uid()));
