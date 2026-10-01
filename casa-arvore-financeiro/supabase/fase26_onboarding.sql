-- Fase 26: Onboarding de cliente novo — checklist por empresa, estruturado
-- nas 4 fases do roteiro de onboarding BPO (Diagnóstico e Alinhamento →
-- Acessos e Ferramentas → Equipe e Cultura → Operação Assistida/Go-Live).
-- Empresa nova já nasce com o checklist padrão (seedOnboardingChecklist no
-- App.jsx); empresa existente ganha via botão "Gerar checklist" na tela.
create table public.onboarding_items (
  id text primary key,
  "empresaId" text not null references public.empresas(id) on delete cascade,
  fase text not null check (fase in ('diagnostico', 'acessos', 'equipe', 'golive')),
  titulo text not null,
  status text not null default 'pendente' check (status in ('pendente', 'concluido')),
  "concluidoEm" timestamptz,
  "concluidoPor" text,
  created_at timestamptz not null default now()
);

alter table public.onboarding_items enable row level security;

-- Leitura: quem tem acesso à empresa (igual bpo_tasks). Escrita: só
-- gestor — onboarding é decisão do BPO, não do cliente/dono.
create policy onboarding_items_read on public.onboarding_items
  for select using (public.has_empresa_access(auth.uid(), "empresaId"));
create policy onboarding_items_write on public.onboarding_items
  for insert with check (public.is_gestor(auth.uid()));
create policy onboarding_items_update on public.onboarding_items
  for update using (public.is_gestor(auth.uid()));
create policy onboarding_items_delete on public.onboarding_items
  for delete using (public.is_gestor(auth.uid()));
