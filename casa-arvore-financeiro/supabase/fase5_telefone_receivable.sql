-- Fase 5 (telefone do cliente em receivables): permite cobrança automática
-- por WhatsApp de recebível atrasado. Só em receivables por enquanto — o CRM
-- (casa-arvore-comercial) já manda o telefone do cliente quando uma venda
-- fecha; payables (fornecedor) não tem fonte de telefone hoje, fica pra
-- quando existir.
-- Rode no SQL Editor do Supabase (mesmo projeto das fases anteriores).

alter table public.receivables add column if not exists telefone text;
