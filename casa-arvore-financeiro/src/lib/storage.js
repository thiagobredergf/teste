// Camada de persistência — Supabase (Postgres relacional), com RLS por dono.
//
// Cada empresa/conta/lançamento agora é uma linha de verdade numa tabela
// (não um blob JSON só). O Postgres já filtra sozinho o que cada usuário
// pode ver: gestor enxerga tudo, dono só enxerga as empresas atribuídas a
// ele em `empresa_owners` (ver supabase/fase3_multiempresa.sql).
//
// storageGet/storageSet/storageDelete mantêm a mesma assinatura de antes —
// App.jsx continua chamando "salva esse array inteiro" e aqui a gente
// traduz isso em upsert das linhas que mudaram + delete das que sumiram.

import { supabase } from "./supabaseClient";

const TABLE_NAMES = {
  empresas: "empresas",
  accounts: "accounts",
  payables: "payables",
  receivables: "receivables",
  bankEntries: "bankEntries",
  transfers: "transfers",
  fiscalObligations: "fiscalObligations",
  contacts: "contacts",
  documentUploads: "documentUploads",
};

// selectedEmpresa é só preferência de navegação de quem está olhando a
// tela agora — não é dado do negócio, então fica só no navegador local
// (senão a seleção de um gestor ficaria vazando pra tela dos outros).
const LOCAL_KEYS = new Set(["selectedEmpresa"]);
const LOCAL_PREFIX = "ca-financeiro:";

async function getCategories() {
  const { data, error } = await supabase.from("categories").select("codigo, nome, natureza");
  if (error) {
    console.error("storageGet categories falhou:", error);
    return null;
  }
  return {
    receitas: data.filter((c) => c.natureza === "receita").map(({ codigo, nome }) => ({ codigo, nome })),
    despesas: data.filter((c) => c.natureza === "despesa").map(({ codigo, nome }) => ({ codigo, nome })),
  };
}

async function setCategories(value) {
  const rows = [
    ...value.receitas.map((c) => ({ codigo: c.codigo, nome: c.nome, natureza: "receita" })),
    ...value.despesas.map((c) => ({ codigo: c.codigo, nome: c.nome, natureza: "despesa" })),
  ];
  const { data: existing, error: selErr } = await supabase.from("categories").select("codigo");
  if (selErr) {
    console.error("storageSet categories falhou ao ler existentes:", selErr);
    return false;
  }
  const newCodes = new Set(rows.map((r) => r.codigo));
  const toDelete = existing.filter((r) => !newCodes.has(r.codigo)).map((r) => r.codigo);
  if (toDelete.length) {
    const { error } = await supabase.from("categories").delete().in("codigo", toDelete);
    if (error) {
      console.error("storageSet categories falhou ao apagar:", error);
      return false;
    }
  }
  if (rows.length) {
    const { error } = await supabase.from("categories").upsert(rows);
    if (error) {
      console.error("storageSet categories falhou ao gravar:", error);
      return false;
    }
  }
  return true;
}

export async function storageGet(key) {
  if (LOCAL_KEYS.has(key)) {
    try {
      const raw = window.localStorage.getItem(LOCAL_PREFIX + key);
      return raw !== null ? { key, value: raw } : null;
    } catch (e) {
      console.error("storageGet local falhou:", e);
      return null;
    }
  }

  if (key === "categories") {
    const value = await getCategories();
    return value ? { key, value: JSON.stringify(value) } : null;
  }

  const table = TABLE_NAMES[key];
  if (!table) return null;
  const { data, error } = await supabase.from(table).select("*");
  if (error) {
    console.error(`storageGet(${key}) falhou:`, error);
    return null;
  }
  return { key, value: JSON.stringify(data) };
}

export async function storageSet(key, value) {
  if (LOCAL_KEYS.has(key)) {
    try {
      window.localStorage.setItem(LOCAL_PREFIX + key, value);
      return { key, value };
    } catch (e) {
      console.error("storageSet local falhou:", e);
      return null;
    }
  }

  if (key === "categories") {
    const ok = await setCategories(JSON.parse(value));
    return ok ? { key, value } : null;
  }

  const table = TABLE_NAMES[key];
  if (!table) return null;
  const newArray = JSON.parse(value);

  const { data: existing, error: selErr } = await supabase.from(table).select("id");
  if (selErr) {
    console.error(`storageSet(${key}) falhou ao ler existentes:`, selErr);
    return null;
  }
  const newIds = new Set(newArray.map((r) => r.id));
  const toDelete = existing.filter((r) => !newIds.has(r.id)).map((r) => r.id);

  if (toDelete.length) {
    const { error } = await supabase.from(table).delete().in("id", toDelete);
    if (error) {
      console.error(`storageSet(${key}) falhou ao apagar:`, error);
      return null;
    }
  }
  if (newArray.length) {
    // O upsert em lote do PostgREST exige que todo objeto de uma mesma
    // chamada tenha exatamente as mesmas colunas — senão devolve 400 e NADA
    // é salvo, nem os itens que estavam corretos. Isso acontecia sempre que
    // o array misturava linhas antigas (vindas do select("*"), com todas as
    // colunas) com uma linha nova recém-criada no formulário (só com os
    // campos que o usuário preencheu).
    //
    // Não dá pra simplesmente preencher toda coluna ausente com null: várias
    // têm "not null default" no banco (created_at, mas também
    // empresas.ativa, payables/receivables/bankEntries/transfers.conciliado,
    // etc.) — um null explícito SOBRESCREVE o default e viola o not-null,
    // derrubando o lote inteiro (foi exatamente isso que quebrou o
    // cadastro de uma 2ª empresa: a nova linha não tinha "ativa", a antiga
    // tinha, e o null enviado pra nova violou o not-null). Só omitir a
    // coluna inteiramente deixa o Postgres aplicar o default.
    //
    // Por isso created_at nunca é enviado (é metadado puro, nunca deve
    // voltar do cliente) e as demais linhas são agrupadas por "assinatura"
    // de colunas: cada grupo manda só as colunas que seus próprios
    // registros realmente têm, sem herdar coluna de outro registro do
    // array que por acaso já tinha esse campo preenchido.
    const OMIT_KEYS = new Set(["created_at"]);
    const groups = new Map();
    for (const row of newArray) {
      const keys = Object.keys(row).filter((k) => !OMIT_KEYS.has(k)).sort();
      const sig = keys.join("|");
      if (!groups.has(sig)) groups.set(sig, { keys, rows: [] });
      groups.get(sig).rows.push(row);
    }
    for (const { keys, rows } of groups.values()) {
      const normalized = rows.map((row) => {
        const complete = {};
        for (const k of keys) complete[k] = row[k] ?? null;
        return complete;
      });
      const { error } = await supabase.from(table).upsert(normalized);
      if (error) {
        console.error(`storageSet(${key}) falhou ao gravar:`, error);
        return null;
      }
    }
  }
  return { key, value };
}

export async function storageDelete(key) {
  if (LOCAL_KEYS.has(key)) {
    try {
      window.localStorage.removeItem(LOCAL_PREFIX + key);
      return { key, deleted: true };
    } catch (e) {
      console.error("storageDelete local falhou:", e);
      return null;
    }
  }
  return storageSet(key, JSON.stringify([]));
}
