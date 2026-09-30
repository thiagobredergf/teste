import { createClient } from "@supabase/supabase-js";

// Fixos aqui em vez de lidos de variável de ambiente colada num painel
// (Vercel etc.) — já causou corrupção silenciosa duas vezes (espaço
// escondido, depois um caractere inválido no meio da chave, sem erro
// visível, só a requisição falhando sem sair do navegador). São valores
// públicos por natureza: a chave "anon"/"publishable" do Supabase é pra
// ficar exposta no navegador mesmo — a segurança vem das regras de acesso
// (RLS) no banco, não do segredo dela. Se um dia precisar apontar pra
// outro projeto Supabase, troque os valores aqui direto (via git), não
// numa variável de ambiente.
const SUPABASE_URL = "https://gkrvjwhcuynxlqkawrbe.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_jfVg4YiQjkI4-6Ut_rq9ZQ_tJBiscTF";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
