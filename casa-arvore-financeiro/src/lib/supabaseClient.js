import { createClient } from "@supabase/supabase-js";

// .trim() porque copiar/colar em painéis como o do Vercel às vezes traz
// espaço ou quebra de linha junto — isso corrompe a URL silenciosamente
// (o SDK não lança erro visível, só some sem nenhuma requisição de rede).
const url = (import.meta.env.VITE_SUPABASE_URL || "").trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

if (!url || !anonKey) {
  throw new Error(
    "Faltam VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copie .env.example para .env.local e preencha."
  );
}

export const supabase = createClient(url, anonKey);
