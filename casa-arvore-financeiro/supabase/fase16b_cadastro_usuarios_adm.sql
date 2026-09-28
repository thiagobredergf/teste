-- Fase 16b: tela ADM — cadastro de usuário (nome, CPF, papel) e troca de
-- senha, pros três papéis (gestor, operador, dono). Reaproveita o mesmo
-- padrão já usado pro dono (assign_empresa_owner): a função verifica
-- is_gestor(auth.uid()) internamente, então só quem já é gestor consegue
-- chamar — o próprio banco garante "só gestor mexe no ADM", não só a UI.
alter table public.profiles add column if not exists nome text;
alter table public.profiles add column if not exists cpf text;

-- Cria/atualiza o perfil (papel, nome, CPF) de um usuário que JÁ TEM login
-- no Supabase Auth (criado por manage-staff-login ou manage-owner-login) —
-- só gestor/operador passam por aqui, dono continua sendo atribuído por
-- empresa via assign_empresa_owner (já existente), que essa função não
-- substitui.
create or replace function public.upsert_staff_profile(p_email text, p_role text, p_nome text default null, p_cpf text default null)
returns void
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
begin
  if not public.is_gestor(auth.uid()) then
    raise exception 'só gestor pode gerenciar usuários';
  end if;
  if p_role not in ('gestor', 'operador') then
    raise exception 'papel inválido: %', p_role;
  end if;
  select id into v_user_id from auth.users where email = p_email;
  if v_user_id is null then
    raise exception 'usuário não encontrado — crie o login primeiro';
  end if;
  insert into public.profiles (id, role, email, nome, cpf)
    values (v_user_id, p_role, p_email, p_nome, p_cpf)
  on conflict (id) do update set
    role = excluded.role,
    nome = coalesce(excluded.nome, public.profiles.nome),
    cpf = coalesce(excluded.cpf, public.profiles.cpf);
end;
$$;
