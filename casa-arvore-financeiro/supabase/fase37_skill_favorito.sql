-- Fase 37: favoritar skills no Hub de Skills (destaque próprio do usuário,
-- separado do badge "Dados automáticos" que o sistema já calcula sozinho).
alter table public.bpo_skills add column if not exists favorito boolean not null default false;
