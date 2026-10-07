import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  LayoutDashboard, Wallet, ArrowDownCircle, ArrowUpCircle, Landmark,
  ArrowLeftRight, ListTree, Plus, X, Check, Trash2, Pencil, AlertTriangle,
  TrendingUp, TrendingDown, CircleDollarSign, ChevronDown, Search, Building2, FileText, Printer,
  CheckCircle2, Upload, HelpCircle, Users, Image as ImageIcon, ChevronLeft, ChevronRight, CalendarClock,
  Calendar, Bell, LogOut, Sparkles, Contact, Inbox, Link2, Copy, RotateCcw, ShieldCheck, MessageCircle, ClipboardList, Zap, CheckCheck, FileUp, Percent, Lock, Unlock, ListChecks, Play, Square, Download, Loader2
} from "lucide-react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";
import JSZip from "jszip";
import { storageGet, storageSet } from "./lib/storage";
import { supabase } from "./lib/supabaseClient";
import { buildCnab240Remessa, validarItensCnab } from "./lib/cnab240";

/* ---------------------------------------------------------------------- */
/*  Design tokens                                                         */
/* ---------------------------------------------------------------------- */
const COLORS = {
  bg: "#F6F5F1",
  panel: "#FFFFFF",
  ink: "#1C2622",
  inkSoft: "#5B6560",
  primary: "#1F3A34",
  primarySoft: "#2E5147",
  gold: "#B8912F",
  goldSoft: "#F1E6C8",
  green: "#2F7A55",
  greenSoft: "#E4F0E7",
  red: "#A8412C",
  redSoft: "#F5E3DE",
  border: "#E4E1D8",
  amber: "#B8792F",
  amberSoft: "#F3E7D2",
  blue: "#2F6E8C",
  blueSoft: "#DFEAF0",
};

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

// Plano de Contas: cada empresa tem sua própria lista (por segmento),
// agrupada num nível de "grupo" pra ficar comparável na DRE entre
// empresas de segmentos diferentes. A taxonomia de grupo é sempre a
// mesma; só a lista de contas analíticas dentro de cada grupo muda por
// segmento (ver PLANO_CONTAS_TEMPLATES). Fica de fora de propósito o que
// é balanço patrimonial (Ativo/Passivo/PL, Investimentos) — o sistema já
// representa isso via Contas/Contas a Pagar/Receber, não como categoria
// de lançamento.
const PLANO_CONTAS_GRUPOS = {
  receita: ["Receita Operacional", "Outras Receitas Operacionais", "Receitas Financeiras"],
  despesa: [
    "Deduções e Impostos sobre Vendas",
    "Custos Diretos (CMV / Serviços Prestados)",
    "Despesas com Pessoal",
    "Despesas de Ocupação",
    "Serviços de Terceiros e Tecnologia",
    "Marketing e Comercial",
    "Despesas Financeiras",
    "Outras Despesas",
  ],
};

// Chave "__generico" é o fallback pra qualquer segmento sem template
// dedicado ainda. As chaves com nome de segmento precisam bater exatamente
// com SEGMENTOS_EMPRESA. Os códigos de "Clínica / Consultório" abaixo são
// os mesmos já gravados no banco pelas duas empresas semeadas na fase 12
// — mudar um nome aqui não renomeia o que já existe, só afeta empresas
// novas desse segmento.
const PLANO_CONTAS_TEMPLATES = {
  "Clínica / Consultório": [
    { grupo: "Receita Operacional", codigo: "R1.01", nome: "Consultas Particulares", natureza: "receita" },
    { grupo: "Receita Operacional", codigo: "R1.02", nome: "Consultas via Convênios / Planos de Saúde", natureza: "receita" },
    { grupo: "Receita Operacional", codigo: "R1.03", nome: "Procedimentos Médicos e Cirurgias", natureza: "receita" },
    { grupo: "Receita Operacional", codigo: "R1.04", nome: "Exames e Diagnósticos", natureza: "receita" },
    { grupo: "Receita Operacional", codigo: "R1.05", nome: "Medicina Ocupacional", natureza: "receita" },
    { grupo: "Outras Receitas Operacionais", codigo: "R2.01", nome: "Locação de Salas / Consultórios", natureza: "receita" },
    { grupo: "Outras Receitas Operacionais", codigo: "R2.02", nome: "Venda de Vacinas / Medicamentos", natureza: "receita" },
    { grupo: "Outras Receitas Operacionais", codigo: "R2.03", nome: "Contratos de Gestão / Parcerias", natureza: "receita" },
    { grupo: "Receitas Financeiras", codigo: "R3.01", nome: "Rendimentos de Aplicações Financeiras", natureza: "receita" },
    { grupo: "Receitas Financeiras", codigo: "R3.02", nome: "Descontos Obtidos", natureza: "receita" },
    { grupo: "Deduções e Impostos sobre Vendas", codigo: "D1.01", nome: "Simples Nacional (DAS)", natureza: "despesa" },
    { grupo: "Deduções e Impostos sobre Vendas", codigo: "D1.02", nome: "ISS (Imposto Sobre Serviços)", natureza: "despesa" },
    { grupo: "Deduções e Impostos sobre Vendas", codigo: "D1.03", nome: "PIS / COFINS", natureza: "despesa" },
    { grupo: "Deduções e Impostos sobre Vendas", codigo: "D1.04", nome: "IRPJ / CSLL", natureza: "despesa" },
    { grupo: "Deduções e Impostos sobre Vendas", codigo: "D1.05", nome: "Tarifas de Cartão de Crédito / Débito", natureza: "despesa" },
    { grupo: "Deduções e Impostos sobre Vendas", codigo: "D1.06", nome: "Tarifas de Boletos Bancários", natureza: "despesa" },
    { grupo: "Deduções e Impostos sobre Vendas", codigo: "D1.07", nome: "Glosas de Convênios", natureza: "despesa" },
    { grupo: "Custos Diretos (CMV / Serviços Prestados)", codigo: "D2.01", nome: "Repasse a Médicos Parceiros / Plantonistas (PF)", natureza: "despesa" },
    { grupo: "Custos Diretos (CMV / Serviços Prestados)", codigo: "D2.02", nome: "Prestadores de Serviços Médicos (PJ)", natureza: "despesa" },
    { grupo: "Custos Diretos (CMV / Serviços Prestados)", codigo: "D2.03", nome: "Comissões da Recepção / Vendas", natureza: "despesa" },
    { grupo: "Custos Diretos (CMV / Serviços Prestados)", codigo: "D2.04", nome: "Descartáveis (Luvas, Seringas, Agulhas, Gazes)", natureza: "despesa" },
    { grupo: "Custos Diretos (CMV / Serviços Prestados)", codigo: "D2.05", nome: "Medicamentos e Anestésicos", natureza: "despesa" },
    { grupo: "Custos Diretos (CMV / Serviços Prestados)", codigo: "D2.06", nome: "Material de Higienização e Esterilização", natureza: "despesa" },
    { grupo: "Custos Diretos (CMV / Serviços Prestados)", codigo: "D2.07", nome: "Serviços de Lavanderia Hospitalar", natureza: "despesa" },
    { grupo: "Custos Diretos (CMV / Serviços Prestados)", codigo: "D2.08", nome: "Descarte de Lixo Hospitalar", natureza: "despesa" },
    { grupo: "Despesas com Pessoal", codigo: "D3.01", nome: "Salários e Ordenados (Recepção, Enfermagem, Administração)", natureza: "despesa" },
    { grupo: "Despesas com Pessoal", codigo: "D3.02", nome: "Pró-labore", natureza: "despesa" },
    { grupo: "Despesas com Pessoal", codigo: "D3.03", nome: "Encargos Sociais (INSS, FGTS)", natureza: "despesa" },
    { grupo: "Despesas com Pessoal", codigo: "D3.04", nome: "Benefícios (Vale-Transporte, Vale-Refeição, Plano de Saúde)", natureza: "despesa" },
    { grupo: "Despesas com Pessoal", codigo: "D3.05", nome: "Rescisões e Férias", natureza: "despesa" },
    { grupo: "Despesas de Ocupação", codigo: "D4.01", nome: "Aluguel do Imóvel", natureza: "despesa" },
    { grupo: "Despesas de Ocupação", codigo: "D4.02", nome: "Condomínio e IPTU", natureza: "despesa" },
    { grupo: "Despesas de Ocupação", codigo: "D4.03", nome: "Energia Elétrica e Água", natureza: "despesa" },
    { grupo: "Despesas de Ocupação", codigo: "D4.04", nome: "Telefone, Internet e Links de Dados", natureza: "despesa" },
    { grupo: "Despesas de Ocupação", codigo: "D4.05", nome: "Limpeza, Copa e Consumo Diário", natureza: "despesa" },
    { grupo: "Despesas de Ocupação", codigo: "D4.06", nome: "Manutenção de Infraestrutura", natureza: "despesa" },
    { grupo: "Serviços de Terceiros e Tecnologia", codigo: "D5.01", nome: "Assessoria Contábil", natureza: "despesa" },
    { grupo: "Serviços de Terceiros e Tecnologia", codigo: "D5.02", nome: "Assessoria Jurídica", natureza: "despesa" },
    { grupo: "Serviços de Terceiros e Tecnologia", codigo: "D5.03", nome: "Licença de Software de Gestão Médica (Prontuário/ERP)", natureza: "despesa" },
    { grupo: "Serviços de Terceiros e Tecnologia", codigo: "D5.04", nome: "Serviços de TI e Hospedagem em Nuvem", natureza: "despesa" },
    { grupo: "Serviços de Terceiros e Tecnologia", codigo: "D5.05", nome: "Licenças Médicas e Vigilância Sanitária (Anvisa, CRM, Alvarás)", natureza: "despesa" },
    { grupo: "Marketing e Comercial", codigo: "D6.01", nome: "Anúncios (Google Ads, Meta Ads)", natureza: "despesa" },
    { grupo: "Marketing e Comercial", codigo: "D6.02", nome: "Agência de Marketing / Redes Sociais", natureza: "despesa" },
    { grupo: "Marketing e Comercial", codigo: "D6.03", nome: "Identidade Visual e Material Impresso", natureza: "despesa" },
    { grupo: "Despesas Financeiras", codigo: "D7.01", nome: "Tarifas de Manutenção de Conta", natureza: "despesa" },
    { grupo: "Despesas Financeiras", codigo: "D7.02", nome: "Juros de Empréstimos e Financiamentos", natureza: "despesa" },
    { grupo: "Despesas Financeiras", codigo: "D7.03", nome: "Multas e Juros por Atraso", natureza: "despesa" },
    { grupo: "Outras Despesas", codigo: "D8.01", nome: "Aquisição de Equipamentos Médicos e Maquinário", natureza: "despesa" },
    { grupo: "Outras Despesas", codigo: "D8.02", nome: "Reformas e Benfeitorias no Imóvel", natureza: "despesa" },
  ],

  "Restaurante / Bar": [
    { grupo: "Receita Operacional", codigo: "R1.01", nome: "Vendas de Alimentos e Bebidas (Salão/Balcão)", natureza: "receita" },
    { grupo: "Receita Operacional", codigo: "R1.02", nome: "Vendas via Delivery (iFood, Rappi, etc.)", natureza: "receita" },
    { grupo: "Receitas Financeiras", codigo: "R3.01", nome: "Rendimentos de Aplicações Financeiras", natureza: "receita" },
    { grupo: "Receitas Financeiras", codigo: "R3.02", nome: "Descontos Obtidos", natureza: "receita" },
    { grupo: "Deduções e Impostos sobre Vendas", codigo: "D1.01", nome: "Simples Nacional / Impostos a Recolher", natureza: "despesa" },
    { grupo: "Deduções e Impostos sobre Vendas", codigo: "D1.02", nome: "Comissões de Plataformas de Delivery", natureza: "despesa" },
    { grupo: "Deduções e Impostos sobre Vendas", codigo: "D1.03", nome: "Taxas de Cartão de Crédito / Débito", natureza: "despesa" },
    { grupo: "Deduções e Impostos sobre Vendas", codigo: "D1.04", nome: "Taxas de Antecipação de Recebíveis", natureza: "despesa" },
    { grupo: "Deduções e Impostos sobre Vendas", codigo: "D1.05", nome: "Cancelamentos e Cortesias", natureza: "despesa" },
    { grupo: "Custos Diretos (CMV / Serviços Prestados)", codigo: "D2.01", nome: "Carnes e Proteínas", natureza: "despesa" },
    { grupo: "Custos Diretos (CMV / Serviços Prestados)", codigo: "D2.02", nome: "Pães e Hortifrúti", natureza: "despesa" },
    { grupo: "Custos Diretos (CMV / Serviços Prestados)", codigo: "D2.03", nome: "Bebidas e Outros Insumos", natureza: "despesa" },
    { grupo: "Custos Diretos (CMV / Serviços Prestados)", codigo: "D2.04", nome: "Embalagens e Descartáveis de Delivery", natureza: "despesa" },
    { grupo: "Despesas com Pessoal", codigo: "D3.01", nome: "Salários e Ordenados", natureza: "despesa" },
    { grupo: "Despesas com Pessoal", codigo: "D3.02", nome: "Pró-labore", natureza: "despesa" },
    { grupo: "Despesas com Pessoal", codigo: "D3.03", nome: "Freelancers / Diárias", natureza: "despesa" },
    { grupo: "Despesas com Pessoal", codigo: "D3.04", nome: "Provisão de Férias e 13º Salário", natureza: "despesa" },
    { grupo: "Despesas com Pessoal", codigo: "D3.05", nome: "Benefícios (Vale-Transporte, Alimentação)", natureza: "despesa" },
    { grupo: "Despesas com Pessoal", codigo: "D3.06", nome: "Treinamentos e Uniformes", natureza: "despesa" },
    { grupo: "Despesas com Pessoal", codigo: "D3.07", nome: "Sindicato e Encargos", natureza: "despesa" },
    { grupo: "Despesas de Ocupação", codigo: "D4.01", nome: "Aluguel e Condomínio", natureza: "despesa" },
    { grupo: "Despesas de Ocupação", codigo: "D4.02", nome: "IPTU", natureza: "despesa" },
    { grupo: "Despesas de Ocupação", codigo: "D4.03", nome: "Energia Elétrica", natureza: "despesa" },
    { grupo: "Despesas de Ocupação", codigo: "D4.04", nome: "Água e Esgoto", natureza: "despesa" },
    { grupo: "Despesas de Ocupação", codigo: "D4.05", nome: "Gás Comercial (GLP/Encanado)", natureza: "despesa" },
    { grupo: "Despesas de Ocupação", codigo: "D4.06", nome: "Seguros do Estabelecimento", natureza: "despesa" },
    { grupo: "Serviços de Terceiros e Tecnologia", codigo: "D5.01", nome: "Contabilidade", natureza: "despesa" },
    { grupo: "Serviços de Terceiros e Tecnologia", codigo: "D5.02", nome: "Assessoria Jurídica", natureza: "despesa" },
    { grupo: "Serviços de Terceiros e Tecnologia", codigo: "D5.03", nome: "Software de Frente de Caixa (PDV) e ERP", natureza: "despesa" },
    { grupo: "Marketing e Comercial", codigo: "D6.01", nome: "Anúncios Online (Meta Ads, Google Ads)", natureza: "despesa" },
    { grupo: "Marketing e Comercial", codigo: "D6.02", nome: "Promoções e Cupons nas Plataformas", natureza: "despesa" },
    { grupo: "Despesas Financeiras", codigo: "D7.01", nome: "Tarifas Bancárias", natureza: "despesa" },
    { grupo: "Despesas Financeiras", codigo: "D7.02", nome: "Juros e Multas por Atraso", natureza: "despesa" },
    { grupo: "Outras Despesas", codigo: "D8.01", nome: "Manutenção de Equipamentos e Utensílios", natureza: "despesa" },
    { grupo: "Outras Despesas", codigo: "D8.02", nome: "Aquisição de Equipamentos de Cozinha e Salão", natureza: "despesa" },
  ],

  // Fallback pra qualquer segmento sem template dedicado ainda.
  __generico: [
    { grupo: "Receita Operacional", codigo: "R1.01", nome: "Vendas de Produtos", natureza: "receita" },
    { grupo: "Receita Operacional", codigo: "R1.02", nome: "Prestação de Serviços", natureza: "receita" },
    { grupo: "Outras Receitas Operacionais", codigo: "R2.01", nome: "Aluguéis Recebidos", natureza: "receita" },
    { grupo: "Outras Receitas Operacionais", codigo: "R2.02", nome: "Outros Recebimentos", natureza: "receita" },
    { grupo: "Receitas Financeiras", codigo: "R3.01", nome: "Juros Recebidos", natureza: "receita" },
    { grupo: "Deduções e Impostos sobre Vendas", codigo: "D1.01", nome: "Impostos e Taxas", natureza: "despesa" },
    { grupo: "Custos Diretos (CMV / Serviços Prestados)", codigo: "D2.01", nome: "Fornecedores / Compras", natureza: "despesa" },
    { grupo: "Despesas com Pessoal", codigo: "D3.01", nome: "Salários e Pró-labore", natureza: "despesa" },
    { grupo: "Despesas de Ocupação", codigo: "D4.01", nome: "Aluguel", natureza: "despesa" },
    { grupo: "Despesas de Ocupação", codigo: "D4.02", nome: "Energia Elétrica", natureza: "despesa" },
    { grupo: "Despesas de Ocupação", codigo: "D4.03", nome: "Água e Saneamento", natureza: "despesa" },
    { grupo: "Despesas de Ocupação", codigo: "D4.04", nome: "Seguros", natureza: "despesa" },
    { grupo: "Serviços de Terceiros e Tecnologia", codigo: "D5.01", nome: "Internet e Telefone", natureza: "despesa" },
    { grupo: "Serviços de Terceiros e Tecnologia", codigo: "D5.02", nome: "Contabilidade", natureza: "despesa" },
    { grupo: "Marketing e Comercial", codigo: "D6.01", nome: "Marketing e Publicidade", natureza: "despesa" },
    { grupo: "Despesas Financeiras", codigo: "D7.01", nome: "Despesas Bancárias", natureza: "despesa" },
    { grupo: "Despesas Financeiras", codigo: "D7.02", nome: "Empréstimos e Financiamentos", natureza: "despesa" },
    { grupo: "Outras Despesas", codigo: "D8.01", nome: "Manutenção e Reparos", natureza: "despesa" },
    { grupo: "Outras Despesas", codigo: "D8.02", nome: "Material de Escritório", natureza: "despesa" },
    { grupo: "Outras Despesas", codigo: "D8.03", nome: "Frete e Logística", natureza: "despesa" },
    { grupo: "Outras Despesas", codigo: "D8.04", nome: "Combustível e Transporte", natureza: "despesa" },
    { grupo: "Outras Despesas", codigo: "D8.05", nome: "Outras Despesas", natureza: "despesa" },
  ],
};

function categoriaTemplateDoSegmento(segmento) {
  return PLANO_CONTAS_TEMPLATES[segmento] || PLANO_CONTAS_TEMPLATES.__generico;
}

const EMPRESA_CORES = ["#1F3A34", "#B8912F", "#2F6E8C", "#8C4A2F", "#5B4B8C", "#3E7A4C"];

const SEGMENTOS_EMPRESA = [
  "Restaurante / Bar",
  "Clínica / Consultório",
  "Salão de Beleza / Estética",
  "Academia / Esportes",
  "Bazar / Loja de Variedades",
  "E-commerce",
  "Farmácia",
  "Petshop / Veterinária",
  "Escritório de Advocacia",
  "Contabilidade",
  "Construção Civil",
  "Imobiliária",
  "Escola / Educação",
  "Hotel / Pousada",
  "Oficina Mecânica",
  "Distribuidora / Atacado",
  "Tecnologia / Software",
  "Consultoria",
  "Transportadora / Logística",
  "Outros",
];

// Regime tributário da empresa — usado pra sugerir automaticamente as
// obrigações fiscais que se aplicam a ela (ver FISCAL_RULES): Simples só
// paga o DAS, já Lucro Presumido/Real também têm IRPJ/CSLL/PIS/COFINS/INSS
// separados, por exemplo.
const REGIMES_TRIBUTARIOS = ["Simples Nacional", "MEI", "Lucro Presumido", "Lucro Real"];

// Principais bancos do Brasil (código + nome) — usados no cadastro de
// Contas pra padronizar o nome do banco (ajuda, por exemplo, a detecção
// automática de transferência entre contas na Conciliação Bancária).
const BANCOS_BRASIL = [
  { codigo: "001", nome: "Banco do Brasil" },
  { codigo: "033", nome: "Santander" },
  { codigo: "104", nome: "Caixa Econômica Federal" },
  { codigo: "237", nome: "Bradesco" },
  { codigo: "341", nome: "Itaú Unibanco" },
  { codigo: "260", nome: "Nubank" },
  { codigo: "077", nome: "Banco Inter" },
  { codigo: "336", nome: "C6 Bank" },
  { codigo: "756", nome: "Sicoob" },
  { codigo: "748", nome: "Sicredi" },
];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const todayISO = () => new Date().toISOString().slice(0, 10);
const confirmDelete = (msg) => window.confirm(msg);

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("Erro lendo o arquivo."));
    reader.readAsDataURL(file);
  });

// Chama a Edge Function de extração por IA — usada tanto quando o operador
// sobe um arquivo direto na tela (Contas a Pagar/Receber/Bancários) quanto
// quando processa um documento já recebido pelo link de upload sem login
// (tela Documentos Recebidos), sem duplicar a lógica de erro nas duas.
async function callExtractDocument(fileBase64, mediaType, context) {
  const { data, error } = await supabase.functions.invoke("extract-document", {
    body: { fileBase64, mediaType, context },
  });
  if (error) {
    // O supabase-js só põe uma mensagem genérica em error.message pra
    // respostas de erro — o motivo de verdade que a função devolveu fica
    // no corpo da resposta, acessível via error.context (um Response cru).
    let detail = error.message;
    if (error.context && typeof error.context.json === "function") {
      try {
        const body = await error.context.clone().json();
        if (body?.error) detail = body.error;
      } catch {
        // corpo não era JSON — mantém a mensagem genérica
      }
    }
    throw new Error(detail);
  }
  if (!data?.ok) throw new Error(data?.error || "Não consegui ler o documento.");
  // "truncated" só vem true no contexto "statement", quando o arquivo era
  // grande demais e a IA cortou no meio — o back-end já recorta pra devolver
  // só as linhas que fecharam por completo (ver salvageStatementLines).
  return { ...(data.extracted || {}), _truncated: !!data.truncated };
}

// Roda uma skill da Biblioteca (Hub de Skills) — o prompt já vem com as
// variáveis {{campo}} substituídas pelo texto que o gestor preencheu; a
// função escolhe o modelo pelo "tier" (economico/padrao) indicado na
// própria skill, sem o operador precisar escolher modelo manualmente.
async function callRunSkill(prompt, tier) {
  const { data, error } = await supabase.functions.invoke("run-skill", { body: { prompt, tier } });
  if (error) {
    let detail = error.message;
    if (error.context && typeof error.context.json === "function") {
      try {
        const body = await error.context.clone().json();
        if (body?.error) detail = body.error;
      } catch {
        // corpo não era JSON — mantém a mensagem genérica
      }
    }
    throw new Error(detail);
  }
  if (!data?.ok) throw new Error(data?.error || "Não consegui gerar a análise.");
  return data.resultado;
}

// Abre o WhatsApp Web/app com uma mensagem pronta pro celular cadastrado
// — sem precisar de API/credenciais do WhatsApp Business, é só o link
// público wa.me. Assume DDI 55 (Brasil) quando o número não vier com um.
function openWhatsApp(celular, message) {
  const digits = (celular || "").replace(/\D/g, "");
  if (!digits) return false;
  const phone = digits.length > 11 ? digits : `55${digits}`;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
  return true;
}

// Log de auditoria (dar baixa / cancelar baixa) — insert direto, fora do
// storageGet/storageSet genérico: esse log é só-inserção (a policy de RLS
// nem tem update/delete), então não pode passar pelo diff "apaga o que
// não vier no array" que storageSet faz pras outras tabelas.
async function logAudit(empresaId, entity, entityId, action, detail, userEmail) {
  const { error } = await supabase.from("auditLog").insert({
    id: `al-${uid()}`, empresaId, entity, entityId, action, detail, userEmail,
  });
  if (error) console.error("logAudit falhou:", error);
}

// Sobe pro Storage o arquivo que gerou a extração por IA num "Importar
// documento" — sem isso, o arquivo só existia como base64 na memória do
// navegador durante a importação e desaparecia depois (nem sobrevivia a
// trocar de computador antes de lançar). Não bloqueia o salvamento do
// lançamento se o upload falhar (rede instável, por ex.): o dado
// financeiro em si já está certo, só o anexo que fica faltando — por
// isso devolve null em vez de lançar, deixando quem chamou decidir.
async function abrirDocumentoLancamento(path) {
  const { data, error } = await supabase.storage.from("documentos-lancamentos").createSignedUrl(path, 300);
  if (error) { alert("Não consegui abrir o arquivo: " + error.message); return; }
  window.open(data.signedUrl, "_blank");
}

async function uploadDocumentoLancamento(empresaId, tipo, entidadeId, previewDoc) {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(previewDoc?.url || "");
  if (!match) return null;
  const [, mediaType, base64] = match;
  const ext = mediaType.split("/")[1]?.split("+")[0] || "bin";
  const path = `${empresaId}/${tipo}/${entidadeId}.${ext}`;
  try {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const { error } = await supabase.storage.from("documentos-lancamentos").upload(path, bytes, { contentType: mediaType, upsert: true });
    if (error) { console.error("upload de documento do lançamento falhou:", error); return null; }
    return path;
  } catch (e) {
    console.error("upload de documento do lançamento falhou:", e);
    return null;
  }
}

const TIPOS_DOCUMENTO_LANCAMENTO = ["payables", "receivables", "bankEntries", "transfers", "settlementPartners"];

// Lista, num único array, todo arquivo já guardado de uma empresa nos
// dois buckets (Documentos Recebidos + anexos de lançamento importados
// direto) — usado tanto pra exportar (zip) quanto pra apagar de vez, no
// fluxo de fim de contrato / LGPD.
async function listarDocumentosDaEmpresa(empresaId) {
  const arquivos = [];
  const { data: recebidos } = await supabase.storage.from("documentos-recebidos").list(empresaId, { limit: 1000 });
  (recebidos || []).filter((f) => f.id).forEach((f) => arquivos.push({ bucket: "documentos-recebidos", path: `${empresaId}/${f.name}`, nome: f.name }));
  for (const tipo of TIPOS_DOCUMENTO_LANCAMENTO) {
    const { data: lista } = await supabase.storage.from("documentos-lancamentos").list(`${empresaId}/${tipo}`, { limit: 1000 });
    (lista || []).filter((f) => f.id).forEach((f) => arquivos.push({ bucket: "documentos-lancamentos", path: `${empresaId}/${tipo}/${f.name}`, nome: `${tipo}-${f.name}` }));
  }
  return arquivos;
}

// Junta tudo num .zip e sobe pro Storage com link assinado (7 dias) — é
// esse link que vai pro dono/contador, por WhatsApp; signed URL do
// Supabase funciona pra qualquer um que tiver o link, sem precisar de
// login, até expirar, então não trava quem recebe pedindo senha pra
// baixar os documentos. Compartilhado entre a exportação completa (fim
// de contrato) e a exportação recortada por competência (fechamento
// mensal → contador).
async function zipESubirDocumentos(empresaId, arquivos, nomeArquivoBase) {
  if (arquivos.length === 0) return { total: 0, url: null };
  const zip = new JSZip();
  for (const arq of arquivos) {
    const { data: signed } = await supabase.storage.from(arq.bucket).createSignedUrl(arq.path, 60);
    if (!signed) continue;
    const res = await fetch(signed.signedUrl);
    if (!res.ok) continue;
    zip.file(arq.nome, await res.blob());
  }
  const zipBlob = await zip.generateAsync({ type: "blob" });
  const zipPath = `${empresaId}/${nomeArquivoBase}_${Date.now()}.zip`;
  const { error: upErr } = await supabase.storage.from("documentos-export").upload(zipPath, zipBlob, { contentType: "application/zip" });
  if (upErr) throw new Error(upErr.message);
  const { data: signedZip, error: signErr } = await supabase.storage.from("documentos-export").createSignedUrl(zipPath, 60 * 60 * 24 * 7);
  if (signErr) throw new Error(signErr.message);
  return { total: arquivos.length, url: signedZip.signedUrl };
}

async function gerarExportacaoDocumentos(empresa) {
  const arquivos = await listarDocumentosDaEmpresa(empresa.id);
  return zipESubirDocumentos(empresa.id, arquivos, "export");
}

// Só os anexos (comprovante/NF/boleto importado) dos lançamentos cuja
// competência bate com o mês sendo fechado — não o histórico inteiro da
// empresa (isso já existe em gerarExportacaoDocumentos, pro fim de
// contrato). "documentos-recebidos" (caixa de entrada) fica de fora de
// propósito: não tem vínculo com uma competência específica.
async function listarDocumentosDaCompetencia(empresaId, competencia, { payables, receivables, bankEntries, transfers }) {
  const idsPorTipo = {
    payables: new Set(payables.filter((p) => p.empresaId === empresaId && competenciaOf(PERIOD_DATE_FIELD.payables(p)) === competencia).map((p) => p.id)),
    receivables: new Set(receivables.filter((r) => r.empresaId === empresaId && competenciaOf(PERIOD_DATE_FIELD.receivables(r)) === competencia).map((r) => r.id)),
    bankEntries: new Set(bankEntries.filter((b) => b.empresaId === empresaId && competenciaOf(PERIOD_DATE_FIELD.bankEntries(b)) === competencia).map((b) => b.id)),
    transfers: new Set(transfers.filter((t) => t.empresaId === empresaId && competenciaOf(PERIOD_DATE_FIELD.transfers(t)) === competencia).map((t) => t.id)),
  };
  const arquivos = [];
  for (const tipo of ["payables", "receivables", "bankEntries", "transfers"]) {
    const { data: lista } = await supabase.storage.from("documentos-lancamentos").list(`${empresaId}/${tipo}`, { limit: 1000 });
    (lista || []).filter((f) => f.id).forEach((f) => {
      const id = f.name.split(".")[0];
      if (idsPorTipo[tipo].has(id)) arquivos.push({ bucket: "documentos-lancamentos", path: `${empresaId}/${tipo}/${f.name}`, nome: `${tipo}-${f.name}` });
    });
  }
  return arquivos;
}

async function gerarExportacaoDocumentosCompetencia(empresa, competencia, dados) {
  const arquivos = await listarDocumentosDaCompetencia(empresa.id, competencia, dados);
  return zipESubirDocumentos(empresa.id, arquivos, `export_${competencia}`);
}

// Apaga de vez os originais dos dois buckets — separado e manual de
// propósito: excluir documento de cliente é destrutivo, não deve rodar
// sozinho/automático, só depois que alguém confirmou que o dono já
// baixou o zip exportado.
async function apagarDocumentosDaEmpresa(empresaId) {
  const { data: recebidos } = await supabase.storage.from("documentos-recebidos").list(empresaId, { limit: 1000 });
  const pathsRecebidos = (recebidos || []).filter((f) => f.id).map((f) => `${empresaId}/${f.name}`);
  if (pathsRecebidos.length) await supabase.storage.from("documentos-recebidos").remove(pathsRecebidos);
  for (const tipo of TIPOS_DOCUMENTO_LANCAMENTO) {
    const { data: lista } = await supabase.storage.from("documentos-lancamentos").list(`${empresaId}/${tipo}`, { limit: 1000 });
    const paths = (lista || []).filter((f) => f.id).map((f) => `${empresaId}/${tipo}/${f.name}`);
    if (paths.length) await supabase.storage.from("documentos-lancamentos").remove(paths);
  }
}

const fmtBRL = (n) =>
  (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Sufixo textual com a quebra de juros/multa/desconto de uma baixa, pra
// descrições de extrato/relatório — "" quando não há nenhum dos três.
function fmtAdjustments(item) {
  const parts = [
    item.juros ? `juros ${fmtBRL(item.juros)}` : null,
    item.multa ? `multa ${fmtBRL(item.multa)}` : null,
    item.desconto ? `desconto ${fmtBRL(item.desconto)}` : null,
  ].filter(Boolean);
  return parts.length ? ` (${parts.join(" · ")})` : "";
}

const fmtDate = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const addMonthsISO = (iso, n) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1 + n, d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

const daysUntil = (iso) => {
  if (!iso) return Infinity;
  const a = new Date(todayISO() + "T00:00:00");
  const b = new Date(iso + "T00:00:00");
  return Math.round((b - a) / 86400000);
};

// Certificado vencido = empresa não emite nota — aviso com 30 dias de
// antecedência (mesma margem que a apostila recomenda), pra dar tempo de
// renovar antes de travar a operação.
const certificadoAlerta = (empresa) => {
  if (!empresa?.certificadoDigitalValidade) return null;
  const dias = daysUntil(empresa.certificadoDigitalValidade);
  if (dias < 0) return { nivel: "vencido", dias };
  if (dias <= 30) return { nivel: "vencendo", dias };
  return null;
};

// Mesma lógica do certificado, mas pro contrato de prestação de serviço
// do BPO com o cliente — 60 dias de antecedência (janela maior porque
// negociar renovação, ou preparar a saída/exportação de documentos por
// LGPD, leva mais tempo que renovar um certificado digital).
const contratoAlerta = (empresa) => {
  if (!empresa?.contratoVencimento) return null;
  const dias = daysUntil(empresa.contratoVencimento);
  if (dias < 0) return { nivel: "vencido", dias };
  if (dias <= 60) return { nivel: "vencendo", dias };
  return null;
};

// Checklist padrão de onboarding — baseado no roteiro de onboarding BPO
// (diagnóstico → acessos → equipe → go-live). Empresa nova já nasce com
// isso; empresa antiga ganha via botão "Gerar checklist" na tela
// Onboarding, caso o gestor queira usar nela também.
const ONBOARDING_FASES = [
  { key: "diagnostico", label: "Diagnóstico e Alinhamento", tone: "neutral" },
  { key: "acessos", label: "Acessos e Ferramentas", tone: "gold" },
  { key: "equipe", label: "Equipe e Cultura", tone: "blue" },
  { key: "golive", label: "Operação Assistida (Go-Live)", tone: "green" },
];
const ONBOARDING_CHECKLIST_PADRAO = [
  { fase: "diagnostico", titulo: "Plano de Contas definido/sugerido" },
  { fase: "diagnostico", titulo: "Calendário de obrigações fixas mapeado" },
  { fase: "diagnostico", titulo: "Regras de cobrança definidas" },
  { fase: "diagnostico", titulo: "Lista de fornecedores/clientes importada" },
  { fase: "acessos", titulo: "Certificado digital recebido" },
  { fase: "acessos", titulo: 'Acesso bancário "Operador" criado (sem senha master)' },
  { fase: "acessos", titulo: "ERP/sistema do cliente configurado (se houver)" },
  { fase: "acessos", titulo: "Canal oficial de comunicação definido" },
  { fase: "equipe", titulo: "Analista responsável alocado" },
  { fase: "equipe", titulo: "Apresentação oficial ao cliente feita" },
  { fase: "equipe", titulo: "Aprovador final (dono) identificado e com acesso criado" },
  { fase: "golive", titulo: "Primeira rotina executada com supervisão" },
  { fase: "golive", titulo: "Primeira validação semanal feita" },
  { fase: "golive", titulo: "Comando definitivo transferido pro BPO" },
];
// Puro — só monta as linhas. Quem grava é persist() (via onboardingItems
// no FinanceiroApp), pro estado local ficar sincronizado na hora — nada
// aqui chama supabase.from(...) direto, como o resto do app já faz.
function buildOnboardingChecklistRows(empresaId) {
  return ONBOARDING_CHECKLIST_PADRAO.map((item) => ({
    id: uid(), empresaId, fase: item.fase, titulo: item.titulo, status: "pendente",
  }));
}

const monthIndex = (iso) => (iso ? parseInt(iso.slice(5, 7), 10) - 1 : -1);
const yearOf = (iso) => (iso ? parseInt(iso.slice(0, 4), 10) : null);

const timeAgo = (iso) => {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d}d`;
  const mo = Math.floor(d / 30);
  return `há ${mo} ${mo > 1 ? "meses" : "mês"}`;
};

/* ---------------------------------------------------------------------- */
/*  Persistence                                                           */
/* ---------------------------------------------------------------------- */
const STORE_KEYS = {
  empresas: "empresas",
  accounts: "accounts",
  payables: "payables",
  receivables: "receivables",
  bankEntries: "bankEntries",
  transfers: "transfers",
  fiscalObligations: "fiscalObligations",
  contacts: "contacts",
  documentUploads: "documentUploads",
  categories: "categories",
  settlementPartners: "settlementPartners",
  periodLocks: "periodLocks",
  bpoTasks: "bpoTasks",
  timeSessions: "timeSessions",
  bpoSkills: "bpoSkills",
  skillRuns: "skillRuns",
  remessasCnab: "remessasCnab",
  onboardingItems: "onboardingItems",
  costCenters: "costCenters",
  selectedEmpresa: "selectedEmpresa",
};

async function loadAll() {
  const out = {};
  for (const [key, storageKey] of Object.entries(STORE_KEYS)) {
    try {
      const res = await storageGet(storageKey);
      out[key] = res ? JSON.parse(res.value) : null;
    } catch (e) {
      out[key] = null;
    }
  }
  return out;
}

async function saveKey(key, value) {
  try {
    const res = await storageSet(STORE_KEYS[key], JSON.stringify(value));
    return !!res;
  } catch (e) {
    console.error("Erro ao salvar", key, e);
    return false;
  }
}

// Fechamento mensal (Rotina): qual data de cada entidade representa o "mês"
// pra efeito de trava — não é sempre a mesma coluna, porque cada lista usa a
// própria data como referência principal.
const PERIOD_DATE_FIELD = {
  payables: (r) => r.dataLanc || r.vencimento,
  receivables: (r) => r.dataLanc || r.vencimento,
  bankEntries: (r) => r.data,
  transfers: (r) => r.data,
  fiscalObligations: (r) => r.vencimento,
};

const competenciaOf = (dateStr) => (dateStr || "").slice(0, 7);

// Telas que contam como "trabalho de rotina numa empresa" pro cronômetro
// automático — as operacionais do dia a dia mais o próprio Fechamento e a
// auditoria de Pendências daquela empresa. Visão Geral/Resumo/Painel/ADM/
// Relatórios/Hub de Skills ficam de fora: não são "rotina" de uma empresa
// específica.
const ROTINA_TRACK_VIEWS = new Set([
  "documentUploads", "reconciliation", "accounts", "contacts", "payables", "receivables",
  "bank", "transfers", "settlementPartners", "fiscal", "categories", "fechamento", "pendencias",
]);

// Recusa salvar qualquer linha nova/alterada/excluída cuja data caia dentro
// de um mês fechado daquela empresa — olha tanto a data antiga quanto a
// nova (pra ninguém contornar o fechamento só mudando a data do
// lançamento pra fora do mês travado). Se nada mudou de fato numa linha
// (mesmo conteúdo de antes), ela passa batido mesmo que esteja num mês
// fechado — senão toda gravação futura do array inteiro (ex.: adicionar 1
// lançamento novo em outro mês) esbarraria em meses fechados antigos que
// nem foram tocados.
function findLockedViolation(key, oldArray, newArray, periodLocks) {
  const dateFn = PERIOD_DATE_FIELD[key];
  if (!dateFn) return null;
  const lockedSet = new Set(
    periodLocks.filter((l) => !l.reabertoEm).map((l) => `${l.empresaId}|${l.competencia}`)
  );
  if (lockedSet.size === 0) return null;

  const oldById = new Map(oldArray.map((r) => [r.id, r]));
  for (const row of newArray) {
    const old = oldById.get(row.id);
    if (old && JSON.stringify(old) === JSON.stringify(row)) continue;
    const datesToCheck = old ? [dateFn(old), dateFn(row)] : [dateFn(row)];
    for (const d of datesToCheck) {
      const comp = competenciaOf(d);
      if (comp && lockedSet.has(`${row.empresaId}|${comp}`)) return { competencia: comp };
    }
  }
  const newIds = new Set(newArray.map((r) => r.id));
  for (const old of oldArray) {
    if (newIds.has(old.id)) continue;
    const comp = competenciaOf(dateFn(old));
    if (comp && lockedSet.has(`${old.empresaId}|${comp}`)) return { competencia: comp };
  }
  return null;
}

/* ---------------------------------------------------------------------- */
/*  Small UI primitives                                                   */
/* ---------------------------------------------------------------------- */
function Badge({ children, tone = "neutral" }) {
  const tones = {
    neutral: { bg: "#EEEDE7", fg: COLORS.inkSoft },
    green: { bg: COLORS.greenSoft, fg: COLORS.green },
    amber: { bg: COLORS.amberSoft, fg: COLORS.amber },
    red: { bg: COLORS.redSoft, fg: COLORS.red },
    gold: { bg: COLORS.goldSoft, fg: COLORS.gold },
    blue: { bg: COLORS.blueSoft, fg: COLORS.blue },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ background: t.bg, color: t.fg }}
    >
      {children}
    </span>
  );
}

function Card({ children, className = "", style = {} }) {
  return (
    <div
      className={`rounded-xl ${className}`}
      style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, ...style }}
    >
      {children}
    </div>
  );
}

function Button({ children, onClick, variant = "primary", type = "button", className = "", disabled, title, style }) {
  const base = "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
  const styles = {
    primary: { background: COLORS.primary, color: "#fff" },
    ghost: { background: "transparent", color: COLORS.primary, border: `1px solid ${COLORS.border}` },
    danger: { background: COLORS.redSoft, color: COLORS.red },
    subtle: { background: "#EFEEE8", color: COLORS.ink },
  };
  return (
    <button type={type} disabled={disabled} onClick={onClick} title={title} className={`${base} ${className}`} style={{ ...styles[variant], ...style }}>
      {children}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium" style={{ color: COLORS.inkSoft }}>{label}</span>
      {children}
    </label>
  );
}

// Largura total por padrão vem do style (não de uma classe w-full) de
// propósito: classe Tailwind "perde" de outra classe de largura dependendo
// da ordem em que o Tailwind as gera (não da ordem no className), então um
// className="w-44" num call site nunca conseguia vencer um w-full fixo
// aqui. Via style, o merge abaixo (props.style depois de inputStyle) sempre
// vence de forma previsível — pra um campo mais estreito, use style={{width}}.
const inputCls =
  "px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 transition-shadow bg-white";
const inputStyle = { border: `1px solid ${COLORS.border}`, width: "100%" };

function TextInput(props) {
  return <input {...props} className={`${inputCls} ${props.className || ""}`} style={{ ...inputStyle, ...(props.style || {}) }} />;
}
function Select(props) {
  return (
    <select {...props} className={`${inputCls} ${props.className || ""}`} style={{ ...inputStyle, ...(props.style || {}) }}>
      {props.children}
    </select>
  );
}

function Modal({ title, onClose, children, wide, xwide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(20,24,22,0.45)" }}>
      <div
        className={`w-full ${xwide ? "max-w-5xl" : wide ? "max-w-2xl" : "max-w-md"} rounded-2xl overflow-hidden max-h-[90vh] flex flex-col`}
        style={{ background: COLORS.panel }}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
          <h3 className="font-semibold text-base" style={{ color: COLORS.ink }}>{title}</h3>
          <button onClick={onClose} title="Fechar" className="p-1 rounded-md hover:bg-black/5">
            <X size={18} color={COLORS.inkSoft} />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// Preview do documento (imagem ou PDF) ao lado do formulário de
// confirmação de um lançamento extraído por IA — só existe enquanto o
// arquivo ainda está em memória (base64), então só aparece pra
// lançamentos recém-importados, nunca ao editar um já salvo.
function DocumentPreviewPanel({ doc }) {
  if (!doc) return null;
  return (
    <div className="rounded-lg overflow-hidden shrink-0 md:sticky md:top-0" style={{ border: `1px solid ${COLORS.border}`, background: "#FAFAF7", width: "100%", height: 420 }}>
      {doc.mediaType === "application/pdf" ? (
        <iframe src={doc.url} title="Documento" className="w-full h-full" style={{ border: "none" }} />
      ) : (
        <img src={doc.url} alt="Documento" className="w-full h-full object-contain" />
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <Icon size={28} color={COLORS.inkSoft} strokeWidth={1.5} />
      <p className="font-medium" style={{ color: COLORS.ink }}>{title}</p>
      {subtitle && <p className="text-sm max-w-xs" style={{ color: COLORS.inkSoft }}>{subtitle}</p>}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  App                                                                    */
/* ---------------------------------------------------------------------- */
function FinanceiroApp({ userEmail, onLogout }) {
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState(null); // "gestor" | "owner"
  const [view, setView] = useState("empresas");
  const [empresas, setEmpresas] = useState([]);
  // Nunca é "all" — o operador sempre trabalha dentro de UMA empresa por
  // vez (evita risco de lançar/classificar coisa na empresa errada). Pra
  // trocar de empresa, ele volta pro Cadastro (tela Empresas) e clica no
  // card da empresa desejada — não existe mais um seletor "Todas as
  // empresas" pairando pelas telas.
  const [selectedEmpresa, setSelectedEmpresa] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [payables, setPayables] = useState([]);
  const [receivables, setReceivables] = useState([]);
  const [bankEntries, setBankEntries] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [fiscalObligations, setFiscalObligations] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [documentUploads, setDocumentUploads] = useState([]);
  const [categories, setCategories] = useState([]);
  const [settlementPartners, setSettlementPartners] = useState([]);
  const [periodLocks, setPeriodLocks] = useState([]);
  const [bpoTasks, setBpoTasks] = useState([]);
  const [timeSessions, setTimeSessions] = useState([]);
  const [bpoSkills, setBpoSkills] = useState([]);
  const [skillRuns, setSkillRuns] = useState([]);
  const [remessasCnab, setRemessasCnab] = useState([]);
  const [onboardingItems, setOnboardingItems] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [saveError, setSaveError] = useState(null);
  const [navQuery, setNavQuery] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState(null); // { id, context, fileBase64, mediaType }
  const [inboxError, setInboxError] = useState("");

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userData?.user?.id)
        .maybeSingle();
      const myRole = profile?.role || "owner";
      setRole(myRole);

      const data = await loadAll();
      setEmpresas(data.empresas || []);
      setAccounts(data.accounts || []);
      setPayables(data.payables || []);
      setReceivables(data.receivables || []);
      setBankEntries(data.bankEntries || []);
      setTransfers(data.transfers || []);
      setFiscalObligations(data.fiscalObligations || []);
      setContacts(data.contacts || []);
      setDocumentUploads(data.documentUploads || []);
      setCategories(data.categories || []);
      setSettlementPartners(data.settlementPartners || []);
      setPeriodLocks(data.periodLocks || []);
      setBpoTasks(data.bpoTasks || []);
      setTimeSessions(data.timeSessions || []);
      setBpoSkills(data.bpoSkills || []);
      setSkillRuns(data.skillRuns || []);
      setRemessasCnab(data.remessasCnab || []);
      setOnboardingItems(data.onboardingItems || []);
      setCostCenters(data.costCenters || []);
      // Dono não tem visão consolidada entre empresas — pousa direto no
      // Resumo da empresa dele. Gestor pousa no Cadastro de Empresas (os
      // cards de todas), pra escolher com qual vai trabalhar.
      setSelectedEmpresa(myRole === "owner" ? (data.empresas || [])[0]?.id || null : null);
      setView(myRole === "owner" ? "resumo" : "empresas");
      setReady(true);
    })();
  }, []);

  // Fechamento mensal: antes de gravar qualquer array financeiro, checa se
  // alguma linha nova/alterada/excluída cai num mês já fechado da empresa
  // dela — se cair, recusa o save inteiro (nada é gravado) e mostra o
  // motivo, em vez de deixar passar e o operador só descobrir depois que
  // "sumiu" um lançamento do relatório fechado.
  const persist = useCallback(async (key, value, setter) => {
    const currentArray = { payables, receivables, bankEntries, transfers, fiscalObligations }[key];
    if (currentArray) {
      const violation = findLockedViolation(key, currentArray, value, periodLocks);
      if (violation) {
        setSaveError(`Não foi possível salvar: o mês ${violation.competencia} está fechado para esta empresa. Reabra o fechamento em "Rotina" antes de editar esse lançamento.`);
        return;
      }
    }
    setter(value);
    const ok = await saveKey(key, value);
    if (!ok) setSaveError("Não foi possível salvar agora. Suas alterações podem não persistir — tente novamente em instantes.");
    else setSaveError(null);
  }, [payables, receivables, bankEntries, transfers, fiscalObligations, periodLocks]);

  // Confirmação automática na data prevista: contas marcadas com
  // confirmarAutomaticamente que já bateram o vencimento dão baixa sozinhas,
  // na conta padrão escolhida no cadastro — sem esperar alguém clicar "Dar
  // baixa". Roda a cada carregamento/atualização dos arrays; é idempotente
  // porque, assim que uma conta é confirmada, ela vira "Pago"/"Recebido" e
  // deixa de bater no filtro abaixo, então não há risco de loop.
  useEffect(() => {
    if (!ready) return;
    const today = todayISO();
    const payDue = payables.filter((p) => p.confirmarAutomaticamente && !p.deletedAt && p.status !== "Pago" && p.contaPadraoId && (p.vencimento || "") <= today);
    const recDue = receivables.filter((r) => r.confirmarAutomaticamente && !r.deletedAt && r.status !== "Recebido" && r.contaPadraoId && (r.vencimento || "") <= today);
    if (payDue.length) {
      const dueIds = new Set(payDue.map((p) => p.id));
      persist("payables", payables.map((p) => (dueIds.has(p.id)
        ? { ...p, status: "Pago", dataPgto: p.vencimento, valorPago: p.valor, contaPgtoId: p.contaPadraoId }
        : p)), setPayables);
      payDue.forEach((p) => logAudit(p.empresaId, "payable", p.id, "baixa_automatica", `Confirmação automática no vencimento — ${p.fornecedor}${p.numeroDocumento ? ` · doc. ${p.numeroDocumento}` : ""} — ${fmtBRL(p.valor)} em ${fmtDate(p.vencimento)}`, "sistema"));
    }
    if (recDue.length) {
      const dueIds = new Set(recDue.map((r) => r.id));
      persist("receivables", receivables.map((r) => (dueIds.has(r.id)
        ? { ...r, status: "Recebido", dataReceb: r.vencimento, valorRecebido: r.valor, contaRecebId: r.contaPadraoId }
        : r)), setReceivables);
      recDue.forEach((r) => logAudit(r.empresaId, "receivable", r.id, "baixa_automatica", `Confirmação automática no vencimento — ${r.cliente}${r.numeroDocumento ? ` · doc. ${r.numeroDocumento}` : ""} — ${fmtBRL(r.valor)} em ${fmtDate(r.vencimento)}`, "sistema"));
    }
  }, [ready, payables, receivables, persist]);

  // Cronômetro automático: abre uma sessão em time_sessions quando o
  // usuário passa a ter uma empresa selecionada e está numa tela de
  // ROTINA_TRACK_VIEWS, e fecha quando isso deixa de ser verdade (mudou de
  // empresa, saiu pra uma tela não-operacional, ou é dono — que não tem
  // "rotina" cronometrada). Sem botão Iniciar/Pausar: é o próprio uso do
  // sistema que liga e desliga o relógio. Só uma sessão aberta por usuário
  // — trocar de empresa no meio do trabalho fecha sozinho a de antes.
  useEffect(() => {
    if (!ready || role === "owner") return;
    const devoContar = !!selectedEmpresa && ROTINA_TRACK_VIEWS.has(view);
    const aberta = timeSessions.find((s) => s.userEmail === userEmail && !s.fim);

    if (devoContar) {
      if (aberta && aberta.empresaId === selectedEmpresa) return;
      const agora = new Date().toISOString();
      const semAberta = timeSessions.filter((s) => !(s.userEmail === userEmail && !s.fim));
      const comAntigaFechada = aberta ? [...semAberta, { ...aberta, fim: agora }] : semAberta;
      persist("timeSessions", [...comAntigaFechada, { id: uid(), empresaId: selectedEmpresa, userEmail, inicio: agora }], setTimeSessions);
    } else if (aberta) {
      persist("timeSessions", timeSessions.map((s) => (s.id === aberta.id ? { ...s, fim: new Date().toISOString() } : s)), setTimeSessions);
    }
  }, [ready, role, selectedEmpresa, view, userEmail, timeSessions, persist]);

  // Toda empresa nova já nasce com o Plano de Contas do segmento dela
  // (ver PLANO_CONTAS_TEMPLATES) — sem isso a empresa ficaria sem
  // categoria nenhuma pra classificar lançamento até alguém cadastrar
  // uma por uma na mão.
  const saveEmpresas = useCallback((novasEmpresas) => {
    const empresaCriada = novasEmpresas.find((e) => !empresas.some((old) => old.id === e.id));
    persist("empresas", novasEmpresas, setEmpresas);
    if (empresaCriada) {
      const template = categoriaTemplateDoSegmento(empresaCriada.segmento);
      const novasCategorias = template.map((t) => ({
        id: `${empresaCriada.id}-${t.codigo}`,
        empresaId: empresaCriada.id,
        grupo: t.grupo,
        codigo: t.codigo,
        nome: t.nome,
        natureza: t.natureza,
      }));
      persist("categories", [...categories, ...novasCategorias], setCategories);
      persist("onboardingItems", [...onboardingItems, ...buildOnboardingChecklistRows(empresaCriada.id)], setOnboardingItems);
    }
  }, [empresas, categories, onboardingItems, persist]);

  // "Gerar checklist" na tela Onboarding — pra empresa que já existia antes
  // dessa feature (não ganhou o checklist sozinha na criação).
  const gerarOnboardingChecklist = useCallback((empresaId) => {
    persist("onboardingItems", [...onboardingItems, ...buildOnboardingChecklistRows(empresaId)], setOnboardingItems);
  }, [onboardingItems, persist]);

  const changeEmpresa = useCallback((id) => {
    setSelectedEmpresa(id);
    saveKey("selectedEmpresa", id);
  }, []);

  // Navegação genérica do menu (rail, painel de itens, botões "Ir para
  // Empresas"): ao voltar pra Cadastro de Empresas, a empresa selecionada é
  // esquecida de propósito — senão o operador clicava numa ação (lançamento,
  // fiscal, análise) sem escolher empresa e o sistema silenciosamente
  // reaproveitava a última empresa que ele tinha olhado. Visão Geral NÃO
  // entra mais nessa lista: ela mora dentro do mesmo Painel que
  // Resumo/Dashboard, e limpar a seleção ao clicar nela quebrava esses dois
  // vizinhos (voltavam "vazios" até escolher a empresa de novo).
  const goToView = useCallback((id) => {
    setView(id);
    if (id === "empresas") setSelectedEmpresa(null);
    // Sair de Fechamento/Pendências por qualquer outro caminho (menu,
    // busca) esquece a competência que estava em análise — evitar que uma
    // visita futura, direta, a Pendências reapareça presa num mês antigo.
    if (id !== "fechamento" && id !== "pendencias") setClosingCompetencia(null);
  }, []);

  // Fechamento mensal: "Fechar mês" (em Análise → Fechamento) não trava
  // de cara — leva pra Análise → Pendências, recortada pra essa
  // competência, pro operador ver o que falta (ou "não há pendência")
  // antes de confirmar. closingCompetencia é o que diferencia essa visita
  // "vindo de um fechamento" de uma navegação direta pelo menu (que mostra
  // a auditoria de sempre, sem recorte de mês).
  const [closingCompetencia, setClosingCompetencia] = useState(null);
  const solicitarFechamento = useCallback((competencia) => {
    setClosingCompetencia(competencia);
    setView("pendencias");
  }, []);
  const cancelarFechamento = useCallback(() => {
    setClosingCompetencia(null);
    setView("fechamento");
  }, []);
  // Depois de travar o mês, se a empresa tiver contato de contabilidade
  // cadastrado (Cadastros → Editar empresa), gera na hora o pacote só com
  // os anexos daquela competência e abre o WhatsApp pro contador —
  // automático, sem precisar passar pelo ADM/"Exportar documentos"
  // manualmente. Silencioso se não tiver contato cadastrado ou não houver
  // nenhum documento anexado nesse mês (nada pra mandar).
  const enviarDocumentosContador = useCallback(async (empresaId, competencia) => {
    const empresa = empresas.find((e) => e.id === empresaId);
    if (!empresa?.contabilidadeContato) return;
    try {
      const { total, url } = await gerarExportacaoDocumentosCompetencia(empresa, competencia, {
        payables, receivables, bankEntries, transfers,
      });
      if (total === 0) return;
      logAudit(empresaId, "empresa", empresaId, "exportar_documentos", `Gerou exportação com ${total} arquivo(s) do fechamento de ${fmtCompetencia(competencia)} pro contador`, userEmail);
      const mensagem = `Olá! Segue o pacote de documentos do fechamento de ${fmtCompetencia(competencia)} (${empresa.nome}) — ${total} arquivo(s). O link fica disponível por 7 dias:\n\n${url}`;
      openWhatsApp(empresa.contabilidadeContato, mensagem);
    } catch (err) {
      console.error("Falha ao gerar exportação de documentos pro contador:", err);
    }
  }, [empresas, payables, receivables, bankEntries, transfers, userEmail]);

  const fecharMes = useCallback((competencia) => {
    if (!confirmDelete(`Fechar ${fmtCompetencia(competencia)}? Depois de fechado, nenhum lançamento datado dentro desse mês (Contas a Pagar/Receber, Lançamentos Bancários, Transferências, Calendário Fiscal) poderá ser criado, editado, excluído ou baixado até reabrir.`)) return;
    const existing = periodLocks.find((l) => l.empresaId === selectedEmpresa && l.competencia === competencia);
    if (existing) {
      persist("periodLocks", periodLocks.map((l) => (l.id === existing.id
        ? { ...l, fechadoEm: new Date().toISOString(), fechadoPor: userEmail, reabertoEm: null, reabertoPor: null }
        : l)), setPeriodLocks);
    } else {
      persist("periodLocks", [...periodLocks, { id: uid(), empresaId: selectedEmpresa, competencia, fechadoEm: new Date().toISOString(), fechadoPor: userEmail }], setPeriodLocks);
    }
    enviarDocumentosContador(selectedEmpresa, competencia);
    setClosingCompetencia(null);
    setView("fechamento");
  }, [periodLocks, selectedEmpresa, userEmail, persist, enviarDocumentosContador]);
  const reabrirMes = useCallback((competencia) => {
    if (!confirmDelete(`Reabrir ${fmtCompetencia(competencia)}? Os lançamentos desse mês voltam a poder ser editados normalmente.`)) return;
    const existing = periodLocks.find((l) => l.empresaId === selectedEmpresa && l.competencia === competencia);
    if (!existing) return;
    persist("periodLocks", periodLocks.map((l) => (l.id === existing.id ? { ...l, reabertoEm: new Date().toISOString(), reabertoPor: userEmail } : l)), setPeriodLocks);
  }, [periodLocks, selectedEmpresa, userEmail, persist]);

  // Processa um documento já recebido pelo link de upload sem login: baixa
  // o arquivo do Storage, navega pra tela de destino e entrega o base64 já
  // pronto pra ela extrair com IA — o mesmo caminho que "Importar
  // documento" usa quando o arquivo vem direto do computador do operador.
  const processInboxDocument = async (upload, context) => {
    setInboxError("");
    try {
      const { data, error } = await supabase.storage.from("documentos-recebidos").createSignedUrl(upload.storagePath, 120);
      if (error) throw new Error(error.message);
      const res = await fetch(data.signedUrl);
      if (!res.ok) throw new Error("Não consegui baixar o arquivo.");
      const blob = await res.blob();
      const fileBase64 = await fileToBase64(blob);
      const viewFor = { payable: "payables", receivable: "receivables", bankEntry: "bank" }[context];
      setPendingImport({ id: upload.id, context, fileBase64, mediaType: upload.mediaType });
      setView(viewFor);
    } catch (err) {
      setInboxError(err?.message || "Erro ao processar o documento.");
    }
  };

  const handleImportProcessed = (uploadId) => {
    setPendingImport(null);
    persist("documentUploads", documentUploads.map((u) => (u.id === uploadId ? { ...u, status: "processado" } : u)), setDocumentUploads);
  };

  const inScope = useCallback(
    (item) => !item.deletedAt && item.empresaId === selectedEmpresa,
    [selectedEmpresa]
  );
  const empresasAtivas = useMemo(() => empresas.filter((e) => e.ativa !== false), [empresas]);
  const currentEmpresa = useMemo(() => empresas.find((e) => e.id === selectedEmpresa) || null, [empresas, selectedEmpresa]);
  const accountsF = useMemo(() => accounts.filter(inScope), [accounts, inScope]);
  const payablesF = useMemo(() => payables.filter(inScope), [payables, inScope]);
  const receivablesF = useMemo(() => receivables.filter(inScope), [receivables, inScope]);
  const bankEntriesF = useMemo(() => bankEntries.filter(inScope), [bankEntries, inScope]);
  const fiscalObligationsF = useMemo(() => fiscalObligations.filter(inScope), [fiscalObligations, inScope]);
  const transfersF = useMemo(() => transfers.filter(inScope), [transfers, inScope]);
  // Plano de Contas é por empresa desde a fase 12 — categoriesF é a lista
  // da empresa selecionada, já separada por natureza pros formulários de
  // Contas a Pagar/Receber.
  const categoriesF = useMemo(() => categories.filter(inScope), [categories, inScope]);
  const receitasF = useMemo(() => categoriesF.filter((c) => c.natureza === "receita"), [categoriesF]);
  const despesasF = useMemo(() => categoriesF.filter((c) => c.natureza === "despesa"), [categoriesF]);
  const allCategoryNames = useMemo(() => categoriesF.map((c) => c.nome), [categoriesF]);
  // Mesmo padrão do Plano de Contas — cadastro por empresa, usado tanto
  // na tela de gestão (abaixo do Plano de Contas) quanto no dropdown de
  // "Centro de Custo" dos formulários de Contas a Pagar/Receber.
  const costCentersF = useMemo(() => costCenters.filter(inScope), [costCenters, inScope]);

  /* ------------------------- derived calculations ---------------------- */
  const accountBalance = useCallback(
    (accId) => {
      const acc = accounts.find((a) => a.id === accId);
      if (!acc) return 0;
      const recIn = receivables
        .filter((r) => !r.deletedAt && r.status === "Recebido" && r.contaRecebId === accId)
        .reduce((s, r) => s + Number(r.valorRecebido || r.valor || 0), 0);
      const bankIn = bankEntries
        .filter((b) => !b.deletedAt && b.tipo === "Entrada" && b.contaId === accId)
        .reduce((s, b) => s + Number(b.valor || 0), 0);
      const transfIn = transfers
        .filter((t) => !t.deletedAt && t.contaDestinoId === accId)
        .reduce((s, t) => s + Number(t.valor || 0), 0);
      const payOut = payables
        .filter((p) => !p.deletedAt && p.status === "Pago" && p.contaPgtoId === accId)
        .reduce((s, p) => s + Number(p.valorPago || p.valor || 0), 0);
      const bankOut = bankEntries
        .filter((b) => !b.deletedAt && b.tipo === "Saída" && b.contaId === accId)
        .reduce((s, b) => s + Number(b.valor || 0), 0);
      const transfOut = transfers
        .filter((t) => !t.deletedAt && t.contaOrigemId === accId)
        .reduce((s, t) => s + Number(t.valor || 0), 0);
      // Obrigação fiscal com baixa dada também é dinheiro saindo da conta —
      // sem isso, pagar um DAS/FGTS pelo Calendário Fiscal não derrubava o
      // saldo em lugar nenhum do sistema (Contas, Resumo, Relatórios).
      const fiscalOut = fiscalObligations
        .filter((o) => !o.deletedAt && o.status === "Pago" && o.contaId === accId)
        .reduce((s, o) => s + Number(o.valor || 0), 0);
      return (
        Number(acc.saldoInicial || 0) + recIn + bankIn + transfIn - payOut - bankOut - transfOut - fiscalOut
      );
    },
    [accounts, receivables, bankEntries, transfers, payables, fiscalObligations]
  );

  const totalBalance = useMemo(
    () => accountsF.reduce((s, a) => s + accountBalance(a.id), 0),
    [accountsF, accountBalance]
  );

  // Saldo disponível = saldo atual da conta menos os pagamentos já
  // agendados/autorizados pra ela (que ainda não viraram baixa) — sem isso
  // o saldo "livre" mostrado em Contas/Resumo parece maior do que realmente
  // é quando já existe uma ordem de pagamento em andamento.
  const accountAvailableBalance = useCallback(
    (accId) => {
      const agendado = payables
        .filter((p) => !p.deletedAt && (p.status === "Agendado" || p.status === "Autorizado") && p.contaAgendadaId === accId)
        .reduce((s, p) => s + Number(p.valor || 0), 0);
      return accountBalance(accId) - agendado;
    },
    [payables, accountBalance]
  );

  const totalAvailableBalance = useMemo(
    () => accountsF.reduce((s, a) => s + accountAvailableBalance(a.id), 0),
    [accountsF, accountAvailableBalance]
  );

  // monthly realized cash flow for selected year: {entradas[12], saidas[12]}
  const buildMonthlyFlow = useCallback((recArr, payArr, bankArr, fiscalArr, yr) => {
    const entradas = Array(12).fill(0);
    const saidas = Array(12).fill(0);
    recArr.forEach((r) => {
      if (r.status === "Recebido" && yearOf(r.dataReceb) === yr) {
        entradas[monthIndex(r.dataReceb)] += Number(r.valorRecebido || r.valor || 0);
      }
    });
    bankArr.forEach((b) => {
      if (b.tipo === "Entrada" && yearOf(b.data) === yr) entradas[monthIndex(b.data)] += Number(b.valor || 0);
      if (b.tipo === "Saída" && yearOf(b.data) === yr) saidas[monthIndex(b.data)] += Number(b.valor || 0);
    });
    payArr.forEach((p) => {
      if (p.status === "Pago" && yearOf(p.dataPgto) === yr) {
        saidas[monthIndex(p.dataPgto)] += Number(p.valorPago || p.valor || 0);
      }
    });
    fiscalArr.forEach((o) => {
      if (o.status === "Pago" && yearOf(o.dataPagamento) === yr) {
        saidas[monthIndex(o.dataPagamento)] += Number(o.valor || 0);
      }
    });
    let acc = 0;
    const acumulado = entradas.map((e, i) => (acc += e - saidas[i]));
    return { entradas, saidas, acumulado };
  }, []);

  const monthlyFlow = useMemo(
    () => buildMonthlyFlow(receivablesF, payablesF, bankEntriesF, fiscalObligationsF, year),
    [receivablesF, payablesF, bankEntriesF, fiscalObligationsF, year, buildMonthlyFlow]
  );

  const empresaBreakdown = useMemo(() => {
    if (empresasAtivas.length === 0) return [];
    return empresasAtivas.map((emp) => {
      const recE = receivables.filter((r) => !r.deletedAt && r.empresaId === emp.id);
      const payE = payables.filter((p) => !p.deletedAt && p.empresaId === emp.id);
      const bankE = bankEntries.filter((b) => !b.deletedAt && b.empresaId === emp.id);
      const fiscalE = fiscalObligations.filter((o) => !o.deletedAt && o.empresaId === emp.id);
      const accE = accounts.filter((a) => a.empresaId === emp.id);
      const flow = buildMonthlyFlow(recE, payE, bankE, fiscalE, year);
      const entradas = flow.entradas.reduce((a, b) => a + b, 0);
      const saidas = flow.saidas.reduce((a, b) => a + b, 0);
      const saldoContas = accE.reduce((s, a) => s + accountBalance(a.id), 0);
      return { empresa: emp, entradas, saidas, saldo: entradas - saidas, saldoContas };
    });
  }, [empresasAtivas, receivables, payables, bankEntries, fiscalObligations, accounts, year, buildMonthlyFlow, accountBalance]);

  const totals = useMemo(() => {
    const totalEntradas = monthlyFlow.entradas.reduce((a, b) => a + b, 0);
    const totalSaidas = monthlyFlow.saidas.reduce((a, b) => a + b, 0);
    const saldo = totalEntradas - totalSaidas;
    const margem = totalEntradas > 0 ? saldo / totalEntradas : 0;
    return { totalEntradas, totalSaidas, saldo, margem };
  }, [monthlyFlow]);

  const categoryBreakdown = useMemo(() => {
    const map = {};
    payablesF.forEach((p) => {
      if (p.status !== "Pago") return;
      map[p.categoria] = map[p.categoria] || { pago: 0, aPagar: 0 };
      // Valor principal só — tira juros/multa/desconto do que foi de fato
      // pago, porque esses entram à parte no Resultado Financeiro do DRE
      // (não misturar custo financeiro dentro da categoria operacional).
      // Se "valor pago" tiver sido editado na mão além do que os 3 campos
      // calculariam, a diferença residual fica aqui mesmo — nunca some.
      map[p.categoria].pago += Number(p.valorPago ?? p.valor ?? 0) - Number(p.juros || 0) - Number(p.multa || 0) + Number(p.desconto || 0);
    });
    payablesF.forEach((p) => {
      if (p.status === "Pago") return;
      map[p.categoria] = map[p.categoria] || { pago: 0, aPagar: 0 };
      map[p.categoria].aPagar += Number(p.valor || 0);
    });
    return map;
  }, [payablesF]);

  const receivableBreakdown = useMemo(() => {
    const map = {};
    receivablesF.forEach((r) => {
      if (r.status !== "Recebido") return;
      map[r.categoria] = map[r.categoria] || { recebido: 0, aReceber: 0 };
      map[r.categoria].recebido += Number(r.valorRecebido ?? r.valor ?? 0) - Number(r.juros || 0) - Number(r.multa || 0) + Number(r.desconto || 0);
    });
    receivablesF.forEach((r) => {
      if (r.status === "Recebido") return;
      map[r.categoria] = map[r.categoria] || { recebido: 0, aReceber: 0 };
      map[r.categoria].aReceber += Number(r.valor || 0);
    });
    return map;
  }, [receivablesF]);

  // Resultado financeiro do período — juros/multa pagos e descontos
  // concedidos são custo financeiro; juros/multa recebidos e descontos
  // obtidos de fornecedor são ganho financeiro. Fica de fora do
  // categoryBreakdown/receivableBreakdown de propósito (ver acima), pra
  // aparecer como linha própria no DRE, igual um contador faria.
  const financialAdjustments = useMemo(() => {
    const paidPayables = payablesF.filter((p) => p.status === "Pago");
    const receivedReceivables = receivablesF.filter((r) => r.status === "Recebido");
    const despesas =
      paidPayables.reduce((s, p) => s + Number(p.juros || 0) + Number(p.multa || 0), 0) +
      receivedReceivables.reduce((s, r) => s + Number(r.desconto || 0), 0);
    const receitas =
      receivedReceivables.reduce((s, r) => s + Number(r.juros || 0) + Number(r.multa || 0), 0) +
      paidPayables.reduce((s, p) => s + Number(p.desconto || 0), 0);
    return { despesas, receitas, resultado: receitas - despesas };
  }, [payablesF, receivablesF]);

  const upcomingPayables = useMemo(
    () =>
      payablesF
        .filter((p) => p.status !== "Pago")
        .sort((a, b) => (a.vencimento || "").localeCompare(b.vencimento || ""))
        .slice(0, 6),
    [payablesF]
  );
  const upcomingReceivables = useMemo(
    () =>
      receivablesF
        .filter((r) => r.status !== "Recebido")
        .sort((a, b) => (a.vencimento || "").localeCompare(b.vencimento || ""))
        .slice(0, 6),
    [receivablesF]
  );

  const ACTIVITY_META = {
    payable: { icon: ArrowUpCircle, bg: COLORS.redSoft, fg: COLORS.red, label: "Conta a pagar" },
    receivable: { icon: ArrowDownCircle, bg: COLORS.greenSoft, fg: COLORS.green, label: "Conta a receber" },
    bank: { icon: Wallet, bg: COLORS.goldSoft, fg: COLORS.gold, label: "Lançamento bancário" },
    transfer: { icon: ArrowLeftRight, bg: "#EEEDE7", fg: COLORS.inkSoft, label: "Transferência" },
  };

  const empresaNome = useCallback(
    (id) => empresas.find((e) => e.id === id)?.nome || "",
    [empresas]
  );

  const recentActivity = useMemo(() => {
    const items = [
      ...payablesF.map((p) => ({ id: `p-${p.id}`, tipo: "payable", label: p.descricao || "Conta a pagar", sub: empresaNome(p.empresaId), valor: p.valor, data: p.created_at })),
      ...receivablesF.map((r) => ({ id: `r-${r.id}`, tipo: "receivable", label: r.descricao || "Conta a receber", sub: empresaNome(r.empresaId), valor: r.valor, data: r.created_at })),
      ...bankEntriesF.map((b) => ({ id: `b-${b.id}`, tipo: "bank", label: b.descricao || "Lançamento bancário", sub: empresaNome(b.empresaId), valor: b.valor, data: b.created_at })),
      ...transfersF.map((t) => ({ id: `t-${t.id}`, tipo: "transfer", label: t.descricao || "Transferência", sub: empresaNome(t.empresaId), valor: t.valor, data: t.created_at })),
    ].filter((i) => i.data);
    items.sort((a, b) => (b.data || "").localeCompare(a.data || ""));
    return items.slice(0, 8);
  }, [payablesF, receivablesF, bankEntriesF, transfersF, empresaNome]);

  // O que precisa de atenção na empresa aberta agora — documento recebido
  // ainda não classificado, ou fornecedor/cliente que entrou num
  // lançamento mas cujo cadastro (CPF/CNPJ, contato) nunca foi completado
  // (todo lançamento nasce com um Contato pareado pelo nome, mesmo que
  // vazio — não dá pra saber se falta cadastrar só pelo nome existir).
  const pendingDocs = useMemo(
    () => documentUploads.filter((u) => u.empresaId === selectedEmpresa && u.status !== "processado"),
    [documentUploads, selectedEmpresa]
  );
  const pendingContacts = useMemo(
    () => contacts.filter((c) => !c.deletedAt && c.empresaId === selectedEmpresa && !c.documento && !c.contato),
    [contacts, selectedEmpresa]
  );
  // Mesmos quatro critérios da auditoria completa (Análise →
  // Inconsistência/Pendências) — antes este painel só cobria os dois de
  // cima, então ficava "em branco" mesmo com pendência real (vencido,
  // não conciliado) esperando na empresa.
  // Cada contador de pendência abaixo tem sua própria tela de destino —
  // quebrados por origem (em vez de um "sem categoria"/"vencidos" único
  // somando pagar+receber+banco) justamente pra que clicar leve direto
  // pra onde a ação é feita, nunca pro relatório agregado de
  // Inconsistência/Pendências (que é só auditoria, sem ação nenhuma).
  const pendingBankSemCategoria = useMemo(
    () => bankEntriesF.filter((b) => !b.categoria || b.categoria === "A classificar").length,
    [bankEntriesF]
  );
  const pendingPayablesSemCategoria = useMemo(
    () => payablesF.filter((p) => !p.categoria).length,
    [payablesF]
  );
  const pendingReceivablesSemCategoria = useMemo(
    () => receivablesF.filter((r) => !r.categoria).length,
    [receivablesF]
  );
  const pendingNaoConciliados = useMemo(
    () => bankEntriesF.filter((b) => !b.conciliado).length
      + transfersF.filter((t) => !t.conciliado).length
      + payablesF.filter((p) => p.status === "Pago" && !p.conciliado).length
      + receivablesF.filter((r) => r.status === "Recebido" && !r.conciliado).length,
    [bankEntriesF, transfersF, payablesF, receivablesF]
  );
  const pendingPayablesVencidos = useMemo(
    () => payablesF.filter((p) => p.status !== "Pago" && (p.vencimento || "") < todayISO()).length,
    [payablesF]
  );
  const pendingReceivablesVencidos = useMemo(
    () => receivablesF.filter((r) => r.status !== "Recebido" && (r.vencimento || "") < todayISO()).length,
    [receivablesF]
  );

  if (!ready) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: COLORS.bg, minHeight: 480 }}>
        <p style={{ color: COLORS.inkSoft }} className="text-sm">Carregando sistema financeiro…</p>
      </div>
    );
  }

  const nav = [
    { id: "empresas", label: "Empresas", icon: Building2 },
    ...(role === "gestor" ? [{ id: "gestor", label: "Visão Geral", icon: Users }] : []),
    { id: "resumo", label: "Resumo", icon: CalendarClock },
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    ...(role !== "owner" ? [{ id: "accounts", label: "Contas", icon: Landmark }] : []),
    ...(role !== "owner" ? [{ id: "contacts", label: "Contatos", icon: Contact }] : []),
    { id: "payables", label: role === "owner" ? "Agendamentos" : "Contas a Pagar", icon: ArrowUpCircle },
    ...(role !== "owner" ? [{ id: "receivables", label: "Contas a Receber", icon: ArrowDownCircle }] : []),
    ...(role !== "owner" ? [{ id: "bank", label: "Lançamentos Bancários", icon: Wallet }] : []),
    ...(role !== "owner" ? [{ id: "transfers", label: "Transferências", icon: ArrowLeftRight }] : []),
    ...(role !== "owner" ? [{ id: "fiscal", label: "Calendário Fiscal", icon: Calendar }] : []),
    ...(role !== "owner" ? [{ id: "categories", label: "Plano de Contas", icon: ListTree }] : []),
    ...(role !== "owner" ? [{ id: "reconciliation", label: "Conciliação Bancária", icon: CheckCircle2 }] : []),
    ...(role !== "owner" ? [{ id: "settlementPartners", label: "Repasses de Terceiros", icon: Percent }] : []),
    ...(role === "gestor" ? [{ id: "pendencias", label: "Inconsistência/Pendências", icon: AlertTriangle }] : []),
    ...(role === "gestor" ? [{ id: "fechamento", label: "Fechamento", icon: ListChecks }] : []),
    ...(role === "gestor" ? [{ id: "onboarding", label: "Onboarding", icon: ClipboardList }] : []),
    ...(role === "gestor" ? [{ id: "hubSkills", label: "Hub de Skills", icon: Zap }] : []),
    ...(role === "gestor" ? [{ id: "reports", label: "Relatórios", icon: FileText }] : []),
    { id: "documentUploads", label: "Documentos Recebidos", icon: Inbox },
    ...(role === "gestor" ? [{ id: "lixeira", label: "Lixeira", icon: Trash2 }] : []),
    ...(role === "gestor" ? [{ id: "adm", label: "ADM", icon: ShieldCheck }] : []),
    ...(role === "gestor" ? [{ id: "produtividade", label: "Produtividade", icon: TrendingUp }] : []),
  ];
  const navById = Object.fromEntries(nav.map((n) => [n.id, n]));

  const RAIL_SECTIONS = [
    { id: "cadastros", label: "Cadastros", icon: Building2, items: ["empresas"] },
    // Visão Geral (portfólio do gestor) vive dentro do Painel, junto de
    // Resumo/Dashboard — não é mais uma trilha própria.
    { id: "painel", label: "Painel", icon: LayoutDashboard, items: [...(role === "gestor" ? ["gestor"] : []), "resumo", "dashboard"] },
    // Rotina: operações do dia a dia do BPO — Gestor e Operador.
    ...(role !== "owner" ? [{
      id: "rotina", label: "Rotina", icon: ListChecks,
      items: ["documentUploads", "reconciliation", "accounts", "contacts", "payables", "receivables", "bank", "transfers", "settlementPartners", "fiscal", "categories"],
    }] : []),
    // Análise: supervisão e auditoria — só Gestor.
    ...(role === "gestor" ? [{
      id: "analise", label: "Análise", icon: FileText,
      items: ["fechamento", "onboarding", "pendencias", "reports", "hubSkills", "lixeira"],
    }] : []),
    // Acompanhamento: o que o Dono/Sócio acompanha da própria empresa.
    ...(role === "owner" ? [{ id: "acompanhamento", label: "Acompanhamento", icon: Inbox, items: ["documentUploads", "payables"] }] : []),
    ...(role === "gestor" ? [{ id: "admSecao", label: "ADM", icon: ShieldCheck, items: ["adm", "produtividade"] }] : []),
  ].map((s) => ({ ...s, items: s.items.map((id) => navById[id]).filter(Boolean) }));

  const activeSection = RAIL_SECTIONS.find((s) => s.items.some((n) => n.id === view)) || RAIL_SECTIONS[0];
  const searching = navQuery.trim().length > 0;
  const panelItems = searching
    ? nav.filter((n) => n.label.toLowerCase().includes(navQuery.trim().toLowerCase()))
    : activeSection.items;

  const initials = (userEmail || "?").slice(0, 2).toUpperCase();
  const dueSoonCount = [...upcomingPayables, ...upcomingReceivables].filter((i) => daysUntil(i.vencimento) <= 3).length;

  return (
    <div className="w-full flex" style={{ background: COLORS.bg, minHeight: 640, fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
      {/* Trilha de ícones */}
      <aside className="w-16 shrink-0 flex flex-col items-center py-5 gap-1 print:hidden" style={{ background: COLORS.panel, borderRight: `1px solid ${COLORS.border}` }}>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center mb-4 shrink-0"
          style={{ background: COLORS.primary }}
          title="ESEK"
        >
          <Sparkles size={17} color="#fff" />
        </div>
        {RAIL_SECTIONS.map((s) => {
          const Icon = s.icon;
          const first = s.items[0];
          const active = !searching && activeSection.id === s.id;
          if (!first) return null;
          return (
            <button
              key={s.id}
              onClick={() => { setNavQuery(""); goToView(first.id); }}
              title={s.label}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
              style={{ background: active ? COLORS.greenSoft : "transparent", color: active ? COLORS.primary : COLORS.inkSoft }}
            >
              <Icon size={18} />
            </button>
          );
        })}
      </aside>

      {/* Painel de navegação */}
      <aside className="w-60 shrink-0 flex flex-col py-5 px-3 gap-1 print:hidden" style={{ background: COLORS.panel, borderRight: `1px solid ${COLORS.border}` }}>
        <div className="px-2 pb-3">
          <p className="font-semibold text-[15px] leading-tight" style={{ color: COLORS.ink }}>ESEK</p>
          <p className="text-[13px]" style={{ color: COLORS.inkSoft }}>Gestão Financeira</p>
        </div>
        <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: COLORS.inkSoft }}>
          {searching ? "Resultados" : activeSection.label}
        </p>
        {panelItems.length === 0 && (
          <p className="px-2.5 text-sm" style={{ color: COLORS.inkSoft }}>Nada encontrado.</p>
        )}
        {panelItems.map((n) => {
          const Icon = n.icon;
          const active = view === n.id;
          return (
            <button
              key={n.id}
              onClick={() => goToView(n.id)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors"
              style={{
                background: active ? COLORS.greenSoft : "transparent",
                color: active ? COLORS.primary : COLORS.inkSoft,
                fontWeight: active ? 600 : 500,
              }}
            >
              <Icon size={16} />
              {n.label}
            </button>
          );
        })}
      </aside>

      {/* Coluna principal: topo + conteúdo + atividade recente */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header
          className="flex items-center gap-4 px-6 py-3 shrink-0 print:hidden"
          style={{ background: COLORS.panel, borderBottom: `1px solid ${COLORS.border}` }}
        >
          <div className="relative flex-1 max-w-sm">
            <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: COLORS.inkSoft }} />
            <input
              value={navQuery}
              onChange={(e) => setNavQuery(e.target.value)}
              placeholder="Buscar no menu…"
              className="w-full text-sm rounded-lg pl-8 pr-3 py-2 outline-none"
              style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.ink }}
            />
          </div>
          <div className="flex-1" />
          {/* Identificação de qual empresa está ativa — sempre visível, pra
              nunca ter dúvida em qual empresa a ação vai cair. Pra trocar,
              o operador só consegue indo em Empresas e clicando noutro
              card (não existe mais um seletor rápido aqui). */}
          {view === "gestor" ? (
            <span className="text-sm font-medium px-3 py-1.5 rounded-lg" style={{ background: COLORS.bg, color: COLORS.inkSoft }}>
              Visão Geral · Todas as empresas
            </span>
          ) : view !== "empresas" && currentEmpresa && (
            <button
              onClick={() => goToView("empresas")}
              title="Trocar de empresa"
              className="flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg hover:opacity-80 transition-opacity"
              style={{ background: COLORS.greenSoft, color: COLORS.primary }}
            >
              {currentEmpresa.logoUrl ? (
                <img src={currentEmpresa.logoUrl} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
              ) : (
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: currentEmpresa.cor }} />
              )}
              {currentEmpresa.nome}
              <ChevronDown size={13} />
            </button>
          )}
          <button
            onClick={() => setView("resumo")}
            className="relative w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: COLORS.bg }}
            title="Próximos vencimentos"
          >
            <Bell size={16} color={COLORS.inkSoft} />
            {dueSoonCount > 0 && (
              <span
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-semibold text-white"
                style={{ background: COLORS.red }}
              >
                {dueSoonCount > 9 ? "9+" : dueSoonCount}
              </span>
            )}
          </button>
          <div className="relative">
            <button onClick={() => setUserMenuOpen((v) => !v)} title="Menu do usuário" className="flex items-center gap-2">
              <span
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
                style={{ background: COLORS.primary }}
              >
                {initials}
              </span>
              <ChevronDown size={14} color={COLORS.inkSoft} />
            </button>
            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                <div
                  className="absolute right-0 top-11 z-20 w-56 rounded-xl overflow-hidden"
                  style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, boxShadow: "0 8px 24px rgba(20,24,22,0.12)" }}
                >
                  <p className="px-3.5 py-3 text-[13px] truncate" style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
                    {userEmail}
                  </p>
                  <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-2 px-3.5 py-2.5 text-sm text-left"
                    style={{ color: COLORS.red }}
                  >
                    <LogOut size={15} /> Sair
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <div className="flex-1 min-w-0 flex">
          <main className="flex-1 min-w-0 p-6 space-y-5">
            {saveError && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: COLORS.redSoft, color: COLORS.red }}>
                <AlertTriangle size={15} /> {saveError}
              </div>
            )}

            {empresas.length === 0 && view !== "empresas" ? (
          <Card className="p-8">
            <EmptyState
              icon={Building2}
              title={role === "gestor" ? "Cadastre a primeira empresa do grupo" : "Nenhuma empresa liberada pra você ainda"}
              subtitle={role === "gestor"
                ? "Cada empresa (Casarão, Casa Pôr do Sol, Vai da Praia...) tem suas próprias contas e lançamentos, separados dentro do mesmo sistema."
                : "Peça pro gestor te dar acesso a uma empresa."}
            />
            {role === "gestor" && (
              <div className="flex justify-center mt-2">
                <Button onClick={() => goToView("empresas")}><Plus size={15} /> Cadastrar empresa</Button>
              </div>
            )}
          </Card>
        ) : !selectedEmpresa && view !== "empresas" && view !== "gestor" ? (
          <Card className="p-8">
            <EmptyState
              icon={Building2}
              title="Selecione uma empresa"
              subtitle="Escolha o card da empresa que você quer trabalhar, em Cadastros, antes de continuar."
            />
            <div className="flex justify-center mt-2">
              <Button onClick={() => goToView("empresas")}><Building2 size={15} /> Ir para Empresas</Button>
            </div>
          </Card>
        ) : (
          <>
            {view === "gestor" && (
              <GestorDashboard
                empresas={empresasAtivas}
                empresaBreakdown={empresaBreakdown}
                year={year}
                documentUploads={documentUploads}
                onOpenEmpresa={(id) => { changeEmpresa(id); setView("resumo"); }}
              />
            )}

            {view === "resumo" && (
              <ResumoView
                accounts={accountsF}
                payables={payablesF}
                receivables={receivablesF}
                bankEntries={bankEntriesF}
                transfers={transfersF}
                accountBalance={accountBalance}
                totalBalance={totalBalance}
                accountAvailableBalance={accountAvailableBalance}
                totalAvailableBalance={totalAvailableBalance}
                goToView={goToView}
              />
            )}

            {view === "dashboard" && (
              <Dashboard
                year={year}
                setYear={setYear}
                totals={totals}
                monthlyFlow={monthlyFlow}
                accounts={accountsF}
                accountBalance={accountBalance}
                totalBalance={totalBalance}
                categoryBreakdown={categoryBreakdown}
                receivableBreakdown={receivableBreakdown}
                upcomingPayables={upcomingPayables}
                upcomingReceivables={upcomingReceivables}
              />
            )}

            {view === "empresas" && (
              <EmpresasView
                empresas={empresas}
                role={role}
                documentUploads={documentUploads}
                onSave={saveEmpresas}
                onOpenAccounts={(id) => { changeEmpresa(id); setView("accounts"); }}
                onOpenContacts={(id) => { changeEmpresa(id); setView("contacts"); }}
                onOpenEmpresa={(id) => { changeEmpresa(id); setView("resumo"); }}
                userEmail={userEmail}
              />
            )}

            {view === "accounts" && (
              <AccountsView
                accounts={accounts}
                empresas={empresas}
                selectedEmpresa={selectedEmpresa}
                accountBalance={accountBalance}
                accountAvailableBalance={accountAvailableBalance}
                onSave={(v) => persist("accounts", v, setAccounts)}
              />
            )}

            {view === "contacts" && (
              <ContactsView
                contacts={contacts}
                empresas={empresas}
                selectedEmpresa={selectedEmpresa}
                onSave={(v) => persist("contacts", v, setContacts)}
              />
            )}

            {view === "payables" && (
              <PayablesView
                payables={payables}
                accounts={accounts}
                empresas={empresas}
                selectedEmpresa={selectedEmpresa}
                categories={despesasF}
                costCenters={costCentersF}
                contacts={contacts}
                onSaveContacts={(v) => persist("contacts", v, setContacts)}
                onSave={(v) => persist("payables", v, setPayables)}
                pendingImport={pendingImport?.context === "payable" ? pendingImport : null}
                onImportProcessed={handleImportProcessed}
                userEmail={userEmail}
                canEdit={role !== "owner"}
                role={role}
                remessasCnab={remessasCnab}
                onSaveAccounts={(v) => persist("accounts", v, setAccounts)}
                onSaveRemessasCnab={(v) => persist("remessasCnab", v, setRemessasCnab)}
              />
            )}

            {view === "receivables" && (
              <ReceivablesView
                receivables={receivables}
                accounts={accounts}
                empresas={empresas}
                selectedEmpresa={selectedEmpresa}
                categories={receitasF}
                costCenters={costCentersF}
                contacts={contacts}
                onSaveContacts={(v) => persist("contacts", v, setContacts)}
                onSave={(v) => persist("receivables", v, setReceivables)}
                pendingImport={pendingImport?.context === "receivable" ? pendingImport : null}
                onImportProcessed={handleImportProcessed}
                userEmail={userEmail}
                canEdit={role !== "owner"}
              />
            )}

            {view === "bank" && (
              <BankEntriesView
                entries={bankEntries}
                accounts={accounts}
                empresas={empresas}
                selectedEmpresa={selectedEmpresa}
                categories={allCategoryNames}
                onSave={(v) => persist("bankEntries", v, setBankEntries)}
                pendingImport={pendingImport?.context === "bankEntry" ? pendingImport : null}
                onImportProcessed={handleImportProcessed}
                canEdit={role !== "owner"}
              />
            )}

            {view === "transfers" && (
              <TransfersView
                transfers={transfers}
                accounts={accounts}
                empresas={empresas}
                selectedEmpresa={selectedEmpresa}
                onSave={(v) => persist("transfers", v, setTransfers)}
                canEdit={role !== "owner"}
              />
            )}

            {view === "fiscal" && (
              <FiscalView
                obligations={fiscalObligations}
                accounts={accounts}
                empresas={empresasAtivas}
                selectedEmpresa={selectedEmpresa}
                onSave={(v) => persist("fiscalObligations", v, setFiscalObligations)}
                userEmail={userEmail}
                readOnly={role !== "gestor"}
              />
            )}

            {view === "categories" && (
              <CategoriesView
                categories={categories}
                costCenters={costCenters}
                selectedEmpresa={selectedEmpresa}
                currentEmpresa={currentEmpresa}
                readOnly={role !== "gestor"}
                onSave={(v) => persist("categories", v, setCategories)}
                onSaveCostCenters={(v) => persist("costCenters", v, setCostCenters)}
              />
            )}

            {view === "reconciliation" && (
              <ReconciliationView
                accounts={accountsF}
                payables={payables}
                receivables={receivables}
                bankEntries={bankEntries}
                transfers={transfers}
                categories={allCategoryNames}
                despesaCategorias={despesasF}
                receitaCategorias={receitasF}
                contacts={contacts}
                onSaveContacts={(v) => persist("contacts", v, setContacts)}
                onSavePayables={(v) => persist("payables", v, setPayables)}
                onSaveReceivables={(v) => persist("receivables", v, setReceivables)}
                onSaveBankEntries={(v) => persist("bankEntries", v, setBankEntries)}
                onSaveTransfers={(v) => persist("transfers", v, setTransfers)}
              />
            )}

            {view === "settlementPartners" && (
              <SettlementPartnersView
                partners={settlementPartners}
                accounts={accountsF}
                empresaId={selectedEmpresa}
                despesaCategorias={despesasF}
                receitaCategorias={receitasF}
                contacts={contacts}
                payables={payables}
                receivables={receivables}
                onSavePartners={(v) => persist("settlementPartners", v, setSettlementPartners)}
                onSaveContacts={(v) => persist("contacts", v, setContacts)}
                onSavePayables={(v) => persist("payables", v, setPayables)}
                onSaveReceivables={(v) => persist("receivables", v, setReceivables)}
              />
            )}

            {view === "pendencias" && (
              <PendenciasView
                payables={payables}
                receivables={receivables}
                bankEntries={bankEntries}
                transfers={transfers}
                empresaId={selectedEmpresa}
                empresaNome={currentEmpresa?.nome}
                empresa={currentEmpresa}
                competenciaFechamento={closingCompetencia}
                onFecharMes={fecharMes}
                onCancelarFechamento={cancelarFechamento}
              />
            )}

            {view === "fechamento" && (
              <RotinaView
                periodLocks={periodLocks}
                tasks={bpoTasks}
                fiscalObligations={fiscalObligations}
                timeSessions={timeSessions}
                empresaId={selectedEmpresa}
                userEmail={userEmail}
                onSaveTasks={(v) => persist("bpoTasks", v, setBpoTasks)}
                onSolicitarFechamento={solicitarFechamento}
                onReabrirMes={reabrirMes}
              />
            )}

            {view === "onboarding" && (
              <OnboardingView
                items={onboardingItems}
                empresaId={selectedEmpresa}
                empresaNome={currentEmpresa?.nome}
                userEmail={userEmail}
                onSave={(v) => persist("onboardingItems", v, setOnboardingItems)}
                onGerarChecklist={gerarOnboardingChecklist}
              />
            )}

            {view === "hubSkills" && (
              <HubSkillsView
                skills={bpoSkills}
                runs={skillRuns}
                empresaId={selectedEmpresa}
                userEmail={userEmail}
                onSaveSkills={(v) => persist("bpoSkills", v, setBpoSkills)}
                onSaveRuns={(v) => persist("skillRuns", v, setSkillRuns)}
              />
            )}

            {view === "adm" && <AdmView role={role} empresas={empresasAtivas} userEmail={userEmail} />}

            {view === "produtividade" && <ProdutividadeView role={role} empresas={empresasAtivas} timeSessions={timeSessions} />}

            {view === "reports" && (
              <ReportsView
                year={year}
                accounts={accountsF}
                payables={payablesF}
                receivables={receivablesF}
                bankEntries={bankEntriesF}
                transfers={transfersF}
                fiscalObligations={fiscalObligationsF}
                contacts={contacts}
                empresas={empresas}
                selectedEmpresa={selectedEmpresa}
                categoryBreakdown={categoryBreakdown}
                receivableBreakdown={receivableBreakdown}
                financialAdjustments={financialAdjustments}
                empresaBreakdown={empresaBreakdown}
                accountBalance={accountBalance}
                totals={totals}
                monthlyFlow={monthlyFlow}
              />
            )}

            {view === "documentUploads" && (
              <DocumentUploadsView
                uploads={documentUploads}
                empresas={empresas}
                selectedEmpresa={selectedEmpresa}
                userEmail={userEmail}
                onSave={(v) => persist("documentUploads", v, setDocumentUploads)}
                onProcess={processInboxDocument}
                processError={inboxError}
              />
            )}

            {view === "lixeira" && (
              <LixeiraView
                empresas={empresas}
                payables={payables}
                receivables={receivables}
                bankEntries={bankEntries}
                transfers={transfers}
                fiscalObligations={fiscalObligations}
                contacts={contacts}
                onRestorePayables={(v) => persist("payables", v, setPayables)}
                onRestoreReceivables={(v) => persist("receivables", v, setReceivables)}
                onRestoreBankEntries={(v) => persist("bankEntries", v, setBankEntries)}
                onRestoreTransfers={(v) => persist("transfers", v, setTransfers)}
                onRestoreFiscal={(v) => persist("fiscalObligations", v, setFiscalObligations)}
                onRestoreContacts={(v) => persist("contacts", v, setContacts)}
              />
            )}
          </>
        )}
          </main>

          {/* Pendências primeiro (o que precisa de ação), Atividade recente
              depois (o que já aconteceu) — inverter a ordem de antes
              prioriza o que exige decisão sobre o que é só histórico. */}
          <aside
            className="w-72 shrink-0 p-5 space-y-4 print:hidden hidden xl:flex xl:flex-col overflow-y-auto"
            style={{ background: COLORS.panel, borderLeft: `1px solid ${COLORS.border}` }}
          >
            {selectedEmpresa && (
              <div>
                <p className="font-semibold text-sm" style={{ color: COLORS.ink }}>Pendências</p>
                <p className="text-xs mb-3" style={{ color: COLORS.inkSoft }}>O que precisa de atenção nesta empresa</p>
                {pendingDocs.length === 0 && pendingContacts.length === 0 && pendingBankSemCategoria === 0 && pendingPayablesSemCategoria === 0 && pendingReceivablesSemCategoria === 0 && pendingNaoConciliados === 0 && pendingPayablesVencidos === 0 && pendingReceivablesVencidos === 0 ? (
                  <p className="text-sm" style={{ color: COLORS.inkSoft }}>Nada pendente por aqui.</p>
                ) : (
                  <div className="space-y-1.5">
                    {pendingPayablesVencidos > 0 && (
                      <button
                        onClick={() => goToView("payables")}
                        className="w-full flex items-center gap-2.5 p-2 -mx-2 rounded-lg text-left hover:bg-black/5"
                      >
                        <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: COLORS.redSoft, color: COLORS.red }}>
                          <AlertTriangle size={14} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <p className="text-sm font-medium" style={{ color: COLORS.ink }}>
                            {pendingPayablesVencidos} a pagar vencida{pendingPayablesVencidos > 1 ? "s" : ""}
                          </p>
                          <p className="text-xs" style={{ color: COLORS.inkSoft }}>Revisar em Contas a Pagar</p>
                        </span>
                      </button>
                    )}
                    {pendingReceivablesVencidos > 0 && (
                      <button
                        onClick={() => goToView("receivables")}
                        className="w-full flex items-center gap-2.5 p-2 -mx-2 rounded-lg text-left hover:bg-black/5"
                      >
                        <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: COLORS.redSoft, color: COLORS.red }}>
                          <AlertTriangle size={14} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <p className="text-sm font-medium" style={{ color: COLORS.ink }}>
                            {pendingReceivablesVencidos} a receber vencida{pendingReceivablesVencidos > 1 ? "s" : ""}
                          </p>
                          <p className="text-xs" style={{ color: COLORS.inkSoft }}>Revisar em Contas a Receber</p>
                        </span>
                      </button>
                    )}
                    {pendingNaoConciliados > 0 && (
                      <button
                        onClick={() => goToView("reconciliation")}
                        className="w-full flex items-center gap-2.5 p-2 -mx-2 rounded-lg text-left hover:bg-black/5"
                      >
                        <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: COLORS.amberSoft, color: COLORS.amber }}>
                          <Landmark size={14} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <p className="text-sm font-medium" style={{ color: COLORS.ink }}>
                            {pendingNaoConciliados} não conciliado{pendingNaoConciliados > 1 ? "s" : ""}
                          </p>
                          <p className="text-xs" style={{ color: COLORS.inkSoft }}>Já andou na conta, ainda não bateu com o extrato</p>
                        </span>
                      </button>
                    )}
                    {pendingBankSemCategoria > 0 && (
                      <button
                        onClick={() => goToView("bank")}
                        className="w-full flex items-center gap-2.5 p-2 -mx-2 rounded-lg text-left hover:bg-black/5"
                      >
                        <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: COLORS.amberSoft, color: COLORS.amber }}>
                          <ListTree size={14} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <p className="text-sm font-medium" style={{ color: COLORS.ink }}>
                            {pendingBankSemCategoria} lançamento{pendingBankSemCategoria > 1 ? "s" : ""} sem categoria
                          </p>
                          <p className="text-xs" style={{ color: COLORS.inkSoft }}>Revisar em Lançamentos Bancários</p>
                        </span>
                      </button>
                    )}
                    {pendingPayablesSemCategoria > 0 && (
                      <button
                        onClick={() => goToView("payables")}
                        className="w-full flex items-center gap-2.5 p-2 -mx-2 rounded-lg text-left hover:bg-black/5"
                      >
                        <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: COLORS.amberSoft, color: COLORS.amber }}>
                          <ListTree size={14} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <p className="text-sm font-medium" style={{ color: COLORS.ink }}>
                            {pendingPayablesSemCategoria} a pagar sem categoria
                          </p>
                          <p className="text-xs" style={{ color: COLORS.inkSoft }}>Revisar em Contas a Pagar</p>
                        </span>
                      </button>
                    )}
                    {pendingReceivablesSemCategoria > 0 && (
                      <button
                        onClick={() => goToView("receivables")}
                        className="w-full flex items-center gap-2.5 p-2 -mx-2 rounded-lg text-left hover:bg-black/5"
                      >
                        <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: COLORS.amberSoft, color: COLORS.amber }}>
                          <ListTree size={14} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <p className="text-sm font-medium" style={{ color: COLORS.ink }}>
                            {pendingReceivablesSemCategoria} a receber sem categoria
                          </p>
                          <p className="text-xs" style={{ color: COLORS.inkSoft }}>Revisar em Contas a Receber</p>
                        </span>
                      </button>
                    )}
                    {pendingDocs.length > 0 && (
                      <button
                        onClick={() => goToView("documentUploads")}
                        className="w-full flex items-center gap-2.5 p-2 -mx-2 rounded-lg text-left hover:bg-black/5"
                      >
                        <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: COLORS.amberSoft, color: COLORS.amber }}>
                          <Inbox size={14} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <p className="text-sm font-medium" style={{ color: COLORS.ink }}>
                            {pendingDocs.length} documento{pendingDocs.length > 1 ? "s" : ""} pendente{pendingDocs.length > 1 ? "s" : ""}
                          </p>
                          <p className="text-xs" style={{ color: COLORS.inkSoft }}>Aguardando classificação</p>
                        </span>
                      </button>
                    )}
                    {pendingContacts.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => goToView("contacts")}
                        className="w-full flex items-center gap-2.5 p-2 -mx-2 rounded-lg text-left hover:bg-black/5"
                        title="Completar cadastro deste contato"
                      >
                        <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: COLORS.amberSoft, color: COLORS.amber }}>
                          <Contact size={14} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate" style={{ color: COLORS.ink }}>{c.nome}</p>
                          <p className="text-xs" style={{ color: COLORS.inkSoft }}>Cadastro incompleto — falta CPF/CNPJ ou contato</p>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className={selectedEmpresa ? "pt-4 mt-1" : ""} style={selectedEmpresa ? { borderTop: `1px solid ${COLORS.border}` } : undefined}>
              <p className="font-semibold text-sm" style={{ color: COLORS.ink }}>Atividade recente</p>
              <p className="text-xs" style={{ color: COLORS.inkSoft }}>Últimos lançamentos registrados</p>
            </div>
            {recentActivity.length === 0 ? (
              <p className="text-sm" style={{ color: COLORS.inkSoft }}>Nenhuma atividade ainda.</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((item) => {
                  const meta = ACTIVITY_META[item.tipo];
                  const Icon = meta.icon;
                  return (
                    <div key={item.id} className="flex items-start gap-2.5">
                      <span
                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: meta.bg, color: meta.fg }}
                      >
                        <Icon size={14} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate" style={{ color: COLORS.ink }}>{item.label}</p>
                        <p className="text-xs truncate" style={{ color: COLORS.inkSoft }}>{item.sub || meta.label} · {fmtBRL(item.valor)}</p>
                        <p className="text-[11px]" style={{ color: COLORS.inkSoft }}>{timeAgo(item.data)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Dashboard                                                              */
/* ---------------------------------------------------------------------- */
function Dashboard({
  year, setYear, totals, monthlyFlow, accounts, accountBalance, totalBalance,
  categoryBreakdown, receivableBreakdown, upcomingPayables, upcomingReceivables,
}) {
  const chartData = MONTHS.map((m, i) => ({
    mes: m,
    Entradas: Math.round(monthlyFlow.entradas[i] * 100) / 100,
    Saídas: Math.round(monthlyFlow.saidas[i] * 100) / 100,
    Acumulado: Math.round(monthlyFlow.acumulado[i] * 100) / 100,
  }));

  // Sparkline dos últimos 5 meses — escala própria por tile, altura 4-22px.
  const sparkOf = (serie) => {
    const ultimos = serie.slice(-5);
    const max = Math.max(1, ...ultimos.map((v) => Math.abs(v)));
    return ultimos.map((v) => Math.round((Math.abs(v) / max) * 18) + 4);
  };

  const proximosVencimentos = useMemo(() => {
    const itens = [
      ...upcomingPayables.map((p) => ({ ...p, tipo: "pagar" })),
      ...upcomingReceivables.map((r) => ({ ...r, tipo: "receber" })),
    ];
    itens.sort((a, b) => a.vencimento.localeCompare(b.vencimento));
    return itens.slice(0, 6);
  }, [upcomingPayables, upcomingReceivables]);

  const kpis = [
    { label: "Entradas no ano", value: totals.totalEntradas, icon: TrendingUp, tone: "green", spark: sparkOf(monthlyFlow.entradas) },
    { label: "Saídas no ano", value: totals.totalSaidas, icon: TrendingDown, tone: "red", spark: sparkOf(monthlyFlow.saidas) },
    { label: "Saldo líquido", value: totals.saldo, icon: CircleDollarSign, tone: totals.saldo >= 0 ? "green" : "red", spark: sparkOf(monthlyFlow.acumulado) },
    { label: "Saldo em contas", value: totalBalance, icon: Landmark, tone: "gold", spark: null },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: COLORS.ink }}>Dashboard</h1>
          <p className="text-sm" style={{ color: COLORS.inkSoft }}>Regime de caixa · visão do ano desta empresa</p>
        </div>
        <Select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: 112 }}>
          {[year - 1, year, year + 1].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          const toneColor = k.tone === "green" ? COLORS.green : k.tone === "red" ? COLORS.red : COLORS.gold;
          const toneBg = k.tone === "green" ? COLORS.greenSoft : k.tone === "red" ? COLORS.redSoft : COLORS.goldSoft;
          return (
            <Card key={k.label} className="p-3.5 flex items-center gap-3">
              <div className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center shrink-0" style={{ background: toneBg }}>
                <Icon size={15} color={toneColor} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11.5px] mb-0.5" style={{ color: COLORS.inkSoft }}>{k.label}</p>
                <p className="text-base font-bold tabular-nums" style={{ color: toneColor, fontVariantNumeric: "tabular-nums" }}>
                  {fmtBRL(k.value)}
                </p>
              </div>
              {k.spark && (
                <div className="flex items-end gap-0.5 h-6 shrink-0">
                  {k.spark.map((h, i) => (
                    <div key={i} className="w-1 rounded-sm" style={{ background: toneColor, height: h }} />
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="p-4">
        <h2 className="text-sm font-semibold mb-3" style={{ color: COLORS.ink }}>Entradas × Saídas × Saldo acumulado</h2>
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 12, fill: COLORS.inkSoft }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: COLORS.inkSoft }} axisLine={false} tickLine={false} width={70}
                tickFormatter={(v) => v.toLocaleString("pt-BR", { notation: "compact", compactDisplay: "short" })} />
              <Tooltip formatter={(v) => fmtBRL(v)} contentStyle={{ borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
              <Bar dataKey="Entradas" fill="#BFDBC9" radius={[3, 3, 0, 0]} maxBarSize={22} />
              <Bar dataKey="Saídas" fill="#E3C9C0" radius={[3, 3, 0, 0]} maxBarSize={22} />
              <Line type="monotone" dataKey="Acumulado" stroke={COLORS.primary} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3" style={{ color: COLORS.ink }}>Saldo por conta</h2>
          {accounts.length === 0 ? (
            <p className="text-sm" style={{ color: COLORS.inkSoft }}>Nenhuma conta cadastrada ainda.</p>
          ) : (
            <div className="space-y-3.5">
              {(() => {
                const maxAbs = Math.max(1, ...accounts.map((a) => Math.abs(accountBalance(a.id))));
                return accounts.map((a) => {
                  const saldo = accountBalance(a.id);
                  const cor = saldo >= 0 ? COLORS.green : COLORS.red;
                  const barBg = saldo < 0 ? "#E3C9C0" : "#BFDBC9";
                  const pct = (Math.abs(saldo) / maxAbs) * 48;
                  return (
                    <div key={a.id} className="flex items-center gap-2.5">
                      <span className="w-20 text-xs shrink-0 truncate" style={{ color: COLORS.inkSoft }}>{a.nome}</span>
                      <div className="flex-1 relative" style={{ height: 18 }}>
                        <div className="absolute top-0 bottom-0" style={{ left: "50%", width: 1, background: "#C7C2B3" }} />
                        <div
                          className="absolute rounded"
                          style={{ top: 3, bottom: 3, background: barBg, left: `${saldo < 0 ? 50 - pct : 50}%`, width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-24 text-right text-xs font-semibold tabular-nums shrink-0" style={{ color: cor }}>{fmtBRL(saldo)}</span>
                    </div>
                  );
                });
              })()}
            </div>
          )}
          <p className="text-[10.5px] mt-1" style={{ color: COLORS.inkSoft }}>A linha vertical é o zero — barra pra esquerda é saldo negativo, pra direita é positivo.</p>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3" style={{ color: COLORS.ink }}>Próximos vencimentos</h2>
          <div className="space-y-1.5">
            {proximosVencimentos.length === 0 && (
              <p className="text-sm" style={{ color: COLORS.inkSoft }}>Nada pendente no momento.</p>
            )}
            {proximosVencimentos.map((item) => {
              const dias = daysUntil(item.vencimento);
              const cor = dias < 0 ? COLORS.red : dias <= 10 ? COLORS.amber : COLORS.border;
              const ehPagar = item.tipo === "pagar";
              return (
                <div key={`${item.tipo}-${item.id}`} className="flex items-center gap-2.5 py-0.5">
                  <span className="w-[3px] self-stretch rounded shrink-0" style={{ background: cor }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate" style={{ color: COLORS.ink }}>{ehPagar ? item.fornecedor : item.cliente}</p>
                    <p className="text-xs" style={{ color: COLORS.inkSoft }}>{ehPagar ? "Pagar" : "Receber"} · {fmtDate(item.vencimento)}</p>
                  </div>
                  <p className="text-sm font-medium tabular-nums shrink-0" style={{ color: ehPagar ? COLORS.red : COLORS.green }}>
                    {ehPagar ? "−" : "+"}{fmtBRL(item.valor)}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3" style={{ color: COLORS.ink }}>Despesas por categoria</h2>
          <CategoryBarChart
            data={categoryBreakdown}
            labels={[{ key: "pago", label: "Pago" }, { key: "aPagar", label: "A pagar" }]}
            tone="red"
          />
        </Card>
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3" style={{ color: COLORS.ink }}>Receitas por categoria</h2>
          <CategoryBarChart
            data={receivableBreakdown}
            labels={[{ key: "recebido", label: "Recebido" }, { key: "aReceber", label: "A receber" }]}
            tone="green"
          />
        </Card>
      </div>
    </div>
  );
}

function CategoryBarChart({ data, labels, tone }) {
  const rows = Object.entries(data)
    .map(([cat, vals]) => ({ cat, a: vals[labels[0].key] || 0, b: vals[labels[1].key] || 0 }))
    .sort((x, y) => (y.a + y.b) - (x.a + x.b));
  if (rows.length === 0) return <p className="text-sm" style={{ color: COLORS.inkSoft }}>Sem lançamentos ainda.</p>;
  const maxTotal = Math.max(1, ...rows.map((r) => r.a + r.b));
  const corForte = tone === "red" ? COLORS.red : COLORS.green;
  const corRealizado = tone === "red" ? "#E3C9C0" : "#BFDBC9";
  const corPendente = tone === "red" ? "#F1E3DD" : "#DCEDE1";
  return (
    <div>
      <div className="space-y-2.5">
        {rows.map((r) => {
          const total = r.a + r.b;
          const pctA = (r.a / maxTotal) * 100;
          const pctB = (r.b / maxTotal) * 100;
          return (
            <div key={r.cat} className="flex items-center gap-2.5">
              <span className="w-28 text-xs shrink-0 truncate" style={{ color: COLORS.inkSoft }}>{r.cat}</span>
              <div className="flex-1 flex rounded overflow-hidden" style={{ height: 14, background: COLORS.bg }}>
                <div style={{ width: `${pctA}%`, background: corRealizado }} />
                <div style={{ width: `${pctB}%`, background: corPendente }} />
              </div>
              <span className="w-24 text-right text-xs font-semibold tabular-nums shrink-0" style={{ color: corForte }}>{fmtBRL(total)}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 pt-2.5 text-[10.5px]" style={{ color: COLORS.inkSoft }}>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: corRealizado }} />{labels[0].label}</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: corPendente }} />{labels[1].label}</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Empresas                                                               */
/* ---------------------------------------------------------------------- */
function EmpresasView({ empresas, role, documentUploads = [], onSave, onOpenAccounts, onOpenContacts, onOpenEmpresa, userEmail }) {
  const [modal, setModal] = useState(null);
  const [exportBusy, setExportBusy] = useState(null); // empresaId gerando exportação na hora de inativar
  const isGestor = role === "gestor";
  const activeCount = empresas.filter((e) => e.ativa !== false).length;
  const segmentoCount = new Set(empresas.filter((e) => e.ativa !== false && e.segmento).map((e) => e.segmento)).size;
  const pendentesPorEmpresa = (empId) => documentUploads.filter((u) => u.empresaId === empId && u.status !== "processado").length;

  const submit = (form) => {
    if (form.id) onSave(empresas.map((e) => (e.id === form.id ? form : e)));
    else onSave([...empresas, { ...form, id: uid() }]);
    setModal(null);
  };
  // Empresa nunca é excluída pelo app — só inativada. Mantém o histórico
  // (contas, lançamentos) intacto pra auditoria, e permite reativar se a
  // empresa voltar a ser cliente no futuro. Quebra de contrato antes do
  // prazo passa pela mesma política de fim de contrato normal: ao
  // inativar, oferece na hora gerar e mandar por WhatsApp o link dos
  // documentos guardados (válido por 7 dias) — sem precisar ir no ADM
  // nem mexer na data de "Fim do contrato".
  const toggleAtiva = async (e) => {
    const ativa = e.ativa === false; // reativando se já estava inativa
    const msg = ativa
      ? `Reativar "${e.nome}"? Ela volta a aparecer no seletor de empresas.`
      : `Inativar "${e.nome}"? Ela some do seletor do dia a dia, mas os dados continuam guardados e você pode reativar quando quiser.`;
    if (!confirmDelete(msg)) return;
    onSave(empresas.map((x) => (x.id === e.id ? { ...x, ativa } : x)));
    if (ativa) return; // reativando não mexe em documentos

    if (!window.confirm(`Gerar agora o link com os documentos guardados de "${e.nome}" e mandar por WhatsApp (válido por 7 dias) — mesma política usada em fim de contrato?`)) return;
    setExportBusy(e.id);
    try {
      const { total, url } = await gerarExportacaoDocumentos(e);
      if (total === 0) { alert(`Nenhum documento guardado pra "${e.nome}" ainda.`); return; }
      logAudit(e.id, "empresa", e.id, "exportar_documentos", `Gerou exportação com ${total} arquivo(s) por inativação (quebra de contrato antes do prazo)`, userEmail);
      const mensagem = `Olá! Segue, num único arquivo, todos os documentos trocados durante nosso contrato de prestação de serviço (${total} arquivo(s)). O link fica disponível por 7 dias:\n\n${url}`;
      if (!openWhatsApp(e.contatoCelular, mensagem)) {
        window.prompt("Cadastre o celular do dono pra mandar automático por WhatsApp — por enquanto, copie e envie manualmente:", url);
      }
    } catch (err) {
      alert("Não consegui gerar a exportação: " + err.message);
    } finally {
      setExportBusy(null);
    }
  };

  // Link de upload sem login: quem recebe (o sócio da empresa cliente) só
  // precisa desse link pra mandar boleto/comprovante/NF direto pra caixa de
  // entrada dessa empresa — sem criar usuário nem senha no ESEK.
  const copyUploadLink = async (e) => {
    const url = `${window.location.origin}${window.location.pathname}?upload=${e.uploadToken}`;
    try {
      await navigator.clipboard.writeText(url);
      alert(`Link de upload copiado! Envie pro cliente:\n\n${url}`);
    } catch {
      window.prompt("Copie o link de upload:", url);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="flex gap-3">
          <Card className="p-3 px-4">
            <p className="text-xs" style={{ color: COLORS.inkSoft }}>Clientes ativos</p>
            <p className="text-lg font-semibold" style={{ color: COLORS.ink }}>{activeCount}</p>
          </Card>
          <Card className="p-3 px-4">
            <p className="text-xs" style={{ color: COLORS.inkSoft }}>Segmentos atendidos</p>
            <p className="text-lg font-semibold" style={{ color: COLORS.ink }}>{segmentoCount || "—"}</p>
          </Card>
        </div>
        {isGestor && <Button onClick={() => setModal({})}><Plus size={15} /> Nova empresa</Button>}
      </div>

      {empresas.length === 0 ? (
        <Card><EmptyState icon={Building2} title="Nenhuma empresa cadastrada" subtitle="Ex.: Casarão, Casa Pôr do Sol, Vai da Praia." /></Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {empresas.map((e) => {
            return (
            <Card key={e.id} className="p-4" style={e.ativa === false ? { opacity: 0.6 } : {}}>
              <div className="flex items-start justify-between mb-3">
                <div
                  className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0 -m-2 p-2 rounded-xl transition-all duration-150 hover:bg-[#E4F0E7] hover:shadow-[0_4px_14px_rgba(31,58,52,0.18)] hover:-translate-y-0.5"
                  onClick={() => onOpenEmpresa(e.id)}
                  title="Entrar nesta empresa"
                >
                  {e.logoUrl ? (
                    <img src={e.logoUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" style={{ border: `1px solid ${COLORS.border}` }} />
                  ) : (
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: e.cor }} />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-sm flex items-center gap-1.5" style={{ color: COLORS.ink }}>
                      {e.nome} {e.ativa === false && <Badge tone="neutral">Inativa</Badge>}
                      {pendentesPorEmpresa(e.id) > 0 && (
                        <Badge tone="amber"><Inbox size={11} /> {pendentesPorEmpresa(e.id)} pendente{pendentesPorEmpresa(e.id) > 1 ? "s" : ""}</Badge>
                      )}
                      {certificadoAlerta(e) && (
                        <Badge tone="red">
                          <ShieldCheck size={11} /> Certificado {certificadoAlerta(e).nivel === "vencido" ? "vencido" : `vence em ${certificadoAlerta(e).dias}d`}
                        </Badge>
                      )}
                    </p>
                    {e.cnpj && <p className="text-xs" style={{ color: COLORS.inkSoft }}>{e.cnpj}</p>}
                  </div>
                </div>
                {isGestor && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => onOpenAccounts(e.id)} title="Ver contas bancárias desta empresa" className="p-1.5 rounded-md hover:bg-black/5">
                      <Landmark size={14} color={COLORS.inkSoft} />
                    </button>
                    <button onClick={() => onOpenContacts(e.id)} title="Ver contatos desta empresa (clientes/fornecedores)" className="p-1.5 rounded-md hover:bg-black/5">
                      <Contact size={14} color={COLORS.inkSoft} />
                    </button>
                    <button onClick={() => copyUploadLink(e)} title="Copiar link de upload sem login (pro cliente enviar documentos)" className="p-1.5 rounded-md hover:bg-black/5">
                      <Link2 size={14} color={COLORS.inkSoft} />
                    </button>
                    <button onClick={() => setModal(e)} title="Editar empresa" className="p-1.5 rounded-md hover:bg-black/5">
                      <Pencil size={14} color={COLORS.inkSoft} />
                    </button>
                    <button
                      onClick={() => toggleAtiva(e)}
                      disabled={exportBusy === e.id}
                      title={e.ativa === false ? "Reativar empresa" : "Inativar empresa"}
                      className="p-1.5 rounded-md hover:bg-black/5"
                    >
                      {exportBusy === e.id ? <Loader2 size={14} className="animate-spin" color={COLORS.inkSoft} /> : e.ativa === false ? <Check size={14} color={COLORS.green} /> : <Trash2 size={14} color={COLORS.red} />}
                    </button>
                  </div>
                )}
              </div>
              {(e.segmento || e.proprietario || e.contatoEmail || e.contatoCelular) && (
                <div className="pb-3 space-y-1">
                  {e.segmento && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge tone="neutral">{e.segmento}</Badge>
                    </div>
                  )}
                  {e.proprietario && <p className="text-xs" style={{ color: COLORS.inkSoft }}>Proprietário: {e.proprietario}</p>}
                  {(e.contatoEmail || e.contatoCelular) && (
                    <p className="text-xs" style={{ color: COLORS.inkSoft }}>
                      {[e.contatoEmail, e.contatoCelular].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              )}
              {isGestor && (e.contratoValorMensal || e.contabilidadeNome || e.certificadoDigitalTipo) && (
                <div className="pb-3 space-y-1">
                  {e.contratoValorMensal != null && (
                    <p className="text-xs" style={{ color: COLORS.inkSoft }}>Contrato: {fmtBRL(e.contratoValorMensal)}/mês{e.contratoVencimento ? ` · fim em ${fmtDate(e.contratoVencimento)}` : ""}</p>
                  )}
                  {e.contabilidadeNome && (
                    <p className="text-xs" style={{ color: COLORS.inkSoft }}>Contabilidade: {e.contabilidadeNome}{e.contabilidadeContato ? ` (${e.contabilidadeContato})` : ""}</p>
                  )}
                  {e.certificadoDigitalTipo && (
                    <p className="text-xs" style={{ color: certificadoAlerta(e) ? COLORS.red : COLORS.inkSoft }}>
                      Certificado: {e.certificadoDigitalTipo}{e.certificadoDigitalValidade ? ` · validade ${fmtDate(e.certificadoDigitalValidade)}` : ""}
                    </p>
                  )}
                </div>
              )}
              {isGestor && <EmpresaOwnersPanel empresa={e} />}
            </Card>
            );
          })}
        </div>
      )}

      {modal && <EmpresaModal initial={modal} existingCount={empresas.length} onClose={() => setModal(null)} onSubmit={submit} />}
    </div>
  );
}

function EmpresaOwnersPanel({ empresa }) {
  const [owners, setOwners] = useState(null); // null = carregando
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Credencial recém-gerada (login novo ou reset de senha) — some assim
  // que o gestor sai da tela ou fecha, nunca fica guardada em lugar
  // nenhum além da memória desta sessão.
  const [tempCred, setTempCred] = useState(null); // { email, password }

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("empresa_owners")
      .select("user_id, profiles(email)")
      .eq("empresaId", empresa.id);
    if (err) { setOwners([]); return; }
    setOwners(data.map((r) => r.profiles?.email || r.user_id));
  }, [empresa.id]);

  useEffect(() => { load(); }, [load]);

  // Só pré-preenche na primeira vez (ainda sem nenhum dono cadastrado) e só
  // se o campo continuar vazio — nunca sobrescreve o que o gestor já
  // digitou. É conveniência, não automação: continua exigindo o clique em
  // "Dar acesso" pra de fato criar o login, porque e-mail de contato e
  // login são coisas diferentes (ver texto abaixo do campo).
  useEffect(() => {
    if (owners && owners.length === 0 && empresa.contatoEmail && !email) {
      setEmail(empresa.contatoEmail);
    }
  }, [owners]); // eslint-disable-line react-hooks/exhaustive-deps

  const addOwner = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setError("");
    setTempCred(null);
    const { data, error: err } = await supabase.functions.invoke("manage-owner-login", {
      body: { email: email.trim(), empresaId: empresa.id },
    });
    setBusy(false);
    if (err) {
      let detail = err.message;
      if (err.context && typeof err.context.json === "function") {
        try { const b = await err.context.clone().json(); if (b?.error) detail = b.error; } catch { /* corpo não era JSON */ }
      }
      setError(detail);
      return;
    }
    setEmail("");
    if (data?.createdNew && data?.tempPassword) setTempCred({ email: email.trim(), password: data.tempPassword });
    load();
  };

  const resetPassword = async (ownerEmail) => {
    if (!confirmDelete(`Gerar uma nova senha temporária pra "${ownerEmail}"? A senha antiga dela deixa de funcionar.`)) return;
    setError("");
    setTempCred(null);
    const { data, error: err } = await supabase.functions.invoke("manage-owner-login", {
      body: { email: ownerEmail, resetPassword: true },
    });
    if (err) {
      let detail = err.message;
      if (err.context && typeof err.context.json === "function") {
        try { const b = await err.context.clone().json(); if (b?.error) detail = b.error; } catch { /* corpo não era JSON */ }
      }
      setError(detail);
      return;
    }
    if (data?.tempPassword) setTempCred({ email: ownerEmail, password: data.tempPassword });
  };

  const removeOwner = async (ownerEmail) => {
    await supabase.rpc("remove_empresa_owner", { p_empresa_id: empresa.id, p_email: ownerEmail });
    load();
  };

  const sendCredByWhatsApp = () => {
    if (!tempCred) return;
    const loginUrl = `${window.location.origin}${window.location.pathname}`;
    const mensagem = `Olá${empresa.proprietario ? `, ${empresa.proprietario}` : ""}! Seu acesso ao ESEK (gestão financeira da ${empresa.nome}) foi criado.\n\nAcesse: ${loginUrl}\nLogin: ${tempCred.email}\nSenha temporária: ${tempCred.password}\n\nEntre e, se possível, troque a senha no primeiro acesso.`;
    if (!openWhatsApp(empresa.contatoCelular, mensagem)) {
      alert("Essa empresa não tem celular do proprietário cadastrado — copie a senha e envie manualmente.");
    }
  };

  return (
    <div className="pt-3" style={{ borderTop: `1px solid ${COLORS.border}` }}>
      <p className="text-xs font-medium" style={{ color: COLORS.inkSoft }}>Donos com acesso a esta empresa</p>
      <p className="text-xs mb-2" style={{ color: COLORS.inkSoft }}>Cria um login pra essa pessoa entrar no sistema — diferente do e-mail de contato ali em cima, que é só referência.</p>
      {owners === null ? (
        <p className="text-xs" style={{ color: COLORS.inkSoft }}>Carregando…</p>
      ) : owners.length === 0 ? (
        <p className="text-xs mb-2" style={{ color: COLORS.inkSoft }}>Ninguém tem acesso restrito ainda — só quem for gestor vê essa empresa.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {owners.map((ownerEmail) => (
            <span key={ownerEmail} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs" style={{ background: "#EFEEE8", color: COLORS.ink }}>
              {ownerEmail}
              <button onClick={() => resetPassword(ownerEmail)} title="Gerar nova senha temporária" className="hover:opacity-70"><RotateCcw size={11} /></button>
              <button onClick={() => removeOwner(ownerEmail)} title="Remover acesso" className="hover:opacity-70"><X size={11} /></button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <TextInput
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email-do-dono@exemplo.com"
          className="text-xs"
          style={{ height: 30, padding: "0 10px" }}
        />
        <Button variant="subtle" onClick={addOwner} disabled={busy} className="text-xs shrink-0" style={{ height: 30, padding: "0 10px" }}>
          <Plus size={13} /> Dar acesso
        </Button>
      </div>
      {error && <p className="text-xs mt-1" style={{ color: COLORS.red }}>{error}</p>}
      {tempCred && (
        <div className="mt-2 p-2 rounded-lg text-xs" style={{ background: COLORS.goldSoft }}>
          <p className="font-medium mb-1" style={{ color: COLORS.ink }}>Login criado — repassa pro dono agora, essa senha não aparece de novo:</p>
          <p style={{ color: COLORS.ink }}>Acesso: <span className="font-mono">{window.location.origin}{window.location.pathname}</span></p>
          <p style={{ color: COLORS.ink }}>Login: <span className="font-mono">{tempCred.email}</span></p>
          <p style={{ color: COLORS.ink }}>Senha: <span className="font-mono font-semibold">{tempCred.password}</span></p>
          <div className="flex gap-2 mt-1.5">
            <Button variant="ghost" className="text-xs" style={{ height: 26, padding: "0 8px" }} onClick={sendCredByWhatsApp}>
              <MessageCircle size={12} /> Enviar por WhatsApp
            </Button>
            <Button variant="ghost" className="text-xs" style={{ height: 26, padding: "0 8px" }} onClick={() => setTempCred(null)}>Ok, guardei</Button>
          </div>
        </div>
      )}
    </div>
  );
}

async function extractFunctionError(err) {
  let detail = err.message;
  if (err.context && typeof err.context.json === "function") {
    try { const b = await err.context.clone().json(); if (b?.error) detail = b.error; } catch { /* corpo não era JSON */ }
  }
  return detail;
}

function NovoUsuarioModal({ onClose, onSubmit, busy }) {
  const [form, setForm] = useState({ email: "", nome: "", cpf: "", role: "operador" });
  const valid = form.email.trim() && form.nome.trim();
  return (
    <Modal title="Novo usuário" onClose={onClose}>
      <div className="grid gap-3">
        <Field label="Nome">
          <TextInput value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} autoFocus />
        </Field>
        <Field label="E-mail">
          <TextInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="CPF (opcional)">
          <TextInput value={form.cpf} onChange={(e) => setForm({ ...form, cpf: formatCPF(e.target.value) })} placeholder="000.000.000-00" />
        </Field>
        <Field label="Papel">
          <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="operador">Operador — rotina do BPO</option>
            <option value="gestor">Gestor — supervisão e ADM</option>
          </Select>
        </Field>
        <p className="text-xs" style={{ color: COLORS.inkSoft }}>
          Pra dar acesso a um Dono/Sócio, use "Donos com acesso" no card da empresa, em Cadastros → Empresas — lá o acesso já nasce vinculado à empresa certa.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => valid && onSubmit(form)} disabled={!valid || busy}>{busy ? "Criando…" : "Criar usuário"}</Button>
        </div>
      </div>
    </Modal>
  );
}

function AdmView({ role, empresas = [], userEmail }) {
  const [users, setUsers] = useState(null);
  const [empresasByOwner, setEmpresasByOwner] = useState({});
  const [staffAccess, setStaffAccess] = useState({}); // { userId: Set(empresaId) }
  const [modal, setModal] = useState(null);
  const [accessModal, setAccessModal] = useState(null); // usuário sendo editado
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tempCred, setTempCred] = useState(null);
  const [exportBusy, setExportBusy] = useState(null); // empresaId em exportação/exclusão
  const [exportResults, setExportResults] = useState({}); // { empresaId: { url, total } }

  // Além do aviso normal de fim de contrato (alerta por data), inclui
  // empresas já inativadas antes do prazo (quebra de contrato) mesmo sem
  // alerta de data — senão elas nunca aparecem aqui e "Apagar documentos"
  // fica inalcançável se o "Fim do contrato" ainda estiver longe.
  const contratosAlerta = useMemo(
    () => empresas
      .map((e) => ({ empresa: e, alerta: contratoAlerta(e) }))
      .filter((x) => x.alerta || x.empresa.ativa === false)
      .sort((a, b) => (a.alerta?.dias ?? -9999) - (b.alerta?.dias ?? -9999)),
    [empresas]
  );

  const handleExportar = async (empresa) => {
    setExportBusy(empresa.id);
    try {
      const { total, url } = await gerarExportacaoDocumentos(empresa);
      if (total === 0) { alert(`Nenhum documento guardado pra "${empresa.nome}" ainda.`); return; }
      setExportResults((r) => ({ ...r, [empresa.id]: { url, total } }));
      logAudit(empresa.id, "empresa", empresa.id, "exportar_documentos", `Gerou exportação com ${total} arquivo(s) pra fim de contrato`, userEmail);
      const mensagem = `Olá! Segue, num único arquivo, todos os documentos trocados durante nosso contrato de prestação de serviço (${total} arquivo(s)). O link fica disponível por 7 dias:\n\n${url}`;
      if (!openWhatsApp(empresa.contatoCelular, mensagem)) {
        window.prompt("Cadastre o celular do dono pra mandar automático por WhatsApp — por enquanto, copie e envie manualmente:", url);
      }
    } catch (e) {
      alert("Não consegui gerar a exportação: " + e.message);
    } finally {
      setExportBusy(null);
    }
  };

  const handleApagar = async (empresa) => {
    if (!confirmDelete(`Apagar TODOS os documentos guardados de "${empresa.nome}" (Documentos Recebidos + anexos de lançamentos)? Isso não pode ser desfeito — só confirme depois que o dono já baixou o link exportado.`)) return;
    setExportBusy(empresa.id);
    try {
      await apagarDocumentosDaEmpresa(empresa.id);
      logAudit(empresa.id, "empresa", empresa.id, "apagar_documentos", "Removeu os documentos guardados após exportação de fim de contrato", userEmail);
      setExportResults((r) => { const next = { ...r }; delete next[empresa.id]; return next; });
      alert(`Documentos de "${empresa.nome}" removidos.`);
    } catch (e) {
      alert("Não consegui apagar: " + e.message);
    } finally {
      setExportBusy(null);
    }
  };

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from("profiles").select("id, email, role, nome, cpf").order("email");
    if (err) { setUsers([]); return; }
    setUsers(data || []);
    const { data: owners } = await supabase.from("empresa_owners").select("user_id, empresas(nome)");
    const map = {};
    (owners || []).forEach((o) => {
      const nomeEmpresa = o.empresas?.nome;
      if (!nomeEmpresa) return;
      map[o.user_id] = [...(map[o.user_id] || []), nomeEmpresa];
    });
    setEmpresasByOwner(map);
    const { data: access } = await supabase.from("staff_empresa_access").select("user_id, empresaId");
    const accessMap = {};
    (access || []).forEach((a) => {
      if (!accessMap[a.user_id]) accessMap[a.user_id] = new Set();
      accessMap[a.user_id].add(a.empresaId);
    });
    setStaffAccess(accessMap);
  }, []);

  useEffect(() => { load(); }, [load]);

  const salvarAcesso = async (userId, empresaIds) => {
    setError("");
    const { error: err } = await supabase.rpc("set_staff_empresa_access", { p_user_id: userId, p_empresa_ids: empresaIds });
    if (err) { setError(err.message); return; }
    setAccessModal(null);
    load();
  };

  const criarUsuario = async (form) => {
    setBusy(true);
    setError("");
    setTempCred(null);
    const { data, error: err } = await supabase.functions.invoke("manage-staff-login", {
      body: { email: form.email.trim(), nome: form.nome.trim(), cpf: form.cpf.trim(), role: form.role },
    });
    setBusy(false);
    if (err) { setError(await extractFunctionError(err)); return; }
    if (data?.tempPassword) setTempCred({ email: form.email.trim(), password: data.tempPassword });
    setModal(null);
    load();
  };

  // Owner não passa por aqui — vira dono vinculando ele a uma empresa
  // específica na tela Empresas (é lá que faz sentido escolher qual
  // empresa), não soltando um dono sem empresa nenhuma no ADM.
  const mudarPapel = async (u, novoPapel) => {
    if (novoPapel === u.role) return;
    if (u.role === "gestor" && users.filter((x) => x.role === "gestor").length <= 1) {
      if (!confirmDelete(`"${u.email}" é o único gestor do sistema — trocar o papel dele pode tirar o acesso ao ADM de todo mundo. Continuar mesmo assim?`)) return;
    }
    setError("");
    const { error: err } = await supabase.rpc("upsert_staff_profile", { p_email: u.email, p_role: novoPapel, p_nome: u.nome, p_cpf: u.cpf });
    if (err) { setError(err.message); return; }
    load();
  };

  const resetSenha = async (u) => {
    if (!confirmDelete(`Gerar uma nova senha temporária pra "${u.email}"? A senha antiga dela deixa de funcionar.`)) return;
    setError("");
    setTempCred(null);
    const { data, error: err } = await supabase.functions.invoke("manage-staff-login", { body: { email: u.email, resetPassword: true } });
    if (err) { setError(await extractFunctionError(err)); return; }
    if (data?.tempPassword) setTempCred({ email: u.email, password: data.tempPassword });
  };

  if (role !== "gestor") {
    return <EmptyState icon={ShieldCheck} title="Só gestor acessa o ADM" subtitle="Peça pra um gestor gerenciar usuários e papéis de acesso." />;
  }

  return (
    <div className="space-y-4">
      <Header title="ADM" subtitle="Cadastro de usuários, papel de acesso (Gestor, Operador ou Dono) e troca de senha.">
        <Button onClick={() => setModal({})}><Plus size={15} /> Novo usuário</Button>
      </Header>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: COLORS.redSoft, color: COLORS.red }}>
          <AlertTriangle size={15} /> {error}
        </div>
      )}
      {tempCred && (
        <div className="p-3 rounded-lg text-sm" style={{ background: COLORS.goldSoft }}>
          <p className="font-medium mb-1" style={{ color: COLORS.ink }}>Credencial gerada — repassa agora, não aparece de novo:</p>
          <p style={{ color: COLORS.ink }}>Login: <span className="font-mono">{tempCred.email}</span> · Senha: <span className="font-mono font-semibold">{tempCred.password}</span></p>
          <Button variant="ghost" className="mt-1.5" onClick={() => setTempCred(null)}>Ok, guardei</Button>
        </div>
      )}

      {contratosAlerta.length > 0 && (
        <Card className="p-4">
          <p className="text-sm font-medium mb-1" style={{ color: COLORS.ink }}>Contratos de prestação de serviço vencendo ou encerrados</p>
          <p className="text-xs mb-3" style={{ color: COLORS.inkSoft }}>
            Aviso com 60 dias de antecedência (campo "Fim do contrato", em Cadastros → Editar empresa), mais empresas já inativadas por quebra de contrato antes do prazo. "Exportar documentos" gera um .zip com tudo que já foi trocado com o cliente e manda o link por WhatsApp pro dono — a exclusão dos originais é uma ação separada, só depois que ele confirmar o recebimento.
          </p>
          <div className="grid gap-2">
            {contratosAlerta.map(({ empresa, alerta }) => {
              const resultado = exportResults[empresa.id];
              const ocupado = exportBusy === empresa.id;
              const vencido = alerta ? alerta.nivel === "vencido" : true; // inativada sem alerta de data = trata como vencido (precisa de atenção)
              return (
                <div key={empresa.id} className="rounded-lg px-3 py-2.5" style={{ background: vencido ? COLORS.redSoft : COLORS.amberSoft }}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm font-medium" style={{ color: vencido ? COLORS.red : COLORS.amber }}>
                        {empresa.nome} — {alerta ? (alerta.nivel === "vencido" ? `contrato vencido há ${-alerta.dias}d` : `vence em ${alerta.dias}d`) : "empresa inativada (quebra de contrato)"}
                      </p>
                      <p className="text-xs" style={{ color: COLORS.inkSoft }}>Fim do contrato: {fmtDate(empresa.contratoVencimento)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" disabled={ocupado} onClick={() => handleExportar(empresa)}>
                        <Download size={14} /> {ocupado ? "Gerando…" : "Exportar documentos"}
                      </Button>
                      {resultado && (
                        <Button variant="danger" disabled={ocupado} onClick={() => handleApagar(empresa)}>
                          <Trash2 size={14} /> Confirmar exclusão
                        </Button>
                      )}
                    </div>
                  </div>
                  {resultado && (
                    <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>
                      Exportado: {resultado.total} arquivo(s) · link válido por 7 dias{resultado.url ? <> — <a href={resultado.url} target="_blank" rel="noreferrer" className="underline">abrir</a></> : ""}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="overflow-x-auto">
        {users === null ? (
          <p className="text-sm p-4" style={{ color: COLORS.inkSoft }}>Carregando…</p>
        ) : (
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
                <th className="text-left font-medium text-xs px-2.5 py-1.5">Nome</th>
                <th className="text-left font-medium text-xs px-2.5 py-1.5">E-mail</th>
                <th className="text-left font-medium text-xs px-2.5 py-1.5">CPF</th>
                <th className="text-left font-medium text-xs px-2.5 py-1.5">Papel</th>
                <th className="text-left font-medium text-xs px-2.5 py-1.5">Empresas com acesso</th>
                <th className="text-right font-medium text-xs px-2.5 py-1.5">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const meusIds = staffAccess[u.id];
                const restrito = meusIds && meusIds.size > 0;
                return (
                <tr key={u.id} style={{ borderTop: `1px solid #F0EEE7` }}>
                  <td className="px-2.5 py-1.5" style={{ color: COLORS.ink }}>{u.nome || "—"}</td>
                  <td className="px-2.5 py-1.5" style={{ color: COLORS.ink }}>{u.email}</td>
                  <td className="px-2.5 py-1.5" style={{ color: COLORS.inkSoft }}>{u.cpf || "—"}</td>
                  <td className="px-2.5 py-1.5">
                    {u.role === "owner" ? (
                      <Badge tone="blue">Dono</Badge>
                    ) : (
                      <Select value={u.role} onChange={(e) => mudarPapel(u, e.target.value)} style={{ height: 28, padding: "0 8px", width: 112 }}>
                        <option value="gestor">Gestor</option>
                        <option value="operador">Operador</option>
                      </Select>
                    )}
                  </td>
                  <td className="px-2.5 py-1.5" style={{ color: COLORS.inkSoft }}>
                    {u.role === "owner" ? (
                      (empresasByOwner[u.id] || []).join(", ") || "Nenhuma vinculada"
                    ) : restrito ? (
                      <span>{[...meusIds].map((id) => empresas.find((e) => e.id === id)?.nome || id).join(", ")}</span>
                    ) : (
                      <Badge tone="green">Todas as empresas</Badge>
                    )}
                  </td>
                  <td className="px-2.5 py-1.5 text-right">
                    <div className="flex justify-end gap-1">
                      {u.role !== "owner" && (
                        <Button variant="ghost" onClick={() => setAccessModal(u)} style={{ padding: "4px 9px", fontSize: 12.5 }}><Building2 size={12} /> Gerenciar acesso</Button>
                      )}
                      <Button variant="ghost" onClick={() => resetSenha(u)} style={{ padding: "4px 9px", fontSize: 12.5 }}><RotateCcw size={12} /> Redefinir senha</Button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <AuditLogReport empresas={empresas} users={users || []} />

      {modal && <NovoUsuarioModal onClose={() => setModal(null)} onSubmit={criarUsuario} busy={busy} />}
      {accessModal && (
        <StaffAccessModal
          usuario={accessModal}
          empresas={empresas}
          empresaIdsAtuais={staffAccess[accessModal.id] || new Set()}
          onClose={() => setAccessModal(null)}
          onSubmit={(ids) => salvarAcesso(accessModal.id, ids)}
        />
      )}
    </div>
  );
}

// Acesso por empresa de um Gestor/Operador — "Todas as empresas" é o padrão
// (nenhuma linha em staff_empresa_access) pra não quebrar quem já existia
// antes dessa função existir; escolher "Somente as selecionadas" só grava
// as marcadas, virando allowlist a partir daí.
function StaffAccessModal({ usuario, empresas, empresaIdsAtuais, onClose, onSubmit }) {
  const [restrito, setRestrito] = useState(empresaIdsAtuais.size > 0);
  const [checked, setChecked] = useState(() => new Set(empresaIdsAtuais));

  const toggle = (id) => setChecked((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <Modal title={`Acesso de ${usuario.nome || usuario.email}`} onClose={onClose}>
      <div className="grid gap-3">
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={!restrito} onChange={() => setRestrito(false)} /> Todas as empresas
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={restrito} onChange={() => setRestrito(true)} /> Somente as selecionadas
          </label>
        </div>
        {restrito && (
          <div className="max-h-64 overflow-y-auto rounded-lg border" style={{ borderColor: COLORS.border }}>
            {empresas.length === 0 ? (
              <p className="text-sm p-3" style={{ color: COLORS.inkSoft }}>Nenhuma empresa cadastrada.</p>
            ) : empresas.map((e) => (
              <label key={e.id} className="flex items-center gap-2 px-3 py-2 text-sm" style={{ borderTop: `1px solid ${COLORS.border}` }}>
                <input type="checkbox" checked={checked.has(e.id)} onChange={() => toggle(e.id)} />
                {e.nome}
              </label>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSubmit(restrito ? [...checked] : [])}>Salvar</Button>
        </div>
      </div>
    </Modal>
  );
}

// Produtividade: cruza o cronômetro automático (tempo) com o log de
// auditoria (quantidade de ações — baixa, agendar, autorizar, etc., já
// registradas em todo lançamento) por analista e por empresa. Existe pro
// gestor achar gargalo (quem/qual empresa consome mais tempo do que devia)
// ou desequilíbrio de carteira — nunca é visto pelo cliente.
function ProdutividadeView({ role, empresas = [], timeSessions = [] }) {
  const [profiles, setProfiles] = useState(null);
  const [logs, setLogs] = useState(null);
  const [mes, setMes] = useState(""); // "" = todo o período

  useEffect(() => {
    (async () => {
      const { data: profs } = await supabase.from("profiles").select("id, email, nome, role");
      setProfiles(profs || []);
      const { data: rows } = await supabase
        .from("auditLog")
        .select("empresaId, userEmail, created_at")
        .order("created_at", { ascending: false })
        .limit(5000);
      setLogs(rows || []);
    })();
  }, []);

  const meses = useMemo(() => {
    const out = [];
    const base = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return out;
  }, []);

  if (role !== "gestor") {
    return <EmptyState icon={ShieldCheck} title="Só gestor acessa Produtividade" subtitle="Peça pra um gestor consultar tempo e ações por analista/empresa." />;
  }
  if (profiles === null || logs === null) {
    return <p className="text-sm" style={{ color: COLORS.inkSoft }}>Carregando…</p>;
  }

  const nomePorEmail = new Map(profiles.map((p) => [p.email, p.nome || p.email]));
  const empresaNome = (id) => empresas.find((e) => e.id === id)?.nome || id;

  const sessoesF = timeSessions.filter((s) => s.fim && (!mes || (s.inicio || "").slice(0, 7) === mes));
  const logsF = (logs || []).filter((l) => l.userEmail !== "sistema" && (!mes || (l.created_at || "").slice(0, 7) === mes));

  const acumular = (chave) => {
    const map = new Map();
    sessoesF.forEach((s) => {
      const k = chave === "analista" ? s.userEmail : s.empresaId;
      if (!map.has(k)) map.set(k, { segundos: 0, acoes: 0 });
      map.get(k).segundos += (new Date(s.fim) - new Date(s.inicio)) / 1000;
    });
    logsF.forEach((l) => {
      const k = chave === "analista" ? l.userEmail : l.empresaId;
      if (!map.has(k)) map.set(k, { segundos: 0, acoes: 0 });
      map.get(k).acoes += 1;
    });
    return [...map.entries()].sort((a, b) => b[1].segundos - a[1].segundos);
  };

  const porAnalista = acumular("analista");
  const porEmpresa = acumular("empresa");

  const totalSegundos = (lista) => lista.reduce((s, [, v]) => s + v.segundos, 0);
  const DOTS = [COLORS.primary, COLORS.gold, COLORS.blue, COLORS.green, COLORS.red];

  return (
    <div className="space-y-4">
      <Header title="Produtividade" subtitle="Tempo (cronômetro automático) e ações registradas, por analista e por empresa — controle interno, nunca visto pelo cliente.">
        <Select value={mes} onChange={(e) => setMes(e.target.value)} style={{ width: 180 }}>
          <option value="">Todo o período</option>
          {meses.map((m) => <option key={m} value={m}>{fmtCompetencia(m)}</option>)}
        </Select>
      </Header>

      <div className="grid md:grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2.5 mb-3.5">
            <div className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center shrink-0" style={{ background: COLORS.greenSoft }}>
              <CalendarClock size={15} color={COLORS.primary} />
            </div>
            <h2 className="text-sm font-semibold flex-1" style={{ color: COLORS.ink }}>Horas por analista</h2>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: COLORS.greenSoft, color: COLORS.primary }}>
              {fmtDuracao(totalSegundos(porAnalista))}
            </span>
          </div>
          {porAnalista.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: COLORS.inkSoft }}>Sem cronômetro registrado nesse período.</p>
          ) : (
            <div className="space-y-3">
              {(() => {
                const max = Math.max(1, ...porAnalista.map(([, v]) => v.segundos));
                return porAnalista.map(([email, v]) => (
                  <div key={email}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs truncate" style={{ color: COLORS.ink }}>{nomePorEmail.get(email) || email}</span>
                      <span className="text-xs font-semibold tabular-nums shrink-0 ml-2" style={{ color: COLORS.primary }}>{fmtDuracao(v.segundos)}</span>
                    </div>
                    <div className="h-[8px] rounded-full overflow-hidden" style={{ background: "#F0EEE7" }}>
                      <div className="h-full rounded-full" style={{ background: COLORS.primary, width: `${Math.round((v.segundos / max) * 100)}%` }} />
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2.5 mb-3.5">
            <div className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center shrink-0" style={{ background: COLORS.goldSoft }}>
              <Building2 size={15} color={COLORS.gold} />
            </div>
            <h2 className="text-sm font-semibold flex-1" style={{ color: COLORS.ink }}>Horas por empresa</h2>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: COLORS.goldSoft, color: COLORS.gold }}>
              {fmtDuracao(totalSegundos(porEmpresa))}
            </span>
          </div>
          {porEmpresa.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: COLORS.inkSoft }}>Sem cronômetro registrado nesse período.</p>
          ) : (
            <div className="space-y-3">
              {(() => {
                const max = Math.max(1, ...porEmpresa.map(([, v]) => v.segundos));
                return porEmpresa.map(([id, v]) => (
                  <div key={id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs truncate" style={{ color: COLORS.ink }}>{empresaNome(id)}</span>
                      <span className="text-xs font-semibold tabular-nums shrink-0 ml-2" style={{ color: COLORS.gold }}>{fmtDuracao(v.segundos)}</span>
                    </div>
                    <div className="h-[8px] rounded-full overflow-hidden" style={{ background: "#F0EEE7" }}>
                      <div className="h-full rounded-full" style={{ background: COLORS.gold, width: `${Math.round((v.segundos / max) * 100)}%` }} />
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </Card>
      </div>

      <ReportCard title="Detalhe por analista" subtitle="Tempo total (cronômetro automático) e quantidade de ações registradas (baixas, agendamentos, autorizações...) no período.">
        {porAnalista.length === 0 ? (
          <p className="text-sm" style={{ color: COLORS.inkSoft }}>Nada registrado nesse período.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
                <th className="text-left font-medium px-2 py-1.5">Analista</th>
                <th className="text-right font-medium px-2 py-1.5">Tempo</th>
                <th className="text-right font-medium px-2 py-1.5">Ações</th>
              </tr>
            </thead>
            <tbody>
              {porAnalista.map(([email, v], i) => (
                <tr key={email} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                  <td className="px-2 py-1.5" style={{ color: COLORS.ink }}>
                    <span className="inline-block w-[7px] h-[7px] rounded-full mr-2" style={{ background: DOTS[i % DOTS.length] }} />
                    {nomePorEmail.get(email) || email}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: COLORS.ink }}>{fmtDuracao(v.segundos)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: COLORS.ink }}>{v.acoes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ReportCard>

      <ReportCard title="Detalhe por empresa" subtitle="Quais clientes consomem mais tempo/ações — ajuda a identificar gargalo ou carteira desequilibrada entre analistas.">
        {porEmpresa.length === 0 ? (
          <p className="text-sm" style={{ color: COLORS.inkSoft }}>Nada registrado nesse período.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
                <th className="text-left font-medium px-2 py-1.5">Empresa</th>
                <th className="text-right font-medium px-2 py-1.5">Tempo</th>
                <th className="text-right font-medium px-2 py-1.5">Ações</th>
              </tr>
            </thead>
            <tbody>
              {porEmpresa.map(([id, v], i) => (
                <tr key={id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                  <td className="px-2 py-1.5" style={{ color: COLORS.ink }}>
                    <span className="inline-block w-[7px] h-[7px] rounded-full mr-2" style={{ background: DOTS[i % DOTS.length] }} />
                    {empresaNome(id)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: COLORS.ink }}>{fmtDuracao(v.segundos)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: COLORS.ink }}>{v.acoes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ReportCard>
    </div>
  );
}

function formatCNPJ(digits) {
  const d = digits.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function formatCPF(digits) {
  const d = digits.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

function EmpresaModal({ initial, existingCount, onClose, onSubmit }) {
  const [form, setForm] = useState({ nome: "", cor: EMPRESA_CORES[existingCount % EMPRESA_CORES.length], ...initial });
  const [logoError, setLogoError] = useState("");
  const [cnpjStatus, setCnpjStatus] = useState(""); // "", "loading", "error"
  const [cnpjError, setCnpjError] = useState("");

  const buscarCnpj = async () => {
    const digits = (form.cnpj || "").replace(/\D/g, "");
    if (digits.length !== 14) {
      setCnpjError("CNPJ precisa ter 14 dígitos.");
      return;
    }
    setCnpjStatus("loading");
    setCnpjError("");
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) throw new Error(res.status === 404 ? "CNPJ não encontrado." : "Falha ao consultar.");
      const data = await res.json();
      const endereco = [
        data.logradouro && `${data.logradouro}${data.numero ? `, ${data.numero}` : ""}`,
        data.bairro,
        data.municipio && data.uf ? `${data.municipio}/${data.uf}` : data.municipio,
        data.cep,
      ].filter(Boolean).join(" — ");
      setForm((f) => ({
        ...f,
        nome: f.nome.trim() ? f.nome : (data.nome_fantasia || data.razao_social || f.nome),
        razaoSocial: data.razao_social || "",
        endereco,
      }));
      setCnpjStatus("");
    } catch (err) {
      setCnpjStatus("error");
      // "Failed to fetch" é o erro genérico que o navegador dá quando a
      // chamada nem chega a completar (ex: o serviço de consulta de CNPJ,
      // gratuito, respondeu 429 "muitas requisições" sem cabeçalho de CORS,
      // e o navegador bloqueia sem expor o motivo real pro JS) — troca por
      // uma explicação que a pessoa realmente consiga agir.
      const generic = !err.message || /failed to fetch/i.test(err.message);
      setCnpjError(
        generic
          ? "Não consegui buscar agora — o serviço de consulta de CNPJ pode estar temporariamente sobrecarregado. Tente de novo em alguns instantes, ou preencha os campos manualmente."
          : err.message
      );
    }
  };

  const handleLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError("");
    if (file.size > 400 * 1024) {
      setLogoError("Imagem muito grande — escolha um arquivo de até 400KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, logoUrl: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  return (
    <Modal title={initial.id ? "Editar empresa" : "Nova empresa"} onClose={onClose}>
      <div className="grid gap-3">
        <Field label="CNPJ (opcional — preenche nome e endereço automaticamente)">
          <div className="flex gap-2">
            <TextInput
              value={form.cnpj || ""}
              onChange={(e) => setForm({ ...form, cnpj: formatCNPJ(e.target.value) })}
              placeholder="00.000.000/0000-00"
            />
            <Button type="button" variant="subtle" onClick={buscarCnpj} disabled={cnpjStatus === "loading"}>
              <Search size={14} /> {cnpjStatus === "loading" ? "Buscando…" : "Buscar"}
            </Button>
          </div>
          {cnpjError && <p className="text-xs mt-1" style={{ color: COLORS.red }}>{cnpjError}</p>}
          {form.razaoSocial && <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>{form.razaoSocial}{form.endereco ? ` · ${form.endereco}` : ""}</p>}
        </Field>
        <Field label="Nome da empresa">
          <TextInput value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Casa Pôr do Sol" />
        </Field>
        <Field label="Segmento de atuação">
          <Select value={form.segmento || ""} onChange={(e) => setForm({ ...form, segmento: e.target.value })}>
            <option value="">Selecione…</option>
            {SEGMENTOS_EMPRESA.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Regime tributário (pra sugerir o Calendário Fiscal certo)">
          <Select value={form.regimeTributario || ""} onChange={(e) => setForm({ ...form, regimeTributario: e.target.value })}>
            <option value="">Selecione…</option>
            {REGIMES_TRIBUTARIOS.map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Proprietário">
            <TextInput value={form.proprietario || ""} onChange={(e) => setForm({ ...form, proprietario: e.target.value })} placeholder="Nome do(a) proprietário(a)" />
          </Field>
          <Field label="E-mail de contato">
            <TextInput type="email" value={form.contatoEmail || ""} onChange={(e) => setForm({ ...form, contatoEmail: e.target.value })} />
          </Field>
          <Field label="Celular de contato">
            <TextInput value={form.contatoCelular || ""} onChange={(e) => setForm({ ...form, contatoCelular: e.target.value })} placeholder="(00) 00000-0000" />
          </Field>
        </div>
        <p className="text-xs -mt-1" style={{ color: COLORS.inkSoft }}>
          Isso é só referência (WhatsApp/e-mail de contato) — não dá login. Pra esse proprietário acessar o sistema, use "Donos com acesso" no card da empresa, em Cadastros → Empresas.
        </p>

        <div className="pt-2 mt-1" style={{ borderTop: `1px solid ${COLORS.border}` }}>
          <p className="text-sm font-medium mb-3" style={{ color: COLORS.ink }}>Dados operacionais do BPO (uso interno)</p>
          <div className="grid gap-3">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Valor mensal (R$)">
                <TextInput type="number" step="0.01" value={form.contratoValorMensal ?? ""} onChange={(e) => setForm({ ...form, contratoValorMensal: e.target.value })} />
              </Field>
              <Field label="Início do contrato">
                <TextInput type="date" value={form.contratoInicio || ""} onChange={(e) => setForm({ ...form, contratoInicio: e.target.value })} />
              </Field>
              <Field label="Fim do contrato">
                <TextInput type="date" value={form.contratoVencimento || ""} onChange={(e) => setForm({ ...form, contratoVencimento: e.target.value })} />
              </Field>
            </div>
            <p className="text-xs -mt-1" style={{ color: COLORS.inkSoft }}>
              "Fim do contrato" alimenta o alerta de contrato vencendo, no menu ADM (aviso com 60 dias de antecedência).
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Contabilidade responsável">
                <TextInput value={form.contabilidadeNome || ""} onChange={(e) => setForm({ ...form, contabilidadeNome: e.target.value })} placeholder="Nome do escritório/contador" />
              </Field>
              <Field label="Contato da contabilidade">
                <TextInput value={form.contabilidadeContato || ""} onChange={(e) => setForm({ ...form, contabilidadeContato: e.target.value })} placeholder="Telefone ou e-mail" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Certificado digital">
                <Select value={form.certificadoDigitalTipo || ""} onChange={(e) => setForm({ ...form, certificadoDigitalTipo: e.target.value })}>
                  <option value="">Não informado</option>
                  <option value="A1">A1</option>
                  <option value="A3">A3</option>
                </Select>
              </Field>
              <Field label="Validade do certificado">
                <TextInput type="date" value={form.certificadoDigitalValidade || ""} onChange={(e) => setForm({ ...form, certificadoDigitalValidade: e.target.value })} />
              </Field>
            </div>
            <Field label="Observações / POP (procedimento operacional padrão)">
              <textarea
                value={form.observacoesOperacionais || ""}
                onChange={(e) => setForm({ ...form, observacoesOperacionais: e.target.value })}
                rows={3}
                className={inputCls}
                style={inputStyle}
                placeholder='Anotações de rotina desse cliente. Nunca anote senha/credencial aqui — só uma referência de onde encontrá-la (ex.: "senha do Simples Nacional está no cofre X").'
              />
            </Field>
          </div>
        </div>

        <Field label="Cor de identificação">
          <div className="flex gap-2 pt-1">
            {EMPRESA_CORES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setForm({ ...form, cor: c })}
                title={`Cor ${c}`}
                className="w-7 h-7 rounded-full"
                style={{ background: c, outline: form.cor === c ? `2px solid ${COLORS.ink}` : "none", outlineOffset: 2 }}
              />
            ))}
          </div>
        </Field>
        <Field label="Logomarca (opcional, aparece nos relatórios)">
          <div className="flex items-center gap-3">
            {form.logoUrl ? (
              <img src={form.logoUrl} alt="" className="w-12 h-12 rounded-lg object-contain" style={{ border: `1px solid ${COLORS.border}` }} />
            ) : (
              <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: "#EFEEE8" }}>
                <ImageIcon size={18} color={COLORS.inkSoft} />
              </div>
            )}
            <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer" style={{ background: "#EFEEE8", color: COLORS.ink }}>
              <Upload size={14} /> Escolher imagem
              <input type="file" accept="image/*" className="hidden" onChange={handleLogo} />
            </label>
            {form.logoUrl && (
              <button type="button" onClick={() => setForm((f) => ({ ...f, logoUrl: "" }))} className="text-xs underline" style={{ color: COLORS.inkSoft }}>
                Remover
              </button>
            )}
          </div>
          {logoError && <p className="text-xs mt-1" style={{ color: COLORS.red }}>{logoError}</p>}
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => form.nome.trim() && onSubmit({
              ...form,
              contratoValorMensal: form.contratoValorMensal === "" || form.contratoValorMensal == null ? null : Number(form.contratoValorMensal),
            })}
            disabled={!form.nome.trim()}
          >
            Salvar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function AccountsView({ accounts, selectedEmpresa, accountBalance, accountAvailableBalance, onSave }) {
  const [modal, setModal] = useState(null); // account being edited, or {} for new
  const visible = accounts.filter((a) => a.empresaId === selectedEmpresa);

  const submit = (form) => {
    if (form.id) {
      onSave(accounts.map((a) => (a.id === form.id ? form : a)));
    } else {
      onSave([...accounts, { ...form, id: uid() }]);
    }
    setModal(null);
  };

  const remove = (id) => {
    if (!confirmDelete("Excluir esta conta? Isso não pode ser desfeito.")) return;
    onSave(accounts.filter((a) => a.id !== id));
  };

  return (
    <div className="space-y-4">
      <Header title="Contas (Caixa & Bancos)" subtitle="Cadastre onde o dinheiro entra e sai.">
        <Button onClick={() => setModal({ empresaId: selectedEmpresa })}>
          <Plus size={15} /> Nova conta
        </Button>
      </Header>

      {visible.length === 0 ? (
        <Card><EmptyState icon={Landmark} title="Nenhuma conta cadastrada" subtitle="Cadastre o caixa e as contas bancárias desta empresa para começar a lançar." /></Card>
      ) : (
        <div className="grid md:grid-cols-3 gap-3">
          {visible.map((a) => (
            <Card key={a.id} className="p-4 flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-sm" style={{ color: COLORS.ink }}>{a.nome}</p>
                  <p className="text-xs" style={{ color: COLORS.inkSoft }}>{a.tipo}{a.banco ? ` · ${a.banco}` : ""}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setModal(a)} title="Editar conta" className="p-1.5 rounded-md hover:bg-black/5"><Pencil size={14} color={COLORS.inkSoft} /></button>
                  <button onClick={() => remove(a.id)} title="Excluir conta" className="p-1.5 rounded-md hover:bg-black/5"><Trash2 size={14} color={COLORS.red} /></button>
                </div>
              </div>
              <p className="text-xl font-semibold tabular-nums" style={{ color: accountBalance(a.id) >= 0 ? COLORS.green : COLORS.red }}>
                {fmtBRL(accountBalance(a.id))}
              </p>
              {accountAvailableBalance(a.id) !== accountBalance(a.id) && (
                <p className="text-xs tabular-nums" style={{ color: accountAvailableBalance(a.id) >= 0 ? COLORS.inkSoft : COLORS.red }}>
                  Saldo disponível (após agendamentos): <span className="font-medium">{fmtBRL(accountAvailableBalance(a.id))}</span>
                </p>
              )}
              <p className="text-xs" style={{ color: COLORS.inkSoft }}>
                Saldo inicial {fmtBRL(a.saldoInicial)} em {fmtDate(a.dataInicial)}
              </p>
            </Card>
          ))}
        </div>
      )}

      {modal && <AccountModal initial={modal} onClose={() => setModal(null)} onSubmit={submit} />}
    </div>
  );
}

function AccountModal({ initial, onClose, onSubmit }) {
  const [form, setForm] = useState({
    nome: "", tipo: "Conta Corrente", banco: "", agencia: "", contaNum: "",
    saldoInicial: 0, dataInicial: todayISO(), ...initial,
  });
  const [bancoOutro, setBancoOutro] = useState(() => !!form.banco && !BANCOS_BRASIL.some((b) => b.nome === form.banco));
  const valid = form.nome.trim() && form.empresaId;
  return (
    <Modal title={initial.id ? "Editar conta" : "Nova conta"} onClose={onClose}>
      <div className="grid gap-3">
        <Field label="Nome da conta">
          <TextInput value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Banco Bradesco" />
        </Field>
        <Field label="Tipo">
          <Select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
            <option>Caixa</option>
            <option>Conta Corrente</option>
            <option>Conta Poupança</option>
            <option>Conta Digital</option>
            <option>Cartão de Crédito</option>
            <option>Maquininha</option>
            <option>Delivery</option>
          </Select>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Banco">
            <Select
              value={bancoOutro ? "outro" : form.banco}
              onChange={(e) => {
                if (e.target.value === "outro") { setBancoOutro(true); setForm({ ...form, banco: "" }); }
                else { setBancoOutro(false); setForm({ ...form, banco: e.target.value }); }
              }}
            >
              <option value="">Selecione…</option>
              {BANCOS_BRASIL.map((b) => <option key={b.codigo} value={b.nome}>{b.codigo} — {b.nome}</option>)}
              <option value="outro">Outro banco</option>
            </Select>
            {bancoOutro && (
              <TextInput
                className="mt-1.5"
                value={form.banco}
                onChange={(e) => setForm({ ...form, banco: e.target.value })}
                placeholder="Nome do banco"
              />
            )}
          </Field>
          <Field label="Agência"><TextInput value={form.agencia} onChange={(e) => setForm({ ...form, agencia: e.target.value })} /></Field>
          <Field label="Conta nº"><TextInput value={form.contaNum} onChange={(e) => setForm({ ...form, contaNum: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Saldo inicial (R$)">
            <TextInput type="number" step="0.01" value={form.saldoInicial} onChange={(e) => setForm({ ...form, saldoInicial: e.target.value })} />
          </Field>
          <Field label="Data do saldo inicial">
            <TextInput type="date" value={form.dataInicial} max={todayISO()} onChange={(e) => setForm({ ...form, dataInicial: e.target.value })} />
          </Field>
        </div>
        <Field label="Convênio CNAB (opcional — só necessário pra exportar remessa de pagamentos)">
          <TextInput value={form.convenioCnab || ""} onChange={(e) => setForm({ ...form, convenioCnab: e.target.value })} placeholder="Código de convênio que o banco atribuiu pra essa conta" />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => valid && onSubmit(form)} disabled={!valid}>Salvar</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/*  Contatos (fornecedores/clientes) — cadastro único, usado tanto em      */
/*  Contas a Pagar quanto em Contas a Receber, pra futura cobrança.        */
/* ---------------------------------------------------------------------- */
const TIPO_CONTATO_LABELS = {
  cliente: "Cliente",
  fornecedor: "Fornecedor",
  socio: "Sócio",
  funcionario: "Funcionário",
};

function ContactsView({ contacts, selectedEmpresa, onSave }) {
  const [modal, setModal] = useState(null);
  const [importModal, setImportModal] = useState(false);
  const visible = contacts
    .filter((c) => !c.deletedAt && c.empresaId === selectedEmpresa)
    .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));

  const submit = (form) => {
    if (form.id) onSave(contacts.map((c) => (c.id === form.id ? form : c)));
    else onSave([...contacts, { ...form, id: uid() }]);
    setModal(null);
  };
  const remove = (id) => {
    if (!confirmDelete("Mover este contato pra lixeira? Você pode restaurar depois, em Lixeira.")) return;
    onSave(contacts.map((c) => (c.id === id ? { ...c, deletedAt: new Date().toISOString() } : c)));
  };

  return (
    <div className="space-y-4">
      <Header title="Contatos" subtitle="Fornecedores e clientes cadastrados — usados em Contas a Pagar/Receber e reaproveitados pra cobrança.">
        <Button variant="ghost" onClick={() => setImportModal(true)}>
          <Upload size={15} /> Importar contatos
        </Button>
        <Button onClick={() => setModal({ empresaId: selectedEmpresa })}>
          <Plus size={15} /> Novo contato
        </Button>
      </Header>
      <Card className="overflow-x-auto">
        {visible.length === 0 ? (
          <EmptyState icon={Contact} title="Nenhum contato cadastrado" subtitle="Cadastre aqui, ou deixe o sistema cadastrar sozinho ao lançar uma conta a pagar/receber com um nome novo." />
        ) : (
          <table className="w-full text-sm min-w-[680px]">
            <thead>
              <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
                <th className="text-left font-medium px-4 py-2.5">Nome</th>
                <th className="text-left font-medium px-4 py-2.5">Tipo</th>
                <th className="text-left font-medium px-4 py-2.5">CPF/CNPJ</th>
                <th className="text-left font-medium px-4 py-2.5">Contato</th>
                <th className="text-right font-medium px-4 py-2.5">Ações</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr key={c.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                  <td className="px-4 py-2.5" style={{ color: COLORS.ink }}>
                    <p className="font-medium">{c.nome}</p>
                    {c.email && <p className="text-xs" style={{ color: COLORS.inkSoft }}>{c.email}</p>}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: COLORS.inkSoft }}>{TIPO_CONTATO_LABELS[c.tipoContato] || "—"}</td>
                  <td className="px-4 py-2.5" style={{ color: COLORS.inkSoft }}>{c.documento || "—"}</td>
                  <td className="px-4 py-2.5" style={{ color: COLORS.inkSoft }}>{c.contato || "—"}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setModal(c)} title="Editar contato" className="p-1.5 rounded-md hover:bg-black/5"><Pencil size={14} color={COLORS.inkSoft} /></button>
                      <button onClick={() => remove(c.id)} title="Excluir contato" className="p-1.5 rounded-md hover:bg-black/5"><Trash2 size={14} color={COLORS.red} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {modal && <ContactModal initial={modal} contacts={contacts} onClose={() => setModal(null)} onSubmit={submit} />}
      {importModal && (
        <ImportContactsModal
          empresaId={selectedEmpresa}
          contacts={contacts}
          onClose={() => setImportModal(false)}
          onImport={(novos) => { onSave([...contacts, ...novos]); setImportModal(false); }}
        />
      )}
    </div>
  );
}

// Importação em lote de contatos a partir de .csv — pensado pro caso de
// já existir um cadastro de clientes/fornecedores em outro sistema (ex.:
// sistema de clínica) na hora de começar um contrato novo, sem digitar
// um por um. Mapeamento de coluna é manual (não por IA): aqui o que
// importa é exatidão do dado cadastral, não velocidade — errar CPF de
// um cliente pro outro é pior que gastar 30 segundos conferindo o
// mapeamento antes de confirmar.
function ImportContactsModal({ empresaId, contacts, onClose, onImport }) {
  const [rows, setRows] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [fileError, setFileError] = useState("");
  const [fileName, setFileName] = useState("");

  const CAMPOS = [
    { key: "nome", label: "Nome", required: true, guess: /nome|raz[aã]o.?social|cliente|fornecedor|paciente/i },
    { key: "documento", label: "CPF/CNPJ", guess: /cpf|cnpj|documento/i },
    { key: "contato", label: "Telefone", guess: /telefone|celular|fone|whats|contato/i },
    { key: "email", label: "E-mail", guess: /e-?mail/i },
  ];

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileError("");
    try {
      const raw = await file.text();
      const text = raw.replace(/^﻿/, "");
      const linhas = text.split(/\r?\n/).filter((l) => l.trim());
      if (linhas.length < 2) throw new Error("Arquivo vazio ou sem linhas de dados.");
      const sep = (linhas[0].match(/;/g) || []).length > (linhas[0].match(/,/g) || []).length ? ";" : ",";
      const parseLine = (l) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
      const hdrs = parseLine(linhas[0]);
      const data = linhas.slice(1).map((l) => {
        const cols = parseLine(l);
        const obj = {};
        hdrs.forEach((h, i) => { obj[h] = cols[i] ?? ""; });
        return obj;
      });
      const autoMap = {};
      CAMPOS.forEach(({ key, guess }) => {
        const found = hdrs.find((h) => guess.test(h));
        if (found) autoMap[key] = found;
      });
      setHeaders(hdrs);
      setRows(data);
      setMapping(autoMap);
      setFileName(file.name);
    } catch (err) {
      setFileError(err.message || "Não consegui ler esse arquivo — confira se é um .csv válido.");
    }
  };

  const nomeCol = mapping.nome;
  const prontos = rows && nomeCol ? rows.filter((r) => (r[nomeCol] || "").trim()) : [];
  const existentesLower = new Set(
    contacts.filter((c) => !c.deletedAt && c.empresaId === empresaId).map((c) => (c.nome || "").trim().toLowerCase())
  );
  const novos = prontos.filter((r) => !existentesLower.has((r[nomeCol] || "").trim().toLowerCase()));
  const duplicados = prontos.length - novos.length;

  const confirmar = () => {
    const criados = novos.map((r) => ({
      id: uid(),
      empresaId,
      nome: (r[mapping.nome] || "").trim(),
      documento: mapping.documento ? (r[mapping.documento] || "").trim() : "",
      contato: mapping.contato ? (r[mapping.contato] || "").trim() : "",
      email: mapping.email ? (r[mapping.email] || "").trim() : "",
    }));
    onImport(criados);
  };

  return (
    <Modal title="Importar contatos" onClose={onClose} wide>
      <div className="grid gap-3">
        <p className="text-xs -mt-1 px-3 py-2 rounded-lg" style={{ background: COLORS.goldSoft, color: COLORS.gold }}>
          Aceita arquivo .csv — se o cadastro do outro sistema só exportar em Excel, abra e salve como CSV antes de subir aqui.
        </p>
        {!rows ? (
          <label className="flex flex-col items-center justify-center gap-2 py-10 rounded-lg border-2 border-dashed cursor-pointer" style={{ borderColor: COLORS.border }}>
            <Upload size={22} color={COLORS.inkSoft} />
            <span className="text-sm" style={{ color: COLORS.inkSoft }}>Clique pra escolher o arquivo .csv</span>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
          </label>
        ) : (
          <>
            <p className="text-sm" style={{ color: COLORS.ink }}>{fileName} · {rows.length} linha(s) encontrada(s)</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {CAMPOS.map(({ key, label, required }) => (
                <Field key={key} label={`${label}${required ? " *" : ""}`}>
                  <Select value={mapping[key] || ""} onChange={(e) => setMapping((m) => ({ ...m, [key]: e.target.value || undefined }))}>
                    <option value="">Não importar</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </Select>
                </Field>
              ))}
            </div>
            {!nomeCol && <p className="text-xs" style={{ color: COLORS.red }}>Escolha qual coluna é o "Nome" pra continuar.</p>}
            {nomeCol && (
              <>
                <div className="rounded-lg border max-h-56 overflow-y-auto" style={{ borderColor: COLORS.border }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}`, background: "#FAFAF7" }}>
                        <th className="text-left font-medium px-3 py-2">Nome</th>
                        <th className="text-left font-medium px-3 py-2">CPF/CNPJ</th>
                        <th className="text-left font-medium px-3 py-2">Contato</th>
                        <th className="text-left font-medium px-3 py-2">E-mail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prontos.slice(0, 8).map((r, i) => (
                        <tr key={i} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                          <td className="px-3 py-2" style={{ color: COLORS.ink }}>{r[mapping.nome]}</td>
                          <td className="px-3 py-2" style={{ color: COLORS.inkSoft }}>{mapping.documento ? r[mapping.documento] : "—"}</td>
                          <td className="px-3 py-2" style={{ color: COLORS.inkSoft }}>{mapping.contato ? r[mapping.contato] : "—"}</td>
                          <td className="px-3 py-2" style={{ color: COLORS.inkSoft }}>{mapping.email ? r[mapping.email] : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {prontos.length > 8 && <p className="text-xs px-3 py-1.5" style={{ color: COLORS.inkSoft }}>+ {prontos.length - 8} linha(s)…</p>}
                </div>
                <p className="text-sm" style={{ color: COLORS.inkSoft }}>
                  {novos.length} novo(s) contato(s) a criar{duplicados > 0 ? ` · ${duplicados} já cadastrado(s) (mesmo nome), serão ignorados` : ""}
                </p>
              </>
            )}
          </>
        )}
        {fileError && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: COLORS.redSoft, color: COLORS.red }}>
            <AlertTriangle size={15} /> {fileError}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          {rows && (
            <Button onClick={confirmar} disabled={!nomeCol || novos.length === 0}>
              <Upload size={15} /> Importar {novos.length > 0 ? `(${novos.length})` : ""}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function ContactModal({ initial, contacts = [], onClose, onSubmit }) {
  const [form, setForm] = useState({
    nome: "", documento: "", contato: "", email: "",
    bancoCnab: "", agenciaCnab: "", contaCnab: "", contaCnabDigito: "", tipoContaCnab: "CC",
    ...initial,
    tipoPessoa: initial.tipoPessoa || "juridica",
    tipoContato: initial.tipoContato || "",
  });
  const [bancoCnabOutro, setBancoCnabOutro] = useState(() => !!form.bancoCnab && !BANCOS_BRASIL.some((b) => b.codigo === form.bancoCnab));
  const [autoFillNote, setAutoFillNote] = useState("");
  const [cnpjStatus, setCnpjStatus] = useState(""); // "", "loading", "error"
  const [cnpjError, setCnpjError] = useState("");
  const valid = form.nome.trim() && form.empresaId;

  const handleTipoPessoa = (tipoPessoa) => {
    if (tipoPessoa === form.tipoPessoa) return;
    setCnpjError("");
    setForm((f) => ({ ...f, tipoPessoa, documento: "" }));
  };

  // Mesma consulta pública (BrasilAPI) já usada no cadastro de Empresas —
  // só se aplica a CNPJ (não existe consulta pública gratuita por CPF).
  const buscarCnpj = async () => {
    const digits = (form.documento || "").replace(/\D/g, "");
    if (digits.length !== 14) {
      setCnpjError("CNPJ precisa ter 14 dígitos.");
      return;
    }
    setCnpjStatus("loading");
    setCnpjError("");
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) throw new Error(res.status === 404 ? "CNPJ não encontrado." : "Falha ao consultar.");
      const data = await res.json();
      setForm((f) => ({ ...f, nome: f.nome.trim() ? f.nome : (data.nome_fantasia || data.razao_social || f.nome) }));
      setCnpjStatus("");
    } catch (err) {
      setCnpjStatus("error");
      const generic = !err.message || /failed to fetch/i.test(err.message);
      setCnpjError(
        generic
          ? "Não consegui buscar agora — o serviço de consulta de CNPJ pode estar temporariamente sobrecarregado. Tente de novo em alguns instantes, ou preencha os campos manualmente."
          : err.message
      );
    }
  };

  // Mesmo nome já cadastrado em OUTRA empresa (ex: um fornecedor que atende
  // mais de uma do grupo) — copia CPF/CNPJ, contato e e-mail de lá pra não
  // pedir pra digitar de novo. Continua sendo um registro próprio desta
  // empresa, nunca compartilha o id (cada empresa mantém seu cadastro
  // segregado, como já conversamos).
  const handleNome = (nome) => {
    const nomeTrim = nome.trim().toLowerCase();
    const other = !initial.id && nomeTrim
      ? contacts.find((c) => !c.deletedAt && c.empresaId !== form.empresaId && c.nome.trim().toLowerCase() === nomeTrim)
      : null;
    if (other && !form.documento && !form.contato) {
      setForm((f) => ({ ...f, nome, documento: other.documento || "", contato: other.contato || "", email: other.email || "" }));
      setAutoFillNote(`Dados copiados do cadastro de "${other.nome}" em outra empresa — confira antes de salvar.`);
    } else {
      setForm((f) => ({ ...f, nome }));
      if (!other) setAutoFillNote("");
    }
  };

  return (
    <Modal title={initial.id ? "Editar contato" : "Novo contato"} onClose={onClose}>
      <div className="grid gap-3">
        {autoFillNote && (
          <p className="text-xs px-3 py-2 rounded-lg" style={{ background: COLORS.greenSoft, color: COLORS.green }}>
            {autoFillNote}
          </p>
        )}
        <Field label="Nome"><TextInput value={form.nome} onChange={(e) => handleNome(e.target.value)} /></Field>

        <Field label="Tipo de pessoa">
          <div className="inline-flex rounded-lg overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
            <button
              type="button"
              onClick={() => handleTipoPessoa("juridica")}
              className="px-3 py-1.5 text-sm"
              style={{ background: form.tipoPessoa === "juridica" ? COLORS.primary : "transparent", color: form.tipoPessoa === "juridica" ? "#fff" : COLORS.inkSoft }}
            >
              Pessoa Jurídica
            </button>
            <button
              type="button"
              onClick={() => handleTipoPessoa("fisica")}
              className="px-3 py-1.5 text-sm"
              style={{ background: form.tipoPessoa === "fisica" ? COLORS.primary : "transparent", color: form.tipoPessoa === "fisica" ? "#fff" : COLORS.inkSoft }}
            >
              Pessoa Física
            </button>
          </div>
        </Field>

        <Field label={form.tipoPessoa === "fisica" ? "CPF" : "CNPJ"}>
          <div className="flex gap-2">
            <TextInput
              value={form.documento}
              onChange={(e) => setForm({ ...form, documento: form.tipoPessoa === "fisica" ? formatCPF(e.target.value) : formatCNPJ(e.target.value) })}
              placeholder={form.tipoPessoa === "fisica" ? "000.000.000-00" : "00.000.000/0000-00"}
            />
            {form.tipoPessoa === "juridica" && (
              <Button type="button" variant="subtle" onClick={buscarCnpj} disabled={cnpjStatus === "loading"}>
                <Search size={14} /> {cnpjStatus === "loading" ? "Buscando…" : "Buscar"}
              </Button>
            )}
          </div>
          {cnpjError && <p className="text-xs mt-1" style={{ color: COLORS.red }}>{cnpjError}</p>}
        </Field>

        <Field label="Tipo de contato (opcional)">
          <Select value={form.tipoContato} onChange={(e) => setForm({ ...form, tipoContato: e.target.value })}>
            <option value="">Não classificado</option>
            <option value="cliente">Cliente</option>
            <option value="fornecedor">Fornecedor</option>
            <option value="socio">Sócio</option>
            <option value="funcionario">Funcionário</option>
          </Select>
        </Field>

        <Field label="Contato (telefone/WhatsApp)"><TextInput value={form.contato} onChange={(e) => setForm({ ...form, contato: e.target.value })} /></Field>
        <Field label="E-mail"><TextInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>

        <div className="pt-2 mt-1" style={{ borderTop: `1px solid ${COLORS.border}` }}>
          <p className="text-sm font-medium mb-3" style={{ color: COLORS.ink }}>Dados bancários (opcional — só necessário pra pagar via CNAB240)</p>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Banco">
                <Select
                  value={bancoCnabOutro ? "outro" : form.bancoCnab}
                  onChange={(e) => {
                    if (e.target.value === "outro") { setBancoCnabOutro(true); setForm({ ...form, bancoCnab: "" }); }
                    else { setBancoCnabOutro(false); setForm({ ...form, bancoCnab: e.target.value }); }
                  }}
                >
                  <option value="">Selecione…</option>
                  {BANCOS_BRASIL.map((b) => <option key={b.codigo} value={b.codigo}>{b.codigo} — {b.nome}</option>)}
                  <option value="outro">Outro banco (informar código)</option>
                </Select>
                {bancoCnabOutro && (
                  <TextInput
                    className="mt-1.5"
                    value={form.bancoCnab}
                    onChange={(e) => setForm({ ...form, bancoCnab: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                    placeholder="Código do banco (3 dígitos)"
                  />
                )}
              </Field>
              <Field label="Tipo de conta">
                <Select value={form.tipoContaCnab} onChange={(e) => setForm({ ...form, tipoContaCnab: e.target.value })}>
                  <option value="CC">Conta Corrente</option>
                  <option value="CP">Conta Poupança</option>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Agência"><TextInput value={form.agenciaCnab} onChange={(e) => setForm({ ...form, agenciaCnab: e.target.value })} /></Field>
              <Field label="Conta nº"><TextInput value={form.contaCnab} onChange={(e) => setForm({ ...form, contaCnab: e.target.value })} /></Field>
              <Field label="Dígito"><TextInput value={form.contaCnabDigito} onChange={(e) => setForm({ ...form, contaCnabDigito: e.target.value })} /></Field>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => valid && onSubmit(form)} disabled={!valid}>Salvar</Button>
        </div>
      </div>
    </Modal>
  );
}

// Acha ou cria (na hora, sem round-trip) um contato pelo nome dentro da
// empresa — usado pelos formulários de Contas a Pagar/Receber pra manter o
// cadastro único de terceiros alimentado sem exigir que o operador saia do
// fluxo de lançamento. Se o contato já existe e o operador preencheu
// documento/contato novos, atualiza os campos que estavam vazios.
function resolveContact(contacts, { nome, documento, contato, empresaId }) {
  const nomeTrim = (nome || "").trim();
  if (!nomeTrim || !empresaId) return { contacts, contact: null };
  const idx = contacts.findIndex(
    (c) => !c.deletedAt && c.empresaId === empresaId && c.nome.trim().toLowerCase() === nomeTrim.toLowerCase()
  );
  if (idx >= 0) {
    const existing = contacts[idx];
    const merged = {
      ...existing,
      documento: existing.documento || documento || "",
      contato: existing.contato || contato || "",
    };
    const next = contacts.map((c, i) => (i === idx ? merged : c));
    return { contacts: next, contact: merged };
  }
  // Mesmo nome já cadastrado em OUTRA empresa — copia CPF/CNPJ e contato de
  // lá, mas cria um registro próprio desta empresa (nunca compartilha id).
  const other = contacts.find(
    (c) => !c.deletedAt && c.empresaId !== empresaId && c.nome.trim().toLowerCase() === nomeTrim.toLowerCase()
  );
  const created = {
    id: uid(),
    empresaId,
    nome: nomeTrim,
    documento: documento || other?.documento || "",
    contato: contato || other?.contato || "",
    email: other?.email || "",
  };
  return { contacts: [...contacts, created], contact: created };
}

/* ---------------------------------------------------------------------- */
/*  Shared list header                                                     */
/* ---------------------------------------------------------------------- */
function Header({ title, subtitle, children }) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: COLORS.ink }}>{title}</h1>
        {subtitle && <p className="text-sm" style={{ color: COLORS.inkSoft }}>{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 print:hidden">{children}</div>
    </div>
  );
}

function FilterBar({ search, setSearch, status, setStatus, statusOptions, placeholder, dateFrom, setDateFrom, dateTo, setDateTo }) {
  return (
    <div
      className="flex items-center gap-2 flex-wrap p-2 rounded-xl"
      style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}` }}
    >
      <div className="relative flex-1 min-w-[200px]">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" color={COLORS.inkSoft} />
        <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder={placeholder} className="pl-8" style={{ height: 38 }} />
      </div>
      {statusOptions.length > 0 && (
        <Select value={status} onChange={(e) => setStatus(e.target.value)} style={{ height: 38, width: 176 }}>
          <option value="">Todos os status</option>
          {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
      )}
      {setDateFrom && (
        <div
          className="flex items-center gap-1.5 rounded-lg pl-2.5 pr-1.5 shrink-0"
          style={{ background: "#fff", border: `1px solid ${COLORS.border}`, height: 38 }}
        >
          <Calendar size={14} color={COLORS.inkSoft} className="shrink-0" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            title="Vencimento de"
            className="text-sm outline-none bg-transparent"
            style={{ color: COLORS.ink, width: 108 }}
          />
          <span className="text-xs shrink-0" style={{ color: COLORS.inkSoft }}>até</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            title="Vencimento até"
            className="text-sm outline-none bg-transparent"
            style={{ color: COLORS.ink, width: 108 }}
          />
          {(dateFrom || dateTo) ? (
            <button onClick={() => { setDateFrom(""); setDateTo(""); }} title="Limpar período" className="p-1 rounded-full hover:bg-black/5 shrink-0">
              <X size={13} color={COLORS.inkSoft} />
            </button>
          ) : (
            <span className="w-1.5 shrink-0" />
          )}
        </div>
      )}
    </div>
  );
}

function StatusSummary({ items, statuses }) {
  // auto-fit (em vez de repeat(N, 1fr) fixo) deixa o card nunca passar de
  // minmax — numa tela mais estreita (notebook menor) os cards que não
  // couberem na linha quebram pra linha de baixo, em vez de espremer até
  // o texto virar ilegível/sobrepor.
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
      {statuses.map(({ key, label, tone }) => {
        const subset = items.filter((i) => i.statusDisplay === key);
        const total = subset.reduce((s, i) => s + Number(i.valor || 0), 0);
        const bg = { green: COLORS.greenSoft, red: COLORS.redSoft, amber: COLORS.amberSoft, gold: COLORS.goldSoft, blue: COLORS.blueSoft, neutral: "#EEEDE7" }[tone];
        const fg = { green: COLORS.green, red: COLORS.red, amber: COLORS.amber, gold: COLORS.gold, blue: COLORS.blue, neutral: COLORS.inkSoft }[tone];
        return (
          <div key={key} className="rounded-lg p-2.5" style={{ background: bg }}>
            <p className="text-[11px]" style={{ color: fg }}>{label}</p>
            <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>{subset.length} · {fmtBRL(total)}</p>
          </div>
        );
      })}
    </div>
  );
}

// Recibo avulso pra imprimir/exportar como PDF (comprovante de um
// pagamento ou recebimento já baixado) — reusa o mesmo truque de
// impressão do Relatórios (print:hidden no conteúdo normal da tela,
// bloco próprio só visível em @media print), evitando que o resto da
// tabela/filtros entre na impressão junto.
function ReciboImpressao({ item, empresa, tipo }) {
  const isPagamento = tipo === "pagamento";
  const contraparte = isPagamento ? item.fornecedor : item.cliente;
  const valor = (isPagamento ? item.valorPago : item.valorRecebido) ?? item.valor;
  const data = isPagamento ? item.dataPgto : item.dataReceb;
  return (
    <div className="p-10 max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-8 pb-4" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
        {empresa?.logoUrl && <img src={empresa.logoUrl} alt="" className="w-12 h-12 rounded object-contain" />}
        <div>
          <p className="text-lg font-semibold" style={{ color: COLORS.ink }}>{empresa?.nome}</p>
          {empresa?.cnpj && <p className="text-xs" style={{ color: COLORS.inkSoft }}>CNPJ {empresa.cnpj}</p>}
        </div>
      </div>
      <h3 className="text-base font-semibold mb-5" style={{ color: COLORS.ink }}>
        Recibo de {isPagamento ? "Pagamento" : "Recebimento"}
      </h3>
      <div className="grid gap-2.5 text-sm" style={{ color: COLORS.ink }}>
        <p><span style={{ color: COLORS.inkSoft }}>{isPagamento ? "Pago a" : "Recebido de"}:</span> {contraparte}</p>
        {item.documento && <p><span style={{ color: COLORS.inkSoft }}>CPF/CNPJ:</span> {item.documento}</p>}
        <p><span style={{ color: COLORS.inkSoft }}>Valor:</span> {fmtBRL(valor)}</p>
        <p><span style={{ color: COLORS.inkSoft }}>Data:</span> {fmtDate(data)}</p>
        {item.categoria && <p><span style={{ color: COLORS.inkSoft }}>Categoria:</span> {item.categoria}</p>}
        {item.descricao && <p><span style={{ color: COLORS.inkSoft }}>Descrição:</span> {item.descricao}</p>}
        {item.numeroDocumento && <p><span style={{ color: COLORS.inkSoft }}>Nº documento:</span> {item.numeroDocumento}</p>}
      </div>
      <p className="text-xs mt-10" style={{ color: COLORS.inkSoft }}>Emitido em {fmtDate(todayISO())} pelo ESEK.</p>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Contas a Pagar                                                         */
/* ---------------------------------------------------------------------- */
const PAYABLES_KANBAN_COLUNAS = [
  { key: "A Pagar", tone: "neutral" },
  { key: "Agendado", tone: "gold" },
  { key: "Autorizado", tone: "blue" },
  { key: "Pago", tone: "green" },
];

// Quadro Kanban da Ordem de Pagamento — mesmas 4 etapas que já existem no
// banco (A Pagar → Agendado → Autorizado → Pago), só numa camada visual
// nova. Arrastar e soltar nativo do navegador (sem lib extra); cada drop
// dispara a mesma função que o botão equivalente da lista já chamava
// (ver handleDropPayable em PayablesView) — nunca um status cru.
function PayablesKanban({ payables, accounts, onDrop, onEdit }) {
  const [dragId, setDragId] = useState(null);
  const porColuna = (key) => payables.filter((p) => p.statusDisplay === key || (key === "A Pagar" && (p.statusDisplay === "Atrasado" || p.statusDisplay === "Próximo")));
  const contaNome = (id) => accounts.find((a) => a.id === id)?.nome || "—";

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      {PAYABLES_KANBAN_COLUNAS.map((col) => {
        const itens = porColuna(col.key);
        const totalCol = itens.reduce((s, p) => s + Number(p.valor || 0), 0);
        return (
          <div
            key={col.key}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragId) {
                const p = payables.find((x) => x.id === dragId);
                if (p) onDrop(col.key, p);
              }
              setDragId(null);
            }}
            className="rounded-xl p-2.5 min-h-[140px]"
            style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}` }}
          >
            <p className="text-xs font-semibold mb-0.5 px-1 flex items-center justify-between" style={{ color: COLORS.inkSoft }}>
              {col.key} <Badge tone={col.tone}>{itens.length}</Badge>
            </p>
            <p className="text-[11px] mb-2 px-1 tabular-nums" style={{ color: COLORS.inkSoft }}>{fmtBRL(totalCol)}</p>
            <div className="space-y-2">
              {itens.map((p) => (
                <div
                  key={p.id}
                  draggable
                  onDragStart={() => setDragId(p.id)}
                  onClick={() => onEdit && onEdit(p)}
                  className="rounded-lg p-2.5 cursor-grab active:cursor-grabbing"
                  style={{ background: "#fff", border: `1px solid ${COLORS.border}`, boxShadow: "0 1px 2px rgba(31,58,52,0.06)" }}
                >
                  <p className="text-sm font-medium truncate" style={{ color: COLORS.ink }}>{p.fornecedor}</p>
                  <p className="text-sm tabular-nums font-medium" style={{ color: COLORS.ink }}>{fmtBRL(p.valor)}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {col.key === "A Pagar" && (p.statusDisplay === "Atrasado" || p.statusDisplay === "Próximo") && (
                      <Badge tone={p.statusDisplay === "Atrasado" ? "red" : "amber"}>{p.statusDisplay}</Badge>
                    )}
                    <span className="text-xs" style={{ color: COLORS.inkSoft }}>
                      {col.key === "Pago" ? `Pago em ${fmtDate(p.dataPgto)}` : fmtDate(p.vencimento)}
                    </span>
                  </div>
                  {(col.key === "Agendado" || col.key === "Autorizado") && (
                    <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>Conta: {contaNome(p.contaAgendadaId)}</p>
                  )}
                  {col.key === "Autorizado" && p.autorizadoPor && (
                    <p className="text-xs mt-0.5 truncate" style={{ color: COLORS.inkSoft }} title={p.autorizadoPor}>Por: {p.autorizadoPor}</p>
                  )}
                </div>
              ))}
              {itens.length === 0 && (
                <p className="text-xs text-center py-4" style={{ color: COLORS.inkSoft }}>Arraste um cartão pra aqui</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PayablesView({
  payables, accounts, empresas, selectedEmpresa, categories, costCenters = [], contacts, onSaveContacts, onSave,
  pendingImport, onImportProcessed, userEmail, canEdit = true, role,
  remessasCnab = [], onSaveAccounts, onSaveRemessasCnab,
}) {
  const [modal, setModal] = useState(null);
  const [modoPayables, setModoPayables] = useState("lista"); // "lista" | "quadro"
  const [payModal, setPayModal] = useState(null);
  const [scheduleModal, setScheduleModal] = useState(false); // false | true (agendar em lote) | payable (arrastado no quadro)
  const [batchSettleModal, setBatchSettleModal] = useState(false);
  const [cnabModal, setCnabModal] = useState(false);
  const [remessasModal, setRemessasModal] = useState(false);
  const [reciboAlvo, setReciboAlvo] = useState(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [aiNote, setAiNote] = useState("");
  const [installmentsReview, setInstallmentsReview] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);

  const processExtractedDocument = async (fileBase64, mediaType) => {
    const ex = await callExtractDocument(fileBase64, mediaType, "payable");
    const categoriaMatch = categories.find((c) => c.nome === ex.categoria_sugerida)?.nome;
    const parcelas = Array.isArray(ex.parcelas) && ex.parcelas.length > 0 ? ex.parcelas : [ex];
    const empresaId = selectedEmpresa;

    if (parcelas.length > 1) {
      // Parcelas com valor/vencimento próprios (ex: carnê de IPTU) — nunca
      // passa pelo "Recorrente"/"Parcelas" do formulário, que repete valor
      // e soma meses a partir de uma data-base. Aqui cada linha guarda o
      // que a IA leu, pro operador conferir uma a uma antes de criar todas.
      setInstallmentsReview({
        party: ex.contraparte || "",
        categoria: categoriaMatch || categories[0]?.nome || "",
        empresaId,
        rows: parcelas.map((p, i) => ({
          numero: p.numero ?? i + 1,
          valor: p.valor != null ? String(p.valor) : "",
          vencimento: p.vencimento || "",
          descricao: p.descricao || `Parcela ${p.numero ?? i + 1}/${parcelas.length}`,
        })),
      });
    } else {
      const p = parcelas[0] || {};
      setAiNote("Dados extraídos automaticamente do documento — confira antes de salvar.");
      setPreviewDoc({ url: `data:${mediaType};base64,${fileBase64}`, mediaType });
      setModal({
        empresaId,
        fornecedor: ex.contraparte || "",
        valor: p.valor != null ? String(p.valor) : "",
        vencimento: p.vencimento || todayISO(),
        dataLanc: todayISO(),
        descricao: p.descricao || "",
        numeroDocumento: ex.numero_documento || "",
        documento: ex.documento_contraparte || "",
        tipoDocumento: ex.tipo_nota_fiscal || "",
        chaveAcesso: ex.chave_acesso || "",
        ...(categoriaMatch ? { categoria: categoriaMatch } : {}),
      });
    }
  };

  const handleImportDocument = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportError("");
    setImporting(true);
    try {
      const fileBase64 = await fileToBase64(file);
      await processExtractedDocument(fileBase64, file.type);
    } catch (err) {
      setImportError(err?.message || "Erro ao importar o documento.");
    } finally {
      setImporting(false);
    }
  };

  // Documento processado direto da caixa de entrada (link de upload sem
  // login) — o arquivo já vem baixado do Storage pelo FinanceiroApp. Só
  // marca o item como "processado" quando o lançamento resultante for de
  // fato salvo (ver submit/onConfirm mais abaixo) — nunca só por ter
  // aberto o modal de confirmação, senão um cancelamento faria o sistema
  // "esquecer" um boleto que nunca chegou a virar lançamento.
  const processedImportIds = useRef(new Set());
  const pendingUploadRef = useRef(null);
  useEffect(() => {
    if (!pendingImport || processedImportIds.current.has(pendingImport.id)) return;
    processedImportIds.current.add(pendingImport.id);
    (async () => {
      setImportError("");
      setImporting(true);
      try {
        await processExtractedDocument(pendingImport.fileBase64, pendingImport.mediaType);
        pendingUploadRef.current = pendingImport.id;
      } catch (err) {
        setImportError(err?.message || "Erro ao importar o documento.");
      } finally {
        setImporting(false);
      }
    })();
  }, [pendingImport]); // eslint-disable-line react-hooks/exhaustive-deps

  const withDerived = payables
    .filter((p) => !p.deletedAt && p.empresaId === selectedEmpresa)
    .map((p) => {
      // Atrasado/Próximo só faz sentido pra quem ainda está parado em "A
      // Pagar" — uma vez que o analista já propôs uma data (Agendado) ou o
      // dono já autorizou (Autorizado), o status mostra isso, não mais o
      // quão perto/longe o vencimento original está.
      let statusDisplay = p.status;
      if (p.status === "A Pagar" && p.vencimento < todayISO()) statusDisplay = "Atrasado";
      else if (p.status === "A Pagar" && daysUntil(p.vencimento) <= 10) statusDisplay = "Próximo";
      return { ...p, statusDisplay };
    });

  const filtered = withDerived.filter((p) => {
    if (status && p.statusDisplay !== status) return false;
    if (search && !`${p.fornecedor} ${p.descricao} ${p.categoria}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (dateFrom && (p.vencimento || "") < dateFrom) return false;
    if (dateTo && (p.vencimento || "") > dateTo) return false;
    return true;
  }).sort((a, b) => (b.dataLanc || "").localeCompare(a.dataLanc || ""));

  const submit = async (formOrList, contactInfo) => {
    const list = Array.isArray(formOrList) ? formOrList : [formOrList];
    let withContact = list;
    if (contactInfo && list[0]?.fornecedor && list[0]?.empresaId) {
      const { contacts: nextContacts, contact } = resolveContact(contacts, {
        nome: list[0].fornecedor, documento: contactInfo.documento, contato: contactInfo.contato, empresaId: list[0].empresaId,
      });
      if (contact) {
        onSaveContacts(nextContacts);
        withContact = list.map((f) => ({ ...f, contactId: contact.id }));
      }
    }
    const isEdit = withContact.length === 1 && withContact[0].id;
    let finalList = isEdit ? withContact : withContact.map((f) => ({ ...f, id: uid() }));
    if (previewDoc) {
      const path = await uploadDocumentoLancamento(selectedEmpresa, "payables", finalList[0].id, previewDoc);
      if (path) finalList = finalList.map((f) => ({ ...f, documentoArquivoPath: path }));
    }
    if (isEdit) {
      onSave(payables.map((p) => (p.id === finalList[0].id ? finalList[0] : p)));
    } else {
      onSave([...payables, ...finalList]);
    }
    setModal(null);
    setPreviewDoc(null);
    if (pendingUploadRef.current) {
      onImportProcessed?.(pendingUploadRef.current);
      pendingUploadRef.current = null;
    }
  };

  const remove = (id) => {
    if (!confirmDelete("Mover esta conta a pagar pra lixeira? Você pode restaurar depois, em Lixeira.")) return;
    onSave(payables.map((p) => (p.id === id ? { ...p, deletedAt: new Date().toISOString() } : p)));
  };

  // Referência legível de qual conta é essa no log de auditoria — sem
  // isso, duas baixas de mesmo valor (ex.: duas parcelas de R$79,84 em
  // meses diferentes) ficam indistinguíveis só pelo "Detalhe" da
  // Auditoria, que só mostrava valor+data.
  const refPayable = (id) => {
    const p = payables.find((x) => x.id === id);
    if (!p) return "";
    return `${p.fornecedor}${p.numeroDocumento ? ` · doc. ${p.numeroDocumento}` : ""} — `;
  };

  const confirmPayment = (id, dataPgto, valorPago, contaPgtoId, adj) => {
    const { juros = 0, multa = 0, desconto = 0 } = adj || {};
    const ref = refPayable(id);
    onSave(payables.map((p) => (p.id === id ? { ...p, status: "Pago", dataPgto, valorPago, contaPgtoId, juros, multa, desconto } : p)));
    const detalheAdj = (juros || multa || desconto)
      ? ` (juros ${fmtBRL(juros)}, multa ${fmtBRL(multa)}, desconto ${fmtBRL(desconto)})`
      : "";
    logAudit(selectedEmpresa, "payable", id, "baixa", `Dar baixa — ${ref}${fmtBRL(valorPago)} em ${fmtDate(dataPgto)}${detalheAdj}`, userEmail);
    setPayModal(null);
  };

  // "Agendar pagamentos" NÃO é uma baixa — é a proposta do analista BPO de
  // quando/de qual conta cada conta será paga, virando a "relação" que o
  // dono autoriza. Por isso a data é livre (inclusive futura) e nada em
  // valorPago/dataPgto/contaPgtoId é tocado aqui — só a baixa de verdade
  // (Dar baixa) mexe nesses campos.
  const confirmSchedule = (ids, agendadoPara, contaAgendadaId) => {
    const idSet = new Set(ids);
    const foiLote = scheduleModal === true;
    const atualizados = payables.map((p) => (idSet.has(p.id) ? { ...p, status: "Agendado", agendadoPara, contaAgendadaId } : p));
    onSave(atualizados);
    ids.forEach((id) => logAudit(selectedEmpresa, "payable", id, "agendar", `Incluído na ordem de pagamento — proposto pra ${fmtDate(agendadoPara)}`, userEmail));
    setScheduleModal(false);
    // "Agendar pagamentos" em lote (toolbar, usado tanto na Lista quanto
    // no Quadro) é um clique explícito de "terminei de selecionar" —
    // avisa o dono na hora. Um arrasto individual no Kanban não tem esse
    // sinal (pode vir mais um arrasto em seguida), por isso só fica
    // pendente e é consolidado quando a tela for fechada (ver useEffect
    // de cleanup, mais abaixo).
    if (foiLote) {
      const pendentes = atualizados.filter((p) => p.empresaId === selectedEmpresa && p.status === "Agendado" && !p.notificadoDonoEm);
      enviarNotificacaoDono(pendentes, atualizados, {
        onFail: () => alert("Cadastre o celular do dono em Cadastros → Editar empresa antes de notificar — o agendamento foi salvo normalmente."),
      });
    }
  };

  const confirmBatchPayment = (items, dataPgto, contaPgtoId) => {
    const valores = new Map(items.map((i) => [i.id, i.valor]));
    const refs = new Map(items.map((i) => [i.id, refPayable(i.id)]));
    onSave(payables.map((p) => (valores.has(p.id) ? { ...p, status: "Pago", dataPgto, valorPago: valores.get(p.id), contaPgtoId } : p)));
    items.forEach((i) => logAudit(selectedEmpresa, "payable", i.id, "baixa", `Dar baixa em lote — ${refs.get(i.id)}${fmtBRL(i.valor)} em ${fmtDate(dataPgto)}`, userEmail));
    setBatchSettleModal(false);
  };

  const authorizePayment = (p) => {
    if (!confirmDelete(`Autorizar o pagamento de "${p.fornecedor}" (${fmtBRL(p.valor)}, proposto pra ${fmtDate(p.agendadoPara)})?`)) return;
    onSave(payables.map((x) => (x.id === p.id ? { ...x, status: "Autorizado", autorizadoPor: userEmail, autorizadoEm: new Date().toISOString() } : x)));
    logAudit(selectedEmpresa, "payable", p.id, "autorizar", `Autorizou pagamento de ${fmtBRL(p.valor)}`, userEmail);
  };

  const cancelSchedule = (p) => {
    if (!confirmDelete(`Cancelar o agendamento de "${p.fornecedor}"? Ela volta pra "A Pagar".`)) return;
    onSave(payables.map((x) => (x.id === p.id ? { ...x, status: "A Pagar", agendadoPara: null, contaAgendadaId: null, autorizadoPor: null, autorizadoEm: null } : x)));
    logAudit(selectedEmpresa, "payable", p.id, "cancelar_agendamento", `Cancelou agendamento de ${fmtBRL(p.valor)}`, userEmail);
  };

  const cancelPayment = (p) => {
    if (!confirmDelete(`Cancelar a baixa de "${p.fornecedor}"? Ela volta pra "${p.autorizadoPor ? "Autorizado" : p.agendadoPara ? "Agendado" : "A Pagar"}".`)) return;
    const revertStatus = p.autorizadoPor ? "Autorizado" : p.agendadoPara ? "Agendado" : "A Pagar";
    onSave(payables.map((x) => (x.id === p.id ? { ...x, status: revertStatus, dataPgto: null, valorPago: null, contaPgtoId: null } : x)));
    logAudit(selectedEmpresa, "payable", p.id, "cancelar_baixa", `Cancelou baixa de ${p.fornecedor}${p.numeroDocumento ? ` · doc. ${p.numeroDocumento}` : ""} — ${fmtBRL(p.valorPago || p.valor)}`, userEmail);
  };

  // Arrastar um cartão no quadro Kanban reaproveita as mesmas ações do
  // botão de sempre — nenhuma transição nova, só outro jeito de disparar a
  // que já existe pra aquele par origem/destino. "Autorizado" continua só
  // pro dono (a trava real é no banco — fase23 — isso aqui só evita um
  // alerta de erro genérico quando não é o dono arrastando).
  const handleDropPayable = (targetStatus, p) => {
    if (p.status === targetStatus) return;
    if (targetStatus !== "Autorizado" && !canEdit) { alert("Você não tem permissão pra editar."); return; }
    if (targetStatus === "Pago") { setPayModal(p); return; }
    if (targetStatus === "Agendado") {
      if (p.status === "A Pagar") setScheduleModal(p);
      return;
    }
    if (targetStatus === "Autorizado") {
      if (p.status === "Pago") { cancelPayment(p); return; }
      if (p.status !== "Agendado") return;
      if (role !== "owner") { alert("Só o dono da empresa pode autorizar pagamento."); return; }
      authorizePayment(p);
      return;
    }
    if (targetStatus === "A Pagar") {
      if (p.status === "Pago") { cancelPayment(p); return; }
      if (p.status === "Agendado" || p.status === "Autorizado") cancelSchedule(p);
    }
  };

  const total = filtered.reduce((s, p) => s + Number(p.valor || 0), 0);
  const empresa = empresas.find((e) => e.id === selectedEmpresa);
  const agendados = withDerived.filter((p) => p.status === "Agendado");
  const autorizados = withDerived.filter((p) => p.status === "Autorizado");
  const remessasEmpresa = remessasCnab.filter((r) => r.empresaId === selectedEmpresa);

  // Gera a remessa CNAB240 e marca os itens incluídos como "enviados ao
  // banco" — a baixa em si continua manual, no fluxo de sempre; isso só dá
  // visibilidade de que aquele grupo já saiu num arquivo, pra não perder o
  // rastro enquanto o retorno automático não existe (ver Fase 20).
  const gerarRemessaCnab = ({ contaId, itens }) => {
    const conta = accounts.find((a) => a.id === contaId);
    const bancoInfo = BANCOS_BRASIL.find((b) => b.nome === conta.banco);
    if (!bancoInfo) {
      alert(`Não reconheço o código Febraban do banco "${conta.banco}" — edite a conta e selecione um banco da lista.`);
      return;
    }
    const { conteudo, numeroArquivo, quantidadeItens, valorTotal } = buildCnab240Remessa({
      empresa, conta, codigoBanco: bancoInfo.codigo, itens,
    });
    const remessaId = uid();
    onSaveRemessasCnab([...remessasCnab, {
      id: remessaId, empresaId: selectedEmpresa, contaId, numeroArquivo,
      geradoEm: new Date().toISOString(), geradoPor: userEmail, quantidadeItens, valorTotal,
    }]);
    onSaveAccounts(accounts.map((a) => (a.id === contaId ? { ...a, proximoNumeroRemessaCnab: numeroArquivo + 1 } : a)));
    const agora = new Date().toISOString();
    const idsIncluidos = new Set(itens.map(({ payable }) => payable.id));
    onSave(payables.map((p) => (idsIncluidos.has(p.id) ? { ...p, remessaCnabId: remessaId, remessaCnabEm: agora } : p)));
    itens.forEach(({ payable }) => logAudit(selectedEmpresa, "payable", payable.id, "remessa_cnab", `Incluído na remessa CNAB240 nº ${numeroArquivo} — ${fmtBRL(payable.valor)}`, userEmail));

    const blob = new Blob([conteudo], { type: "text/plain;charset=ascii" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CNAB240_${String(numeroArquivo).padStart(6, "0")}_${todayISO().replace(/-/g, "")}.rem`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setCnabModal(false);
  };

  const buildMensagemAgendados = (lista) => [
    `Olá! Segue a relação de pagamentos aguardando sua autorização${empresa ? ` (${empresa.nome})` : ""}:`,
    "",
    ...lista.map((p) => `• ${p.fornecedor} — ${fmtBRL(p.valor)} — proposto pra ${fmtDate(p.agendadoPara)}`),
    "",
    `Total: ${fmtBRL(lista.reduce((s, p) => s + Number(p.valor || 0), 0))}`,
    "",
    "Pode confirmar a autorização e/ou efetivação desses pagamentos?",
  ].join("\n");

  // Compartilhado pelo clique manual "Notificar dono" e pelos dois
  // gatilhos automáticos (confirmar "Agendar pagamentos" em lote, sair da
  // tela com arrasto pendente no Kanban) — sempre ordena pela data mais
  // próxima primeiro e marca os itens inclusos como avisados, pra uma
  // próxima mensagem automática nunca repetir nem perder item.
  const enviarNotificacaoDono = (lista, sourcePayables, { onFail } = {}) => {
    if (lista.length === 0) return false;
    const ordenada = [...lista].sort((a, b) => (a.agendadoPara || "").localeCompare(b.agendadoPara || ""));
    const enviou = openWhatsApp(empresa?.contatoCelular, buildMensagemAgendados(ordenada));
    if (enviou) {
      const ids = new Set(ordenada.map((p) => p.id));
      const agora = new Date().toISOString();
      onSave(sourcePayables.map((p) => (ids.has(p.id) ? { ...p, notificadoDonoEm: agora } : p)));
    } else {
      onFail?.();
    }
    return enviou;
  };

  const notifyOwner = () => {
    enviarNotificacaoDono(agendados, payables, {
      onFail: () => alert("Cadastre o celular do dono em Cadastros → Editar empresa antes de notificar."),
    });
  };

  // Ao sair da tela Contas a Pagar (trocar de view), consolida numa única
  // mensagem automática qualquer agendamento feito arrastando cartão por
  // cartão no Kanban que ainda não foi avisado — o lote confirmado pelo
  // toolbar já avisa na hora (ver confirmSchedule); isso só cobre o caso
  // de vários arrastos individuais em seguida, sem abrir um WhatsApp por
  // cartão. O cleanup roda no desmonte de verdade, por isso lê sempre do
  // ref (a closure do efeito, com deps vazias, ficaria presa nos valores
  // do primeiro render).
  const latestRef = useRef();
  latestRef.current = { payables, selectedEmpresa, enviarNotificacaoDono };
  useEffect(() => {
    return () => {
      const { payables, selectedEmpresa, enviarNotificacaoDono } = latestRef.current;
      const pendentes = payables.filter((p) => p.empresaId === selectedEmpresa && p.status === "Agendado" && !p.notificadoDonoEm);
      enviarNotificacaoDono(pendentes, payables);
    };
  }, []);

  return (
    <>
    <div className={`space-y-4 ${reciboAlvo ? "print:hidden" : ""}`}>
      <Header title="Contas a Pagar" subtitle={`${filtered.length} lançamento(s) · ${fmtBRL(total)}`}>
        {canEdit && (
          <>
            <label
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-40"
              style={{ background: "transparent", color: COLORS.primary, border: `1px solid ${COLORS.border}` }}
            >
              <Upload size={15} /> {importing ? "Lendo documento…" : "Importar documento"}
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleImportDocument} disabled={importing} />
            </label>
            <Button variant="ghost" onClick={() => setScheduleModal(true)}>
              <CalendarClock size={15} /> Agendar pagamentos
            </Button>
            <Button variant="ghost" onClick={() => setBatchSettleModal(true)}>
              <CheckCheck size={15} /> Dar baixa em lote
            </Button>
            {autorizados.length > 0 && (
              <Button variant="ghost" onClick={() => setCnabModal(true)} title="Gera o arquivo CNAB240 pra subir no internet banking, em vez de digitar cada pagamento autorizado manualmente">
                <FileUp size={15} /> Exportar CNAB240 ({autorizados.length})
              </Button>
            )}
            {remessasEmpresa.length > 0 && (
              <Button variant="ghost" onClick={() => setRemessasModal(true)}>
                <ClipboardList size={15} /> Remessas CNAB ({remessasEmpresa.length})
              </Button>
            )}
            {agendados.length > 0 && (
              <Button variant="ghost" onClick={notifyOwner} title="Abre o WhatsApp com uma mensagem pronta, listando os pagamentos agendados que aguardam autorização">
                <MessageCircle size={15} /> Notificar dono ({agendados.length})
              </Button>
            )}
            <Button onClick={() => { setAiNote(""); setModal({ empresaId: selectedEmpresa }); }}>
              <Plus size={15} /> Novo lançamento
            </Button>
          </>
        )}
      </Header>
      {importError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: COLORS.redSoft, color: COLORS.red }}>
          <AlertTriangle size={15} /> {importError}
        </div>
      )}
      <StatusSummary items={withDerived} statuses={[
        { key: "Atrasado", label: "Atrasado", tone: "red" },
        { key: "Próximo", label: "Próximo (10 dias)", tone: "amber" },
        { key: "Agendado", label: "Agendado", tone: "gold" },
        { key: "Autorizado", label: "Autorizado", tone: "blue" },
        { key: "A Pagar", label: "A pagar", tone: "neutral" },
        { key: "Pago", label: "Pago", tone: "green" },
      ]} />
      <FilterBar search={search} setSearch={setSearch} status={status} setStatus={setStatus}
        statusOptions={["Atrasado", "Próximo", "Agendado", "Autorizado", "A Pagar", "Pago"]} placeholder="Buscar fornecedor, descrição..."
        dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo} />

      <div className="inline-flex rounded-lg overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
        <button
          onClick={() => setModoPayables("lista")}
          className="px-3 py-1.5 text-sm"
          style={{ background: modoPayables === "lista" ? COLORS.primary : "transparent", color: modoPayables === "lista" ? "#fff" : COLORS.inkSoft }}
        >
          Lista
        </button>
        <button
          onClick={() => setModoPayables("quadro")}
          className="px-3 py-1.5 text-sm"
          style={{ background: modoPayables === "quadro" ? COLORS.primary : "transparent", color: modoPayables === "quadro" ? "#fff" : COLORS.inkSoft }}
        >
          Quadro
        </button>
      </div>

      {modoPayables === "quadro" ? (
        <PayablesKanban
          payables={filtered}
          accounts={accounts}
          onDrop={handleDropPayable}
          onEdit={canEdit ? (p) => { setAiNote(""); setModal(p); } : null}
        />
      ) : (
      <Card className="overflow-x-auto">
        {filtered.length === 0 ? (
          <EmptyState icon={ArrowUpCircle} title="Nenhum lançamento" subtitle="Cadastre as contas a pagar aqui." />
        ) : (
          <table className="w-full text-sm min-w-[840px]">
            <thead>
              <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
                <th className="text-left font-medium px-4 py-2.5">Data Lanç.</th>
                <th className="text-left font-medium px-4 py-2.5">Vencimento</th>
                <th className="text-left font-medium px-4 py-2.5">Fornecedor</th>
                <th className="text-left font-medium px-4 py-2.5">Categoria</th>
                <th className="text-right font-medium px-4 py-2.5">Valor</th>
                <th className="text-left font-medium px-4 py-2.5">Status</th>
                <th className="text-right font-medium px-4 py-2.5">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                  <td className="px-4 py-2.5" style={{ color: COLORS.inkSoft }}>{fmtDate(p.dataLanc)}</td>
                  <td className="px-4 py-2.5" style={{ color: COLORS.ink }}>{fmtDate(p.vencimento)}</td>
                  <td className="px-4 py-2.5" style={{ color: COLORS.ink }}>
                    <p className="font-medium">{p.fornecedor}</p>
                    <p className="text-xs" style={{ color: COLORS.inkSoft }}>{p.descricao}</p>
                  </td>
                  <td className="px-4 py-2.5" style={{ color: COLORS.inkSoft }}>{p.categoria}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium" style={{ color: COLORS.ink }}>
                    {fmtBRL(p.valor)}
                    {p.status === "Pago" && (p.juros || p.multa || p.desconto) ? (
                      <p className="text-[11px] font-normal" style={{ color: COLORS.inkSoft }}>
                        {[p.juros ? `+${fmtBRL(p.juros)} juros` : null, p.multa ? `+${fmtBRL(p.multa)} multa` : null, p.desconto ? `−${fmtBRL(p.desconto)} desc.` : null].filter(Boolean).join(" · ")}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={p.statusDisplay} />
                    {(p.status === "Agendado" || p.status === "Autorizado") && (
                      <p className="text-[11px] mt-0.5" style={{ color: COLORS.inkSoft }}>
                        {fmtDate(p.agendadoPara)} · {accounts.find((a) => a.id === p.contaAgendadaId)?.nome || "—"}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      {p.status === "Pago" && (
                        <button onClick={() => { setReciboAlvo(p); setTimeout(() => window.print(), 50); }} title="Imprimir recibo" className="p-1.5 rounded-md hover:bg-black/5"><Printer size={14} color={COLORS.inkSoft} /></button>
                      )}
                      {canEdit && p.status === "Pago" && (
                        <button onClick={() => cancelPayment(p)} title="Cancelar baixa" className="p-1.5 rounded-md hover:bg-black/5"><RotateCcw size={14} color={COLORS.amber} /></button>
                      )}
                      {p.status === "Agendado" && (
                        <>
                          {role === "owner" ? (
                            <Button variant="subtle" onClick={() => authorizePayment(p)} title={`Proposto pra ${fmtDate(p.agendadoPara)}`}><ShieldCheck size={13} /> Autorizar</Button>
                          ) : (
                            <span className="text-xs px-2 py-1 rounded-md" style={{ background: COLORS.goldSoft, color: COLORS.gold }}>Aguardando autorização do dono</span>
                          )}
                          {canEdit && (
                            <button onClick={() => cancelSchedule(p)} title="Cancelar agendamento (volta pra A Pagar)" className="p-1.5 rounded-md hover:bg-black/5"><RotateCcw size={14} color={COLORS.amber} /></button>
                          )}
                        </>
                      )}
                      {canEdit && p.status === "Autorizado" && (
                        <button onClick={() => cancelSchedule(p)} title="Cancelar agendamento (volta pra A Pagar)" className="p-1.5 rounded-md hover:bg-black/5"><RotateCcw size={14} color={COLORS.amber} /></button>
                      )}
                      {canEdit && p.status !== "Pago" && (
                        <Button variant="subtle" onClick={() => setPayModal(p)}><Check size={13} /> Dar baixa</Button>
                      )}
                      {p.documentoArquivoPath && (
                        <button onClick={() => abrirDocumentoLancamento(p.documentoArquivoPath)} title="Ver documento anexado" className="p-1.5 rounded-md hover:bg-black/5"><FileText size={14} color={COLORS.inkSoft} /></button>
                      )}
                      {canEdit && (
                        <>
                          <button onClick={() => { setAiNote(""); setModal(p); }} title="Editar lançamento" className="p-1.5 rounded-md hover:bg-black/5"><Pencil size={14} color={COLORS.inkSoft} /></button>
                          <button onClick={() => remove(p.id)} title="Excluir lançamento" className="p-1.5 rounded-md hover:bg-black/5"><Trash2 size={14} color={COLORS.red} /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      )}

      {modal && (
        <PayableModal
          initial={modal} categories={categories} costCenters={costCenters.filter((c) => c.empresaId === modal.empresaId)} contacts={contacts} accounts={accounts.filter((a) => a.empresaId === modal.empresaId)} aiNote={aiNote} previewDoc={previewDoc}
          onClose={() => { setModal(null); setAiNote(""); setPreviewDoc(null); pendingUploadRef.current = null; }}
          onSubmit={submit}
        />
      )}
      {installmentsReview && (
        <InstallmentsReviewModal
          review={installmentsReview}
          categories={categories}
          partyLabel="Fornecedor"
          onClose={() => { setInstallmentsReview(null); pendingUploadRef.current = null; }}
          onConfirm={(rows, party, categoria, empresaId) => {
            const { contacts: nextContacts, contact } = resolveContact(contacts, { nome: party, empresaId });
            if (contact) onSaveContacts(nextContacts);
            const novos = rows.map((r) => ({
              id: uid(),
              empresaId,
              dataLanc: todayISO(),
              vencimento: r.vencimento,
              fornecedor: party,
              contactId: contact?.id,
              categoria,
              descricao: r.descricao,
              valor: Number(r.valor),
              formaPgto: "Boleto",
              status: "A Pagar",
              conciliado: false,
            }));
            onSave([...payables, ...novos]);
            setInstallmentsReview(null);
            if (pendingUploadRef.current) {
              onImportProcessed?.(pendingUploadRef.current);
              pendingUploadRef.current = null;
            }
          }}
        />
      )}
      {payModal && (
        <SettleModal
          title="Dar baixa — Contas a Pagar"
          label="Valor pago"
          dateLabel="Data do pagamento"
          accountLabel="Conta de pagamento"
          item={payModal}
          accounts={accounts.filter((a) => a.empresaId === payModal.empresaId)}
          showAdjustments
          onClose={() => setPayModal(null)}
          onConfirm={(data, valor, contaId, adj) => confirmPayment(payModal.id, data, valor, contaId, adj)}
        />
      )}
      {scheduleModal && (
        <ScheduleModal
          title="Agendar pagamentos"
          nameField="fornecedor"
          items={scheduleModal === true
            ? payables.filter((p) => p.status === "A Pagar" && p.empresaId === selectedEmpresa)
            : [scheduleModal]}
          accounts={accounts.filter((a) => a.empresaId === selectedEmpresa)}
          onClose={() => setScheduleModal(false)}
          onConfirm={confirmSchedule}
        />
      )}
      {batchSettleModal && (
        <BatchSettleModal
          title="Dar baixa em lote — Contas a Pagar"
          nameField="fornecedor"
          valueLabel="Valor pago"
          dateLabel="Data do pagamento"
          accountLabel="Conta de pagamento"
          items={payables.filter((p) => p.status !== "Pago" && p.empresaId === selectedEmpresa)}
          accounts={accounts.filter((a) => a.empresaId === selectedEmpresa)}
          onClose={() => setBatchSettleModal(false)}
          onConfirm={confirmBatchPayment}
        />
      )}
      {cnabModal && (
        <CnabExportModal
          empresa={empresa}
          autorizados={autorizados}
          accounts={accounts.filter((a) => a.empresaId === selectedEmpresa)}
          contacts={contacts}
          onClose={() => setCnabModal(false)}
          onConfirm={gerarRemessaCnab}
        />
      )}
      {remessasModal && (
        <RemessasCnabModal
          remessas={remessasEmpresa}
          payables={payables}
          accounts={accounts}
          onClose={() => setRemessasModal(false)}
        />
      )}
    </div>
    {reciboAlvo && (
      <div className="hidden print:block">
        <ReciboImpressao item={reciboAlvo} empresa={empresa} tipo="pagamento" />
      </div>
    )}
    </>
  );
}

// Escolhe a conta pagadora (define o convênio/agência do Header do
// arquivo) e, a partir dela, os autorizados que já foram agendados pra
// sair daquela conta. Cada item passa por validarItensCnab antes de virar
// candidato selecionável — quem não tem dados bancários completos no
// cadastro de Contatos fica listado como pendência (com o motivo exato),
// em vez de travar quem já está pronto pra ir no arquivo.
function CnabExportModal({ empresa, autorizados, accounts, contacts, onClose, onConfirm }) {
  const [contaId, setContaId] = useState(accounts[0]?.id || "");
  const [checked, setChecked] = useState({});

  const conta = accounts.find((a) => a.id === contaId);
  const candidatos = conta ? autorizados.filter((p) => p.contaAgendadaId === contaId) : [];
  const resolvidos = candidatos.map((payable) => ({
    payable,
    favorecido: contacts.find((c) => c.id === payable.contactId),
  }));

  // validarItensCnab acumula primeiro os erros de empresa/conta, só depois
  // os de cada item — chamando sem itens dá só a parte geral; chamando com
  // 1 item e cortando esse mesmo prefixo isola o que é específico dele.
  const errosGerais = conta ? validarItensCnab({ empresa, conta, itens: [] }) : [];
  const comErro = resolvidos.map((r) => ({
    ...r,
    motivos: validarItensCnab({ empresa, conta, itens: [r] }).slice(errosGerais.length),
  }));
  const prontos = comErro.filter((r) => r.motivos.length === 0);
  const pendentes = comErro.filter((r) => r.motivos.length > 0);

  const selecionados = prontos.filter((r) => checked[r.payable.id]);
  const totalSelecionado = selecionados.reduce((s, r) => s + Number(r.payable.valor || 0), 0);

  const toggle = (id) => setChecked((c) => ({ ...c, [id]: !c[id] }));
  const toggleAll = () => {
    const allOn = prontos.length > 0 && prontos.every((r) => checked[r.payable.id]);
    const next = {};
    prontos.forEach((r) => { next[r.payable.id] = !allOn; });
    setChecked(next);
  };

  return (
    <Modal title="Exportar remessa CNAB240" onClose={onClose} wide>
      <div className="grid gap-3">
        <p className="text-xs -mt-1 px-3 py-2 rounded-lg" style={{ background: COLORS.goldSoft, color: COLORS.gold }}>
          Gera o arquivo-texto (.rem) pra subir no internet banking. Isso não dá baixa — a confirmação de pagamento continua manual, depois de checar no banco.
        </p>
        <Field label="Conta pagadora">
          <Select value={contaId} onChange={(e) => { setContaId(e.target.value); setChecked({}); }}>
            <option value="">Selecione uma conta</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </Select>
        </Field>

        {conta && errosGerais.length > 0 && (
          <div className="text-xs px-3 py-2 rounded-lg space-y-1" style={{ background: COLORS.redSoft, color: COLORS.red }}>
            {errosGerais.map((e, i) => <p key={i}>• {e}</p>)}
          </div>
        )}

        {!conta ? (
          <p className="text-sm py-6 text-center" style={{ color: COLORS.inkSoft }}>Escolha a conta pra ver os pagamentos autorizados dela.</p>
        ) : candidatos.length === 0 ? (
          <p className="text-sm py-6 text-center" style={{ color: COLORS.inkSoft }}>Nenhum pagamento autorizado agendado pra essa conta.</p>
        ) : (
          <>
            <div className="rounded-lg border max-h-72 overflow-y-auto" style={{ borderColor: COLORS.border }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}`, background: "#FAFAF7" }}>
                    <th className="text-left font-medium px-3 py-2">
                      <input type="checkbox" checked={prontos.length > 0 && prontos.every((r) => checked[r.payable.id])} onChange={toggleAll} disabled={prontos.length === 0} />
                    </th>
                    <th className="text-left font-medium px-3 py-2">Fornecedor</th>
                    <th className="text-left font-medium px-3 py-2">Vencimento</th>
                    <th className="text-right font-medium px-3 py-2">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {prontos.map((r) => (
                    <tr key={r.payable.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                      <td className="px-3 py-2"><input type="checkbox" checked={!!checked[r.payable.id]} onChange={() => toggle(r.payable.id)} /></td>
                      <td className="px-3 py-2" style={{ color: COLORS.ink }}>{r.payable.fornecedor}</td>
                      <td className="px-3 py-2" style={{ color: COLORS.ink }}>{fmtDate(r.payable.vencimento)}</td>
                      <td className="px-3 py-2 text-right tabular-nums" style={{ color: COLORS.ink }}>{fmtBRL(r.payable.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pendentes.length > 0 && (
              <div className="text-xs px-3 py-2 rounded-lg space-y-1" style={{ background: COLORS.amberSoft, color: COLORS.amber }}>
                <p className="font-medium">{pendentes.length} fora da remessa por falta de dados:</p>
                {pendentes.map((r) => (
                  <p key={r.payable.id}>• {r.payable.fornecedor}: {r.motivos[0]}</p>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <p className="text-sm" style={{ color: COLORS.inkSoft }}>
                {selecionados.length} selecionado(s) · <span className="font-semibold" style={{ color: COLORS.ink }}>{fmtBRL(totalSelecionado)}</span>
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                <Button
                  onClick={() => onConfirm({ contaId, itens: selecionados.map(({ payable, favorecido }) => ({ payable, favorecido })) })}
                  disabled={selecionados.length === 0}
                >
                  <FileUp size={15} /> Gerar arquivo {selecionados.length > 0 ? `(${selecionados.length})` : ""}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// Não existe retorno automático (fase 20 deixou isso pro backlog) — a
// única forma de saber "o que já foi pago de fato" é cruzar cada item da
// remessa com o status atual do lançamento: ainda "Autorizado" quer dizer
// que saiu no arquivo mas ninguém confirmou a baixa no banco; "Pago" quer
// dizer que o operador já checou e deu baixa pelo fluxo de sempre.
function RemessasCnabModal({ remessas, payables, accounts, onClose }) {
  const [aberta, setAberta] = useState(remessas[0]?.id || null);
  const ordenadas = [...remessas].sort((a, b) => (b.geradoEm || "").localeCompare(a.geradoEm || ""));

  return (
    <Modal title="Remessas CNAB240" onClose={onClose} wide>
      <div className="grid gap-3">
        {ordenadas.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Nenhuma remessa gerada ainda" subtitle="Exporte um arquivo CNAB240 em Contas a Pagar pra ela aparecer aqui." />
        ) : (
          ordenadas.map((r) => {
            const conta = accounts.find((a) => a.id === r.contaId);
            const itens = payables.filter((p) => p.remessaCnabId === r.id);
            const pagos = itens.filter((p) => p.status === "Pago").length;
            const isOpen = aberta === r.id;
            return (
              <div key={r.id} className="rounded-lg border" style={{ borderColor: COLORS.border }}>
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                  onClick={() => setAberta(isOpen ? null : r.id)}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: COLORS.ink }}>
                      Remessa nº {String(r.numeroArquivo).padStart(6, "0")} · {conta?.nome || "conta removida"}
                    </p>
                    <p className="text-xs" style={{ color: COLORS.inkSoft }}>
                      {fmtDate((r.geradoEm || "").slice(0, 10))} · {r.quantidadeItens} item(ns) · {fmtBRL(r.valorTotal)} · {pagos}/{itens.length} confirmado(s) pago
                    </p>
                  </div>
                  <ChevronDown size={16} color={COLORS.inkSoft} style={{ transform: isOpen ? "rotate(180deg)" : "none" }} />
                </button>
                {isOpen && (
                  <div className="border-t" style={{ borderColor: COLORS.border }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}`, background: "#FAFAF7" }}>
                          <th className="text-left font-medium px-3 py-2">Fornecedor</th>
                          <th className="text-right font-medium px-3 py-2">Valor</th>
                          <th className="text-left font-medium px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itens.map((p) => (
                          <tr key={p.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                            <td className="px-3 py-2" style={{ color: COLORS.ink }}>{p.fornecedor}</td>
                            <td className="px-3 py-2 text-right tabular-nums" style={{ color: COLORS.ink }}>{fmtBRL(p.valor)}</td>
                            <td className="px-3 py-2"><StatusBadge status={p.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
        <div className="flex justify-end pt-1">
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </Modal>
  );
}

// documento/contato só existem no formulário pra alimentar o cadastro de
// Contatos (ver resolveContact) — nunca são colunas de payables/receivables.
const stripInstallmentMeta = (f) => {
  const { parcelas, recorrente, repetirMeses, documento, contato, ...rest } = f;
  return rest;
};

function expandEntries(form) {
  const n = Math.max(1, Number(form.parcelas) || 1);
  if (n > 1) {
    const valorParcela = Math.round((Number(form.valor) / n) * 100) / 100;
    return Array.from({ length: n }, (_, i) => ({
      ...stripInstallmentMeta(form),
      valor: valorParcela,
      vencimento: addMonthsISO(form.vencimento, i),
      dataLanc: i === 0 ? form.dataLanc : addMonthsISO(form.dataLanc, i),
      descricao: `${form.descricao ? form.descricao + " " : ""}(${i + 1}/${n})`,
    }));
  }
  if (form.recorrente) {
    const m = Math.max(2, Number(form.repetirMeses) || 12);
    return Array.from({ length: m }, (_, i) => ({
      ...stripInstallmentMeta(form),
      vencimento: addMonthsISO(form.vencimento, i),
      dataLanc: i === 0 ? form.dataLanc : addMonthsISO(form.dataLanc, i),
    }));
  }
  return [stripInstallmentMeta(form)];
}

function InstallmentFields({ form, setForm }) {
  const hasParcelas = Number(form.parcelas) > 1;
  return (
    <div className="grid md:grid-cols-2 gap-3 md:col-span-2 p-3 rounded-lg" style={{ background: "#F6F5F1" }}>
      <Field label="Parcelas">
        <TextInput
          type="number" min="1" value={form.parcelas ?? 1} disabled={!!form.recorrente}
          onChange={(e) => setForm({ ...form, parcelas: e.target.value })}
        />
      </Field>
      <div className="flex flex-col gap-1 text-sm">
        <span className="font-medium" style={{ color: COLORS.inkSoft }}>Recorrente</span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox" checked={!!form.recorrente} disabled={hasParcelas}
              onChange={(e) => setForm({ ...form, recorrente: e.target.checked })}
            />
            Repetir por
          </label>
          <TextInput
            type="number" min="2" value={form.repetirMeses ?? 12} disabled={!form.recorrente}
            onChange={(e) => setForm({ ...form, repetirMeses: e.target.value })} className="w-20"
          />
          <span style={{ color: COLORS.inkSoft }}>meses</span>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  if (status === "Pago" || status === "Recebido") return <Badge tone="green">{status}</Badge>;
  if (status === "Atrasado" || status === "Inadimplente") return <Badge tone="red">{status}</Badge>;
  if (status === "Próximo") return <Badge tone="amber">{status}</Badge>;
  if (status === "Agendado" || status === "Antecipado") return <Badge tone="gold">{status}</Badge>;
  if (status === "Autorizado") return <Badge tone="blue">{status}</Badge>;
  return <Badge tone="neutral">{status}</Badge>;
}

function PayableModal({ initial, categories, costCenters = [], contacts = [], accounts = [], aiNote, previewDoc, onClose, onSubmit }) {
  const linkedContact = contacts.find((c) => c.id === initial.contactId);
  const [form, setForm] = useState({
    dataLanc: todayISO(), vencimento: todayISO(), fornecedor: "", categoria: categories[0]?.nome || "",
    descricao: "", valor: "", formaPgto: "PIX", status: "A Pagar",
    documento: linkedContact?.documento || "", contato: linkedContact?.contato || "",
    centroCusto: "", projeto: "", confirmarAutomaticamente: false, contaPadraoId: "", ...initial,
  });
  const valid = form.fornecedor.trim() && Number(form.valor) > 0 && form.empresaId;
  const contactOptions = contacts.filter((c) => !c.deletedAt && c.empresaId === form.empresaId);
  const handleFornecedor = (nome) => {
    const nomeTrim = nome.trim().toLowerCase();
    const match = contactOptions.find((c) => c.nome.toLowerCase() === nomeTrim)
      || contacts.find((c) => !c.deletedAt && c.nome.toLowerCase() === nomeTrim); // mesmo nome em outra empresa
    setForm((f) => ({
      ...f,
      fornecedor: nome,
      documento: match ? match.documento || f.documento : f.documento,
      contato: match ? match.contato || f.contato : f.contato,
    }));
  };
  return (
    <Modal title={initial.id ? "Editar conta a pagar" : "Nova conta a pagar"} onClose={onClose} wide={!previewDoc} xwide={!!previewDoc}>
      {aiNote && (
        <p className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: COLORS.greenSoft, color: COLORS.green }}>
          {aiNote}
        </p>
      )}
      <div className={previewDoc ? "grid md:grid-cols-[1fr_300px] gap-4" : ""}>
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Fornecedor">
            <TextInput list="contatos-fornecedor" value={form.fornecedor} onChange={(e) => handleFornecedor(e.target.value)} />
            <datalist id="contatos-fornecedor">
              {contactOptions.map((c) => <option key={c.id} value={c.nome} />)}
            </datalist>
          </Field>
          <Field label="Categoria">
            <Select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
              {categories.map((c) => <option key={c.codigo} value={c.nome}>{c.nome}</option>)}
            </Select>
          </Field>
          <Field label="Descrição"><TextInput value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="md:col-span-2" /></Field>
          <Field label="Nº do documento">
            <TextInput value={form.numeroDocumento || ""} onChange={(e) => setForm({ ...form, numeroDocumento: e.target.value })} placeholder="Nº da NF, boleto..." />
          </Field>
          <Field label="Tipo de documento">
            <Select value={form.tipoDocumento || ""} onChange={(e) => setForm({ ...form, tipoDocumento: e.target.value })}>
              <option value="">Não informado</option>
              <option value="NF-e">NF-e (produto)</option>
              <option value="NFS-e">NFS-e (serviço)</option>
              <option value="CT-e">CT-e (frete)</option>
              <option value="Outro">Outro</option>
            </Select>
          </Field>
          <Field label={form.tipoDocumento === "NFS-e" ? "Código de verificação" : "Chave de acesso"}>
            <TextInput
              value={form.chaveAcesso || ""}
              onChange={(e) => setForm({ ...form, chaveAcesso: e.target.value })}
              placeholder={form.tipoDocumento === "NFS-e" ? "Ex.: 7K9X-4T2P" : "44 dígitos"}
              className="md:col-span-2"
            />
          </Field>
          <Field label="Data de lançamento"><TextInput type="date" value={form.dataLanc} max={todayISO()} onChange={(e) => setForm({ ...form, dataLanc: e.target.value })} /></Field>
          <Field label="Vencimento"><TextInput type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} /></Field>
          <Field label="Valor (R$)"><TextInput type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></Field>
          <Field label="Forma de pagamento">
            <Select value={form.formaPgto} onChange={(e) => setForm({ ...form, formaPgto: e.target.value })}>
              <option>PIX</option><option>Boleto</option><option>TED</option><option>Dinheiro</option>
              <option>Cartão</option><option>Débito Automático</option>
            </Select>
          </Field>
          <Field label="CPF/CNPJ do fornecedor">
            <TextInput value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} placeholder="Opcional — usado pra cobrança futura" />
          </Field>
          <Field label="Contato do fornecedor">
            <TextInput value={form.contato} onChange={(e) => setForm({ ...form, contato: e.target.value })} placeholder="Telefone/WhatsApp" />
          </Field>
          <Field label="Centro de Custo">
            <Select value={form.centroCusto} onChange={(e) => setForm({ ...form, centroCusto: e.target.value })}>
              <option value="">Nenhum</option>
              {costCenters.map((c) => <option key={c.id} value={c.nome}>{c.nome}</option>)}
              {form.centroCusto && !costCenters.some((c) => c.nome === form.centroCusto) && (
                <option value={form.centroCusto}>{form.centroCusto} (não cadastrado)</option>
              )}
            </Select>
          </Field>
          <Field label="Projeto">
            <TextInput value={form.projeto} onChange={(e) => setForm({ ...form, projeto: e.target.value })} placeholder="Opcional — alimenta Relatórios → Cronograma de Desembolso" />
          </Field>
          <div className="md:col-span-2 flex items-start gap-2 pt-1">
            <input
              type="checkbox" id="confirmarAutoPay" className="mt-1"
              checked={form.confirmarAutomaticamente}
              onChange={(e) => setForm({ ...form, confirmarAutomaticamente: e.target.checked, contaPadraoId: e.target.checked ? form.contaPadraoId : "" })}
            />
            <label htmlFor="confirmarAutoPay" className="text-sm" style={{ color: COLORS.ink }}>
              Confirmar automaticamente no vencimento
              <span className="block text-xs" style={{ color: COLORS.inkSoft }}>Pra contas cujo valor e data já são certos (assinatura, mensalidade) — dá baixa sozinho na conta padrão abaixo, sem esperar clique.</span>
            </label>
          </div>
          {form.confirmarAutomaticamente && (
            <Field label="Conta padrão pra baixa automática">
              <Select value={form.contaPadraoId} onChange={(e) => setForm({ ...form, contaPadraoId: e.target.value })}>
                <option value="">Selecione uma conta</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </Select>
            </Field>
          )}
          {!initial.id && <InstallmentFields form={form} setForm={setForm} />}
        </div>
        <DocumentPreviewPanel doc={previewDoc} />
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button
          onClick={() => valid && onSubmit(initial.id ? stripInstallmentMeta(form) : expandEntries(form), { documento: form.documento, contato: form.contato })}
          disabled={!valid || (form.confirmarAutomaticamente && !form.contaPadraoId)}
        >
          Salvar
        </Button>
      </div>
    </Modal>
  );
}

// Revisão de parcelas extraídas de um documento (ex: carnê de IPTU) — cada
// parcela guarda o valor/vencimento que a IA leu no documento, não um
// cálculo de divisão igual nem uma data somada mês a mês (isso é o que o
// "Parcelas"/"Recorrente" do PayableModal fazem, e não serve aqui: parcelas
// reais de um carnê costumam ter valores diferentes entre si).
function InstallmentsReviewModal({ review, categories, partyLabel = "Fornecedor", onClose, onConfirm }) {
  const [party, setParty] = useState(review.party);
  const [categoria, setCategoria] = useState(review.categoria);
  const empresaId = review.empresaId;
  const [rows, setRows] = useState(review.rows);

  const updateRow = (i, patch) => setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const removeRow = (i) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  const valid = party.trim() && empresaId && rows.length > 0 && rows.every((r) => Number(r.valor) > 0 && r.vencimento);
  const total = rows.reduce((s, r) => s + (Number(r.valor) || 0), 0);

  return (
    <Modal title={`Revisar ${review.rows.length} parcela(s) extraída(s)`} onClose={onClose} wide>
      <p className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: COLORS.greenSoft, color: COLORS.green }}>
        Cada parcela veio com o valor e vencimento lidos direto do documento — confira e ajuste antes de criar os lançamentos. A data de lançamento de todas será hoje.
      </p>
      <div className="grid md:grid-cols-2 gap-3 mb-4">
        <Field label={partyLabel}><TextInput value={party} onChange={(e) => setParty(e.target.value)} /></Field>
        <Field label="Categoria">
          <Select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {categories.map((c) => <option key={c.codigo} value={c.nome}>{c.nome}</option>)}
          </Select>
        </Field>
      </div>
      <div className="max-h-[45vh] overflow-y-auto -mx-1 px-1">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
              <th className="text-left font-medium px-2 py-1.5">Parcela</th>
              <th className="text-left font-medium px-2 py-1.5">Vencimento</th>
              <th className="text-right font-medium px-2 py-1.5">Valor (R$)</th>
              <th className="text-left font-medium px-2 py-1.5">Descrição</th>
              <th className="px-2 py-1.5"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                <td className="px-2 py-1.5" style={{ color: COLORS.ink }}>{r.numero}</td>
                <td className="px-2 py-1.5">
                  <TextInput type="date" value={r.vencimento} onChange={(e) => updateRow(i, { vencimento: e.target.value })} className="w-36" />
                </td>
                <td className="px-2 py-1.5">
                  <TextInput type="number" step="0.01" value={r.valor} onChange={(e) => updateRow(i, { valor: e.target.value })} className="w-28 text-right" />
                </td>
                <td className="px-2 py-1.5">
                  <TextInput value={r.descricao} onChange={(e) => updateRow(i, { descricao: e.target.value })} />
                </td>
                <td className="px-2 py-1.5">
                  <button onClick={() => removeRow(i)} title="Remover parcela" className="p-1 rounded-md hover:bg-black/5"><Trash2 size={14} color={COLORS.red} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between pt-4">
        <p className="text-sm font-medium" style={{ color: COLORS.ink }}>Total: {fmtBRL(total)}</p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => valid && onConfirm(rows, party, categoria, empresaId)} disabled={!valid}>
            Criar {rows.length} lançamento(s)
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function SettleModal({ title, label, dateLabel, accountLabel, item, accounts, showAdjustments, onClose, onConfirm }) {
  // Se o item já tinha sido agendado (ordem de pagamento), a baixa parte
  // da data/conta propostas — desde que a data não seja futura, já que
  // baixa nunca pode ser.
  const [data, setData] = useState(item.agendadoPara && item.agendadoPara <= todayISO() ? item.agendadoPara : todayISO());
  const [valor, setValor] = useState(item.valor);
  const [contaId, setContaId] = useState(item.contaAgendadaId || accounts[0]?.id || "");
  const [juros, setJuros] = useState(item.juros || "");
  const [multa, setMulta] = useState(item.multa || "");
  const [desconto, setDesconto] = useState(item.desconto || "");

  // Juros/multa somam, desconto diminui — sempre recalculado a partir do
  // valor original do lançamento, nunca do que já estiver digitado em
  // "valor" (senão editar um dos 3 campos duas vezes acumularia errado).
  const recalc = (j, m, d) => {
    setValor(String(Number(item.valor || 0) + (Number(j) || 0) + (Number(m) || 0) - (Number(d) || 0)));
  };

  return (
    <Modal title={title} onClose={onClose}>
      <div className="grid gap-3">
        <Field label={dateLabel}>
          <TextInput type="date" value={data} max={todayISO()} onChange={(e) => setData(e.target.value)} />
          <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Baixa registra um pagamento que já aconteceu — não é possível dar baixa numa data futura.</p>
        </Field>
        {showAdjustments && (
          <div className="grid grid-cols-3 gap-2">
            <Field label="Juros">
              <TextInput type="number" step="0.01" value={juros} onChange={(e) => { setJuros(e.target.value); recalc(e.target.value, multa, desconto); }} placeholder="0,00" />
            </Field>
            <Field label="Multa">
              <TextInput type="number" step="0.01" value={multa} onChange={(e) => { setMulta(e.target.value); recalc(juros, e.target.value, desconto); }} placeholder="0,00" />
            </Field>
            <Field label="Desconto">
              <TextInput type="number" step="0.01" value={desconto} onChange={(e) => { setDesconto(e.target.value); recalc(juros, multa, e.target.value); }} placeholder="0,00" />
            </Field>
          </div>
        )}
        <Field label={label}>
          <TextInput type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
          {showAdjustments && <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Recalculado a partir do valor original + juros/multa − desconto — pode ajustar na mão se precisar.</p>}
        </Field>
        <Field label={accountLabel}>
          <Select value={contaId} onChange={(e) => setContaId(e.target.value)}>
            {accounts.length === 0 && <option value="">Cadastre uma conta primeiro</option>}
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </Select>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => onConfirm(data, valor, contaId, showAdjustments ? { juros: Number(juros) || 0, multa: Number(multa) || 0, desconto: Number(desconto) || 0 } : undefined)}
            disabled={!contaId}
          >
            Confirmar baixa
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ScheduleModal({ title, items, nameField, accounts, onClose, onConfirm }) {
  const [contaId, setContaId] = useState("");
  const [data, setData] = useState(todayISO());
  const [checked, setChecked] = useState({});

  const conta = accounts.find((a) => a.id === contaId);
  const candidatos = conta ? items.filter((i) => i.empresaId === conta.empresaId) : [];
  const selecionados = candidatos.filter((i) => checked[i.id]);
  const totalSelecionado = selecionados.reduce((s, i) => s + Number(i.valor || 0), 0);

  const toggle = (id) => setChecked((c) => ({ ...c, [id]: !c[id] }));
  const toggleAll = () => {
    const allOn = candidatos.length > 0 && candidatos.every((i) => checked[i.id]);
    const next = {};
    candidatos.forEach((i) => { next[i.id] = !allOn; });
    setChecked(next);
  };

  return (
    <Modal title={title} onClose={onClose} wide>
      <div className="grid gap-3">
        <p className="text-xs -mt-1 px-3 py-2 rounded-lg" style={{ background: COLORS.goldSoft, color: COLORS.gold }}>
          Isso ainda não é uma baixa — é a proposta de pagamento que o dono vai autorizar. Escolha a data que fizer sentido pro seu fluxo de caixa (pode ser futura).
        </p>
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Conta prevista pro pagamento">
            <Select value={contaId} onChange={(e) => { setContaId(e.target.value); setChecked({}); }}>
              <option value="">Selecione uma conta</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.nome}</option>
              ))}
            </Select>
          </Field>
          <Field label="Data proposta pro pagamento">
            <TextInput type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </Field>
        </div>

        {!contaId ? (
          <p className="text-sm py-6 text-center" style={{ color: COLORS.inkSoft }}>Escolha a conta pra ver as contas pendentes dela.</p>
        ) : candidatos.length === 0 ? (
          <p className="text-sm py-6 text-center" style={{ color: COLORS.inkSoft }}>Nada pendente pra essa empresa.</p>
        ) : (
          <div className="rounded-lg border max-h-72 overflow-y-auto" style={{ borderColor: COLORS.border }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}`, background: "#FAFAF7" }}>
                  <th className="text-left font-medium px-3 py-2">
                    <input type="checkbox" checked={candidatos.length > 0 && candidatos.every((i) => checked[i.id])} onChange={toggleAll} />
                  </th>
                  <th className="text-left font-medium px-3 py-2">Vencimento</th>
                  <th className="text-left font-medium px-3 py-2">{nameField === "fornecedor" ? "Fornecedor" : "Cliente"}</th>
                  <th className="text-right font-medium px-3 py-2">Valor</th>
                </tr>
              </thead>
              <tbody>
                {candidatos.map((i) => (
                  <tr key={i.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                    <td className="px-3 py-2"><input type="checkbox" checked={!!checked[i.id]} onChange={() => toggle(i.id)} /></td>
                    <td className="px-3 py-2" style={{ color: COLORS.ink }}>{fmtDate(i.vencimento)}</td>
                    <td className="px-3 py-2" style={{ color: COLORS.ink }}>{i[nameField]}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: COLORS.ink }}>{fmtBRL(i.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <p className="text-sm" style={{ color: COLORS.inkSoft }}>
            {selecionados.length} selecionado(s) · <span className="font-semibold" style={{ color: COLORS.ink }}>{fmtBRL(totalSelecionado)}</span>
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button
              onClick={() => onConfirm(selecionados.map((i) => i.id), data, contaId)}
              disabled={selecionados.length === 0}
            >
              Agendar {selecionados.length > 0 ? `(${selecionados.length})` : ""}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// Marcar um recebível como "em antecipação" (cartão, duplicata...) — igual
// "Agendar pagamentos", isso NÃO é baixa: só sinaliza a data/conta
// prevista, pra sair de "A Receber"/"Próximo" sem já contar como
// recebido. Reaproveita os mesmos nomes de campo do agendamento de
// pagamentos (agendadoPara/contaAgendadaId) pra herdar o pré-preenchimento
// que o SettleModal já faz na hora da baixa de verdade — é ali que entra
// o deságio da antecipação, no campo Desconto que já existe.
function AnticipateModal({ item, accounts, onClose, onConfirm }) {
  const [data, setData] = useState(item.agendadoPara || todayISO());
  const [contaId, setContaId] = useState(item.contaAgendadaId || accounts[0]?.id || "");
  return (
    <Modal title={`Antecipar recebível — ${item.cliente}`} onClose={onClose}>
      <div className="grid gap-3">
        <p className="text-xs px-3 py-2 rounded-lg" style={{ background: COLORS.goldSoft, color: COLORS.gold }}>
          Isso não é baixa — só sinaliza que esse valor está em processo de antecipação. Quando o crédito cair de fato na conta (normalmente com deságio), dê baixa e preencha o desconto.
        </p>
        <Field label="Data prevista do crédito">
          <TextInput type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </Field>
        <Field label="Conta que vai receber">
          <Select value={contaId} onChange={(e) => setContaId(e.target.value)}>
            {accounts.length === 0 && <option value="">Cadastre uma conta primeiro</option>}
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </Select>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onConfirm(data, contaId)} disabled={!contaId}>Marcar como antecipado</Button>
        </div>
      </div>
    </Modal>
  );
}

// Dar baixa em vários lançamentos de uma vez — conta e data são únicas pro
// lote (dá pra ajustar o valor linha a linha antes de confirmar), mas fica
// de fora daqui o que precisa de juros/multa/desconto: pra isso, baixa
// individual, que já suporta. É o equivalente do "Dar baixa" de sempre,
// só que pra várias contas ao mesmo tempo.
function BatchSettleModal({ title, items, nameField, valueLabel, dateLabel, accountLabel, accounts, onClose, onConfirm }) {
  const [contaId, setContaId] = useState("");
  const [data, setData] = useState(todayISO());
  const [checked, setChecked] = useState({});
  const [valores, setValores] = useState({}); // overrides pontuais { id: "123.45" }

  const conta = accounts.find((a) => a.id === contaId);
  const candidatos = conta ? items.filter((i) => i.empresaId === conta.empresaId) : [];
  const selecionados = candidatos.filter((i) => checked[i.id]);
  const valorDe = (i) => (valores[i.id] !== undefined ? valores[i.id] : String(i.valor ?? ""));
  const totalSelecionado = selecionados.reduce((s, i) => s + (Number(valorDe(i)) || 0), 0);

  const toggle = (id) => setChecked((c) => ({ ...c, [id]: !c[id] }));
  const toggleAll = () => {
    const allOn = candidatos.length > 0 && candidatos.every((i) => checked[i.id]);
    const next = {};
    candidatos.forEach((i) => { next[i.id] = !allOn; });
    setChecked(next);
  };

  const confirmar = () => {
    onConfirm(selecionados.map((i) => ({ id: i.id, valor: Number(valorDe(i)) || 0 })), data, contaId);
  };

  return (
    <Modal title={title} onClose={onClose} wide>
      <div className="grid gap-3">
        <div className="grid md:grid-cols-2 gap-3">
          <Field label={accountLabel}>
            <Select value={contaId} onChange={(e) => { setContaId(e.target.value); setChecked({}); }}>
              <option value="">Selecione uma conta</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </Select>
          </Field>
          <Field label={dateLabel}>
            <TextInput type="date" value={data} max={todayISO()} onChange={(e) => setData(e.target.value)} />
          </Field>
        </div>
        <p className="text-xs -mt-1" style={{ color: COLORS.inkSoft }}>
          Baixa em lote é pro caso simples (valor cheio, mesma conta e data pra todo mundo). Precisa de juros, multa ou desconto em algum? Dá baixa nele individualmente, na tabela.
        </p>

        {!contaId ? (
          <p className="text-sm py-6 text-center" style={{ color: COLORS.inkSoft }}>Escolha a conta pra ver os lançamentos em aberto dela.</p>
        ) : candidatos.length === 0 ? (
          <p className="text-sm py-6 text-center" style={{ color: COLORS.inkSoft }}>Nada em aberto pra essa empresa.</p>
        ) : (
          <div className="rounded-lg border max-h-80 overflow-y-auto" style={{ borderColor: COLORS.border }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}`, background: "#FAFAF7" }}>
                  <th className="text-left font-medium px-3 py-2">
                    <input type="checkbox" checked={candidatos.length > 0 && candidatos.every((i) => checked[i.id])} onChange={toggleAll} />
                  </th>
                  <th className="text-left font-medium px-3 py-2">Vencimento</th>
                  <th className="text-left font-medium px-3 py-2">{nameField === "fornecedor" ? "Fornecedor" : "Cliente"}</th>
                  <th className="text-left font-medium px-3 py-2">Status</th>
                  <th className="text-right font-medium px-3 py-2">{valueLabel}</th>
                </tr>
              </thead>
              <tbody>
                {candidatos.map((i) => (
                  <tr key={i.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                    <td className="px-3 py-2"><input type="checkbox" checked={!!checked[i.id]} onChange={() => toggle(i.id)} /></td>
                    <td className="px-3 py-2" style={{ color: COLORS.ink }}>{fmtDate(i.vencimento)}</td>
                    <td className="px-3 py-2" style={{ color: COLORS.ink }}>{i[nameField]}</td>
                    <td className="px-3 py-2"><StatusBadge status={i.status} /></td>
                    <td className="px-3 py-2 text-right">
                      <TextInput
                        type="number" step="0.01" value={valorDe(i)}
                        onChange={(e) => setValores((v) => ({ ...v, [i.id]: e.target.value }))}
                        className="w-28 text-right" style={{ height: 32 }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <p className="text-sm" style={{ color: COLORS.inkSoft }}>
            {selecionados.length} selecionado(s) · <span className="font-semibold" style={{ color: COLORS.ink }}>{fmtBRL(totalSelecionado)}</span>
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button onClick={confirmar} disabled={selecionados.length === 0}>
              Dar baixa {selecionados.length > 0 ? `(${selecionados.length})` : ""}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/*  Contas a Receber                                                       */
/* ---------------------------------------------------------------------- */
function ReceivablesView({
  receivables, accounts, empresas = [], selectedEmpresa, categories, costCenters = [], contacts, onSaveContacts, onSave,
  pendingImport, onImportProcessed, userEmail, canEdit = true,
}) {
  const [modal, setModal] = useState(null);
  const [recModal, setRecModal] = useState(null);
  const [batchSettleModal, setBatchSettleModal] = useState(false);
  const [reciboAlvo, setReciboAlvo] = useState(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [aiNote, setAiNote] = useState("");
  const [installmentsReview, setInstallmentsReview] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [cobrancas, setCobrancas] = useState({}); // { receivableId: created_at da última cobrança enviada }
  const [anticipateModal, setAnticipateModal] = useState(null);

  // Régua de cobrança: quando cada conta a receber foi cobrada por
  // último — não guarda estado próprio, só lê do mesmo log de auditoria
  // que já registra baixa/cancelamento (ver logAudit), então a "régua"
  // nunca fica fora de sincronia com o que realmente aconteceu.
  const loadCobrancas = useCallback(async () => {
    const { data, error } = await supabase
      .from("auditLog")
      .select("entityId, created_at")
      .eq("empresaId", selectedEmpresa)
      .eq("entity", "receivable")
      .eq("action", "cobranca")
      .order("created_at", { ascending: false });
    if (error) return;
    const map = {};
    for (const row of data) if (!map[row.entityId]) map[row.entityId] = row.created_at;
    setCobrancas(map);
  }, [selectedEmpresa]);
  useEffect(() => { loadCobrancas(); }, [loadCobrancas]);

  const notifyClient = (r) => {
    const contact = contacts.find((c) => c.id === r.contactId);
    const atrasado = r.statusDisplay === "Inadimplente";
    const dias = Math.abs(daysUntil(r.vencimento));
    const mensagem = atrasado
      ? `Olá, ${r.cliente}! Identificamos que o pagamento de ${fmtBRL(r.valor)} (${r.descricao || r.categoria}), com vencimento em ${fmtDate(r.vencimento)}, está em aberto há ${dias} dia(s). Poderia regularizar ou nos dar um retorno sobre o pagamento?`
      : `Olá, ${r.cliente}! Passando pra lembrar do pagamento de ${fmtBRL(r.valor)} (${r.descricao || r.categoria}), com vencimento em ${fmtDate(r.vencimento)}. Qualquer dúvida, estamos à disposição!`;
    if (!openWhatsApp(contact?.contato, mensagem)) {
      alert("Este cliente não tem telefone/WhatsApp cadastrado — edite o lançamento e preencha \"Contato do cliente\".");
      return;
    }
    logAudit(selectedEmpresa, "receivable", r.id, "cobranca", `Cobrança enviada — ${fmtBRL(r.valor)}, vencimento ${fmtDate(r.vencimento)}`, userEmail);
    loadCobrancas();
  };

  const processExtractedDocument = async (fileBase64, mediaType) => {
    const ex = await callExtractDocument(fileBase64, mediaType, "receivable");
    const categoriaMatch = categories.find((c) => c.nome === ex.categoria_sugerida)?.nome;
    const parcelas = Array.isArray(ex.parcelas) && ex.parcelas.length > 0 ? ex.parcelas : [ex];
    const empresaId = selectedEmpresa;

    if (parcelas.length > 1) {
      setInstallmentsReview({
        party: ex.contraparte || "",
        categoria: categoriaMatch || categories[0]?.nome || "",
        empresaId,
        rows: parcelas.map((p, i) => ({
          numero: p.numero ?? i + 1,
          valor: p.valor != null ? String(p.valor) : "",
          vencimento: p.vencimento || "",
          descricao: p.descricao || `Parcela ${p.numero ?? i + 1}/${parcelas.length}`,
        })),
      });
    } else {
      const p = parcelas[0] || {};
      setAiNote("Dados extraídos automaticamente do documento — confira antes de salvar.");
      setPreviewDoc({ url: `data:${mediaType};base64,${fileBase64}`, mediaType });
      setModal({
        empresaId,
        cliente: ex.contraparte || "",
        valor: p.valor != null ? String(p.valor) : "",
        vencimento: p.vencimento || todayISO(),
        dataLanc: todayISO(),
        descricao: p.descricao || "",
        numeroDocumento: ex.numero_documento || "",
        documento: ex.documento_contraparte || "",
        tipoDocumento: ex.tipo_nota_fiscal || "",
        chaveAcesso: ex.chave_acesso || "",
        ...(categoriaMatch ? { categoria: categoriaMatch } : {}),
      });
    }
  };

  const handleImportDocument = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportError("");
    setImporting(true);
    try {
      const fileBase64 = await fileToBase64(file);
      await processExtractedDocument(fileBase64, file.type);
    } catch (err) {
      setImportError(err?.message || "Erro ao importar o documento.");
    } finally {
      setImporting(false);
    }
  };

  const processedImportIds = useRef(new Set());
  const pendingUploadRef = useRef(null);
  useEffect(() => {
    if (!pendingImport || processedImportIds.current.has(pendingImport.id)) return;
    processedImportIds.current.add(pendingImport.id);
    (async () => {
      setImportError("");
      setImporting(true);
      try {
        await processExtractedDocument(pendingImport.fileBase64, pendingImport.mediaType);
        pendingUploadRef.current = pendingImport.id;
      } catch (err) {
        setImportError(err?.message || "Erro ao importar o documento.");
      } finally {
        setImporting(false);
      }
    })();
  }, [pendingImport]); // eslint-disable-line react-hooks/exhaustive-deps

  const withDerived = receivables
    .filter((r) => !r.deletedAt && r.empresaId === selectedEmpresa)
    .map((r) => {
      // Inadimplente/Próximo só valem pra quem ainda está parado em "A
      // Receber" puro — uma vez antecipado, mostra o status dele mesmo.
      let statusDisplay = r.status;
      if (r.status === "A Receber" && r.vencimento < todayISO()) statusDisplay = "Inadimplente";
      else if (r.status === "A Receber" && daysUntil(r.vencimento) <= 10) statusDisplay = "Próximo";
      return { ...r, statusDisplay };
    });

  const filtered = withDerived.filter((r) => {
    if (status && r.statusDisplay !== status) return false;
    if (search && !`${r.cliente} ${r.descricao} ${r.categoria}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (dateFrom && (r.vencimento || "") < dateFrom) return false;
    if (dateTo && (r.vencimento || "") > dateTo) return false;
    return true;
  }).sort((a, b) => (b.dataLanc || "").localeCompare(a.dataLanc || ""));

  const submit = async (formOrList, contactInfo) => {
    const list = Array.isArray(formOrList) ? formOrList : [formOrList];
    let withContact = list;
    if (contactInfo && list[0]?.cliente && list[0]?.empresaId) {
      const { contacts: nextContacts, contact } = resolveContact(contacts, {
        nome: list[0].cliente, documento: contactInfo.documento, contato: contactInfo.contato, empresaId: list[0].empresaId,
      });
      if (contact) {
        onSaveContacts(nextContacts);
        withContact = list.map((f) => ({ ...f, contactId: contact.id }));
      }
    }
    const isEdit = withContact.length === 1 && withContact[0].id;
    let finalList = isEdit ? withContact : withContact.map((f) => ({ ...f, id: uid() }));
    if (previewDoc) {
      const path = await uploadDocumentoLancamento(selectedEmpresa, "receivables", finalList[0].id, previewDoc);
      if (path) finalList = finalList.map((f) => ({ ...f, documentoArquivoPath: path }));
    }
    if (isEdit) {
      onSave(receivables.map((r) => (r.id === finalList[0].id ? finalList[0] : r)));
    } else {
      onSave([...receivables, ...finalList]);
    }
    setModal(null);
    setPreviewDoc(null);
    if (pendingUploadRef.current) {
      onImportProcessed?.(pendingUploadRef.current);
      pendingUploadRef.current = null;
    }
  };
  const remove = (id) => {
    if (!confirmDelete("Mover esta conta a receber pra lixeira? Você pode restaurar depois, em Lixeira.")) return;
    onSave(receivables.map((r) => (r.id === id ? { ...r, deletedAt: new Date().toISOString() } : r)));
  };
  // Referência legível de qual conta é essa no log de auditoria — sem
  // isso, duas baixas de mesmo valor (ex.: duas mensalidades de cliente
  // diferente) ficam indistinguíveis só pelo "Detalhe" da Auditoria, que
  // só mostrava valor+data.
  const refReceivable = (id) => {
    const r = receivables.find((x) => x.id === id);
    if (!r) return "";
    return `${r.cliente}${r.numeroDocumento ? ` · doc. ${r.numeroDocumento}` : ""} — `;
  };

  const confirmReceipt = (id, dataReceb, valorRecebido, contaRecebId, adj) => {
    const { juros = 0, multa = 0, desconto = 0 } = adj || {};
    const ref = refReceivable(id);
    onSave(receivables.map((r) => (r.id === id ? { ...r, status: "Recebido", dataReceb, valorRecebido, contaRecebId, juros, multa, desconto } : r)));
    const detalheAdj = (juros || multa || desconto)
      ? ` (juros ${fmtBRL(juros)}, multa ${fmtBRL(multa)}, desconto ${fmtBRL(desconto)})`
      : "";
    logAudit(selectedEmpresa, "receivable", id, "baixa", `Dar baixa — ${ref}${fmtBRL(valorRecebido)} em ${fmtDate(dataReceb)}${detalheAdj}`, userEmail);
    setRecModal(null);
  };
  const confirmBatchReceipt = (items, dataReceb, contaRecebId) => {
    const valores = new Map(items.map((i) => [i.id, i.valor]));
    const refs = new Map(items.map((i) => [i.id, refReceivable(i.id)]));
    onSave(receivables.map((r) => (valores.has(r.id) ? { ...r, status: "Recebido", dataReceb, valorRecebido: valores.get(r.id), contaRecebId } : r)));
    items.forEach((i) => logAudit(selectedEmpresa, "receivable", i.id, "baixa", `Dar baixa em lote — ${refs.get(i.id)}${fmtBRL(i.valor)} em ${fmtDate(dataReceb)}`, userEmail));
    setBatchSettleModal(false);
  };
  const cancelReceipt = (r) => {
    const revertStatus = r.agendadoPara ? "Antecipado" : "A Receber";
    if (!confirmDelete(`Cancelar o recebimento de "${r.cliente}"? Ele volta pra "${revertStatus}".`)) return;
    onSave(receivables.map((x) => (x.id === r.id ? { ...x, status: revertStatus, dataReceb: null, valorRecebido: null, contaRecebId: null } : x)));
    logAudit(selectedEmpresa, "receivable", r.id, "cancelar_baixa", `Cancelou recebimento de ${r.cliente}${r.numeroDocumento ? ` · doc. ${r.numeroDocumento}` : ""} — ${fmtBRL(r.valorRecebido || r.valor)}`, userEmail);
  };
  const anticipateReceivable = (data, contaId) => {
    const r = anticipateModal;
    onSave(receivables.map((x) => (x.id === r.id ? { ...x, status: "Antecipado", agendadoPara: data, contaAgendadaId: contaId } : x)));
    logAudit(selectedEmpresa, "receivable", r.id, "antecipar", `Marcado como antecipação — previsto pra ${fmtDate(data)}`, userEmail);
    setAnticipateModal(null);
  };
  const cancelAnticipation = (r) => {
    if (!confirmDelete(`Cancelar a antecipação de "${r.cliente}"? Ele volta pra "A Receber".`)) return;
    onSave(receivables.map((x) => (x.id === r.id ? { ...x, status: "A Receber", agendadoPara: null, contaAgendadaId: null } : x)));
    logAudit(selectedEmpresa, "receivable", r.id, "cancelar_antecipacao", `Cancelou antecipação de ${fmtBRL(r.valor)}`, userEmail);
  };

  const total = filtered.reduce((s, r) => s + Number(r.valor || 0), 0);
  const empresa = empresas.find((e) => e.id === selectedEmpresa);

  return (
    <>
    <div className={`space-y-4 ${reciboAlvo ? "print:hidden" : ""}`}>
      <Header title="Contas a Receber" subtitle={`${filtered.length} lançamento(s) · ${fmtBRL(total)}`}>
        {canEdit && (
          <>
            <label
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-40"
              style={{ background: "transparent", color: COLORS.primary, border: `1px solid ${COLORS.border}` }}
            >
              <Upload size={15} /> {importing ? "Lendo documento…" : "Importar documento"}
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleImportDocument} disabled={importing} />
            </label>
            <Button variant="ghost" onClick={() => setBatchSettleModal(true)}>
              <CheckCheck size={15} /> Dar baixa em lote
            </Button>
            <Button onClick={() => { setAiNote(""); setModal({ empresaId: selectedEmpresa }); }}>
              <Plus size={15} /> Novo lançamento
            </Button>
          </>
        )}
      </Header>
      {importError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: COLORS.redSoft, color: COLORS.red }}>
          <AlertTriangle size={15} /> {importError}
        </div>
      )}
      <StatusSummary items={withDerived} statuses={[
        { key: "Inadimplente", label: "Inadimplente", tone: "red" },
        { key: "Próximo", label: "Próximo (10 dias)", tone: "amber" },
        { key: "Antecipado", label: "Antecipado", tone: "gold" },
        { key: "A Receber", label: "A receber", tone: "neutral" },
        { key: "Recebido", label: "Recebido", tone: "green" },
      ]} />
      <FilterBar search={search} setSearch={setSearch} status={status} setStatus={setStatus}
        statusOptions={["Inadimplente", "Próximo", "Antecipado", "A Receber", "Recebido"]} placeholder="Buscar cliente, descrição..."
        dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo} />

      <Card className="overflow-x-auto">
        {filtered.length === 0 ? (
          <EmptyState icon={ArrowDownCircle} title="Nenhum lançamento" subtitle="Cadastre as contas a receber aqui." />
        ) : (
          <table className="w-full text-sm min-w-[840px]">
            <thead>
              <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
                <th className="text-left font-medium px-4 py-2.5">Data Lanç.</th>
                <th className="text-left font-medium px-4 py-2.5">Vencimento</th>
                <th className="text-left font-medium px-4 py-2.5">Cliente</th>
                <th className="text-left font-medium px-4 py-2.5">Categoria</th>
                <th className="text-right font-medium px-4 py-2.5">Valor</th>
                <th className="text-left font-medium px-4 py-2.5">Status</th>
                <th className="text-right font-medium px-4 py-2.5">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                  <td className="px-4 py-2.5" style={{ color: COLORS.inkSoft }}>{fmtDate(r.dataLanc)}</td>
                  <td className="px-4 py-2.5" style={{ color: COLORS.ink }}>{fmtDate(r.vencimento)}</td>
                  <td className="px-4 py-2.5" style={{ color: COLORS.ink }}>
                    <p className="font-medium">{r.cliente}</p>
                    <p className="text-xs" style={{ color: COLORS.inkSoft }}>{r.descricao}</p>
                  </td>
                  <td className="px-4 py-2.5" style={{ color: COLORS.inkSoft }}>{r.categoria}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium" style={{ color: COLORS.ink }}>
                    {fmtBRL(r.valor)}
                    {r.status === "Recebido" && (r.juros || r.multa || r.desconto) ? (
                      <p className="text-[11px] font-normal" style={{ color: COLORS.inkSoft }}>
                        {[r.juros ? `+${fmtBRL(r.juros)} juros` : null, r.multa ? `+${fmtBRL(r.multa)} multa` : null, r.desconto ? `−${fmtBRL(r.desconto)} desc.` : null].filter(Boolean).join(" · ")}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={r.statusDisplay} />
                    {r.status === "Antecipado" && (
                      <p className="text-[11px] mt-0.5" style={{ color: COLORS.inkSoft }}>
                        {fmtDate(r.agendadoPara)} · {accounts.find((a) => a.id === r.contaAgendadaId)?.nome || "—"}
                      </p>
                    )}
                    {cobrancas[r.id] && r.status === "A Receber" && (
                      <p className="text-[11px] mt-0.5" style={{ color: COLORS.inkSoft }}>Cobrado {timeAgo(cobrancas[r.id])}</p>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      {r.status === "Recebido" && (
                        <button onClick={() => { setReciboAlvo(r); setTimeout(() => window.print(), 50); }} title="Imprimir recibo" className="p-1.5 rounded-md hover:bg-black/5"><Printer size={14} color={COLORS.inkSoft} /></button>
                      )}
                      {canEdit && (r.status === "Recebido" ? (
                        <button onClick={() => cancelReceipt(r)} title="Cancelar recebimento" className="p-1.5 rounded-md hover:bg-black/5"><RotateCcw size={14} color={COLORS.amber} /></button>
                      ) : r.status === "Antecipado" ? (
                        <>
                          <Button variant="subtle" onClick={() => setRecModal(r)}><Check size={13} /> Dar baixa</Button>
                          <button onClick={() => cancelAnticipation(r)} title="Cancelar antecipação (volta pra A Receber)" className="p-1.5 rounded-md hover:bg-black/5"><RotateCcw size={14} color={COLORS.amber} /></button>
                        </>
                      ) : (
                        <>
                          <Button variant="subtle" onClick={() => setRecModal(r)}><Check size={13} /> Dar baixa</Button>
                          <button onClick={() => notifyClient(r)} title="Cobrar cliente via WhatsApp" className="p-1.5 rounded-md hover:bg-black/5"><MessageCircle size={14} color={COLORS.primary} /></button>
                          <button onClick={() => setAnticipateModal(r)} title="Marcar como em processo de antecipação" className="p-1.5 rounded-md hover:bg-black/5"><Zap size={14} color={COLORS.gold} /></button>
                        </>
                      ))}
                      {r.documentoArquivoPath && (
                        <button onClick={() => abrirDocumentoLancamento(r.documentoArquivoPath)} title="Ver documento anexado" className="p-1.5 rounded-md hover:bg-black/5"><FileText size={14} color={COLORS.inkSoft} /></button>
                      )}
                      {canEdit && (
                        <>
                          <button onClick={() => setModal(r)} title="Editar lançamento" className="p-1.5 rounded-md hover:bg-black/5"><Pencil size={14} color={COLORS.inkSoft} /></button>
                          <button onClick={() => remove(r.id)} title="Excluir lançamento" className="p-1.5 rounded-md hover:bg-black/5"><Trash2 size={14} color={COLORS.red} /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {modal && (
        <ReceivableModal
          initial={modal} categories={categories} costCenters={costCenters.filter((c) => c.empresaId === modal.empresaId)} contacts={contacts} accounts={accounts.filter((a) => a.empresaId === modal.empresaId)} aiNote={aiNote} previewDoc={previewDoc}
          onClose={() => { setModal(null); setAiNote(""); setPreviewDoc(null); pendingUploadRef.current = null; }}
          onSubmit={submit}
        />
      )}
      {installmentsReview && (
        <InstallmentsReviewModal
          review={installmentsReview}
          categories={categories}
          partyLabel="Cliente"
          onClose={() => { setInstallmentsReview(null); pendingUploadRef.current = null; }}
          onConfirm={(rows, party, categoria, empresaId) => {
            const { contacts: nextContacts, contact } = resolveContact(contacts, { nome: party, empresaId });
            if (contact) onSaveContacts(nextContacts);
            const novos = rows.map((r) => ({
              id: uid(),
              empresaId,
              dataLanc: todayISO(),
              vencimento: r.vencimento,
              cliente: party,
              contactId: contact?.id,
              categoria,
              descricao: r.descricao,
              valor: Number(r.valor),
              formaReceb: "PIX",
              status: "A Receber",
              conciliado: false,
            }));
            onSave([...receivables, ...novos]);
            setInstallmentsReview(null);
            if (pendingUploadRef.current) {
              onImportProcessed?.(pendingUploadRef.current);
              pendingUploadRef.current = null;
            }
          }}
        />
      )}
      {recModal && (
        <SettleModal
          title="Dar baixa — Contas a Receber"
          label="Valor recebido"
          dateLabel="Data do recebimento"
          accountLabel="Conta de recebimento"
          item={recModal}
          accounts={accounts.filter((a) => a.empresaId === recModal.empresaId)}
          showAdjustments
          onClose={() => setRecModal(null)}
          onConfirm={(data, valor, contaId, adj) => confirmReceipt(recModal.id, data, valor, contaId, adj)}
        />
      )}
      {anticipateModal && (
        <AnticipateModal
          item={anticipateModal}
          accounts={accounts.filter((a) => a.empresaId === anticipateModal.empresaId)}
          onClose={() => setAnticipateModal(null)}
          onConfirm={anticipateReceivable}
        />
      )}
      {batchSettleModal && (
        <BatchSettleModal
          title="Dar baixa em lote — Contas a Receber"
          nameField="cliente"
          valueLabel="Valor recebido"
          dateLabel="Data do recebimento"
          accountLabel="Conta de recebimento"
          items={receivables.filter((r) => r.status !== "Recebido" && r.empresaId === selectedEmpresa)}
          accounts={accounts.filter((a) => a.empresaId === selectedEmpresa)}
          onClose={() => setBatchSettleModal(false)}
          onConfirm={confirmBatchReceipt}
        />
      )}
    </div>
    {reciboAlvo && (
      <div className="hidden print:block">
        <ReciboImpressao item={reciboAlvo} empresa={empresa} tipo="recebimento" />
      </div>
    )}
    </>
  );
}

function ReceivableModal({ initial, categories, costCenters = [], contacts = [], accounts = [], aiNote, previewDoc, onClose, onSubmit }) {
  const linkedContact = contacts.find((c) => c.id === initial.contactId);
  const [form, setForm] = useState({
    dataLanc: todayISO(), vencimento: todayISO(), cliente: "", categoria: categories[0]?.nome || "",
    descricao: "", valor: "", formaReceb: "PIX", status: "A Receber",
    documento: linkedContact?.documento || "", contato: linkedContact?.contato || "",
    centroCusto: "", projeto: "", confirmarAutomaticamente: false, contaPadraoId: "", ...initial,
  });
  const valid = form.cliente.trim() && Number(form.valor) > 0 && form.empresaId;
  const contactOptions = contacts.filter((c) => !c.deletedAt && c.empresaId === form.empresaId);
  const handleCliente = (nome) => {
    const nomeTrim = nome.trim().toLowerCase();
    const match = contactOptions.find((c) => c.nome.toLowerCase() === nomeTrim)
      || contacts.find((c) => !c.deletedAt && c.nome.toLowerCase() === nomeTrim); // mesmo nome em outra empresa
    setForm((f) => ({
      ...f,
      cliente: nome,
      documento: match ? match.documento || f.documento : f.documento,
      contato: match ? match.contato || f.contato : f.contato,
    }));
  };
  return (
    <Modal title={initial.id ? "Editar conta a receber" : "Nova conta a receber"} onClose={onClose} wide={!previewDoc} xwide={!!previewDoc}>
      {aiNote && (
        <p className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: COLORS.greenSoft, color: COLORS.green }}>
          {aiNote}
        </p>
      )}
      <div className={previewDoc ? "grid md:grid-cols-[1fr_300px] gap-4" : ""}>
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Cliente">
            <TextInput list="contatos-cliente" value={form.cliente} onChange={(e) => handleCliente(e.target.value)} />
            <datalist id="contatos-cliente">
              {contactOptions.map((c) => <option key={c.id} value={c.nome} />)}
            </datalist>
          </Field>
          <Field label="Categoria">
            <Select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
              {categories.map((c) => <option key={c.codigo} value={c.nome}>{c.nome}</option>)}
            </Select>
          </Field>
          <Field label="Descrição"><TextInput value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="md:col-span-2" /></Field>
          <Field label="Nº do documento">
            <TextInput value={form.numeroDocumento || ""} onChange={(e) => setForm({ ...form, numeroDocumento: e.target.value })} placeholder="Nº da NF, boleto..." />
          </Field>
          <Field label="Tipo de documento">
            <Select value={form.tipoDocumento || ""} onChange={(e) => setForm({ ...form, tipoDocumento: e.target.value })}>
              <option value="">Não informado</option>
              <option value="NF-e">NF-e (produto)</option>
              <option value="NFS-e">NFS-e (serviço)</option>
              <option value="CT-e">CT-e (frete)</option>
              <option value="Outro">Outro</option>
            </Select>
          </Field>
          <Field label={form.tipoDocumento === "NFS-e" ? "Código de verificação" : "Chave de acesso"}>
            <TextInput
              value={form.chaveAcesso || ""}
              onChange={(e) => setForm({ ...form, chaveAcesso: e.target.value })}
              placeholder={form.tipoDocumento === "NFS-e" ? "Ex.: 7K9X-4T2P" : "44 dígitos"}
              className="md:col-span-2"
            />
          </Field>
          <Field label="Data de lançamento"><TextInput type="date" value={form.dataLanc} max={todayISO()} onChange={(e) => setForm({ ...form, dataLanc: e.target.value })} /></Field>
          <Field label="Vencimento"><TextInput type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} /></Field>
          <Field label="Valor (R$)"><TextInput type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></Field>
          <Field label="Forma de recebimento">
            <Select value={form.formaReceb} onChange={(e) => setForm({ ...form, formaReceb: e.target.value })}>
              <option>PIX</option><option>Boleto</option><option>TED</option><option>Dinheiro</option><option>Cartão</option>
            </Select>
          </Field>
          <Field label="CPF/CNPJ do cliente">
            <TextInput value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} placeholder="Opcional — usado pra cobrança futura" />
          </Field>
          <Field label="Contato do cliente">
            <TextInput value={form.contato} onChange={(e) => setForm({ ...form, contato: e.target.value })} placeholder="Telefone/WhatsApp" />
          </Field>
          <Field label="Centro de Custo">
            <Select value={form.centroCusto} onChange={(e) => setForm({ ...form, centroCusto: e.target.value })}>
              <option value="">Nenhum</option>
              {costCenters.map((c) => <option key={c.id} value={c.nome}>{c.nome}</option>)}
              {form.centroCusto && !costCenters.some((c) => c.nome === form.centroCusto) && (
                <option value={form.centroCusto}>{form.centroCusto} (não cadastrado)</option>
              )}
            </Select>
          </Field>
          <Field label="Projeto">
            <TextInput value={form.projeto} onChange={(e) => setForm({ ...form, projeto: e.target.value })} placeholder="Opcional — alimenta Relatórios → Cronograma de Desembolso" />
          </Field>
          <div className="md:col-span-2 flex items-start gap-2 pt-1">
            <input
              type="checkbox" id="confirmarAutoRec" className="mt-1"
              checked={form.confirmarAutomaticamente}
              onChange={(e) => setForm({ ...form, confirmarAutomaticamente: e.target.checked, contaPadraoId: e.target.checked ? form.contaPadraoId : "" })}
            />
            <label htmlFor="confirmarAutoRec" className="text-sm" style={{ color: COLORS.ink }}>
              Confirmar automaticamente no vencimento
              <span className="block text-xs" style={{ color: COLORS.inkSoft }}>Pra contas cujo valor e data já são certos (assinatura, mensalidade) — dá baixa sozinho na conta padrão abaixo, sem esperar clique.</span>
            </label>
          </div>
          {form.confirmarAutomaticamente && (
            <Field label="Conta padrão pra baixa automática">
              <Select value={form.contaPadraoId} onChange={(e) => setForm({ ...form, contaPadraoId: e.target.value })}>
                <option value="">Selecione uma conta</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </Select>
            </Field>
          )}
          {!initial.id && <InstallmentFields form={form} setForm={setForm} />}
        </div>
        <DocumentPreviewPanel doc={previewDoc} />
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button
          onClick={() => valid && onSubmit(initial.id ? stripInstallmentMeta(form) : expandEntries(form), { documento: form.documento, contato: form.contato })}
          disabled={!valid || (form.confirmarAutomaticamente && !form.contaPadraoId)}
        >
          Salvar
        </Button>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/*  Lançamentos Bancários — helpers de importação de extrato e categorização */
/* ---------------------------------------------------------------------- */
function stripAccents(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Reconhece "1.234,56", "1234.56" ou "-1234,56" — bancos brasileiros
// exportam nos dois formatos dependendo do sistema de origem.
function parseMoneyBR(raw) {
  if (raw == null || raw === "") return NaN;
  let s = String(raw).trim().replace(/^R\$\s?/i, "");
  const neg = /^-/.test(s) || /^\(.*\)$/.test(s);
  s = s.replace(/[()]/g, "").replace(/^-/, "").trim();
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
  else if (lastDot > lastComma) s = s.replace(/,/g, "");
  const n = parseFloat(s);
  if (Number.isNaN(n)) return NaN;
  return neg ? -Math.abs(n) : n;
}

// Aceita "DD/MM/AAAA", "AAAA-MM-DD" e variações com hora colada (comum em OFX).
function parseDateBR(raw) {
  const s = String(raw || "").trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = `20${y}`;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return "";
}

function addMonthsToISODate(dateISO, delta) {
  const [y, m, d] = dateISO.split("-").map(Number);
  const { y: ny, m: nm } = addMonths(y, m, delta);
  const lastDay = new Date(ny, nm, 0).getDate();
  return isoDate(ny, nm, Math.min(d, lastDay));
}

function addDaysToISODate(dateISO, days) {
  const d = new Date(`${dateISO}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function splitCSVLine(line, delim) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === delim && !inQuotes) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

// Extrato em CSV varia muito de banco pra banco — detecta o delimitador e
// tenta achar as colunas de data/descrição/valor pelo nome do cabeçalho
// (ou colunas separadas de crédito/débito). Linha que não fecha conta
// (sem data ou sem valor) é descartada — o analista revisa e completa
// na tela antes de salvar, então perder uma linha ruim aqui não é grave.
function parseCSVBankStatement(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const delim = lines[0].split(";").length >= lines[0].split(",").length ? ";" : ",";
  const header = splitCSVLine(lines[0], delim).map((h) => stripAccents(h.toLowerCase()));
  const idx = (preds) => header.findIndex((h) => preds.some((p) => h.includes(p)));
  const iData = idx(["data", "date"]);
  const iDesc = idx(["historico", "descricao", "memo", "lancamento", "detalhes"]);
  const iValor = idx(["valor", "amount", "montante"]);
  const iCredito = idx(["credito", "credit"]);
  const iDebito = idx(["debito", "debit"]);
  const iTipo = idx(["tipo", "type"]);

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i], delim);
    if (cols.length < 2) continue;
    const data = iData >= 0 ? parseDateBR(cols[iData]) : "";
    const descricao = iDesc >= 0 ? cols[iDesc] : cols.filter((_, ci) => ci !== iData && ci !== iValor && ci !== iCredito && ci !== iDebito).join(" ").trim();
    let valor = 0;
    let tipo = "Saída";
    if (iCredito >= 0 || iDebito >= 0) {
      const vc = iCredito >= 0 ? parseMoneyBR(cols[iCredito]) : NaN;
      const vd = iDebito >= 0 ? parseMoneyBR(cols[iDebito]) : NaN;
      if (vc && !Number.isNaN(vc) && vc !== 0) { valor = Math.abs(vc); tipo = "Entrada"; }
      else if (!Number.isNaN(vd) && vd !== 0) { valor = Math.abs(vd); tipo = "Saída"; }
    } else if (iValor >= 0) {
      const v = parseMoneyBR(cols[iValor]);
      if (!Number.isNaN(v)) {
        valor = Math.abs(v);
        tipo = v < 0 ? "Saída" : "Entrada";
      }
      if (iTipo >= 0) {
        const t = stripAccents(cols[iTipo].toLowerCase());
        if (t.includes("deb") || t.includes("said")) tipo = "Saída";
        else if (t.includes("cred") || t.includes("entr")) tipo = "Entrada";
      }
    }
    if (!data || !valor) continue;
    rows.push({ data, descricao, valor, tipo });
  }
  return rows;
}

// OFX não é XML de verdade (tags costumam vir sem fechamento), então
// extrai cada bloco <STMTTRN>...</STMTTRN> e lê os campos por regex.
function parseOFXBankStatement(text) {
  const blocks = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];
  const rows = [];
  for (const block of blocks) {
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}>([^<\r\n]*)`, "i"));
      return m ? m[1].trim() : "";
    };
    const dtRaw = get("DTPOSTED");
    const dateMatch = dtRaw.match(/^(\d{4})(\d{2})(\d{2})/);
    const data = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : "";
    const valor = parseFloat(get("TRNAMT"));
    if (!data || Number.isNaN(valor) || valor === 0) continue;
    rows.push({
      data,
      descricao: get("MEMO") || get("NAME") || "",
      valor: Math.abs(valor),
      tipo: valor >= 0 ? "Entrada" : "Saída",
    });
  }
  return rows;
}

function parseBankStatementFile(text, filename) {
  const isOFX = /<OFX>/i.test(text) || /OFXHEADER/i.test(text) || /\.(ofx|qfx)$/i.test(filename || "");
  return isOFX ? parseOFXBankStatement(text) : parseCSVBankStatement(text);
}

function normalizeDescricao(s) {
  return stripAccents(String(s || "")).toUpperCase().replace(/[0-9]/g, "").replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim();
}

// "Aprende" com o histórico: procura, entre os lançamentos já salvos da
// mesma empresa, aquele com mais palavras (4+ letras) em comum com a
// descrição atual e sugere a categoria dele — sem regra cadastrada à mão.
function guessCategoria(descricao, entries, empresaId) {
  const norm = normalizeDescricao(descricao);
  const words = norm.split(" ").filter((w) => w.length >= 4);
  if (words.length === 0) return null;
  let best = null;
  let bestScore = 0;
  let bestDate = "";
  for (const e of entries) {
    if (e.deletedAt || e.empresaId !== empresaId || !e.categoria) continue;
    const eWords = new Set(normalizeDescricao(e.descricao).split(" ").filter((w) => w.length >= 4));
    const score = words.filter((w) => eWords.has(w)).length;
    if (score > 0 && (score > bestScore || (score === bestScore && (e.data || "") > bestDate))) {
      best = { categoria: e.categoria, exemplo: e.descricao };
      bestScore = score;
      bestDate = e.data || "";
    }
  }
  return best;
}

/* ---------------------------------------------------------------------- */
/*  Lançamentos Bancários                                                  */
/* ---------------------------------------------------------------------- */
function BankEntriesView({ entries, accounts, selectedEmpresa, categories, onSave, pendingImport, onImportProcessed, canEdit = true }) {
  const [modal, setModal] = useState(null);
  const [aiNote, setAiNote] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [previewDoc, setPreviewDoc] = useState(null);
  const [statementImporting, setStatementImporting] = useState(false);
  const [statementError, setStatementError] = useState("");
  const [importReview, setImportReview] = useState(null);
  const scopedAccounts = accounts.filter((a) => a.empresaId === selectedEmpresa);
  const submit = async (formOrList) => {
    const list = Array.isArray(formOrList) ? formOrList : [formOrList];
    const isEdit = list.length === 1 && list[0].id;
    let finalList = isEdit ? list : list.map((f) => ({ ...f, id: uid() }));
    if (previewDoc) {
      const path = await uploadDocumentoLancamento(selectedEmpresa, "bankEntries", finalList[0].id, previewDoc);
      if (path) finalList = finalList.map((f) => ({ ...f, documentoArquivoPath: path }));
    }
    if (isEdit) {
      onSave(entries.map((e) => (e.id === finalList[0].id ? finalList[0] : e)));
    } else {
      onSave([...entries, ...finalList]);
    }
    setModal(null);
    setPreviewDoc(null);
    if (pendingUploadRef.current) {
      onImportProcessed?.(pendingUploadRef.current);
      pendingUploadRef.current = null;
    }
  };
  const duplicateEntry = (e) => {
    setAiNote("");
    setModal({ contaId: e.contaId, tipo: e.tipo, categoria: e.categoria, descricao: e.descricao, valor: String(e.valor ?? ""), data: todayISO() });
  };
  const handleImportStatement = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setStatementError("");
    setStatementImporting(true);
    try {
      const text = await file.text();
      const rows = parseBankStatementFile(text, file.name);
      if (rows.length === 0) {
        setStatementError("Não consegui reconhecer nenhum lançamento nesse arquivo — confira se é um extrato em CSV ou OFX exportado do banco.");
        return;
      }
      const withCategoria = rows.map((r) => {
        const guess = guessCategoria(r.descricao, entries, selectedEmpresa);
        return { ...r, categoria: guess?.categoria || categories[0] || "" };
      });
      setImportReview(withCategoria);
    } catch (err) {
      setStatementError(err?.message || "Erro ao ler o arquivo do extrato.");
    } finally {
      setStatementImporting(false);
    }
  };
  const confirmImportReview = (rows, contaId) => {
    const novos = rows.map((r) => ({ empresaId: selectedEmpresa, contaId, data: r.data, tipo: r.tipo, categoria: r.categoria, descricao: r.descricao, valor: Number(r.valor) || 0 }));
    onSave([...entries, ...novos.map((f) => ({ ...f, id: uid() }))]);
    setImportReview(null);
  };
  const remove = (id) => {
    if (!confirmDelete("Mover este lançamento pra lixeira? Você pode restaurar depois, em Lixeira.")) return;
    onSave(entries.map((e) => (e.id === id ? { ...e, deletedAt: new Date().toISOString() } : e)));
  };
  const sorted = [...entries]
    .filter((e) => !e.deletedAt && e.empresaId === selectedEmpresa)
    .sort((a, b) => (b.data || "").localeCompare(a.data || ""));

  const processExtractedDocument = async (fileBase64, mediaType) => {
    const ex = await callExtractDocument(fileBase64, mediaType, "bankEntry");
    const p = (Array.isArray(ex.parcelas) && ex.parcelas[0]) || ex;
    const categoriaMatch = categories.find((c) => c === ex.categoria_sugerida);
    setAiNote("Dados extraídos automaticamente do comprovante — confira antes de salvar.");
    setPreviewDoc({ url: `data:${mediaType};base64,${fileBase64}`, mediaType });
    setModal({
      contaId: scopedAccounts[0]?.id || "",
      tipo: ex.tipo_lancamento === "Entrada" ? "Entrada" : "Saída",
      data: p.vencimento || todayISO(),
      valor: p.valor != null ? String(p.valor) : "",
      descricao: p.descricao || (ex.contraparte ? `${ex.tipo_lancamento === "Entrada" ? "Recebido de" : "Enviado para"} ${ex.contraparte}` : ""),
      ...(categoriaMatch ? { categoria: categoriaMatch } : {}),
    });
  };

  const handleImportDocument = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportError("");
    setImporting(true);
    try {
      const fileBase64 = await fileToBase64(file);
      await processExtractedDocument(fileBase64, file.type);
    } catch (err) {
      setImportError(err?.message || "Erro ao importar o documento.");
    } finally {
      setImporting(false);
    }
  };

  const processedImportIds = useRef(new Set());
  const pendingUploadRef = useRef(null);
  useEffect(() => {
    if (!pendingImport || processedImportIds.current.has(pendingImport.id)) return;
    processedImportIds.current.add(pendingImport.id);
    (async () => {
      setImportError("");
      setImporting(true);
      try {
        await processExtractedDocument(pendingImport.fileBase64, pendingImport.mediaType);
        pendingUploadRef.current = pendingImport.id;
      } catch (err) {
        setImportError(err?.message || "Erro ao importar o documento.");
      } finally {
        setImporting(false);
      }
    })();
  }, [pendingImport]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <Header title="Lançamentos Bancários" subtitle="Entradas e saídas avulsas direto do banco: juros, tarifas, IOF, rendimentos.">
        {canEdit && (
          <>
            <label
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-40"
              style={{ background: "transparent", color: COLORS.primary, border: `1px solid ${COLORS.border}` }}
            >
              <Upload size={15} /> {importing ? "Lendo comprovante…" : "Importar documento"}
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleImportDocument} disabled={importing || scopedAccounts.length === 0} />
            </label>
            <label
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-40"
              style={{ background: "transparent", color: COLORS.primary, border: `1px solid ${COLORS.border}` }}
            >
              <FileUp size={15} /> {statementImporting ? "Lendo extrato…" : "Importar extrato (CSV/OFX)"}
              <input type="file" accept=".csv,.ofx,.qfx,.txt" className="hidden" onChange={handleImportStatement} disabled={statementImporting || scopedAccounts.length === 0} />
            </label>
            <Button onClick={() => { setAiNote(""); setModal({}); }} disabled={scopedAccounts.length === 0}><Plus size={15} /> Novo lançamento</Button>
          </>
        )}
      </Header>
      {scopedAccounts.length === 0 && (
        <p className="text-sm px-1" style={{ color: COLORS.inkSoft }}>Cadastre uma conta antes de lançar movimentos bancários.</p>
      )}
      {importError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: COLORS.redSoft, color: COLORS.red }}>
          <AlertTriangle size={15} /> {importError}
        </div>
      )}
      {statementError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: COLORS.redSoft, color: COLORS.red }}>
          <AlertTriangle size={15} /> {statementError}
        </div>
      )}
      <Card className="overflow-x-auto">
        {sorted.length === 0 ? (
          <EmptyState icon={Wallet} title="Nenhum lançamento" subtitle="Registre aqui movimentos bancários que não são contas a pagar/receber." />
        ) : (
          <table className="w-full text-sm min-w-[680px]">
            <thead>
              <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
                <th className="text-left font-medium px-4 py-2.5">Data</th>
                <th className="text-left font-medium px-4 py-2.5">Conta</th>
                <th className="text-left font-medium px-4 py-2.5">Tipo</th>
                <th className="text-left font-medium px-4 py-2.5">Categoria</th>
                <th className="text-left font-medium px-4 py-2.5">Descrição</th>
                <th className="text-right font-medium px-4 py-2.5">Valor</th>
                <th className="text-right font-medium px-4 py-2.5">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((e) => {
                const acc = accounts.find((a) => a.id === e.contaId);
                return (
                  <tr key={e.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                    <td className="px-4 py-2.5" style={{ color: COLORS.ink }}>{fmtDate(e.data)}</td>
                    <td className="px-4 py-2.5" style={{ color: COLORS.ink }}>{acc?.nome || "—"}</td>
                    <td className="px-4 py-2.5"><Badge tone={e.tipo === "Entrada" ? "green" : "red"}>{e.tipo}</Badge></td>
                    <td className="px-4 py-2.5" style={{ color: COLORS.inkSoft }}>{e.categoria}</td>
                    <td className="px-4 py-2.5" style={{ color: COLORS.inkSoft }}>{e.descricao}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium" style={{ color: e.tipo === "Entrada" ? COLORS.green : COLORS.red }}>
                      {e.tipo === "Entrada" ? "+" : "−"}{fmtBRL(e.valor)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        {e.documentoArquivoPath && (
                          <button onClick={() => abrirDocumentoLancamento(e.documentoArquivoPath)} title="Ver documento anexado" className="p-1.5 rounded-md hover:bg-black/5"><FileText size={14} color={COLORS.inkSoft} /></button>
                        )}
                        {canEdit && (
                          <>
                            <button onClick={() => duplicateEntry(e)} title="Duplicar lançamento" className="p-1.5 rounded-md hover:bg-black/5"><Copy size={14} color={COLORS.inkSoft} /></button>
                            <button onClick={() => setModal(e)} title="Editar lançamento" className="p-1.5 rounded-md hover:bg-black/5"><Pencil size={14} color={COLORS.inkSoft} /></button>
                            <button onClick={() => remove(e.id)} title="Excluir lançamento" className="p-1.5 rounded-md hover:bg-black/5"><Trash2 size={14} color={COLORS.red} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
      {modal && (
        <BankEntryModal
          initial={modal} accounts={scopedAccounts} categories={categories} entries={entries} aiNote={aiNote} previewDoc={previewDoc}
          onClose={() => { setModal(null); setAiNote(""); setPreviewDoc(null); pendingUploadRef.current = null; }}
          onSubmit={submit}
        />
      )}
      {importReview && (
        <BankStatementImportModal
          rows={importReview}
          categories={categories}
          accounts={scopedAccounts}
          entries={entries}
          onClose={() => setImportReview(null)}
          onConfirm={confirmImportReview}
        />
      )}
    </div>
  );
}

function BankEntryModal({ initial, accounts, categories, entries = [], aiNote, previewDoc, onClose, onSubmit }) {
  const isNew = !initial.id;
  const [form, setForm] = useState({
    data: todayISO(), contaId: accounts[0]?.id || "", tipo: "Saída", categoria: categories[0] || "",
    descricao: "", valor: "", repetirMeses: "1", ...initial,
  });
  const [categoriaSugerida, setCategoriaSugerida] = useState(null);
  const valid = form.contaId && Number(form.valor) > 0;

  const handleDescricaoBlur = () => {
    if (!isNew || !form.descricao.trim()) return;
    const acc = accounts.find((a) => a.id === form.contaId);
    const guess = guessCategoria(form.descricao, entries, acc?.empresaId);
    if (guess && guess.categoria !== form.categoria) {
      setCategoriaSugerida(guess);
      setForm((f) => ({ ...f, categoria: guess.categoria }));
    }
  };

  const submit = () => {
    const acc = accounts.find((a) => a.id === form.contaId);
    const empresaId = acc?.empresaId || form.empresaId;
    const base = { ...form, empresaId };
    const n = isNew ? Math.max(1, Math.min(36, Number(form.repetirMeses) || 1)) : 1;
    delete base.repetirMeses;
    if (n <= 1) {
      onSubmit(base);
    } else {
      onSubmit(Array.from({ length: n }, (_, i) => ({ ...base, data: addMonthsToISODate(form.data, -i) })));
    }
  };
  return (
    <Modal title={initial.id ? "Editar lançamento" : "Novo lançamento bancário"} onClose={onClose} wide={!previewDoc} xwide={!!previewDoc}>
      {aiNote && (
        <p className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: COLORS.greenSoft, color: COLORS.green }}>
          {aiNote}
        </p>
      )}
      <div className={previewDoc ? "grid md:grid-cols-[1fr_300px] gap-4" : ""}>
        <div className="grid gap-3">
          <Field label="Data"><TextInput type="date" value={form.data} max={todayISO()} onChange={(e) => setForm({ ...form, data: e.target.value })} /></Field>
          <Field label="Conta">
            <Select value={form.contaId} onChange={(e) => setForm({ ...form, contaId: e.target.value })}>
              {accounts.length === 0 && <option value="">Cadastre uma conta primeiro</option>}
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </Select>
          </Field>
          <Field label="Tipo">
            <Select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              <option>Entrada</option><option>Saída</option>
            </Select>
          </Field>
          <Field label="Categoria">
            <Select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          {categoriaSugerida && form.categoria === categoriaSugerida.categoria && (
            <p className="text-xs -mt-2" style={{ color: COLORS.green }}>
              Categoria sugerida automaticamente, com base em lançamento parecido: "{categoriaSugerida.exemplo}". Confira antes de salvar.
            </p>
          )}
          <Field label="Descrição"><TextInput value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} onBlur={handleDescricaoBlur} /></Field>
          <Field label="Valor (R$)"><TextInput type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></Field>
          {isNew && (
            <Field label="Repetir também nos meses anteriores (opcional)">
              <TextInput
                type="number" min="1" max="36" step="1" value={form.repetirMeses}
                onChange={(e) => setForm({ ...form, repetirMeses: e.target.value })}
              />
              <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>
                Quantos meses no total, incluindo este. Útil pra lançar de uma vez uma tarifa ou rendimento fixo que se repete mês a mês e você ainda não tinha registrado.
              </p>
            </Field>
          )}
        </div>
        <DocumentPreviewPanel doc={previewDoc} />
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={() => valid && submit()} disabled={!valid}>Salvar</Button>
      </div>
    </Modal>
  );
}

function BankStatementImportModal({ rows, categories, accounts, entries, onClose, onConfirm }) {
  const [contaId, setContaId] = useState(accounts[0]?.id || "");
  const [localRows, setLocalRows] = useState(() => rows.map((r, i) => ({ ...r, key: i, incluir: true, duplicado: false })));

  useEffect(() => {
    setLocalRows((rs) => rs.map((r) => {
      const duplicado = entries.some((e) => !e.deletedAt && e.contaId === contaId && e.data === r.data && e.tipo === r.tipo && Math.abs(Number(e.valor) - Number(r.valor)) < 0.01);
      return { ...r, duplicado, incluir: !duplicado };
    }));
  }, [contaId]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (key, patch) => setLocalRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const toggleAll = () => {
    const allOn = localRows.length > 0 && localRows.every((r) => r.incluir);
    setLocalRows((rs) => rs.map((r) => ({ ...r, incluir: !allOn })));
  };

  const incluidos = localRows.filter((r) => r.incluir);
  const totalEntradas = incluidos.filter((r) => r.tipo === "Entrada").reduce((s, r) => s + (Number(r.valor) || 0), 0);
  const totalSaidas = incluidos.filter((r) => r.tipo === "Saída").reduce((s, r) => s + (Number(r.valor) || 0), 0);

  const confirmar = () => {
    onConfirm(incluidos.map((r) => ({ data: r.data, tipo: r.tipo, categoria: r.categoria, descricao: r.descricao, valor: Number(r.valor) || 0 })), contaId);
  };

  return (
    <Modal title="Importar extrato bancário" onClose={onClose} wide>
      <div className="grid gap-3">
        <Field label="Conta desse extrato">
          <Select value={contaId} onChange={(e) => setContaId(e.target.value)}>
            {accounts.length === 0 && <option value="">Cadastre uma conta primeiro</option>}
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </Select>
        </Field>
        <p className="text-xs -mt-1" style={{ color: COLORS.inkSoft }}>
          {rows.length} lançamento(s) encontrado(s) no arquivo. Confira data, categoria e valor de cada linha antes de salvar — as que parecem já lançadas vêm desmarcadas, pra evitar duplicidade.
        </p>
        {accounts.length === 0 ? null : (
          <div className="rounded-lg border max-h-96 overflow-y-auto" style={{ borderColor: COLORS.border }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}`, background: "#FAFAF7" }}>
                  <th className="text-left font-medium px-3 py-2">
                    <input type="checkbox" checked={localRows.length > 0 && localRows.every((r) => r.incluir)} onChange={toggleAll} />
                  </th>
                  <th className="text-left font-medium px-3 py-2">Data</th>
                  <th className="text-left font-medium px-3 py-2">Tipo</th>
                  <th className="text-left font-medium px-3 py-2">Categoria</th>
                  <th className="text-left font-medium px-3 py-2">Descrição</th>
                  <th className="text-right font-medium px-3 py-2">Valor</th>
                </tr>
              </thead>
              <tbody>
                {localRows.map((r) => (
                  <tr key={r.key} style={{ borderTop: `1px solid ${COLORS.border}`, opacity: r.incluir ? 1 : 0.5 }}>
                    <td className="px-3 py-2"><input type="checkbox" checked={r.incluir} onChange={(e) => update(r.key, { incluir: e.target.checked })} /></td>
                    <td className="px-3 py-2"><TextInput type="date" value={r.data} max={todayISO()} onChange={(e) => update(r.key, { data: e.target.value })} className="w-32" style={{ height: 32 }} /></td>
                    <td className="px-3 py-2">
                      <Select value={r.tipo} onChange={(e) => update(r.key, { tipo: e.target.value })} style={{ height: 32 }}>
                        <option>Entrada</option><option>Saída</option>
                      </Select>
                    </td>
                    <td className="px-3 py-2">
                      <Select value={r.categoria} onChange={(e) => update(r.key, { categoria: e.target.value })} style={{ height: 32 }}>
                        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                      </Select>
                    </td>
                    <td className="px-3 py-2">
                      <TextInput value={r.descricao} onChange={(e) => update(r.key, { descricao: e.target.value })} style={{ height: 32 }} />
                      {r.duplicado && <p className="text-xs mt-0.5" style={{ color: COLORS.amber }}>Parece já lançado nessa conta</p>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <TextInput type="number" step="0.01" value={r.valor} onChange={(e) => update(r.key, { valor: e.target.value })} className="w-24 text-right" style={{ height: 32 }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between pt-1">
          <p className="text-sm" style={{ color: COLORS.inkSoft }}>
            {incluidos.length} selecionado(s) · <span style={{ color: COLORS.green }}>+{fmtBRL(totalEntradas)}</span> · <span style={{ color: COLORS.red }}>−{fmtBRL(totalSaidas)}</span>
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button onClick={confirmar} disabled={incluidos.length === 0 || !contaId}>
              Salvar {incluidos.length > 0 ? `(${incluidos.length})` : ""}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/*  Transferências                                                         */
/* ---------------------------------------------------------------------- */
function TransfersView({ transfers, accounts, selectedEmpresa, onSave, canEdit = true }) {
  const [modal, setModal] = useState(null);
  const [aiNote, setAiNote] = useState("");
  const [previewDoc, setPreviewDoc] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const scopedAccounts = accounts.filter((a) => a.empresaId === selectedEmpresa);
  const submit = async (form) => {
    const isEdit = !!form.id;
    let final = isEdit ? form : { ...form, id: uid() };
    if (previewDoc) {
      const path = await uploadDocumentoLancamento(selectedEmpresa, "transfers", final.id, previewDoc);
      if (path) final = { ...final, documentoArquivoPath: path };
    }
    if (isEdit) onSave(transfers.map((t) => (t.id === final.id ? final : t)));
    else onSave([...transfers, final]);
    setModal(null);
    setPreviewDoc(null);
  };
  const remove = (id) => {
    if (!confirmDelete("Mover esta transferência pra lixeira? Você pode restaurar depois, em Lixeira.")) return;
    onSave(transfers.map((t) => (t.id === id ? { ...t, deletedAt: new Date().toISOString() } : t)));
  };
  const duplicateTransfer = (t) => {
    setAiNote("");
    setModal({ contaOrigemId: t.contaOrigemId, contaDestinoId: t.contaDestinoId, valor: t.valor, descricao: t.descricao, data: todayISO(), empresaId: t.empresaId });
  };
  const sorted = [...transfers]
    .filter((t) => !t.deletedAt && t.empresaId === selectedEmpresa)
    .sort((a, b) => (b.data || "").localeCompare(a.data || ""));

  const handleImportDocument = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportError("");
    setImporting(true);
    try {
      const fileBase64 = await fileToBase64(file);
      const ex = await callExtractDocument(fileBase64, file.type, "transfer");
      const p = (Array.isArray(ex.parcelas) && ex.parcelas[0]) || ex;
      setAiNote("Dados extraídos automaticamente do comprovante — confira antes de salvar, principalmente as contas de origem e destino.");
      setPreviewDoc({ url: `data:${file.type};base64,${fileBase64}`, mediaType: file.type });
      setModal({
        contaOrigemId: scopedAccounts[0]?.id || "",
        contaDestinoId: scopedAccounts[1]?.id || "",
        data: p.vencimento || todayISO(),
        valor: p.valor != null ? String(p.valor) : "",
        descricao: p.descricao || "",
      });
    } catch (err) {
      setImportError(err?.message || "Erro ao importar o documento.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Header title="Transferências entre contas" subtitle="Movimentações internas — não afetam o fluxo de caixa.">
        {canEdit && (
          <>
            <label
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-40"
              style={{ background: "transparent", color: COLORS.primary, border: `1px solid ${COLORS.border}` }}
            >
              <Upload size={15} /> {importing ? "Lendo comprovante…" : "Importar documento"}
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleImportDocument} disabled={importing || scopedAccounts.length < 2} />
            </label>
            <Button onClick={() => { setAiNote(""); setModal({}); }} disabled={scopedAccounts.length < 2}><Plus size={15} /> Nova transferência</Button>
          </>
        )}
      </Header>
      {scopedAccounts.length < 2 && (
        <p className="text-sm px-1" style={{ color: COLORS.inkSoft }}>Cadastre pelo menos 2 contas nesta empresa para registrar transferências.</p>
      )}
      {importError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: COLORS.redSoft, color: COLORS.red }}>
          <AlertTriangle size={15} /> {importError}
        </div>
      )}
      <Card className="overflow-x-auto">
        {sorted.length === 0 ? (
          <EmptyState icon={ArrowLeftRight} title="Nenhuma transferência" subtitle="Registre movimentações entre as contas da empresa, como Bradesco → Itaú." />
        ) : (
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
                <th className="text-left font-medium px-4 py-2.5">Data</th>
                <th className="text-left font-medium px-4 py-2.5">De</th>
                <th className="text-left font-medium px-4 py-2.5">Para</th>
                <th className="text-right font-medium px-4 py-2.5">Valor</th>
                <th className="text-left font-medium px-4 py-2.5">Descrição</th>
                <th className="text-right font-medium px-4 py-2.5">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => {
                const from = accounts.find((a) => a.id === t.contaOrigemId);
                const to = accounts.find((a) => a.id === t.contaDestinoId);
                return (
                  <tr key={t.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                    <td className="px-4 py-2.5" style={{ color: COLORS.ink }}>{fmtDate(t.data)}</td>
                    <td className="px-4 py-2.5" style={{ color: COLORS.ink }}>{from?.nome || "—"}</td>
                    <td className="px-4 py-2.5" style={{ color: COLORS.ink }}>{to?.nome || "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium" style={{ color: COLORS.ink }}>{fmtBRL(t.valor)}</td>
                    <td className="px-4 py-2.5" style={{ color: COLORS.inkSoft }}>{t.descricao}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        {t.documentoArquivoPath && (
                          <button onClick={() => abrirDocumentoLancamento(t.documentoArquivoPath)} title="Ver documento anexado" className="p-1.5 rounded-md hover:bg-black/5"><FileText size={14} color={COLORS.inkSoft} /></button>
                        )}
                        {canEdit && (
                          <>
                            <button onClick={() => duplicateTransfer(t)} title="Duplicar transferência" className="p-1.5 rounded-md hover:bg-black/5"><Copy size={14} color={COLORS.inkSoft} /></button>
                            <button onClick={() => setModal(t)} title="Editar transferência" className="p-1.5 rounded-md hover:bg-black/5"><Pencil size={14} color={COLORS.inkSoft} /></button>
                            <button onClick={() => remove(t.id)} title="Excluir transferência" className="p-1.5 rounded-md hover:bg-black/5"><Trash2 size={14} color={COLORS.red} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
      {modal && (
        <TransferModal
          initial={modal} accounts={scopedAccounts} aiNote={aiNote} previewDoc={previewDoc}
          onClose={() => { setModal(null); setAiNote(""); setPreviewDoc(null); }}
          onSubmit={submit}
        />
      )}
    </div>
  );
}

function TransferModal({ initial, accounts, aiNote, previewDoc, onClose, onSubmit }) {
  const [form, setForm] = useState({
    data: todayISO(), contaOrigemId: accounts[0]?.id || "", contaDestinoId: accounts[1]?.id || "",
    valor: "", descricao: "", empresaId: accounts[0]?.empresaId || "", ...initial,
  });
  const valid = form.contaOrigemId && form.contaDestinoId && form.contaOrigemId !== form.contaDestinoId && Number(form.valor) > 0;
  return (
    <Modal title={initial.id ? "Editar transferência" : "Nova transferência"} onClose={onClose} wide={!previewDoc} xwide={!!previewDoc}>
      {aiNote && (
        <p className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: COLORS.greenSoft, color: COLORS.green }}>
          {aiNote}
        </p>
      )}
      <div className={previewDoc ? "grid md:grid-cols-[1fr_300px] gap-4" : ""}>
        <div className="grid gap-3">
          <Field label="Data"><TextInput type="date" value={form.data} max={todayISO()} onChange={(e) => setForm({ ...form, data: e.target.value })} /></Field>
          <Field label="Saiu da conta">
            <Select value={form.contaOrigemId} onChange={(e) => setForm({ ...form, contaOrigemId: e.target.value })}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </Select>
          </Field>
          <Field label="Entrou na conta">
            <Select value={form.contaDestinoId} onChange={(e) => setForm({ ...form, contaDestinoId: e.target.value })}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </Select>
          </Field>
          {form.contaOrigemId === form.contaDestinoId && (
            <p className="text-xs" style={{ color: COLORS.red }}>A conta de origem e destino precisam ser diferentes.</p>
          )}
          <Field label="Valor (R$)"><TextInput type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></Field>
          <Field label="Descrição"><TextInput value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></Field>
        </div>
        <DocumentPreviewPanel doc={previewDoc} />
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={() => valid && onSubmit(form)} disabled={!valid}>Salvar</Button>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/*  Calendário Fiscal                                                      */
/* ---------------------------------------------------------------------- */
const TRIBUTOS_COMUNS = ["DAS", "ISS", "INSS", "FGTS", "IRPJ", "CSLL", "PIS", "COFINS", "ICMS", "Simples Nacional"];

function competenciaLabel(c) {
  if (!c) return "—";
  const [y, m] = c.split("-");
  if (!m) return y; // competência anual (ex.: ECD/ECF), sem mês/trimestre
  return `${MONTHS[Number(m) - 1] || m}/${y}`;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}
function isoDate(y, m, d) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}
// Soma "delta" meses ao mês m (1-12) do ano y, ajustando o ano quando passa
// de dezembro/janeiro.
function addMonths(y, m, delta) {
  const total = m - 1 + delta;
  return { y: y + Math.floor(total / 12), m: (((total % 12) + 12) % 12) + 1 };
}
// Aproximação de "último dia útil do mês" sem calendário de feriados —
// só pula sábado/domingo, que é o que o analista mais frequentemente
// precisa ajustar mesmo (feriado municipal/estadual ele corrige na mão).
function lastBusinessDayISO(y, m) {
  const d = new Date(y, m, 0); // dia 0 do mês seguinte = último dia de m
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return isoDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

// Calendário fiscal "de fábrica" — ponto de partida pra sugerir as
// obrigações mais comuns, a partir do regime tributário da empresa.
// Nunca é lançado direto: toda sugestão nasce com status "Sugerido" e só
// passa a valer quando o analista confirma (Validar) ou ajusta e confirma
// (Editar) — ISS e ICMS, por exemplo, variam por município/estado e o
// vencimento sugerido aqui é só uma aproximação que precisa ser checada.
const FISCAL_RULES = [
  { tributo: "FGTS e eSocial", periodicidade: "mensal", diaVencimento: 20, mesesDepois: 1, regimes: null,
    descricao: "Vencimento até o dia 20 do mês seguinte à competência." },
  { tributo: "INSS (DCTFWeb)", periodicidade: "mensal", diaVencimento: 20, mesesDepois: 1, regimes: ["Lucro Presumido", "Lucro Real"],
    descricao: "Vencimento até o dia 20 do mês seguinte à competência." },
  { tributo: "Simples Nacional (DAS)", periodicidade: "mensal", diaVencimento: 20, mesesDepois: 1, regimes: ["Simples Nacional", "MEI"],
    descricao: "Vencimento até o dia 20 do mês seguinte à competência." },
  { tributo: "PIS e COFINS", periodicidade: "mensal", diaVencimento: 25, mesesDepois: 1, regimes: ["Lucro Presumido", "Lucro Real"],
    descricao: "Vencimento geralmente até o dia 25 do mês seguinte à competência." },
  { tributo: "ISS", periodicidade: "mensal", diaVencimento: null, mesesDepois: 1, regimes: null,
    descricao: "Conforme o calendário do município — confira e informe a data antes de validar." },
  { tributo: "ICMS", periodicidade: "mensal", diaVencimento: null, mesesDepois: 1, regimes: ["Lucro Presumido", "Lucro Real"],
    descricao: "Conforme o calendário do estado — confira e informe a data antes de validar." },
  { tributo: "IRPJ e CSLL", periodicidade: "trimestral", mesesDepois: 1, regimes: ["Lucro Presumido", "Lucro Real"],
    descricao: "Pagamento até o último dia útil do mês seguinte ao trimestre encerrado." },
  { tributo: "ECD (Escrituração Contábil Digital)", periodicidade: "anual", vencimentoFixo: "05-31", anoSeguinte: true, regimes: ["Lucro Presumido", "Lucro Real"],
    descricao: "Prazo limite em 31/05 do ano seguinte ao ano-calendário." },
  { tributo: "ECF (Escrituração Contábil Fiscal)", periodicidade: "anual", vencimentoFixo: "07-31", anoSeguinte: true, regimes: ["Lucro Presumido", "Lucro Real"],
    descricao: "Prazo limite em 31/07 do ano seguinte ao ano-calendário." },
  { tributo: "Opção pelo Simples Nacional", periodicidade: "anual", vencimentoFixo: "01-31", anoSeguinte: false, regimes: null,
    descricao: "Prazo até o final de janeiro pra quem quiser mudar de regime tributário." },
];

// Gera as sugestões de obrigações fiscais de um ano pra uma empresa, a
// partir do regime tributário dela — pulando o que já existe (mesmo
// tributo + competência), pra poder chamar de novo sem duplicar.
function buildFiscalSuggestions(empresa, existing, year) {
  const regime = empresa?.regimeTributario || null;
  const applies = (regimes) => !regimes || !regime || regimes.includes(regime);
  const existingKeys = new Set(
    existing.filter((o) => o.empresaId === empresa.id).map((o) => `${o.tributo}|${o.competencia}`)
  );
  const out = [];

  for (const rule of FISCAL_RULES) {
    if (!applies(rule.regimes)) continue;

    if (rule.periodicidade === "mensal") {
      for (let mes = 1; mes <= 12; mes++) {
        const competencia = `${year}-${pad2(mes)}`;
        if (existingKeys.has(`${rule.tributo}|${competencia}`)) continue;
        const vencimento = rule.diaVencimento
          ? (() => { const { y, m } = addMonths(year, mes, rule.mesesDepois || 0); return isoDate(y, m, rule.diaVencimento); })()
          : null;
        out.push({ empresaId: empresa.id, competencia, vencimento, tributo: rule.tributo, descricao: rule.descricao, valor: null, status: "Sugerido" });
      }
    } else if (rule.periodicidade === "trimestral") {
      for (let q = 1; q <= 4; q++) {
        const competencia = `${year}-Q${q}`;
        if (existingKeys.has(`${rule.tributo}|${competencia}`)) continue;
        const { y, m } = addMonths(year, q * 3, rule.mesesDepois || 1);
        out.push({ empresaId: empresa.id, competencia, vencimento: lastBusinessDayISO(y, m), tributo: rule.tributo, descricao: rule.descricao, valor: null, status: "Sugerido" });
      }
    } else if (rule.periodicidade === "anual") {
      const competencia = String(year);
      if (existingKeys.has(`${rule.tributo}|${competencia}`)) continue;
      const [mm, dd] = rule.vencimentoFixo.split("-").map(Number);
      out.push({ empresaId: empresa.id, competencia, vencimento: isoDate(rule.anoSeguinte ? year + 1 : year, mm, dd), tributo: rule.tributo, descricao: rule.descricao, valor: null, status: "Sugerido" });
    }
  }
  return out;
}

function FiscalView({ obligations, accounts, empresas, selectedEmpresa, onSave, userEmail, readOnly = false }) {
  const [modal, setModal] = useState(null);
  const [payModal, setPayModal] = useState(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const empresa = empresas.find((e) => e.id === selectedEmpresa) || null;
  const scoped = obligations.filter((o) => !o.deletedAt && o.empresaId === selectedEmpresa);
  const suggestions = scoped
    .filter((o) => o.status === "Sugerido")
    .sort((a, b) => (a.vencimento || "").localeCompare(b.vencimento || ""));

  const withDerived = scoped
    .filter((o) => o.status !== "Sugerido")
    .map((o) => {
      let statusDisplay = o.status;
      if (o.status !== "Pago" && (o.vencimento || "") < todayISO()) statusDisplay = "Atrasado";
      else if (o.status !== "Pago" && daysUntil(o.vencimento) <= 10) statusDisplay = "Próximo";
      return { ...o, statusDisplay };
    });

  const filtered = withDerived.filter((o) => {
    if (status && o.statusDisplay !== status) return false;
    if (search && !`${o.tributo} ${o.descricao}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => (a.vencimento || "").localeCompare(b.vencimento || ""));

  const submit = (form) => {
    // Editar uma sugestão e salvar já vale como revisão/confirmação dela —
    // "Sugerido" só existe até alguém olhar pro dado, nunca fica pendurado.
    const clean = form.status === "Sugerido" ? { ...form, status: "Pendente" } : form;
    if (clean.id) onSave(obligations.map((o) => (o.id === clean.id ? clean : o)));
    else onSave([...obligations, { ...clean, id: uid() }]);
    setModal(null);
  };
  const remove = (id) => {
    if (!confirmDelete("Mover esta obrigação fiscal pra lixeira? Você pode restaurar depois, em Lixeira.")) return;
    onSave(obligations.map((o) => (o.id === id ? { ...o, deletedAt: new Date().toISOString() } : o)));
  };
  const confirmPayment = (id, dataPagamento, valor, contaId) => {
    const o0 = obligations.find((x) => x.id === id);
    onSave(obligations.map((o) => (o.id === id ? { ...o, status: "Pago", dataPagamento, valor, contaId } : o)));
    logAudit(selectedEmpresa, "fiscalObligation", id, "baixa", `Dar baixa — ${o0?.tributo || ""}${o0 ? ` · ${competenciaLabel(o0.competencia)}` : ""} — ${fmtBRL(valor)} em ${fmtDate(dataPagamento)}`, userEmail);
    setPayModal(null);
  };
  const cancelPayment = (o) => {
    if (!confirmDelete(`Cancelar a baixa de "${o.tributo}"? Ela volta pra "Pendente".`)) return;
    onSave(obligations.map((x) => (x.id === o.id ? { ...x, status: "Pendente", dataPagamento: null, contaId: null } : x)));
    logAudit(selectedEmpresa, "fiscalObligation", o.id, "cancelar_baixa", `Cancelou baixa de ${o.tributo} · ${competenciaLabel(o.competencia)} — ${fmtBRL(o.valor)}`, userEmail);
  };
  const validateSuggestion = (id) => {
    onSave(obligations.map((o) => (o.id === id ? { ...o, status: "Pendente" } : o)));
  };
  const discardSuggestion = (id) => {
    onSave(obligations.map((o) => (o.id === id ? { ...o, deletedAt: new Date().toISOString() } : o)));
  };
  const generateSuggestions = () => {
    const year = new Date().getFullYear();
    const news = buildFiscalSuggestions(empresa, obligations, year);
    if (news.length === 0) {
      alert("Nenhuma obrigação nova pra sugerir — as obrigações desse ano já foram geradas ou já existem.");
      return;
    }
    onSave([...obligations, ...news.map((n) => ({ ...n, id: uid() }))]);
  };

  const total = filtered.reduce((s, o) => s + Number(o.valor || 0), 0);

  return (
    <div className="space-y-4">
      <Header title="Calendário Fiscal" subtitle={`${filtered.length} obrigação(ões) · ${fmtBRL(total)}`}>
        {!readOnly && (
          <>
            <Button variant="ghost" onClick={generateSuggestions} title="Sugere as obrigações do ano a partir do regime tributário da empresa">
              <Sparkles size={15} /> Gerar obrigações do ano
            </Button>
            <Button onClick={() => setModal({ empresaId: selectedEmpresa })}>
              <Plus size={15} /> Nova obrigação
            </Button>
          </>
        )}
      </Header>

      {!empresa?.regimeTributario && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: COLORS.amberSoft, color: COLORS.amber }}>
          <AlertTriangle size={15} />
          Defina o regime tributário desta empresa em Cadastros → Editar empresa, pra sugestões mais precisas (algumas obrigações valem só pra Simples Nacional, outras só pra Lucro Presumido/Real).
        </div>
      )}

      {suggestions.length > 0 && (
        <Card className="p-4" style={{ background: COLORS.goldSoft, border: `1px solid ${COLORS.gold}` }}>
          <p className="text-sm font-semibold mb-1" style={{ color: COLORS.ink }}>
            {suggestions.length} sugestão(ões) de obrigação fiscal pra revisar
          </p>
          <p className="text-xs mb-3" style={{ color: COLORS.inkSoft }}>
            Geradas a partir do regime tributário — confira os dados (principalmente ISS/ICMS, que variam por município/estado) e valide, edite ou descarte cada uma.
          </p>
          <div className="space-y-1.5">
            {suggestions.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2" style={{ background: "#fff" }}>
                <div className="min-w-0">
                  <p className="text-sm font-medium" style={{ color: COLORS.ink }}>
                    {o.tributo} <span style={{ color: COLORS.inkSoft, fontWeight: 400 }}>· {competenciaLabel(o.competencia)}</span>
                  </p>
                  <p className="text-xs" style={{ color: COLORS.inkSoft }}>
                    {o.vencimento ? `Vence em ${fmtDate(o.vencimento)}` : "Defina a data de vencimento"} — {o.descricao}
                  </p>
                </div>
                {!readOnly && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => setModal(o)} title="Editar antes de validar" className="p-1.5 rounded-md hover:bg-black/5"><Pencil size={14} color={COLORS.inkSoft} /></button>
                    <Button variant="subtle" onClick={() => validateSuggestion(o.id)} disabled={!o.vencimento} title={o.vencimento ? "Confirmar esta obrigação" : "Defina a data de vencimento antes de validar"}>
                      <Check size={13} /> Validar
                    </Button>
                    <button onClick={() => discardSuggestion(o.id)} title="Não se aplica a esta empresa" className="p-1.5 rounded-md hover:bg-black/5"><X size={14} color={COLORS.red} /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <StatusSummary items={withDerived} statuses={[
        { key: "Pendente", label: "Pendente", tone: "neutral" },
        { key: "Próximo", label: "Próximo (10 dias)", tone: "amber" },
        { key: "Atrasado", label: "Atrasado", tone: "red" },
        { key: "Pago", label: "Pago", tone: "green" },
      ]} />
      <FilterBar search={search} setSearch={setSearch} status={status} setStatus={setStatus}
        statusOptions={["Pendente", "Próximo", "Pago", "Atrasado"]} placeholder="Buscar tributo, descrição..." />

      <Card className="overflow-x-auto">
        {filtered.length === 0 ? (
          <EmptyState icon={Calendar} title="Nenhuma obrigação cadastrada" subtitle="Cadastre DAS, ISS, INSS, FGTS e outras obrigações fiscais aqui." />
        ) : (
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
                <th className="text-left font-medium px-4 py-2.5">Competência</th>
                <th className="text-left font-medium px-4 py-2.5">Vencimento</th>
                <th className="text-left font-medium px-4 py-2.5">Tributo</th>
                <th className="text-right font-medium px-4 py-2.5">Valor</th>
                <th className="text-left font-medium px-4 py-2.5">Status</th>
                <th className="text-left font-medium px-4 py-2.5">Banco</th>
                <th className="text-right font-medium px-4 py-2.5">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                  <td className="px-4 py-2.5" style={{ color: COLORS.inkSoft }}>{competenciaLabel(o.competencia)}</td>
                  <td className="px-4 py-2.5" style={{ color: COLORS.ink }}>{fmtDate(o.vencimento)}</td>
                  <td className="px-4 py-2.5" style={{ color: COLORS.ink }}>
                    <p className="font-medium">{o.tributo}</p>
                    <p className="text-xs" style={{ color: COLORS.inkSoft }}>{o.descricao}</p>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium" style={{ color: COLORS.ink }}>{fmtBRL(o.valor)}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={o.statusDisplay} /></td>
                  <td className="px-4 py-2.5" style={{ color: COLORS.inkSoft }}>{accounts.find((a) => a.id === o.contaId)?.nome || "—"}</td>
                  <td className="px-4 py-2.5">
                    {!readOnly && (
                      <div className="flex justify-end gap-1">
                        {o.status !== "Pago" ? (
                          <Button variant="subtle" onClick={() => setPayModal(o)}><Check size={13} /> Dar baixa</Button>
                        ) : (
                          <button onClick={() => cancelPayment(o)} title="Cancelar baixa (volta pra Pendente)" className="p-1.5 rounded-md hover:bg-black/5"><RotateCcw size={14} color={COLORS.amber} /></button>
                        )}
                        <button onClick={() => setModal(o)} title="Editar obrigação" className="p-1.5 rounded-md hover:bg-black/5"><Pencil size={14} color={COLORS.inkSoft} /></button>
                        <button onClick={() => remove(o.id)} title="Excluir obrigação" className="p-1.5 rounded-md hover:bg-black/5"><Trash2 size={14} color={COLORS.red} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {modal && (
        <FiscalModal initial={modal} onClose={() => setModal(null)} onSubmit={submit} />
      )}
      {payModal && (
        <SettleModal
          title="Dar baixa — Calendário Fiscal"
          label="Valor pago"
          dateLabel="Data do pagamento"
          accountLabel="Banco"
          item={payModal}
          accounts={accounts.filter((a) => a.empresaId === payModal.empresaId)}
          onClose={() => setPayModal(null)}
          onConfirm={(data, valor, contaId) => confirmPayment(payModal.id, data, valor, contaId)}
        />
      )}
    </div>
  );
}

function FiscalModal({ initial, onClose, onSubmit }) {
  const [form, setForm] = useState({
    competencia: todayISO().slice(0, 7), vencimento: todayISO(), tributo: TRIBUTOS_COMUNS[0],
    descricao: "", valor: "", status: "Pendente", ...initial,
  });
  const valid = form.tributo.trim() && Number(form.valor) > 0 && form.empresaId;
  return (
    <Modal title={initial.id ? "Editar obrigação" : "Nova obrigação fiscal"} onClose={onClose} wide>
      <div className="grid md:grid-cols-2 gap-3">
        <Field label="Tributo">
          <input
            list="tributos-comuns"
            value={form.tributo}
            onChange={(e) => setForm({ ...form, tributo: e.target.value })}
            className={inputCls}
            style={inputStyle}
          />
          <datalist id="tributos-comuns">
            {TRIBUTOS_COMUNS.map((t) => <option key={t} value={t} />)}
          </datalist>
        </Field>
        <Field label="Competência"><TextInput type="month" value={form.competencia} onChange={(e) => setForm({ ...form, competencia: e.target.value })} /></Field>
        <Field label="Vencimento"><TextInput type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} /></Field>
        <Field label="Valor (R$)"><TextInput type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></Field>
        <Field label="Descrição"><TextInput value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="md:col-span-2" /></Field>
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={() => valid && onSubmit(form)} disabled={!valid}>Salvar</Button>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/*  Plano de Contas                                                        */
/* ---------------------------------------------------------------------- */
function CategoriesView({ categories, costCenters, selectedEmpresa, currentEmpresa, readOnly, onSave, onSaveCostCenters }) {
  const [newNome, setNewNome] = useState({}); // { [grupo]: "texto digitado" }
  const [newCentro, setNewCentro] = useState("");
  const scoped = categories.filter((c) => c.empresaId === selectedEmpresa);
  const centrosScoped = costCenters.filter((c) => c.empresaId === selectedEmpresa).sort((a, b) => a.nome.localeCompare(b.nome));

  const addCentro = () => {
    const nome = newCentro.trim();
    if (!nome || !selectedEmpresa) return;
    if (centrosScoped.some((c) => c.nome.toLowerCase() === nome.toLowerCase())) {
      alert(`Já existe um Centro de Custo chamado "${nome}" nesta empresa.`);
      return;
    }
    onSaveCostCenters([...costCenters, { id: uid(), empresaId: selectedEmpresa, nome }]);
    setNewCentro("");
  };
  const removeCentro = (id) => onSaveCostCenters(costCenters.filter((c) => c.id !== id));

  // Próximo código dentro do grupo: olha o maior sufixo numérico já usado
  // (não o total de linhas) pra nunca colidir com um código que ficou
  // "no meio" depois de uma exclusão.
  const nextCodigo = (natureza, grupo) => {
    const prefix = natureza === "receita" ? "R" : "D";
    const grupoIdx = PLANO_CONTAS_GRUPOS[natureza].indexOf(grupo) + 1;
    const maxSeq = scoped
      .filter((c) => c.natureza === natureza && c.grupo === grupo)
      .reduce((max, c) => {
        const m = c.codigo.match(/\.(\d+)$/);
        return Math.max(max, m ? Number(m[1]) : 0);
      }, 0);
    return `${prefix}${grupoIdx}.${String(maxSeq + 1).padStart(2, "0")}`;
  };

  const addConta = (natureza, grupo) => {
    const nome = (newNome[grupo] || "").trim();
    if (!nome || !selectedEmpresa) return;
    const codigo = nextCodigo(natureza, grupo);
    const nova = { id: `${selectedEmpresa}-${codigo}`, empresaId: selectedEmpresa, grupo, codigo, nome, natureza };
    onSave([...categories, nova]);
    setNewNome((s) => ({ ...s, [grupo]: "" }));
  };
  const removeConta = (id) => onSave(categories.filter((c) => c.id !== id));

  // Só ADICIONA o que falta do padrão do segmento — nunca apaga uma
  // conta que o gestor já tenha criado ou renomeado.
  const restaurarPadrao = () => {
    if (!currentEmpresa) return;
    const template = categoriaTemplateDoSegmento(currentEmpresa.segmento);
    const nomesExistentes = new Set(scoped.map((c) => c.nome.trim().toLowerCase()));
    const faltantes = template.filter((t) => !nomesExistentes.has(t.nome.toLowerCase()));
    if (faltantes.length === 0) {
      alert("Essa empresa já tem todas as contas padrão do segmento dela.");
      return;
    }
    if (!confirmDelete(`Adicionar ${faltantes.length} conta(s) do padrão do segmento "${currentEmpresa.segmento || "genérico"}"? Nada é apagado, só o que falta é criado.`)) return;
    const novas = faltantes.map((t) => ({ id: `${selectedEmpresa}-${t.codigo}`, empresaId: selectedEmpresa, grupo: t.grupo, codigo: t.codigo, nome: t.nome, natureza: t.natureza }));
    onSave([...categories, ...novas]);
  };

  const renderGrupo = (natureza, grupo) => {
    const contas = scoped.filter((c) => c.natureza === natureza && c.grupo === grupo).sort((a, b) => a.codigo.localeCompare(b.codigo));
    return (
      <div key={grupo} className="mb-4 last:mb-0">
        <p className="text-xs font-semibold mb-1.5" style={{ color: COLORS.inkSoft }}>{grupo}</p>
        {contas.length === 0 ? (
          <p className="text-xs italic mb-1.5" style={{ color: COLORS.inkSoft }}>Nenhuma conta nesse grupo.</p>
        ) : (
          <div className="space-y-1 mb-1.5">
            {contas.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm py-0.5">
                <span style={{ color: COLORS.ink }}>{c.codigo} · {c.nome}</span>
                {!readOnly && (
                  <button onClick={() => removeConta(c.id)} title="Excluir conta" className="p-1 rounded hover:bg-black/5"><Trash2 size={13} color={COLORS.red} /></button>
                )}
              </div>
            ))}
          </div>
        )}
        {!readOnly && (
          <div className="flex gap-2">
            <TextInput
              value={newNome[grupo] || ""}
              onChange={(e) => setNewNome((s) => ({ ...s, [grupo]: e.target.value }))}
              placeholder={`Nova conta em "${grupo}"`}
              style={{ height: 32 }}
              onKeyDown={(e) => e.key === "Enter" && addConta(natureza, grupo)}
            />
            <Button variant="subtle" onClick={() => addConta(natureza, grupo)} title="Adicionar conta" style={{ height: 32 }}><Plus size={13} /></Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Header
        title="Plano de Contas"
        subtitle={
          !currentEmpresa
            ? "Selecione uma empresa pra ver o plano de contas dela."
            : readOnly
              ? `${currentEmpresa.nome} · segmento: ${currentEmpresa.segmento || "não definido"} · só o gestor pode editar.`
              : `${currentEmpresa.nome} · segmento: ${currentEmpresa.segmento || "não definido"}`
        }
      >
        {!readOnly && currentEmpresa && (
          <Button variant="ghost" onClick={restaurarPadrao}><RotateCcw size={15} /> Restaurar padrão do segmento</Button>
        )}
      </Header>
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3" style={{ color: COLORS.green }}>Receitas</h2>
          {PLANO_CONTAS_GRUPOS.receita.map((g) => renderGrupo("receita", g))}
        </Card>
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3" style={{ color: COLORS.red }}>Despesas</h2>
          {PLANO_CONTAS_GRUPOS.despesa.map((g) => renderGrupo("despesa", g))}
        </Card>
      </div>

      {currentEmpresa && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold" style={{ color: COLORS.ink }}>Centros de Custo</h2>
          <p className="text-xs mb-3" style={{ color: COLORS.inkSoft }}>
            Divisão interna da empresa (área, unidade, departamento...) pra agrupar receita e despesa — alimenta o dropdown "Centro de Custo" em Contas a Pagar/Receber e o relatório Rentabilidade por Centro de Custo.
          </p>
          {centrosScoped.length === 0 ? (
            <p className="text-xs italic mb-2" style={{ color: COLORS.inkSoft }}>Nenhum centro de custo cadastrado ainda.</p>
          ) : (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 mb-2">
              {centrosScoped.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm py-0.5">
                  <span style={{ color: COLORS.ink }}>{c.nome}</span>
                  {!readOnly && (
                    <button onClick={() => removeCentro(c.id)} title="Excluir centro de custo" className="p-1 rounded hover:bg-black/5"><Trash2 size={13} color={COLORS.red} /></button>
                  )}
                </div>
              ))}
            </div>
          )}
          {!readOnly && (
            <div className="flex gap-2">
              <TextInput
                value={newCentro}
                onChange={(e) => setNewCentro(e.target.value)}
                placeholder="Novo centro de custo"
                style={{ height: 32 }}
                onKeyDown={(e) => e.key === "Enter" && addCentro()}
              />
              <Button variant="subtle" onClick={addCentro} title="Adicionar centro de custo" style={{ height: 32 }}><Plus size={13} /></Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Relatórios                                                             */
/* ---------------------------------------------------------------------- */
const daysBetween = (isoFrom, isoTo) => {
  if (!isoFrom || !isoTo) return 0;
  const a = new Date(isoFrom + "T00:00:00");
  const b = new Date(isoTo + "T00:00:00");
  return Math.round((b - a) / 86400000);
};

const REPORT_TABS = [
  { id: "dre", label: "DRE", Comp: DREReport },
  { id: "dfc", label: "DFC (Realizado)", Comp: DFCReport },
  { id: "kpis", label: "Indicadores", Comp: KPIReport },
  { id: "fluxo", label: "Fluxo Projetado", Comp: FluxoProjetadoReport },
  { id: "ordem", label: "Ordem de Pagamento", Comp: PaymentOrderReport },
  { id: "cobranca", label: "Relação de Cobrança", Comp: CollectionsReport },
  { id: "aging", label: "Aging", Comp: AgingReport },
  { id: "rentabilidade", label: "Rentabilidade por Centro de Custo", Comp: RentabilidadeProjetoReport },
  { id: "cronograma", label: "Cronograma de Desembolso", Comp: CronogramaDesembolsoReport },
  { id: "diaSemana", label: "Faturamento por Dia da Semana", Comp: FaturamentoDiaSemanaReport },
  { id: "extrato", label: "Extrato de Conta", Comp: ExtratoContaReport },
];

function ReportsView(props) {
  const { empresas, selectedEmpresa, year } = props;
  const [tab, setTab] = useState("dre");
  const [printMode, setPrintMode] = useState("current"); // "current" | "all" — decides what shows up when window.print() runs
  const empresaLabel = empresas.find((e) => e.id === selectedEmpresa)?.nome || "";
  const empresaLogo = empresas.find((e) => e.id === selectedEmpresa)?.logoUrl;
  const printDate = fmtDate(todayISO());

  const exportPdf = (mode) => {
    setPrintMode(mode);
    setTimeout(() => window.print(), 50);
  };

  const activeReport = REPORT_TABS.find((t) => t.id === tab);

  return (
    <div className="space-y-4">
      <Header
        title="Relatórios"
        subtitle="Análises geradas a partir dos lançamentos já cadastrados."
      >
        <Button variant="ghost" onClick={() => exportPdf("current")}>
          <Printer size={15} /> Exportar PDF (relatório atual)
        </Button>
        <Button onClick={() => exportPdf("all")}>
          <Printer size={15} /> Exportar tudo em PDF
        </Button>
      </Header>
      <div className="flex items-center gap-1.5 flex-wrap print:hidden">
        {REPORT_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: tab === t.id ? COLORS.primary : "#EFEEE8",
              color: tab === t.id ? "#fff" : COLORS.ink,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tela + impressão do relatório atual */}
      <div className={printMode === "all" ? "print:hidden" : ""}>
        <div className="mb-3 hidden print:flex items-center gap-3">
          {empresaLogo && <img src={empresaLogo} alt="" className="w-10 h-10 rounded object-contain" />}
          <div>
            <h2 className="text-lg font-semibold" style={{ color: COLORS.ink }}>{empresaLabel} · {activeReport.label}</h2>
            <p className="text-xs" style={{ color: COLORS.inkSoft }}>{empresaLabel} · Ano {year} · Emitido em {printDate}</p>
          </div>
        </div>
        <activeReport.Comp {...props} />
        {tab === "comparativo" && empresas.length < 2 && (
          <p className="text-xs px-1 mt-2 print:hidden" style={{ color: COLORS.inkSoft }}>
            Cadastre mais de uma empresa para comparar resultados entre elas.
          </p>
        )}
      </div>

      {/* Impressão de todos os relatórios em sequência (um por página) */}
      {printMode === "all" && (
        <div className="hidden print:block space-y-8">
          {REPORT_TABS.map(({ id, label, Comp }) => (
            <div key={id} className="break-after-page">
              <div className="mb-3 flex items-center gap-3">
                {empresaLogo && <img src={empresaLogo} alt="" className="w-10 h-10 rounded object-contain" />}
                <div>
                  <h2 className="text-lg font-semibold" style={{ color: COLORS.ink }}>{empresaLabel} · {label}</h2>
                  <p className="text-xs" style={{ color: COLORS.inkSoft }}>{empresaLabel} · Ano {year} · Emitido em {printDate}</p>
                </div>
              </div>
              <Comp {...props} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReportCard({ title, subtitle, children }) {
  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold" style={{ color: COLORS.ink }}>{title}</h2>
      {subtitle && <p className="text-xs mb-3" style={{ color: COLORS.inkSoft }}>{subtitle}</p>}
      <div className={subtitle ? "" : "mt-3"}>{children}</div>
    </Card>
  );
}

/* --- DRE (Demonstrativo de Resultado) --- */
// DRE em dois regimes — caixa (o que já foi de fato pago/recebido) e
// competência (a que período o lançamento pertence, pelo vencimento, tenha
// sido liquidado ou não). O sistema não coleta uma "data de competência"
// separada da data de vencimento — pra manter simples pro operador não
// contador, competência aqui é aproximada pelo mês de vencimento do
// lançamento, prática comum nesse porte de negócio. As duas visões são
// year-scoped de propósito (o "· {year}" do título só virava verdade
// aqui — categoryBreakdown/receivableBreakdown, usados no regime de caixa
// antigo, eram na verdade desde sempre, não só o ano selecionado).
function DREReport({ year, payables, receivables, financialAdjustments }) {
  const [regime, setRegime] = useState("caixa"); // "caixa" | "competencia"

  const receitas = useMemo(() => {
    const map = {};
    receivables.forEach((r) => {
      if (regime === "caixa") {
        if (r.status !== "Recebido" || yearOf(r.dataReceb) !== year) return;
        map[r.categoria] = (map[r.categoria] || 0) + Number(r.valorRecebido ?? r.valor ?? 0) - Number(r.juros || 0) - Number(r.multa || 0) + Number(r.desconto || 0);
      } else {
        if (yearOf(r.vencimento) !== year) return;
        map[r.categoria] = (map[r.categoria] || 0) + Number(r.valor || 0);
      }
    });
    return Object.entries(map).map(([nome, valor]) => ({ nome, valor })).filter((r) => r.valor > 0).sort((a, b) => b.valor - a.valor);
  }, [receivables, regime, year]);

  const despesas = useMemo(() => {
    const map = {};
    payables.forEach((p) => {
      if (regime === "caixa") {
        if (p.status !== "Pago" || yearOf(p.dataPgto) !== year) return;
        map[p.categoria] = (map[p.categoria] || 0) + Number(p.valorPago ?? p.valor ?? 0) - Number(p.juros || 0) - Number(p.multa || 0) + Number(p.desconto || 0);
      } else {
        if (yearOf(p.vencimento) !== year) return;
        map[p.categoria] = (map[p.categoria] || 0) + Number(p.valor || 0);
      }
    });
    return Object.entries(map).map(([nome, valor]) => ({ nome, valor })).filter((d) => d.valor > 0).sort((a, b) => b.valor - a.valor);
  }, [payables, regime, year]);

  const totalReceitas = receitas.reduce((s, r) => s + r.valor, 0);
  const totalDespesas = despesas.reduce((s, d) => s + d.valor, 0);
  const resultadoOperacional = totalReceitas - totalDespesas;
  const mostraFinanceiro = regime === "caixa" && financialAdjustments && (financialAdjustments.receitas > 0 || financialAdjustments.despesas > 0);
  const resultado = resultadoOperacional + (mostraFinanceiro ? financialAdjustments.resultado : 0);
  const margem = totalReceitas > 0 ? resultadoOperacional / totalReceitas : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 print:hidden">
        {[{ id: "caixa", label: "Regime de caixa" }, { id: "competencia", label: "Regime de competência" }].map((opt) => (
          <button
            key={opt.id}
            onClick={() => setRegime(opt.id)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ background: regime === opt.id ? COLORS.ink : "#EFEEE8", color: regime === opt.id ? "#fff" : COLORS.ink }}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <ReportCard
        title={`DRE (regime de ${regime === "caixa" ? "caixa" : "competência"}) · ${year}`}
        subtitle={regime === "caixa"
          ? "Receitas e despesas efetivamente realizadas (recebidas/pagas) no ano, por categoria."
          : "Receitas e despesas pelo mês de vencimento (competência aproximada), tenham sido liquidadas ou não — mostra o resultado do período independente de quando o dinheiro entrou/saiu de fato."}
      >
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: COLORS.green }}>Receitas</p>
            {receitas.length === 0 ? (
              <p className="text-sm" style={{ color: COLORS.inkSoft }}>Sem receitas no período.</p>
            ) : (
              <div className="space-y-1">
                {receitas.map((r) => (
                  <div key={r.nome} className="flex justify-between text-sm py-0.5">
                    <span style={{ color: COLORS.ink }}>{r.nome}</span>
                    <span className="tabular-nums font-medium" style={{ color: COLORS.green }}>{fmtBRL(r.valor)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between text-sm pt-2 mt-2 font-semibold" style={{ borderTop: `1px solid ${COLORS.border}`, color: COLORS.ink }}>
              <span>Total receitas</span>
              <span className="tabular-nums">{fmtBRL(totalReceitas)}</span>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: COLORS.red }}>Despesas</p>
            {despesas.length === 0 ? (
              <p className="text-sm" style={{ color: COLORS.inkSoft }}>Sem despesas no período.</p>
            ) : (
              <div className="space-y-1">
                {despesas.map((d) => (
                  <div key={d.nome} className="flex justify-between text-sm py-0.5">
                    <span style={{ color: COLORS.ink }}>{d.nome}</span>
                    <span className="tabular-nums font-medium" style={{ color: COLORS.red }}>{fmtBRL(d.valor)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between text-sm pt-2 mt-2 font-semibold" style={{ borderTop: `1px solid ${COLORS.border}`, color: COLORS.ink }}>
              <span>Total despesas</span>
              <span className="tabular-nums">{fmtBRL(totalDespesas)}</span>
            </div>
          </div>
        </div>
      </ReportCard>

      {mostraFinanceiro && (
        <ReportCard title="Resultado financeiro" subtitle="Juros e multas pagos/recebidos, e descontos concedidos/obtidos em baixas — sempre por regime de caixa (só existe no momento da baixa), separado do operacional de propósito.">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex justify-between text-sm">
              <span style={{ color: COLORS.ink }}>Receitas financeiras</span>
              <span className="tabular-nums font-medium" style={{ color: COLORS.green }}>{fmtBRL(financialAdjustments.receitas)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: COLORS.ink }}>Despesas financeiras</span>
              <span className="tabular-nums font-medium" style={{ color: COLORS.red }}>{fmtBRL(financialAdjustments.despesas)}</span>
            </div>
          </div>
          <div className="flex justify-between text-sm pt-2 mt-2 font-semibold" style={{ borderTop: `1px solid ${COLORS.border}`, color: COLORS.ink }}>
            <span>Resultado financeiro</span>
            <span className="tabular-nums" style={{ color: financialAdjustments.resultado >= 0 ? COLORS.green : COLORS.red }}>{fmtBRL(financialAdjustments.resultado)}</span>
          </div>
        </ReportCard>
      )}

      <Card className="p-4 flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: COLORS.ink }}>Resultado líquido do período</span>
        <span className="text-lg font-semibold tabular-nums" style={{ color: resultado >= 0 ? COLORS.green : COLORS.red }}>
          {fmtBRL(resultado)}
        </span>
      </Card>
      <p className="text-xs px-1" style={{ color: COLORS.inkSoft }}>
        Margem operacional: {totalReceitas > 0 ? `${(margem * 100).toFixed(1)}%` : "—"}
      </p>
    </div>
  );
}

/* --- DFC (Demonstrativo de Fluxo de Caixa) realizado --- */
// Diferente do Fluxo Projetado (que olha só pro que ainda está em aberto,
// contas a pagar/receber não liquidadas), este mostra o que JÁ aconteceu
// de fato — mesmos dados que alimentam o card "Saldo em contas" do
// Painel, só que mês a mês em vez de só o total do ano.
function DFCReport({ year, monthlyFlow }) {
  const linhas = MESES_PT.map((nome, i) => ({
    mes: nome,
    entradas: monthlyFlow.entradas[i],
    saidas: monthlyFlow.saidas[i],
    saldoMes: monthlyFlow.entradas[i] - monthlyFlow.saidas[i],
    acumulado: monthlyFlow.acumulado[i],
  }));
  const totalEntradas = monthlyFlow.entradas.reduce((a, b) => a + b, 0);
  const totalSaidas = monthlyFlow.saidas.reduce((a, b) => a + b, 0);
  const saldoAno = totalEntradas - totalSaidas;

  return (
    <div className="space-y-4">
      <ReportCard
        title={`DFC (fluxo de caixa realizado) · ${year}`}
        subtitle="Entradas e saídas que já aconteceram de fato (contas pagas/recebidas, lançamentos bancários e obrigações fiscais quitadas), mês a mês — mostra a liquidez real, diferente do Fluxo Projetado (que olha só pro que ainda está em aberto)."
      >
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={linhas}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
            <XAxis dataKey="mes" tickFormatter={(m) => m.slice(0, 3)} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmtBRL(v)} width={70} />
            <Tooltip formatter={(v) => fmtBRL(v)} labelFormatter={(m) => m} />
            <Legend />
            <Bar dataKey="entradas" name="Entradas" fill={COLORS.green} />
            <Bar dataKey="saidas" name="Saídas" fill={COLORS.red} />
            <Line dataKey="acumulado" name="Saldo acumulado" stroke={COLORS.primary} strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
                <th className="text-left font-medium px-2 py-1.5">Mês</th>
                <th className="text-right font-medium px-2 py-1.5">Entradas</th>
                <th className="text-right font-medium px-2 py-1.5">Saídas</th>
                <th className="text-right font-medium px-2 py-1.5">Saldo do mês</th>
                <th className="text-right font-medium px-2 py-1.5">Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.mes} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                  <td className="px-2 py-1.5 capitalize" style={{ color: COLORS.ink }}>{l.mes}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: COLORS.green }}>{fmtBRL(l.entradas)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: COLORS.red }}>{fmtBRL(l.saidas)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: l.saldoMes >= 0 ? COLORS.green : COLORS.red }}>{fmtBRL(l.saldoMes)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-medium" style={{ color: COLORS.ink }}>{fmtBRL(l.acumulado)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `2px solid ${COLORS.border}` }} className="font-semibold">
                <td className="px-2 py-1.5" style={{ color: COLORS.ink }}>Total do ano</td>
                <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: COLORS.green }}>{fmtBRL(totalEntradas)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: COLORS.red }}>{fmtBRL(totalSaidas)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: saldoAno >= 0 ? COLORS.green : COLORS.red }}>{fmtBRL(saldoAno)}</td>
                <td className="px-2 py-1.5"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </ReportCard>
    </div>
  );
}

/* --- Indicadores (KPIs) --- */
// Métricas que nenhum outro relatório dá isolado: margem já existe no DRE,
// mas inadimplência e prazo médio (de receber/pagar) exigem cruzar
// vencimento com a data em que a baixa de fato aconteceu — só faz sentido
// num relatório próprio.
function KPIReport({ year, payables, receivables, totals }) {
  const today = todayISO();

  const receivablesAno = receivables.filter((r) => yearOf(r.vencimento) === year);
  const recebidosAno = receivablesAno.filter((r) => r.status === "Recebido");
  const totalFaturado = receivablesAno.reduce((s, r) => s + Number(r.valor || 0), 0);
  const vencidoNaoRecebido = receivablesAno
    .filter((r) => r.status !== "Recebido" && r.vencimento && r.vencimento < today)
    .reduce((s, r) => s + Number(r.valor || 0), 0);
  const inadimplencia = totalFaturado > 0 ? (vencidoNaoRecebido / totalFaturado) * 100 : 0;

  const prazosRecebimento = recebidosAno.filter((r) => r.vencimento && r.dataReceb).map((r) => daysBetween(r.vencimento, r.dataReceb));
  const dso = prazosRecebimento.length > 0 ? prazosRecebimento.reduce((a, b) => a + b, 0) / prazosRecebimento.length : null;

  const ticketMedio = recebidosAno.length > 0
    ? recebidosAno.reduce((s, r) => s + Number(r.valorRecebido ?? r.valor ?? 0), 0) / recebidosAno.length
    : 0;

  const payablesAno = payables.filter((p) => yearOf(p.vencimento) === year);
  const pagosAno = payablesAno.filter((p) => p.status === "Pago");
  const prazosPagamento = pagosAno.filter((p) => p.vencimento && p.dataPgto).map((p) => daysBetween(p.vencimento, p.dataPgto));
  const dpo = prazosPagamento.length > 0 ? prazosPagamento.reduce((a, b) => a + b, 0) / prazosPagamento.length : null;

  const fmtDias = (v) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(0)} dia(s)`);

  const cards = [
    { label: "Margem operacional (caixa)", value: totals.totalEntradas > 0 ? `${(totals.margem * 100).toFixed(1)}%` : "—", icon: TrendingUp, tone: totals.margem >= 0 ? "green" : "red", nota: "Saldo do ano ÷ entradas do ano, regime de caixa." },
    { label: "Taxa de inadimplência", value: `${inadimplencia.toFixed(1)}%`, icon: AlertTriangle, tone: inadimplencia > 10 ? "red" : inadimplencia > 0 ? "gold" : "green", nota: "Valor vencido e ainda não recebido ÷ total faturado no ano." },
    { label: "Prazo médio de recebimento", value: fmtDias(dso), icon: CalendarClock, tone: dso == null ? "gold" : dso > 0 ? "red" : "green", nota: "Média de dias entre o vencimento e o recebimento — positivo é atraso." },
    { label: "Prazo médio de pagamento", value: fmtDias(dpo), icon: CalendarClock, tone: "gold", nota: "Média de dias entre o vencimento e a baixa de contas a pagar." },
    { label: "Ticket médio recebido", value: fmtBRL(ticketMedio), icon: CircleDollarSign, tone: "gold", nota: "Valor médio por conta a receber já recebida no ano." },
    { label: "Faturado no ano (a receber)", value: fmtBRL(totalFaturado), icon: ArrowDownCircle, tone: "green", nota: "Soma de tudo com vencimento neste ano, recebido ou não." },
  ];

  return (
    <div className="space-y-4">
      <ReportCard title={`Indicadores de desempenho · ${year}`} subtitle="Métricas de saúde financeira — passe o olho pra ver o que está fora do esperado antes de entrar nos relatórios detalhados.">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {cards.map((k) => {
            const Icon = k.icon;
            const toneColor = k.tone === "green" ? COLORS.green : k.tone === "red" ? COLORS.red : COLORS.gold;
            return (
              <Card key={k.label} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium" style={{ color: COLORS.inkSoft }}>{k.label}</span>
                  <Icon size={16} color={toneColor} />
                </div>
                <p className="text-lg font-semibold tabular-nums" style={{ color: toneColor }}>{k.value}</p>
                <p className="text-[11px] mt-1" style={{ color: COLORS.inkSoft }}>{k.nota}</p>
              </Card>
            );
          })}
        </div>
      </ReportCard>
    </div>
  );
}

/* --- Fluxo de Caixa Projetado --- */
const ITEMIZADO_FLUXO_LIMITE = 10;

function FluxoProjetadoReport({ payables, receivables, fiscalObligations, accounts, accountBalance }) {
  const [tipoFiltro, setTipoFiltro] = useState(""); // "" | "Pagar" | "Receber" | "Fiscal"
  const [verTodosItens, setVerTodosItens] = useState(false);
  const today = todayISO();
  const totalBalance = accounts.reduce((s, a) => s + accountBalance(a.id), 0);

  const openPayables = payables.filter((p) => p.status !== "Pago");
  const openReceivables = receivables.filter((r) => r.status !== "Recebido");
  // "Sugerido" ainda não foi validado pelo analista — não entra na
  // projeção até virar uma obrigação de verdade.
  const openFiscal = fiscalObligations.filter((o) => o.status !== "Pago" && o.status !== "Sugerido");

  const buckets = [
    { label: "Vencidos", test: (d) => d < 0 },
    { label: "Próximos 7 dias", test: (d) => d >= 0 && d <= 7 },
    { label: "8–15 dias", test: (d) => d > 7 && d <= 15 },
    { label: "16–30 dias", test: (d) => d > 15 && d <= 30 },
    { label: "31–60 dias", test: (d) => d > 30 && d <= 60 },
    { label: "61–90 dias", test: (d) => d > 60 && d <= 90 },
  ];

  let saldoAcumulado = totalBalance;
  const rows = buckets.map((b) => {
    const entradas = openReceivables
      .filter((r) => b.test(daysBetween(today, r.vencimento)))
      .reduce((s, r) => s + Number(r.valor || 0), 0);
    const saidas = [...openPayables, ...openFiscal]
      .filter((p) => b.test(daysBetween(today, p.vencimento)))
      .reduce((s, p) => s + Number(p.valor || 0), 0);
    if (b.label !== "Vencidos") saldoAcumulado += entradas - saidas;
    return { label: b.label, entradas, saidas, saldoAcumulado, vencidos: b.label === "Vencidos" };
  });

  const itemized = [
    ...openPayables.map((p) => ({ ...p, __tipo: "Pagar", __nome: p.fornecedor })),
    ...openReceivables.map((r) => ({ ...r, __tipo: "Receber", __nome: r.cliente })),
    ...openFiscal.map((o) => ({ ...o, __tipo: "Fiscal", __nome: o.tributo })),
  ]
    .filter((i) => daysBetween(today, i.vencimento) <= 90)
    .filter((i) => !tipoFiltro || i.__tipo === tipoFiltro)
    .sort((a, b) => (a.vencimento || "").localeCompare(b.vencimento || ""));
  const itemizedExibidos = verTodosItens ? itemized : itemized.slice(0, ITEMIZADO_FLUXO_LIMITE);

  return (
    <div className="space-y-4">
      <ReportCard title="Fluxo de caixa projetado" subtitle="Saldo atual em contas + contas a pagar/receber em aberto, projetado até 90 dias.">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span style={{ color: COLORS.inkSoft }}>Saldo atual em contas</span>
          <span className="font-semibold tabular-nums" style={{ color: COLORS.ink }}>{fmtBRL(totalBalance)}</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
              <th className="text-left font-medium px-2 py-2">Período</th>
              <th className="text-right font-medium px-2 py-2">Entradas previstas</th>
              <th className="text-right font-medium px-2 py-2">Saídas previstas</th>
              <th className="text-right font-medium px-2 py-2">Saldo projetado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                <td className="px-2 py-2" style={{ color: r.vencidos ? COLORS.red : COLORS.ink }}>{r.label}</td>
                <td className="px-2 py-2 text-right tabular-nums" style={{ color: COLORS.green }}>{r.entradas > 0 ? `+${fmtBRL(r.entradas)}` : "—"}</td>
                <td className="px-2 py-2 text-right tabular-nums" style={{ color: COLORS.red }}>{r.saidas > 0 ? `−${fmtBRL(r.saidas)}` : "—"}</td>
                <td className="px-2 py-2 text-right tabular-nums font-medium" style={{ color: r.vencidos ? COLORS.inkSoft : COLORS.ink }}>
                  {r.vencidos ? "—" : fmtBRL(r.saldoAcumulado)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ReportCard>

      <ReportCard title="Itens em aberto até 90 dias" subtitle="Contas a pagar e a receber que ainda não foram baixadas.">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <Select value={tipoFiltro} onChange={(e) => { setTipoFiltro(e.target.value); setVerTodosItens(false); }} style={{ width: 176 }}>
            <option value="">Todos os tipos</option>
            <option value="Pagar">Só a pagar</option>
            <option value="Receber">Só a receber</option>
            <option value="Fiscal">Só fiscal</option>
          </Select>
          <span className="text-xs" style={{ color: COLORS.inkSoft }}>{itemized.length} item(ns)</span>
        </div>
        {itemized.length === 0 ? (
          <EmptyState icon={FileText} title="Nada em aberto" subtitle="Não há contas a pagar/receber pendentes nos próximos 90 dias." />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
                  <th className="text-left font-medium px-2 py-2">Vencimento</th>
                  <th className="text-left font-medium px-2 py-2">Tipo</th>
                  <th className="text-left font-medium px-2 py-2">Descrição</th>
                  <th className="text-right font-medium px-2 py-2">Valor</th>
                </tr>
              </thead>
              <tbody>
                {itemizedExibidos.map((i) => (
                  <tr key={i.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                    <td className="px-2 py-2" style={{ color: daysBetween(today, i.vencimento) < 0 ? COLORS.red : COLORS.ink }}>{fmtDate(i.vencimento)}</td>
                    <td className="px-2 py-2"><Badge tone={i.__tipo === "Receber" ? "green" : "amber"}>{i.__tipo}</Badge></td>
                    <td className="px-2 py-2" style={{ color: COLORS.ink }}>{i.__nome}</td>
                    <td className="px-2 py-2 text-right tabular-nums" style={{ color: i.__tipo === "Receber" ? COLORS.green : COLORS.red }}>{fmtBRL(i.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!verTodosItens && itemized.length > ITEMIZADO_FLUXO_LIMITE && (
              <button onClick={() => setVerTodosItens(true)} className="text-xs font-medium mt-2" style={{ color: COLORS.primary }}>
                Ver mais {itemized.length - ITEMIZADO_FLUXO_LIMITE} item(ns)
              </button>
            )}
          </>
        )}
      </ReportCard>
    </div>
  );
}

const PAYMENT_ORDER_STATUS = ["Agendado", "Autorizado", "Pago"];
const ORDEM_PAGAMENTO_LIMITE = 15;

// Segunda linha (descrição) de uma célula nome+descrição — borda
// esquerda suave pra ficar claro que é um detalhe secundário daquele
// item, não um registro à parte (mesmo tratamento em Ordem de Pagamento
// e Relação de Cobrança).
function SubLinha({ children }) {
  if (!children) return null;
  return (
    <p className="text-xs mt-0.5 pl-2" style={{ color: COLORS.inkSoft, borderLeft: `2px solid ${COLORS.border}` }}>
      {children}
    </p>
  );
}

// Relação de ordem de pagamento — a "prestação de contas" que o analista
// mostra pro dono (o que foi proposto, o que ele já autorizou, o que já
// foi de fato pago), despesa por despesa. Fica disponível pra consulta
// e impressão a qualquer momento — usa o mesmo Exportar PDF de Relatórios.
function PaymentOrderReport({ payables, accounts }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [contaId, setContaId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [verTodos, setVerTodos] = useState(false);

  const dataRef = (p) => p.agendadoPara || p.dataPgto || p.vencimento || "";
  const contaOf = (p) => (p.status === "Pago" ? p.contaPgtoId : p.contaAgendadaId);

  const items = payables
    .filter((p) => PAYMENT_ORDER_STATUS.includes(p.status))
    .filter((p) => !status || p.status === status)
    .filter((p) => !contaId || contaOf(p) === contaId)
    .filter((p) => !search || p.fornecedor.toLowerCase().includes(search.toLowerCase()))
    .filter((p) => !dateFrom || dataRef(p) >= dateFrom)
    .filter((p) => !dateTo || dataRef(p) <= dateTo)
    .sort((a, b) => dataRef(b).localeCompare(dataRef(a)));
  const total = items.reduce((s, p) => s + Number(p.valorPago || p.valor || 0), 0);
  const itemsExibidos = verTodos ? items : items.slice(0, ORDEM_PAGAMENTO_LIMITE);

  return (
    <ReportCard title="Ordem de pagamento" subtitle="Pagamentos agendados, autorizados ou já pagos — despesa por despesa, pra apresentar ao dono, auditoria ou reunião.">
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <FilterBar
          search={search} setSearch={setSearch} placeholder="Buscar fornecedor..."
          status={status} setStatus={(v) => { setStatus(v); setVerTodos(false); }} statusOptions={PAYMENT_ORDER_STATUS}
          dateFrom={dateFrom} setDateFrom={(v) => { setDateFrom(v); setVerTodos(false); }}
          dateTo={dateTo} setDateTo={(v) => { setDateTo(v); setVerTodos(false); }}
        />
        <Select value={contaId} onChange={(e) => { setContaId(e.target.value); setVerTodos(false); }} style={{ height: 38, width: 176 }}>
          <option value="">Todas as contas</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
        </Select>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Nada agendado, autorizado ou pago ainda" subtitle="Assim que agendar um pagamento em Contas a Pagar, ele aparece aqui." />
      ) : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
                <th className="text-left font-medium px-2 py-2">Fornecedor</th>
                <th className="text-left font-medium px-2 py-2">Vencimento</th>
                <th className="text-left font-medium px-2 py-2">Data proposta/paga</th>
                <th className="text-left font-medium px-2 py-2">Conta</th>
                <th className="text-left font-medium px-2 py-2">Status</th>
                <th className="text-left font-medium px-2 py-2">Autorizado por</th>
                <th className="text-right font-medium px-2 py-2">Valor</th>
              </tr>
            </thead>
            <tbody>
              {itemsExibidos.map((p) => (
                <tr key={p.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                  <td className="px-2 py-2" style={{ color: COLORS.ink }}>
                    <p className="font-medium">{p.fornecedor}</p>
                    <SubLinha>{p.descricao}</SubLinha>
                  </td>
                  <td className="px-2 py-2" style={{ color: COLORS.inkSoft }}>{fmtDate(p.vencimento)}</td>
                  <td className="px-2 py-2" style={{ color: COLORS.ink }}>{fmtDate(p.status === "Pago" ? p.dataPgto : p.agendadoPara)}</td>
                  <td className="px-2 py-2" style={{ color: COLORS.inkSoft }}>{accounts.find((a) => a.id === contaOf(p))?.nome || "—"}</td>
                  <td className="px-2 py-2"><StatusBadge status={p.status} /></td>
                  <td className="px-2 py-2" style={{ color: COLORS.inkSoft }}>{p.autorizadoPor || "—"}</td>
                  <td className="px-2 py-2 text-right tabular-nums font-medium" style={{ color: COLORS.ink }}>{fmtBRL(p.valorPago || p.valor)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `2px solid ${COLORS.border}` }}>
                <td colSpan={6} className="px-2 py-2 text-right font-semibold" style={{ color: COLORS.ink }}>Total ({items.length})</td>
                <td className="px-2 py-2 text-right tabular-nums font-semibold" style={{ color: COLORS.ink }}>{fmtBRL(total)}</td>
              </tr>
            </tfoot>
          </table>
          {!verTodos && items.length > ORDEM_PAGAMENTO_LIMITE && (
            <button onClick={() => setVerTodos(true)} className="text-xs font-medium mt-2" style={{ color: COLORS.primary }}>
              Ver mais {items.length - ORDEM_PAGAMENTO_LIMITE} item(ns)
            </button>
          )}
        </>
      )}
    </ReportCard>
  );
}

const COLLECTIONS_STATUS = ["Inadimplente", "Próximo", "A Receber", "Antecipado"];
const COBRANCA_LIMITE = 15;

// Relação de cobrança — o espelho, do lado de receber, da Ordem de
// Pagamento: tudo que ainda está em aberto, pra acompanhar inadimplência,
// repassar pra quem for cobrar, ou levar numa reunião com o dono.
function CollectionsReport({ receivables, contacts }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [verTodos, setVerTodos] = useState(false);
  const today = todayISO();
  const items = receivables
    .filter((r) => r.status !== "Recebido")
    .map((r) => {
      let statusDisplay = r.status;
      if (r.status === "A Receber" && r.vencimento < today) statusDisplay = "Inadimplente";
      else if (r.status === "A Receber" && daysUntil(r.vencimento) <= 10) statusDisplay = "Próximo";
      return { ...r, statusDisplay, contato: contacts.find((c) => c.id === r.contactId)?.contato || "" };
    })
    .filter((r) => !status || r.statusDisplay === status)
    .filter((r) => !search || r.cliente.toLowerCase().includes(search.toLowerCase()))
    .filter((r) => !dateFrom || (r.vencimento || "") >= dateFrom)
    .filter((r) => !dateTo || (r.vencimento || "") <= dateTo)
    .sort((a, b) => (a.vencimento || "").localeCompare(b.vencimento || ""));
  const total = items.reduce((s, r) => s + Number(r.valor || 0), 0);
  const itemsExibidos = verTodos ? items : items.slice(0, COBRANCA_LIMITE);

  return (
    <ReportCard title="Relação de cobrança" subtitle="Contas a receber em aberto — pra acompanhar inadimplência, repassar pra quem for cobrar, ou levar numa reunião.">
      <FilterBar
        search={search} setSearch={setSearch} placeholder="Buscar cliente..."
        status={status} setStatus={(v) => { setStatus(v); setVerTodos(false); }} statusOptions={COLLECTIONS_STATUS}
        dateFrom={dateFrom} setDateFrom={(v) => { setDateFrom(v); setVerTodos(false); }}
        dateTo={dateTo} setDateTo={(v) => { setDateTo(v); setVerTodos(false); }}
      />
      <div className="mt-3">
      {items.length === 0 ? (
        <EmptyState icon={MessageCircle} title="Nada em aberto" subtitle="Todas as contas a receber estão em dia ou já recebidas." />
      ) : (
        <>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
              <th className="text-left font-medium px-2 py-2">Cliente</th>
              <th className="text-left font-medium px-2 py-2">Vencimento</th>
              <th className="text-left font-medium px-2 py-2">Contato</th>
              <th className="text-left font-medium px-2 py-2">Status</th>
              <th className="text-right font-medium px-2 py-2">Valor</th>
            </tr>
          </thead>
          <tbody>
            {itemsExibidos.map((r) => (
              <tr key={r.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                <td className="px-2 py-2" style={{ color: COLORS.ink }}>
                  <p className="font-medium">{r.cliente}</p>
                  <SubLinha>{r.descricao}</SubLinha>
                </td>
                <td className="px-2 py-2" style={{ color: r.statusDisplay === "Inadimplente" ? COLORS.red : COLORS.ink }}>{fmtDate(r.vencimento)}</td>
                <td className="px-2 py-2" style={{ color: COLORS.inkSoft }}>{r.contato || "—"}</td>
                <td className="px-2 py-2"><StatusBadge status={r.statusDisplay} /></td>
                <td className="px-2 py-2 text-right tabular-nums font-medium" style={{ color: COLORS.ink }}>{fmtBRL(r.valor)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: `2px solid ${COLORS.border}` }}>
              <td colSpan={4} className="px-2 py-2 text-right font-semibold" style={{ color: COLORS.ink }}>Total em aberto ({items.length})</td>
              <td className="px-2 py-2 text-right tabular-nums font-semibold" style={{ color: COLORS.ink }}>{fmtBRL(total)}</td>
            </tr>
          </tfoot>
        </table>
        {!verTodos && items.length > COBRANCA_LIMITE && (
          <button onClick={() => setVerTodos(true)} className="text-xs font-medium mt-2" style={{ color: COLORS.primary }}>
            Ver mais {items.length - COBRANCA_LIMITE} item(ns)
          </button>
        )}
        </>
      )}
      </div>
    </ReportCard>
  );
}

/* --- Aging de Pagáveis/Recebíveis --- */
function agingBuckets(items, dateField) {
  const today = todayISO();
  const buckets = { "A vencer": 0, "1–30 dias": 0, "31–60 dias": 0, "61–90 dias": 0, "90+ dias": 0 };
  items.forEach((i) => {
    const d = daysBetween(i[dateField], today);
    const valor = Number(i.valor || 0);
    if (d < 0) buckets["A vencer"] += valor;
    else if (d <= 30) buckets["1–30 dias"] += valor;
    else if (d <= 60) buckets["31–60 dias"] += valor;
    else if (d <= 90) buckets["61–90 dias"] += valor;
    else buckets["90+ dias"] += valor;
  });
  return buckets;
}

function AgingTable({ title, tone, items, dateField, nameField }) {
  const buckets = agingBuckets(items, dateField);
  const total = Object.values(buckets).reduce((a, b) => a + b, 0);
  const today = todayISO();
  const detailed = [...items].sort((a, b) => (a[dateField] || "").localeCompare(b[dateField] || ""));

  return (
    <ReportCard title={title}>
      <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))" }}>
        {Object.entries(buckets).map(([label, valor]) => (
          <div key={label} className="rounded-lg p-2.5 text-center" style={{ background: valor > 0 ? (tone === "red" ? COLORS.redSoft : COLORS.amberSoft) : "#F3F2ED" }}>
            <p className="text-[11px]" style={{ color: COLORS.inkSoft }}>{label}</p>
            <p className="text-sm font-semibold tabular-nums" style={{ color: COLORS.ink }}>{fmtBRL(valor)}</p>
          </div>
        ))}
      </div>
      {detailed.length === 0 ? (
        <p className="text-sm" style={{ color: COLORS.inkSoft }}>Nada em aberto.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
              <th className="text-left font-medium px-2 py-1.5">Vencimento</th>
              <th className="text-left font-medium px-2 py-1.5">{nameField.label}</th>
              <th className="text-right font-medium px-2 py-1.5">Dias em atraso</th>
              <th className="text-right font-medium px-2 py-1.5">Valor</th>
            </tr>
          </thead>
          <tbody>
            {detailed.map((i) => {
              const d = daysBetween(i[dateField], today);
              return (
                <tr key={i.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                  <td className="px-2 py-1.5" style={{ color: COLORS.ink }}>{fmtDate(i[dateField])}</td>
                  <td className="px-2 py-1.5" style={{ color: COLORS.ink }}>{i[nameField.field]}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: d > 0 ? COLORS.red : COLORS.inkSoft }}>{d > 0 ? d : "—"}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-medium" style={{ color: COLORS.ink }}>{fmtBRL(i.valor)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <div className="flex justify-between text-sm pt-2 mt-2 font-semibold" style={{ borderTop: `1px solid ${COLORS.border}`, color: COLORS.ink }}>
        <span>Total em aberto</span>
        <span className="tabular-nums">{fmtBRL(total)}</span>
      </div>
    </ReportCard>
  );
}

function AgingReport({ payables, receivables }) {
  const openPayables = payables.filter((p) => p.status !== "Pago");
  const openReceivables = receivables.filter((r) => r.status !== "Recebido");
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <AgingTable title="Aging · Contas a Pagar" tone="red" items={openPayables} dateField="vencimento" nameField={{ label: "Fornecedor", field: "fornecedor" }} />
      <AgingTable title="Aging · Contas a Receber" tone="amber" items={openReceivables} dateField="vencimento" nameField={{ label: "Cliente", field: "cliente" }} />
    </div>
  );
}

/* --- Rentabilidade por Projeto/Contrato --- */
// Usa o campo "Centro de Custo" que já existe em Contas a Pagar/Receber
// (texto livre) — receita menos custo direto lançado com o mesmo nome de
// centro de custo. Preferido a "Projeto" porque é um conceito universal
// (toda empresa tem uma divisão interna de custos, nem toda empresa
// pensa em "projeto") — "Projeto" continua existindo só pro Cronograma
// de Desembolso (eventos). Não normaliza maiúsculas/acentos de
// propósito: é mais simples avisar que "Delivery" e "delivery" contam
// separado do que arriscar juntar dois centros de custo que só por
// coincidência têm nomes parecidos.
function RentabilidadeProjetoReport({ year, payables, receivables }) {
  const receitaPorCentro = {};
  receivables.forEach((r) => {
    const centro = (r.centroCusto || "").trim();
    if (!centro || yearOf(r.vencimento) !== year) return;
    receitaPorCentro[centro] = (receitaPorCentro[centro] || 0) + Number(r.valor || 0);
  });
  const custoPorCentro = {};
  payables.forEach((p) => {
    const centro = (p.centroCusto || "").trim();
    if (!centro || yearOf(p.vencimento) !== year) return;
    custoPorCentro[centro] = (custoPorCentro[centro] || 0) + Number(p.valor || 0);
  });
  const centros = [...new Set([...Object.keys(receitaPorCentro), ...Object.keys(custoPorCentro)])];
  const linhas = centros
    .map((centro) => {
      const receita = receitaPorCentro[centro] || 0;
      const custo = custoPorCentro[centro] || 0;
      const margem = receita - custo;
      return { centro, receita, custo, margem, margemPct: receita > 0 ? (margem / receita) * 100 : null };
    })
    .sort((a, b) => b.margem - a.margem);
  const semCentro = receivables.some((r) => yearOf(r.vencimento) === year && !(r.centroCusto || "").trim())
    || payables.some((p) => yearOf(p.vencimento) === year && !(p.centroCusto || "").trim());

  return (
    <div className="space-y-4">
      <ReportCard
        title={`Rentabilidade por Centro de Custo · ${year}`}
        subtitle='Receita menos custos diretos, agrupados pelo campo "Centro de Custo" (Contas a Pagar/Receber) — mostra qual área/divisão interna dá lucro e qual dá prejuízo.'
      >
        {linhas.length === 0 ? (
          <EmptyState icon={ListTree} title='Nenhum lançamento com "Centro de Custo" preenchido neste ano' subtitle='Preencha o campo "Centro de Custo" ao lançar contas a pagar/receber pra esse relatório funcionar.' />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
                  <th className="text-left font-medium px-2 py-1.5">Centro de Custo</th>
                  <th className="text-right font-medium px-2 py-1.5">Receita</th>
                  <th className="text-right font-medium px-2 py-1.5">Custo direto</th>
                  <th className="text-right font-medium px-2 py-1.5">Margem</th>
                  <th className="text-right font-medium px-2 py-1.5">Margem %</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.centro} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                    <td className="px-2 py-1.5 font-medium" style={{ color: COLORS.ink }}>{l.centro}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: COLORS.green }}>{fmtBRL(l.receita)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: COLORS.red }}>{fmtBRL(l.custo)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-medium" style={{ color: l.margem >= 0 ? COLORS.green : COLORS.red }}>{fmtBRL(l.margem)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: COLORS.inkSoft }}>{l.margemPct == null ? "—" : `${l.margemPct.toFixed(1)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {semCentro && (
          <p className="text-xs mt-3" style={{ color: COLORS.inkSoft }}>
            Há lançamentos deste ano sem "Centro de Custo" preenchido — eles não entram nesse relatório.
          </p>
        )}
      </ReportCard>
    </div>
  );
}

/* --- Cronograma Financeiro de Desembolso --- */
// Contas a pagar com "Projeto" preenchido, sem filtro de ano (evento pode
// atravessar virada de ano) — agrupadas por projeto e ordenadas por
// vencimento, pra visualizar de uma vez quando cada fornecedor precisa
// ser pago e planejar o caixa com antecedência.
function CronogramaDesembolsoReport({ payables }) {
  const comProjeto = payables.filter((p) => (p.projeto || "").trim());
  const porProjeto = {};
  comProjeto.forEach((p) => {
    const proj = p.projeto.trim();
    (porProjeto[proj] = porProjeto[proj] || []).push(p);
  });
  const projetos = Object.keys(porProjeto).sort();

  return (
    <div className="space-y-4">
      <ReportCard
        title="Cronograma Financeiro de Desembolso"
        subtitle='Contas a pagar com "Projeto" preenchido, agrupadas e ordenadas por vencimento — quando cada fornecedor do evento/projeto precisa ser pago.'
      >
        {projetos.length === 0 ? (
          <EmptyState icon={ListTree} title='Nenhuma conta a pagar com "Projeto" preenchido' subtitle='Preencha o campo "Projeto" ao lançar contas a pagar pra esse cronograma aparecer.' />
        ) : (
          <div className="space-y-5">
            {projetos.map((proj) => {
              const itens = [...porProjeto[proj]].sort((a, b) => (a.vencimento || "").localeCompare(b.vencimento || ""));
              const total = itens.reduce((s, p) => s + Number(p.valor || 0), 0);
              const pendente = itens.filter((p) => p.status !== "Pago").reduce((s, p) => s + Number(p.valor || 0), 0);
              return (
                <div key={proj}>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>{proj}</p>
                    <p className="text-xs" style={{ color: COLORS.inkSoft }}>{fmtBRL(total)} total · {fmtBRL(pendente)} pendente</p>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
                        <th className="text-left font-medium px-2 py-1.5">Vencimento</th>
                        <th className="text-left font-medium px-2 py-1.5">Fornecedor</th>
                        <th className="text-left font-medium px-2 py-1.5">Categoria</th>
                        <th className="text-right font-medium px-2 py-1.5">Valor</th>
                        <th className="text-left font-medium px-2 py-1.5">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((p) => (
                        <tr key={p.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                          <td className="px-2 py-1.5" style={{ color: COLORS.ink }}>{fmtDate(p.vencimento)}</td>
                          <td className="px-2 py-1.5" style={{ color: COLORS.ink }}>{p.fornecedor}</td>
                          <td className="px-2 py-1.5" style={{ color: COLORS.inkSoft }}>{p.categoria}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: COLORS.ink }}>{fmtBRL(p.valor)}</td>
                          <td className="px-2 py-1.5"><StatusBadge status={p.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}
      </ReportCard>
    </div>
  );
}

const DIAS_SEMANA = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

/* --- Faturamento por Dia da Semana --- */
function FaturamentoDiaSemanaReport({ year, receivables }) {
  const porDia = Array(7).fill(0).map(() => ({ total: 0, qtd: 0 }));
  receivables.forEach((r) => {
    if (!r.vencimento || yearOf(r.vencimento) !== year) return;
    const dia = new Date(r.vencimento + "T00:00:00").getDay();
    porDia[dia].total += Number(r.valor || 0);
    porDia[dia].qtd += 1;
  });
  const linhas = DIAS_SEMANA.map((nome, i) => ({ nome, total: porDia[i].total, qtd: porDia[i].qtd, media: porDia[i].qtd > 0 ? porDia[i].total / porDia[i].qtd : 0 }));
  const totalGeral = linhas.reduce((s, l) => s + l.total, 0);
  const maiorDia = linhas.reduce((max, l) => (l.total > max.total ? l : max), linhas[0]);

  return (
    <div className="space-y-4">
      <ReportCard
        title={`Faturamento por Dia da Semana · ${year}`}
        subtitle="Contas a receber agrupadas pelo dia da semana do vencimento — identifica dias de pico e dias fracos, pra ajudar no planejamento de pessoal e compras."
      >
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={linhas} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
            <XAxis dataKey="nome" tickFormatter={(d) => d.slice(0, 3)} tick={{ fontSize: 11, fill: COLORS.inkSoft }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: COLORS.inkSoft }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtBRL(v)} width={70} />
            <Tooltip formatter={(v) => fmtBRL(v)} labelFormatter={(d) => d} contentStyle={{ borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 12 }} />
            <Bar dataKey="total" name="Faturamento" fill="#BFDBC9" radius={[3, 3, 0, 0]} maxBarSize={48} />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
                <th className="text-left font-medium px-2 py-1.5">Dia</th>
                <th className="text-right font-medium px-2 py-1.5">Faturamento</th>
                <th className="text-right font-medium px-2 py-1.5">Lançamentos</th>
                <th className="text-right font-medium px-2 py-1.5">Ticket médio</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.nome} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                  <td className="px-2 py-1.5" style={{ color: COLORS.ink }}>{l.nome}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-medium" style={{ color: COLORS.ink }}>{fmtBRL(l.total)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: COLORS.inkSoft }}>{l.qtd}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: COLORS.inkSoft }}>{fmtBRL(l.media)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalGeral > 0 && (
          <p className="text-xs mt-2 px-1" style={{ color: COLORS.inkSoft }}>
            Dia de maior faturamento: <strong>{maiorDia.nome}</strong> ({fmtBRL(maiorDia.total)}).
          </p>
        )}
      </ReportCard>
    </div>
  );
}

/* --- Comparativo entre Empresas --- */
function ComparativoReport({ empresaBreakdown }) {
  const [selected, setSelected] = useState(null); // null = todas

  if (empresaBreakdown.length === 0) {
    return <EmptyState icon={Building2} title="Nenhuma empresa cadastrada" />;
  }

  const ativos = selected === null ? empresaBreakdown.map((e) => e.empresa.id) : selected;
  const shown = empresaBreakdown.filter((e) => ativos.includes(e.empresa.id));
  const maxSaldo = Math.max(1, ...shown.map((e) => Math.abs(e.saldo)));

  const toggle = (id) => {
    const base = selected === null ? empresaBreakdown.map((e) => e.empresa.id) : selected;
    const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    setSelected(next.length === empresaBreakdown.length ? null : next);
  };

  return (
    <ReportCard title="Comparativo entre empresas do grupo" subtitle="Resultado do ano corrente (regime de caixa) e saldo atual em contas.">
      <div className="flex items-center gap-1.5 flex-wrap mb-3 print:hidden">
        {empresaBreakdown.map(({ empresa }) => {
          const on = ativos.includes(empresa.id);
          return (
            <button
              key={empresa.id}
              onClick={() => toggle(empresa.id)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-opacity"
              style={{ background: on ? empresa.cor : "#EFEEE8", color: on ? "#fff" : COLORS.inkSoft, opacity: on ? 1 : 0.7 }}
            >
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: on ? "#fff" : empresa.cor }} />
              {empresa.nome}
            </button>
          );
        })}
      </div>
      {shown.length === 0 ? (
        <p className="text-sm py-6 text-center" style={{ color: COLORS.inkSoft }}>Selecione ao menos uma empresa pra comparar.</p>
      ) : (
      <table className="w-full text-sm">
        <thead>
          <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
            <th className="text-left font-medium px-2 py-2">Empresa</th>
            <th className="text-right font-medium px-2 py-2">Entradas</th>
            <th className="text-right font-medium px-2 py-2">Saídas</th>
            <th className="text-right font-medium px-2 py-2">Resultado</th>
            <th className="text-left font-medium px-2 py-2 pl-4">Resultado (relativo)</th>
            <th className="text-right font-medium px-2 py-2">Saldo em contas</th>
          </tr>
        </thead>
        <tbody>
          {shown.map(({ empresa, entradas, saidas, saldo, saldoContas }) => (
            <tr key={empresa.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
              <td className="px-2 py-2">
                <span className="inline-flex items-center gap-1.5" style={{ color: COLORS.ink }}>
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: empresa.cor }} />
                  {empresa.nome}
                </span>
              </td>
              <td className="px-2 py-2 text-right tabular-nums" style={{ color: COLORS.green }}>{fmtBRL(entradas)}</td>
              <td className="px-2 py-2 text-right tabular-nums" style={{ color: COLORS.red }}>{fmtBRL(saidas)}</td>
              <td className="px-2 py-2 text-right tabular-nums font-medium" style={{ color: saldo >= 0 ? COLORS.green : COLORS.red }}>{fmtBRL(saldo)}</td>
              <td className="px-2 py-2 pl-4">
                <div className="h-2 rounded-full w-full" style={{ background: "#EFEEE8" }}>
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${(Math.abs(saldo) / maxSaldo) * 100}%`,
                      background: saldo >= 0 ? COLORS.green : COLORS.red,
                    }}
                  />
                </div>
              </td>
              <td className="px-2 py-2 text-right tabular-nums font-medium" style={{ color: COLORS.ink }}>{fmtBRL(saldoContas)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      )}
    </ReportCard>
  );
}

/* --- Extrato de Conta --- */
const EXTRATO_LIMITE = 20;

function ExtratoContaReport({ accounts, payables, receivables, bankEntries, transfers, fiscalObligations, accountBalance }) {
  const [contaId, setContaId] = useState(accounts[0]?.id || "");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [verTodos, setVerTodos] = useState(false);
  useEffect(() => {
    if (!accounts.find((a) => a.id === contaId)) setContaId(accounts[0]?.id || "");
  }, [accounts]); // eslint-disable-line react-hooks/exhaustive-deps

  if (accounts.length === 0) {
    return <EmptyState icon={Landmark} title="Nenhuma conta cadastrada" subtitle="Cadastre uma conta para ver o extrato." />;
  }

  const conta = accounts.find((a) => a.id === contaId);
  const movs = [];
  bankEntries.filter((b) => b.contaId === contaId).forEach((b) => {
    movs.push({ id: `bk-${b.id}`, data: b.data, tipo: b.tipo, valor: Number(b.valor || 0), descricao: `${b.categoria} — ${b.descricao || ""}` });
  });
  payables.filter((p) => p.status === "Pago" && p.contaPgtoId === contaId).forEach((p) => {
    movs.push({ id: `pg-${p.id}`, data: p.dataPgto, tipo: "Saída", valor: Number(p.valorPago || p.valor || 0), descricao: `Pagamento — ${p.fornecedor}${fmtAdjustments(p)}` });
  });
  receivables.filter((r) => r.status === "Recebido" && r.contaRecebId === contaId).forEach((r) => {
    movs.push({ id: `rc-${r.id}`, data: r.dataReceb, tipo: "Entrada", valor: Number(r.valorRecebido || r.valor || 0), descricao: `Recebimento — ${r.cliente}${fmtAdjustments(r)}` });
  });
  transfers.filter((t) => t.contaOrigemId === contaId).forEach((t) => {
    movs.push({ id: `to-${t.id}`, data: t.data, tipo: "Saída", valor: Number(t.valor || 0), descricao: `Transferência enviada — ${t.descricao || ""}` });
  });
  transfers.filter((t) => t.contaDestinoId === contaId).forEach((t) => {
    movs.push({ id: `td-${t.id}`, data: t.data, tipo: "Entrada", valor: Number(t.valor || 0), descricao: `Transferência recebida — ${t.descricao || ""}` });
  });
  fiscalObligations.filter((o) => o.status === "Pago" && o.contaId === contaId).forEach((o) => {
    movs.push({ id: `fo-${o.id}`, data: o.dataPagamento, tipo: "Saída", valor: Number(o.valor || 0), descricao: `Obrigação fiscal — ${o.tributo}` });
  });

  const sorted = movs.filter((m) => m.data).sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id));
  let running = Number(conta?.saldoInicial || 0);
  const withRunning = sorted.map((m) => {
    running += m.tipo === "Entrada" ? m.valor : -m.valor;
    return { ...m, running };
  });
  const saldoAtual = conta ? accountBalance(conta.id) : 0;

  // Filtro é só de exibição — o saldo corrente de cada linha vem sempre
  // da lista completa (withRunning), nunca recalculado em cima do
  // recorte filtrado, senão o "Saldo" mostrado deixaria de bater com o
  // extrato de verdade.
  const filtered = withRunning
    .filter((m) => !search || m.descricao.toLowerCase().includes(search.toLowerCase()))
    .filter((m) => !dateFrom || m.data >= dateFrom)
    .filter((m) => !dateTo || m.data <= dateTo);
  const filteredExibidos = verTodos ? filtered : filtered.slice(-EXTRATO_LIMITE);

  return (
    <ReportCard title="Extrato de conta" subtitle="Todos os movimentos que afetam o saldo da conta selecionada.">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <Field label="Conta">
          <Select value={contaId} onChange={(e) => setContaId(e.target.value)}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </Select>
        </Field>
        <div className="text-right">
          <p className="text-xs" style={{ color: COLORS.inkSoft }}>Saldo atual</p>
          <p className="text-base font-semibold tabular-nums" style={{ color: COLORS.ink }}>{fmtBRL(saldoAtual)}</p>
        </div>
      </div>
      <FilterBar
        search={search} setSearch={setSearch} placeholder="Buscar na descrição..."
        status="" setStatus={() => {}} statusOptions={[]}
        dateFrom={dateFrom} setDateFrom={(v) => { setDateFrom(v); setVerTodos(false); }}
        dateTo={dateTo} setDateTo={(v) => { setDateTo(v); setVerTodos(false); }}
      />
      <div className="mt-3">
      {withRunning.length === 0 ? (
        <EmptyState icon={Wallet} title="Sem movimentos" subtitle="Essa conta ainda não tem lançamentos, baixas ou transferências." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Wallet} title="Nada encontrado" subtitle="Nenhum movimento bate com a busca/período escolhido." />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
              <th className="text-left font-medium px-2 py-2">Data</th>
              <th className="text-left font-medium px-2 py-2">Descrição</th>
              <th className="text-right font-medium px-2 py-2">Valor</th>
              <th className="text-right font-medium px-2 py-2">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {filteredExibidos.length === withRunning.length && (
              <tr style={{ borderTop: `1px solid ${COLORS.border}` }}>
                <td className="px-2 py-2" style={{ color: COLORS.inkSoft }}>{fmtDate(conta?.dataInicial)}</td>
                <td className="px-2 py-2" style={{ color: COLORS.inkSoft }}>Saldo inicial</td>
                <td className="px-2 py-2 text-right tabular-nums" style={{ color: COLORS.inkSoft }}>—</td>
                <td className="px-2 py-2 text-right tabular-nums font-medium" style={{ color: COLORS.ink }}>{fmtBRL(conta?.saldoInicial || 0)}</td>
              </tr>
            )}
            {filteredExibidos.map((m) => (
              <tr key={m.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                <td className="px-2 py-2" style={{ color: COLORS.ink }}>{fmtDate(m.data)}</td>
                <td className="px-2 py-2" style={{ color: COLORS.inkSoft }}>{m.descricao}</td>
                <td className="px-2 py-2 text-right tabular-nums" style={{ color: m.tipo === "Entrada" ? COLORS.green : COLORS.red }}>
                  {m.tipo === "Entrada" ? "+" : "−"}{fmtBRL(m.valor)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums font-medium" style={{ color: COLORS.ink }}>{fmtBRL(m.running)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!verTodos && filtered.length > EXTRATO_LIMITE && (
        <button onClick={() => setVerTodos(true)} className="text-xs font-medium mt-2" style={{ color: COLORS.primary }}>
          Ver {filtered.length - EXTRATO_LIMITE} movimento(s) mais antigo(s)
        </button>
      )}
      </div>
    </ReportCard>
  );
}

const AUDIT_ENTITY_LABEL = { payable: "Conta a pagar", receivable: "Conta a receber", fiscalObligation: "Obrigação fiscal", empresa: "Empresa" };
const AUDIT_ACTION_LABEL = {
  baixa: "Dar baixa",
  baixa_automatica: "Baixa automática",
  cancelar_baixa: "Cancelar baixa",
  agendar: "Agendar pagamento",
  autorizar: "Autorizar pagamento",
  cancelar_agendamento: "Cancelar agendamento",
  cobranca: "Cobrança enviada",
  antecipar: "Marcar antecipação",
  cancelar_antecipacao: "Cancelar antecipação",
  remessa_cnab: "Incluído em remessa CNAB",
  exportar_documentos: "Exportar documentos",
  apagar_documentos: "Apagar documentos",
};
const AUDIT_ACTION_TONE = {
  baixa: "green",
  baixa_automatica: "green",
  cancelar_baixa: "amber",
  agendar: "gold",
  autorizar: "blue",
  cancelar_agendamento: "amber",
  cobranca: "neutral",
  antecipar: "gold",
  cancelar_antecipacao: "amber",
  remessa_cnab: "blue",
  exportar_documentos: "neutral",
  apagar_documentos: "red",
};

function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

// Log de auditoria — só leitura aqui (o insert acontece direto em
// logAudit(), no momento de dar/cancelar uma baixa). Carrega sozinho
// porque, ao contrário do resto do app, essa tabela não passa pelo
// storageGet genérico em FinanceiroApp (é grande demais pra manter tudo
// em memória o tempo todo, e a tela normalmente só é aberta sob demanda).
// Filtros aplicados direto na query (não em memória) porque agora o log
// cruza todas as empresas — sem isso a lista só cresce pra baixo.
function AuditLogReport({ empresas = [], users = [] }) {
  const [rows, setRows] = useState(null); // null = carregando
  const [buscaInput, setBuscaInput] = useState("");
  const [busca, setBusca] = useState("");
  const [empresaId, setEmpresaId] = useState("");
  const [action, setAction] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [dataIni, setDataIni] = useState("");
  const [dataFim, setDataFim] = useState("");
  const empresaNome = (id) => empresas.find((e) => e.id === id)?.nome || "—";

  // Debounce da busca livre — evita 1 query por tecla digitada.
  useEffect(() => {
    const t = setTimeout(() => setBusca(buscaInput.trim()), 400);
    return () => clearTimeout(t);
  }, [buscaInput]);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    (async () => {
      let query = supabase.from("auditLog").select("*").order("created_at", { ascending: false }).limit(200);
      if (empresaId) query = query.eq("empresaId", empresaId);
      if (action) query = query.eq("action", action);
      if (userEmail) query = query.eq("userEmail", userEmail);
      if (dataIni) query = query.gte("created_at", `${dataIni}T00:00:00`);
      if (dataFim) query = query.lte("created_at", `${dataFim}T23:59:59`);
      if (busca) query = query.ilike("detail", `%${busca}%`);
      const { data, error } = await query;
      if (!cancelled) setRows(error ? [] : data);
    })();
    return () => { cancelled = true; };
  }, [empresaId, action, userEmail, dataIni, dataFim, busca]);

  const temFiltro = busca || empresaId || action || userEmail || dataIni || dataFim;
  const limparFiltros = () => { setBuscaInput(""); setBusca(""); setEmpresaId(""); setAction(""); setUserEmail(""); setDataIni(""); setDataFim(""); };
  const usuariosOptions = [...new Set([...users.map((u) => u.email), "sistema"])].sort();

  return (
    <ReportCard title="Log de auditoria" subtitle="Toda baixa e cancelamento de baixa, de todas as empresas, fica registrado aqui — data, hora, usuário e ação. Ninguém, nem o gestor, consegue editar ou apagar essas linhas por dentro do sistema.">
      <div className="flex items-center gap-2 flex-wrap p-2 rounded-xl mb-3 print:hidden" style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}` }}>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" color={COLORS.inkSoft} />
          <TextInput value={buscaInput} onChange={(e) => setBuscaInput(e.target.value)} placeholder="Buscar por documento, fornecedor/cliente, valor..." className="pl-8" style={{ height: 38 }} />
        </div>
        <Select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} style={{ height: 38, width: 176 }}>
          <option value="">Todas as empresas</option>
          {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </Select>
        <Select value={action} onChange={(e) => setAction(e.target.value)} style={{ height: 38, width: 176 }}>
          <option value="">Todas as ações</option>
          {Object.entries(AUDIT_ACTION_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </Select>
        <Select value={userEmail} onChange={(e) => setUserEmail(e.target.value)} style={{ height: 38, width: 176 }}>
          <option value="">Todos os usuários</option>
          {usuariosOptions.map((email) => <option key={email} value={email}>{email}</option>)}
        </Select>
        <div className="flex items-center gap-1.5 rounded-lg pl-2.5 pr-1.5 shrink-0" style={{ background: "#fff", border: `1px solid ${COLORS.border}`, height: 38 }}>
          <Calendar size={14} color={COLORS.inkSoft} className="shrink-0" />
          <input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} title="De" className="text-sm outline-none bg-transparent" style={{ color: COLORS.ink, width: 108 }} />
          <span className="text-xs shrink-0" style={{ color: COLORS.inkSoft }}>até</span>
          <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} title="Até" className="text-sm outline-none bg-transparent" style={{ color: COLORS.ink, width: 108 }} />
        </div>
        {temFiltro && (
          <button onClick={limparFiltros} title="Limpar filtros" className="p-2 rounded-full hover:bg-black/5 shrink-0">
            <X size={15} color={COLORS.inkSoft} />
          </button>
        )}
      </div>

      {rows === null ? (
        <p className="text-sm py-6 text-center" style={{ color: COLORS.inkSoft }}>Carregando…</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Nada encontrado" subtitle={temFiltro ? "Nenhum registro bate com esses filtros." : "Assim que alguém der ou cancelar uma baixa em alguma empresa, aparece aqui."} />
      ) : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
                <th className="text-left font-medium px-2 py-2">Quando</th>
                <th className="text-left font-medium px-2 py-2">Empresa</th>
                <th className="text-left font-medium px-2 py-2">Usuário</th>
                <th className="text-left font-medium px-2 py-2">Ação</th>
                <th className="text-left font-medium px-2 py-2">Registro</th>
                <th className="text-left font-medium px-2 py-2">Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                  <td className="px-2 py-2 whitespace-nowrap" style={{ color: COLORS.inkSoft }}>{fmtDateTime(r.created_at)}</td>
                  <td className="px-2 py-2" style={{ color: COLORS.ink }}>{empresaNome(r.empresaId)}</td>
                  <td className="px-2 py-2" style={{ color: COLORS.ink }}>{r.userEmail || "—"}</td>
                  <td className="px-2 py-2">
                    <Badge tone={AUDIT_ACTION_TONE[r.action] || "neutral"}>{AUDIT_ACTION_LABEL[r.action] || r.action}</Badge>
                  </td>
                  <td className="px-2 py-2" style={{ color: COLORS.inkSoft }}>{AUDIT_ENTITY_LABEL[r.entity] || r.entity}</td>
                  <td className="px-2 py-2" style={{ color: COLORS.inkSoft }}>{r.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 200 && (
            <p className="text-xs text-center pt-3" style={{ color: COLORS.inkSoft }}>Mostrando só os 200 mais recentes — refine os filtros (empresa, período, usuário) pra achar um registro mais antigo.</p>
          )}
        </>
      )}
    </ReportCard>
  );
}

/* ---------------------------------------------------------------------- */
/*  Conciliação Bancária                                                   */
/* ---------------------------------------------------------------------- */

// Converte "1.234,56" / "1234.56" / "R$ 1.234,56" / "-45,00" em número.
function parseMoneyLoose(raw) {
  if (raw == null) return NaN;
  let s = String(raw).trim().replace(/[Rr]\$\s?/, "");
  if (!s) return NaN;
  const neg = /^\(.*\)$/.test(s);
  s = s.replace(/[()]/g, "");
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  if (Number.isNaN(n)) return NaN;
  return neg ? -n : n;
}

// Converte datas em vários formatos comuns de extrato para ISO yyyy-mm-dd.
function parseDateLoose(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); // yyyy-mm-dd ou yyyyMMdd (OFX)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); // dd/mm/yyyy
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = `20${y}`;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

function parseOFX(text) {
  const lines = [];
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  blocks.forEach((block) => {
    const body = block.split(/<\/STMTTRN>/i)[0];
    const get = (tag) => {
      const mm = body.match(new RegExp(`<${tag}>\\s*([^<\\r\\n]+)`, "i"));
      return mm ? mm[1].trim() : "";
    };
    const data = parseDateLoose(get("DTPOSTED"));
    const valorRaw = get("TRNAMT");
    const valor = parseMoneyLoose(valorRaw);
    const descricao = get("MEMO") || get("NAME") || "";
    if (data && !Number.isNaN(valor)) {
      lines.push({ data, valor: Math.abs(valor), tipo: valor >= 0 ? "Entrada" : "Saída", descricao });
    }
  });
  return lines;
}

function parseCSV(text) {
  const rawLines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (rawLines.length === 0) return [];
  const delim = (rawLines[0].match(/;/g) || []).length >= (rawLines[0].match(/,/g) || []).length ? ";" : ",";
  const splitLine = (l) => l.split(delim).map((c) => c.trim().replace(/^"|"$/g, ""));

  const lines = [];
  rawLines.forEach((raw) => {
    const cols = splitLine(raw);
    let data = null;
    let valor = NaN;
    let valorIdx = -1;
    cols.forEach((c, i) => {
      if (!data) {
        const d = parseDateLoose(c);
        if (d) data = d;
      }
    });
    // valor: pega a última coluna que parseia como número plausível (evita pegar a data)
    for (let i = cols.length - 1; i >= 0; i--) {
      const v = parseMoneyLoose(cols[i]);
      if (!Number.isNaN(v) && !parseDateLoose(cols[i])) {
        valor = v;
        valorIdx = i;
        break;
      }
    }
    if (data && !Number.isNaN(valor)) {
      const descricao = cols.filter((_, i) => i !== valorIdx && parseDateLoose(cols[i]) !== data).join(" ").trim() || cols.join(" ");
      lines.push({ data, valor: Math.abs(valor), tipo: valor >= 0 ? "Entrada" : "Saída", descricao });
    }
  });
  return lines;
}

function parseStatementFile(filename, text) {
  if (/\.ofx$/i.test(filename) || /<OFX>/i.test(text)) return parseOFX(text);
  return parseCSV(text);
}

function buildAccountMovements(contaId, payables, receivables, bankEntries, transfers) {
  const movs = [];
  bankEntries.filter((b) => !b.deletedAt && b.contaId === contaId).forEach((b) => {
    movs.push({ key: `bank-${b.id}`, source: "bank", id: b.id, data: b.data, tipo: b.tipo, valor: Number(b.valor || 0), descricao: `${b.categoria} — ${b.descricao || ""}`, conciliado: !!b.conciliado });
  });
  payables.filter((p) => !p.deletedAt && p.status === "Pago" && p.contaPgtoId === contaId).forEach((p) => {
    movs.push({ key: `pay-${p.id}`, source: "payable", id: p.id, data: p.dataPgto, tipo: "Saída", valor: Number(p.valorPago || p.valor || 0), descricao: `Pagamento — ${p.fornecedor}${fmtAdjustments(p)}`, conciliado: !!p.conciliado });
  });
  receivables.filter((r) => !r.deletedAt && r.status === "Recebido" && r.contaRecebId === contaId).forEach((r) => {
    movs.push({ key: `rec-${r.id}`, source: "receivable", id: r.id, data: r.dataReceb, tipo: "Entrada", valor: Number(r.valorRecebido || r.valor || 0), descricao: `Recebimento — ${r.cliente}${fmtAdjustments(r)}`, conciliado: !!r.conciliado });
  });
  transfers.filter((t) => !t.deletedAt && t.contaOrigemId === contaId).forEach((t) => {
    movs.push({ key: `trfo-${t.id}`, source: "transfer", id: t.id, data: t.data, tipo: "Saída", valor: Number(t.valor || 0), descricao: `Transferência enviada — ${t.descricao || ""}`, conciliado: !!t.conciliado });
  });
  transfers.filter((t) => !t.deletedAt && t.contaDestinoId === contaId).forEach((t) => {
    movs.push({ key: `trfd-${t.id}`, source: "transfer", id: t.id, data: t.data, tipo: "Entrada", valor: Number(t.valor || 0), descricao: `Transferência recebida — ${t.descricao || ""}`, conciliado: !!t.conciliado });
  });
  return movs;
}

// Sugestão automática de categoria: compara a descrição do extrato com a de
// lançamentos bancários já categorizados (mesma empresa) e sugere a
// categoria do mais parecido, por sobreposição de palavras — sem chamada
// externa, sem regra manual pra cadastrar. Só sugere, nunca decide sozinho:
// o operador sempre confirma no modal antes de salvar.
const STOPWORDS_DESCRICAO = new Set([
  "de", "da", "do", "das", "dos", "para", "com", "sem", "ltda", "me", "eireli", "sa", "a", "o", "e", "em", "no", "na",
]);

function normalizeWords(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS_DESCRICAO.has(w));
}

function suggestCategoria(descricao, empresaId, bankEntries) {
  const words = new Set(normalizeWords(descricao));
  if (words.size === 0) return null;
  let best = null;
  let bestScore = 0;
  bankEntries
    .filter((b) => b.categoria && b.categoria !== "A classificar" && (!empresaId || b.empresaId === empresaId))
    .forEach((b) => {
      const bWords = new Set(normalizeWords(b.descricao));
      if (bWords.size === 0) return;
      let overlap = 0;
      words.forEach((w) => { if (bWords.has(w)) overlap += 1; });
      const score = overlap / Math.max(words.size, bWords.size);
      if (score > bestScore) {
        bestScore = score;
        best = b;
      }
    });
  // limiar empírico: exige pelo menos ~1/3 das palavras em comum pra sugerir
  // — abaixo disso o palpite vira ruído em vez de ajuda.
  if (best && bestScore >= 0.34) {
    return { categoria: best.categoria, exemplo: best.descricao };
  }
  return null;
}

// Banco brasileiro costuma embutir o nome de quem enviou/recebeu bem depois
// de um prefixo fixo ("Pix Enviado NOME", "Ted Recebido de NOME"...) — em
// vez de deixar o operador digitar de novo um nome que já está na tela,
// tenta extrair direto da descrição do extrato. "Pagamento de Título" ou
// "Pgto Fornecedores" (boleto) não carregam nome nenhum no extrato — nesses
// casos não tem o que adivinhar, mesmo, o operador digita na mão.
function guessContraparteFromDescricao(descricao) {
  const s = (descricao || "").trim();
  const patterns = [
    /^pix\s+enviado\s+(?:para\s+)?(.+)$/i,
    /^pix\s+recebido\s+(?:de\s+)?(.+)$/i,
    /^ted\s+enviad[ao]\s+(?:para\s+)?(.+)$/i,
    /^ted\s+recebid[ao]\s+(?:de\s+)?(.+)$/i,
    /^doc\s+enviad[ao]\s+(?:para\s+)?(.+)$/i,
    /^doc\s+recebid[ao]\s+(?:de\s+)?(.+)$/i,
    /^transfer[êe]ncia\s+enviada\s+(?:para\s+)?(.+)$/i,
    /^transfer[êe]ncia\s+recebida\s+(?:de\s+)?(.+)$/i,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (!m) continue;
    const nome = m[1].trim().replace(/\s+/g, " ");
    // Descarta se for só número/código (id de transação, CPF/CNPJ solto) —
    // isso não é nome de gente/empresa.
    if (nome && !/^[\d.\-/]+$/.test(nome)) return nome;
  }
  // Repasse de adquirente/maquininha ou plataforma de delivery: o extrato
  // não traz o consumidor final (essa informação não existe no repasse,
  // que já vem agregado) — o certo é registrar como contraparte a própria
  // adquirente/plataforma, não tentar adivinhar o cliente.
  for (const nome of ACQUIRER_PLATFORM_NAMES) {
    if (new RegExp(`\\b${nome}\\b`, "i").test(s)) return nome;
  }
  return "";
}

const ACQUIRER_PLATFORM_NAMES = [
  "Cielo", "Rede", "Stone", "GetNet", "PagSeguro", "PagBank", "SafraPay", "Ton", "Mercado Pago",
  "Vero", "Bin", "Global Payments", "Sipag",
  "iFood", "Rappi", "Uber Eats", "99Food", "Aiqfome",
];

function matchStatement(systemMovs, statementLines, toleranceDays = 3) {
  const usedSys = new Set();
  const usedStmt = new Set();
  const matches = [];
  statementLines.forEach((sl, si) => {
    let best = -1;
    let bestDiff = Infinity;
    systemMovs.forEach((sm, mi) => {
      if (usedSys.has(mi) || sm.conciliado) return;
      if (sm.tipo !== sl.tipo) return;
      if (Math.abs(sm.valor - sl.valor) > 0.01) return;
      const diff = Math.abs(daysBetween(sm.data, sl.data));
      if (diff <= toleranceDays && diff < bestDiff) {
        bestDiff = diff;
        best = mi;
      }
    });
    if (best >= 0) {
      usedSys.add(best);
      usedStmt.add(si);
      matches.push({ sys: systemMovs[best], stmt: sl });
    }
  });
  const alreadyOk = systemMovs.filter((sm) => sm.conciliado);
  const sysOnly = systemMovs.filter((_, mi) => !usedSys.has(mi) && !systemMovs[mi].conciliado);
  const stmtOnly = statementLines.filter((_, si) => !usedStmt.has(si));
  return { matches, sysOnly, stmtOnly, alreadyOk };
}

// Detecta se uma linha do extrato que sobrou ("só no extrato") é, na
// verdade, uma transferência pra outra conta já cadastrada da MESMA
// empresa — pra sugerir o preenchimento automático de uma Transferência em
// vez do operador lançá-la como um Lançamento Bancário avulso. Usa três
// indícios, do mais pro menos direto (para no primeiro que bater):
//   1. Número de conta/agência de outra conta cadastrada aparece no texto
//      da descrição do extrato (o parser de OFX/CSV só extrai texto livre,
//      não um campo estruturado de conta de destino).
//   2. Palavra-chave de transferência (TED/DOC/PIX) + banco ou nome da
//      outra conta aparecem na descrição.
//   3. Já existe, na outra conta, um lançamento não conciliado de mesmo
//      valor e tipo oposto em data próxima (ela já foi importada/lançada
//      antes, só falta ligar as duas pontas).
// Nunca decide por conta própria — só sugere; o operador confirma no modal
// antes de qualquer transferência ser criada.
function detectTransferSuggestion(line, contaId, accounts, payables, receivables, bankEntries, transfers) {
  const acc = accounts.find((a) => a.id === contaId);
  if (!acc) return null;
  const others = accounts.filter((a) => a.id !== contaId && a.empresaId === acc.empresaId);
  if (others.length === 0) return null;

  const descUpper = (line.descricao || "").toUpperCase();
  const digitsOnly = descUpper.replace(/\D/g, "");

  for (const other of others) {
    const contaDigits = (other.contaNum || "").replace(/\D/g, "");
    if (contaDigits && contaDigits.length >= 4 && digitsOnly.includes(contaDigits)) {
      return { otherAccountId: other.id, confianca: "alta", motivo: `O número da conta "${other.nome}" (${other.contaNum}) aparece na descrição do extrato.` };
    }
  }

  const hasKeyword = /\b(TED|DOC|PIX|TRANSFEREN)/i.test(line.descricao || "");
  if (hasKeyword) {
    for (const other of others) {
      const bancoUpper = (other.banco || "").toUpperCase();
      const nomeUpper = (other.nome || "").toUpperCase();
      if ((bancoUpper && descUpper.includes(bancoUpper)) || (nomeUpper && descUpper.includes(nomeUpper))) {
        return { otherAccountId: other.id, confianca: "média", motivo: `A descrição menciona transferência e cita o banco/nome de "${other.nome}".` };
      }
    }
  }

  const oppositeTipo = line.tipo === "Entrada" ? "Saída" : "Entrada";
  for (const other of others) {
    const otherMovs = buildAccountMovements(other.id, payables, receivables, bankEntries, transfers);
    const candidate = otherMovs.find(
      (m) => !m.conciliado && m.tipo === oppositeTipo && Math.abs(m.valor - line.valor) < 0.01 && Math.abs(daysBetween(m.data, line.data)) <= 3
    );
    if (candidate) {
      return { otherAccountId: other.id, confianca: "média", motivo: `Já existe um lançamento de ${fmtBRL(candidate.valor)} em "${other.nome}" com data próxima e tipo oposto, ainda não conciliado.` };
    }
  }

  return null;
}

function ReconciliationView({ accounts, payables, receivables, bankEntries, transfers, categories, despesaCategorias, receitaCategorias, contacts, onSaveContacts, onSavePayables, onSaveReceivables, onSaveBankEntries, onSaveTransfers }) {
  const [contaId, setContaId] = useState(accounts[0]?.id || "");
  const [draftModal, setDraftModal] = useState(null); // { line, idx, suggestion }
  const [transferDraft, setTransferDraft] = useState(null); // { line, idx, suggestion }
  useEffect(() => {
    if (!accounts.find((a) => a.id === contaId)) setContaId(accounts[0]?.id || "");
  }, [accounts]); // eslint-disable-line react-hooks/exhaustive-deps

  const [fileName, setFileName] = useState("");
  const [statementLines, setStatementLines] = useState(null);
  const [parseError, setParseError] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [lancarModal, setLancarModal] = useState(null); // { tipo: "payable"|"receivable", line, idx }

  // CSV/OFX é lido no próprio navegador, sem custo — mas boleto de banco,
  // fatura de cartão e relatório de maquininha às vezes só saem em PDF ou
  // foto. Nesses casos reaproveita a mesma IA que já lê boleto/comprovante
  // (extract-document, contexto "statement"), sem contratar Open Finance.
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError("");
    setFileName(file.name);
    const isPdfOrImage = /\.(pdf|jpe?g|png|webp)$/i.test(file.name) || /^(application\/pdf|image\/)/.test(file.type || "");
    if (isPdfOrImage) {
      setStatementLines(null);
      setExtracting(true);
      (async () => {
        try {
          const fileBase64 = await fileToBase64(file);
          const mediaType = file.type || (/\.pdf$/i.test(file.name) ? "application/pdf" : "image/jpeg");
          const ex = await callExtractDocument(fileBase64, mediaType, "statement");
          const lines = (Array.isArray(ex.linhas) ? ex.linhas : [])
            .filter((l) => l.data && l.valor != null)
            .map((l) => ({ data: l.data, valor: Math.abs(Number(l.valor) || 0), tipo: l.tipo === "Entrada" ? "Entrada" : "Saída", descricao: l.descricao || "" }));
          if (lines.length === 0) {
            setParseError("A IA não encontrou nenhum movimento reconhecível nesse arquivo — confira se é um extrato/relatório com uma tabela de lançamentos.");
          } else if (ex._truncated) {
            setParseError(`Arquivo grande — a IA só conseguiu ler ${lines.length} lançamento(s) de uma vez (parou no meio do documento). Confira se falta alguma linha do fim do período; pra pegar o resto, importe separado (ex.: por quinzena) ou use CSV/OFX se o banco exportar.`);
          }
          setStatementLines(lines);
        } catch (err) {
          setParseError(err?.message || "Erro ao ler o arquivo com IA.");
          setStatementLines(null);
        } finally {
          setExtracting(false);
        }
      })();
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const lines = parseStatementFile(file.name, String(reader.result));
        if (lines.length === 0) setParseError("Não consegui reconhecer nenhuma linha de movimento nesse arquivo.");
        setStatementLines(lines);
      } catch (err) {
        setParseError("Erro lendo o arquivo. Confira se é um CSV ou OFX exportado do internet banking.");
        setStatementLines(null);
      }
    };
    reader.readAsText(file);
  };

  const systemMovs = useMemo(
    () => buildAccountMovements(contaId, payables, receivables, bankEntries, transfers),
    [contaId, payables, receivables, bankEntries, transfers]
  );

  const result = useMemo(
    () => (statementLines ? matchStatement(systemMovs, statementLines) : null),
    [systemMovs, statementLines]
  );

  const markConciliado = (mov, value) => {
    if (mov.source === "bank") onSaveBankEntries(bankEntries.map((b) => (b.id === mov.id ? { ...b, conciliado: value } : b)));
    if (mov.source === "payable") onSavePayables(payables.map((p) => (p.id === mov.id ? { ...p, conciliado: value } : p)));
    if (mov.source === "receivable") onSaveReceivables(receivables.map((r) => (r.id === mov.id ? { ...r, conciliado: value } : r)));
    if (mov.source === "transfer") onSaveTransfers(transfers.map((t) => (t.id === mov.id ? { ...t, conciliado: value } : t)));
  };

  const confirmAllMatches = () => {
    if (!result) return;
    const idsBySource = { bank: new Set(), payable: new Set(), receivable: new Set(), transfer: new Set() };
    result.matches.forEach(({ sys }) => idsBySource[sys.source].add(sys.id));
    if (idsBySource.bank.size) onSaveBankEntries(bankEntries.map((b) => (idsBySource.bank.has(b.id) ? { ...b, conciliado: true } : b)));
    if (idsBySource.payable.size) onSavePayables(payables.map((p) => (idsBySource.payable.has(p.id) ? { ...p, conciliado: true } : p)));
    if (idsBySource.receivable.size) onSaveReceivables(receivables.map((r) => (idsBySource.receivable.has(r.id) ? { ...r, conciliado: true } : r)));
    if (idsBySource.transfer.size) onSaveTransfers(transfers.map((t) => (idsBySource.transfer.has(t.id) ? { ...t, conciliado: true } : t)));
    const matchedStmts = new Set(result.matches.map((m) => m.stmt));
    setStatementLines((prev) => prev.filter((l) => !matchedStmts.has(l)));
  };

  const confirmOneMatch = (sys, stmt) => {
    markConciliado(sys, true);
    setStatementLines((prev) => prev.filter((l) => l !== stmt));
  };

  const openDraftModal = (line, idx) => {
    const acc = accounts.find((a) => a.id === contaId);
    const suggestion = suggestCategoria(line.descricao, acc?.empresaId, bankEntries);
    setDraftModal({ line, idx, suggestion });
  };

  const submitDraft = (form) => {
    const acc = accounts.find((a) => a.id === contaId);
    const novo = { ...form, id: uid(), empresaId: acc?.empresaId, conciliado: true };
    onSaveBankEntries([...bankEntries, novo]);
    setStatementLines((prev) => prev.filter((_, i) => i !== draftModal.idx));
    setDraftModal(null);
  };

  const openTransferDraft = (line, idx, suggestion) => setTransferDraft({ line, idx, suggestion });

  const submitTransferDraft = (form) => {
    const acc = accounts.find((a) => a.id === contaId);
    const novo = { ...form, id: uid(), empresaId: acc?.empresaId, conciliado: true };
    onSaveTransfers([...transfers, novo]);
    setStatementLines((prev) => prev.filter((_, i) => i !== transferDraft.idx));
    setTransferDraft(null);
  };

  // "Só no extrato" às vezes não é um lançamento avulso — é uma conta a
  // pagar/receber que nunca chegou a ser cadastrada (o boleto foi pago
  // fora do sistema, por exemplo). Em vez de forçar tudo pra Lançamento
  // Bancário, oferece lançar direto como Pago/Recebido + já conciliado —
  // já tentando adivinhar o fornecedor/cliente a partir da descrição do
  // próprio extrato, pra não digitar de novo um nome que já está na tela.
  const openLancarModal = (tipo, line, idx) => {
    setLancarModal({ tipo, line, idx, contraparteSugerida: guessContraparteFromDescricao(line.descricao) });
  };

  const submitLancar = (form) => {
    const acc = accounts.find((a) => a.id === contaId);
    const empresaId = acc?.empresaId;
    const nomeContraparte = form.fornecedor || form.cliente;
    let contactId;
    if (nomeContraparte && empresaId) {
      const { contacts: nextContacts, contact } = resolveContact(contacts, { nome: nomeContraparte, empresaId });
      onSaveContacts(nextContacts);
      contactId = contact?.id;
    }
    if (lancarModal.tipo === "payable") {
      const novo = { ...form, id: uid(), empresaId, contaPgtoId: contaId, conciliado: true, ...(contactId ? { contactId } : {}) };
      onSavePayables([...payables, novo]);
    } else {
      const novo = { ...form, id: uid(), empresaId, contaRecebId: contaId, conciliado: true, ...(contactId ? { contactId } : {}) };
      onSaveReceivables([...receivables, novo]);
    }
    setStatementLines((prev) => prev.filter((_, i) => i !== lancarModal.idx));
    setLancarModal(null);
  };

  if (accounts.length === 0) {
    return <EmptyState icon={Landmark} title="Nenhuma conta cadastrada" subtitle="Cadastre uma conta para conciliar o extrato bancário." />;
  }

  return (
    <div className="space-y-4">
      <Header title="Conciliação Bancária" subtitle="Importe o extrato do banco (CSV, OFX, PDF ou foto) e cruze automaticamente com os lançamentos do sistema." />

      <Card className="p-4 space-y-3">
        <div className="flex items-end gap-3 flex-wrap">
          <Field label="Conta">
            <Select value={contaId} onChange={(e) => { setContaId(e.target.value); setStatementLines(null); }}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </Select>
          </Field>
          <Field label="Extrato do banco (.csv, .ofx, .pdf ou foto)">
            <label
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-40"
              style={{ background: COLORS.primary, color: "#fff" }}
            >
              <Upload size={15} /> {extracting ? "Lendo com IA…" : (fileName || "Escolher arquivo")}
              <input type="file" accept=".csv,.ofx,.txt,.pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleFile} disabled={extracting} />
            </label>
          </Field>
          {result && (
            <Button variant="ghost" onClick={() => { setStatementLines(null); setFileName(""); }}>
              <X size={15} /> Limpar
            </Button>
          )}
        </div>
        {parseError && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
            style={
              statementLines && statementLines.length > 0
                ? { background: COLORS.amberSoft, color: COLORS.amber }
                : { background: COLORS.redSoft, color: COLORS.red }
            }
          >
            <AlertTriangle size={15} /> {parseError}
          </div>
        )}
        <div className="flex items-start gap-2 text-xs" style={{ color: COLORS.inkSoft }}>
          <HelpCircle size={14} className="shrink-0 mt-0.5" />
          <span>Aceita OFX exportado do internet banking, CSV com colunas de data e valor (com ou sem cabeçalho), ou PDF/foto — nesse caso uma IA lê a tabela de movimentos pra você. Serve pra extrato de banco, fatura de cartão de crédito, relatório de repasse de maquininha ou de delivery, desde que a compra/venda esteja lançada com essa mesma conta. O sistema casa cada linha do extrato com um lançamento já cadastrado pelo mesmo valor, em até 3 dias de diferença.</span>
        </div>
      </Card>

      {result && (
        <>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            <Card className="p-3 text-center">
              <p className="text-xs" style={{ color: COLORS.inkSoft }}>Bateram automaticamente</p>
              <p className="text-xl font-semibold" style={{ color: COLORS.green }}>{result.matches.length}</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-xs" style={{ color: COLORS.inkSoft }}>Só no sistema</p>
              <p className="text-xl font-semibold" style={{ color: COLORS.amber }}>{result.sysOnly.length}</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-xs" style={{ color: COLORS.inkSoft }}>Só no extrato</p>
              <p className="text-xl font-semibold" style={{ color: COLORS.red }}>{result.stmtOnly.length}</p>
            </Card>
          </div>

          <ReportCard title="Bateram automaticamente" subtitle="Mesmo valor e data próxima (até 3 dias) entre extrato e sistema.">
            {result.matches.length === 0 ? (
              <p className="text-sm" style={{ color: COLORS.inkSoft }}>Nenhum lançamento bateu automaticamente.</p>
            ) : (
              <>
                <div className="flex justify-end mb-2">
                  <Button onClick={confirmAllMatches}><Check size={14} /> Confirmar todos como conciliados</Button>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
                      <th className="text-left font-medium px-2 py-1.5">Data (sistema / extrato)</th>
                      <th className="text-left font-medium px-2 py-1.5">Descrição no sistema</th>
                      <th className="text-right font-medium px-2 py-1.5">Valor</th>
                      <th className="text-right font-medium px-2 py-1.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.matches.map(({ sys, stmt }) => (
                      <tr key={sys.key} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                        <td className="px-2 py-1.5" style={{ color: COLORS.ink }}>{fmtDate(sys.data)} / {fmtDate(stmt.data)}</td>
                        <td className="px-2 py-1.5" style={{ color: COLORS.inkSoft }}>{sys.descricao}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: sys.tipo === "Entrada" ? COLORS.green : COLORS.red }}>
                          {sys.tipo === "Entrada" ? "+" : "−"}{fmtBRL(sys.valor)}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <button onClick={() => confirmOneMatch(sys, stmt)} className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full" style={{ background: COLORS.greenSoft, color: COLORS.green }}>
                            <Check size={12} /> Conciliar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </ReportCard>

          <ReportCard title="Só no sistema" subtitle="Lançados no sistema, mas não encontrados no extrato importado — podem ainda não ter sido compensados pelo banco, ou serem duplicados.">
            {result.sysOnly.length === 0 ? (
              <p className="text-sm" style={{ color: COLORS.inkSoft }}>Nada sobrando.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
                    <th className="text-left font-medium px-2 py-1.5">Data</th>
                    <th className="text-left font-medium px-2 py-1.5">Descrição</th>
                    <th className="text-right font-medium px-2 py-1.5">Valor</th>
                    <th className="text-right font-medium px-2 py-1.5">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {result.sysOnly.map((sm) => (
                    <tr key={sm.key} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                      <td className="px-2 py-1.5" style={{ color: COLORS.ink }}>{fmtDate(sm.data)}</td>
                      <td className="px-2 py-1.5" style={{ color: COLORS.inkSoft }}>{sm.descricao}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: sm.tipo === "Entrada" ? COLORS.green : COLORS.red }}>
                        {sm.tipo === "Entrada" ? "+" : "−"}{fmtBRL(sm.valor)}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <button onClick={() => markConciliado(sm, true)} className="text-xs font-medium px-2 py-1 rounded-full" style={{ background: "#EFEEE8", color: COLORS.ink }}>
                          Marcar conciliado mesmo assim
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </ReportCard>

          <ReportCard title="Só no extrato" subtitle="Vieram do banco mas não existem no sistema — provavelmente falta lançar.">
            {result.stmtOnly.length === 0 ? (
              <p className="text-sm" style={{ color: COLORS.inkSoft }}>Nada sobrando.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
                    <th className="text-left font-medium px-2 py-1.5">Data</th>
                    <th className="text-left font-medium px-2 py-1.5">Descrição</th>
                    <th className="text-right font-medium px-2 py-1.5">Valor</th>
                    <th className="text-right font-medium px-2 py-1.5">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {statementLines.map((line, idx) => {
                    if (!result.stmtOnly.includes(line)) return null;
                    const acc = accounts.find((a) => a.id === contaId);
                    const suggestion = suggestCategoria(line.descricao, acc?.empresaId, bankEntries);
                    const transferSuggestion = detectTransferSuggestion(line, contaId, accounts, payables, receivables, bankEntries, transfers);
                    const otherAcc = transferSuggestion && accounts.find((a) => a.id === transferSuggestion.otherAccountId);
                    return (
                      <tr key={idx} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                        <td className="px-2 py-1.5" style={{ color: COLORS.ink }}>{fmtDate(line.data)}</td>
                        <td className="px-2 py-1.5" style={{ color: COLORS.inkSoft }}>
                          {line.descricao}
                          {suggestion && (
                            <span className="block text-[11px] mt-0.5" style={{ color: COLORS.green }}>
                              Sugestão: {suggestion.categoria}
                            </span>
                          )}
                          {transferSuggestion && otherAcc && (
                            <span className="block text-[11px] mt-0.5" style={{ color: COLORS.gold }}>
                              Parece transferência com "{otherAcc.nome}" ({transferSuggestion.motivo})
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: line.tipo === "Entrada" ? COLORS.green : COLORS.red }}>
                          {line.tipo === "Entrada" ? "+" : "−"}{fmtBRL(line.valor)}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <div className="flex justify-end gap-1.5 flex-wrap">
                            {transferSuggestion && otherAcc && (
                              <button
                                onClick={() => openTransferDraft(line, idx, transferSuggestion)}
                                className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full"
                                style={{ background: COLORS.goldSoft, color: COLORS.gold }}
                              >
                                <ArrowLeftRight size={12} /> Confirmar transferência
                              </button>
                            )}
                            <button
                              onClick={() => openLancarModal(line.tipo === "Saída" ? "payable" : "receivable", line, idx)}
                              className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full"
                              style={line.tipo === "Saída" ? { background: COLORS.redSoft, color: COLORS.red } : { background: COLORS.greenSoft, color: COLORS.green }}
                              title={line.tipo === "Saída" ? "Registrar como uma conta a pagar que já foi paga (esqueceu de lançar)" : "Registrar como uma conta a receber que já foi recebida (esqueceu de lançar)"}
                            >
                              {line.tipo === "Saída" ? <ArrowUpCircle size={12} /> : <ArrowDownCircle size={12} />}
                              Lançar como {line.tipo === "Saída" ? "Conta a Pagar" : "Conta a Receber"}
                            </button>
                            <button onClick={() => openDraftModal(line, idx)} className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full" style={{ background: COLORS.amberSoft, color: COLORS.amber }}>
                              <Plus size={12} /> Lançar avulso
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </ReportCard>
        </>
      )}

      {draftModal && (
        <BankEntryModal
          initial={{
            data: draftModal.line.data,
            contaId,
            tipo: draftModal.line.tipo,
            categoria: draftModal.suggestion?.categoria || categories[0] || "A classificar",
            descricao: draftModal.line.descricao || "Importado do extrato",
            valor: draftModal.line.valor,
          }}
          accounts={accounts}
          categories={categories}
          suggestion={draftModal.suggestion}
          onClose={() => setDraftModal(null)}
          onSubmit={submitDraft}
        />
      )}
      {transferDraft && (() => {
        const acc = accounts.find((a) => a.id === contaId);
        const sameEmpresaAccounts = accounts.filter((a) => a.empresaId === acc?.empresaId);
        const isSaida = transferDraft.line.tipo === "Saída";
        return (
          <TransferModal
            initial={{
              data: transferDraft.line.data,
              contaOrigemId: isSaida ? contaId : transferDraft.suggestion.otherAccountId,
              contaDestinoId: isSaida ? transferDraft.suggestion.otherAccountId : contaId,
              valor: transferDraft.line.valor,
              descricao: transferDraft.line.descricao || "Transferência identificada no extrato",
              empresaId: acc?.empresaId,
            }}
            accounts={sameEmpresaAccounts}
            onClose={() => setTransferDraft(null)}
            onSubmit={submitTransferDraft}
          />
        );
      })()}
      {lancarModal && (
        <LancarNoSistemaModal
          tipo={lancarModal.tipo}
          line={lancarModal.line}
          initialContraparte={lancarModal.contraparteSugerida}
          categorias={lancarModal.tipo === "payable" ? despesaCategorias : receitaCategorias}
          onClose={() => setLancarModal(null)}
          onSubmit={submitLancar}
        />
      )}
    </div>
  );
}

// "Só no extrato" pode ser algo que nunca virou conta a pagar/receber no
// sistema — em vez de forçar tudo pra um Lançamento Bancário avulso (que
// perde o rastro de fornecedor/cliente), essa opção já cria o lançamento
// PAGO/RECEBIDO e conciliado, do jeito que ele já aconteceu de verdade.
function LancarNoSistemaModal({ tipo, line, initialContraparte, categorias, onClose, onSubmit }) {
  const isPayable = tipo === "payable";
  const [contraparte, setContraparte] = useState(initialContraparte || "");
  const [categoria, setCategoria] = useState(categorias[0] || "");
  const [descricao, setDescricao] = useState(line.descricao || "");
  const [valor, setValor] = useState(String(line.valor ?? ""));
  const [data, setData] = useState(line.data || todayISO());
  // Contraparte é opcional de propósito: venda de balcão paga na maquininha
  // não tem consumidor identificável no extrato — forçar um nome ali só
  // geraria digitação sem sentido. "Consumidor Final" é o padrão da nota
  // fiscal de venda a varejo sem identificação do comprador.
  const valid = Number(valor) > 0;

  const submit = () => {
    const valorNum = Number(valor) || 0;
    onSubmit({
      [isPayable ? "fornecedor" : "cliente"]: contraparte.trim() || "Consumidor Final",
      categoria,
      descricao,
      valor: valorNum,
      dataLanc: data,
      vencimento: data,
      status: isPayable ? "Pago" : "Recebido",
      ...(isPayable
        ? { dataPgto: data, valorPago: valorNum }
        : { dataReceb: data, valorRecebido: valorNum }),
    });
  };

  return (
    <Modal title={isPayable ? "Lançar como Conta a Pagar (já paga)" : "Lançar como Conta a Receber (já recebida)"} onClose={onClose}>
      <div className="grid gap-3">
        <Field label={isPayable ? "Fornecedor" : "Cliente"}>
          <TextInput value={contraparte} onChange={(e) => setContraparte(e.target.value)} autoFocus />
        </Field>
        {initialContraparte && contraparte === initialContraparte && (
          <p className="text-xs -mt-2" style={{ color: COLORS.green }}>
            Sugerido a partir da descrição do extrato — confira antes de lançar.
          </p>
        )}
        <Field label="Categoria">
          <Select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {categorias.map((c) => <option key={c.codigo} value={c.nome}>{c.nome}</option>)}
          </Select>
        </Field>
        <Field label="Descrição"><TextInput value={descricao} onChange={(e) => setDescricao(e.target.value)} /></Field>
        <Field label="Valor (R$)"><TextInput type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} /></Field>
        <Field label="Data"><TextInput type="date" value={data} max={todayISO()} onChange={(e) => setData(e.target.value)} /></Field>
        <p className="text-xs" style={{ color: COLORS.inkSoft }}>
          Já entra como {isPayable ? "paga" : "recebida"} e conciliada nesta conta — é pra registrar algo que já aconteceu e só não tinha sido lançado ainda.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => valid && submit()} disabled={!valid}>Lançar</Button>
        </div>
      </div>
    </Modal>
  );
}

// Deduções de repasse (comissão, antecipação, taxa de pagamento online,
// publicidade...) vêm com nome livre — cada adquirente/plataforma chama do
// jeito que quer. Em vez de forçar o operador a escolher a categoria de
// despesa pra cada tipo toda vez, tenta bater por palavra-chave com o que
// já existe no Plano de Contas da empresa.
function guessDeducaoCategoria(tipoDeducao, despesaCategorias) {
  const t = (tipoDeducao || "").toLowerCase();
  const find = (re) => despesaCategorias.find((c) => re.test(c.nome.toLowerCase()));
  let match = null;
  if (/comiss/.test(t)) match = find(/comiss/);
  else if (/antecip/.test(t)) match = find(/antecip/) || find(/financeir/);
  else if (/public|an[uú]ncio|ads|turbo|patroc/.test(t)) match = find(/marketing|public|comercial/);
  else if (/cart[aã]o|pagamento online|maquinin/.test(t)) match = find(/tecnologia|servi[cç]o/);
  return (match || despesaCategorias[0])?.nome || "";
}

/* ---------------------------------------------------------------------- */
/*  Repasses de Terceiros — adquirente de cartão / plataforma de delivery */
/* ---------------------------------------------------------------------- */
function SettlementPartnerModal({ initial, empresaId, onClose, onSubmit }) {
  const [partnerId] = useState(() => initial?.id || uid());
  const [nome, setNome] = useState(initial?.nome || "");
  const [tipo, setTipo] = useState(initial?.tipo || "adquirente");
  const [regras, setRegras] = useState(initial?.regras?.length ? initial.regras : [{ tipo: "", percentual: "" }]);
  const [contratoArquivoPath, setContratoArquivoPath] = useState(initial?.contratoArquivoPath || null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [extractNote, setExtractNote] = useState("");

  const setRegra = (i, field, value) => setRegras((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  const addRegra = () => setRegras((prev) => [...prev, { tipo: "", percentual: "" }]);
  const removeRegra = (i) => setRegras((prev) => prev.filter((_, idx) => idx !== i));

  const valid = nome.trim().length > 0;

  // Lê o contrato com IA (taxas percentuais) só pra PRÉ-preencher — o
  // operador sempre confere/ajusta as linhas antes de salvar, igual ao
  // resto do sistema. O arquivo em si também fica guardado (mesmo bucket
  // dos outros "Importar documento"), pra auditoria futura.
  const handleContrato = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setExtractError("");
    setExtractNote("");
    setExtracting(true);
    try {
      const fileBase64 = await fileToBase64(file);
      const mediaType = file.type || "application/pdf";
      const ex = await callExtractDocument(fileBase64, mediaType, "settlementContract");
      const lidas = (Array.isArray(ex.regras) ? ex.regras : [])
        .filter((r) => r?.tipo && r?.percentual != null)
        .map((r) => ({ tipo: String(r.tipo), percentual: String(r.percentual) }));
      const path = await uploadDocumentoLancamento(empresaId, "settlementPartners", partnerId, { url: `data:${mediaType};base64,${fileBase64}` });
      if (path) setContratoArquivoPath(path);
      if (lidas.length === 0) {
        setExtractError("Não encontrei nenhuma taxa percentual reconhecível nesse contrato — confira/preencha manualmente abaixo.");
      } else {
        setRegras((prev) => [...prev.filter((r) => r.tipo.trim() || r.percentual !== ""), ...lidas]);
        setExtractNote(`${lidas.length} taxa(s) lida(s) do contrato — confira os valores antes de salvar.`);
      }
    } catch (err) {
      setExtractError(err?.message || "Erro ao ler o contrato com IA.");
    } finally {
      setExtracting(false);
    }
  };

  const submit = () => {
    onSubmit({
      id: partnerId,
      nome: nome.trim(),
      tipo,
      regras: regras.filter((r) => r.tipo.trim() && r.percentual !== "").map((r) => ({ tipo: r.tipo.trim(), percentual: Number(r.percentual) || 0 })),
      contratoArquivoPath,
    });
  };

  return (
    <Modal title={initial ? "Editar parceiro de repasse" : "Novo parceiro de repasse"} onClose={onClose}>
      <div className="grid gap-3">
        <Field label="Nome (como aparece no relatório de repasse)">
          <TextInput value={nome} onChange={(e) => setNome(e.target.value)} autoFocus placeholder="Ex.: Cielo, iFood, Rappi..." />
        </Field>
        <Field label="Tipo">
          <Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="adquirente">Adquirente (maquininha de cartão)</option>
            <option value="delivery">Plataforma de delivery</option>
            <option value="convenio">Convênio / plano de saúde</option>
            <option value="outro">Outro</option>
          </Select>
        </Field>
        <div>
          <p className="text-sm font-medium mb-1.5" style={{ color: COLORS.ink }}>Taxas contratadas</p>
          <p className="text-xs mb-2" style={{ color: COLORS.inkSoft }}>
            Cadastre cada taxa que o contrato prevê (comissão, antecipação, taxa de pagamento online, publicidade...) — é contra isso que o relatório de repasse importado será auditado.
          </p>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <label
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-40"
              style={{ background: "transparent", color: COLORS.primary, border: `1px solid ${COLORS.border}` }}
            >
              <Upload size={13} /> {extracting ? "Lendo contrato…" : "Ler taxas do contrato (IA)"}
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleContrato} disabled={extracting} />
            </label>
            {contratoArquivoPath && (
              <button type="button" onClick={() => abrirDocumentoLancamento(contratoArquivoPath)} className="text-xs underline" style={{ color: COLORS.inkSoft }}>
                Ver contrato anexado
              </button>
            )}
          </div>
          {extractNote && <p className="text-xs mb-2" style={{ color: COLORS.green }}>{extractNote}</p>}
          {extractError && <p className="text-xs mb-2" style={{ color: COLORS.red }}>{extractError}</p>}
          <div className="grid gap-2">
            {regras.map((r, i) => (
              <div key={i} className="flex gap-2 items-center">
                <TextInput placeholder="Tipo (ex.: Comissão)" value={r.tipo} onChange={(e) => setRegra(i, "tipo", e.target.value)} className="flex-1" />
                <TextInput type="number" step="0.01" placeholder="%" value={r.percentual} onChange={(e) => setRegra(i, "percentual", e.target.value)} style={{ width: 90 }} />
                <button onClick={() => removeRegra(i)} title="Remover taxa" style={{ color: COLORS.red }}><X size={16} /></button>
              </div>
            ))}
          </div>
          <Button variant="ghost" onClick={addRegra} className="mt-2"><Plus size={14} /> Adicionar taxa</Button>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => valid && submit()} disabled={!valid}>Salvar</Button>
        </div>
      </div>
    </Modal>
  );
}

function SettlementPartnersView({
  partners, accounts, empresaId, despesaCategorias, receitaCategorias, contacts, payables, receivables,
  onSavePartners, onSaveContacts, onSavePayables, onSaveReceivables,
}) {
  const partnersF = useMemo(() => partners.filter((p) => p.empresaId === empresaId), [partners, empresaId]);
  const [modal, setModal] = useState(null); // null | {} | partner
  const [importPartnerId, setImportPartnerId] = useState("");
  const [importContaId, setImportContaId] = useState(accounts[0]?.id || "");
  const [fileName, setFileName] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [parseError, setParseError] = useState("");
  const [linhas, setLinhas] = useState(null);
  const [categoriaPorTipo, setCategoriaPorTipo] = useState({});
  const [receitaCategoria, setReceitaCategoria] = useState(receitaCategorias[0]?.nome || "");
  const [lancadoOk, setLancadoOk] = useState("");

  const partnerSelecionado = partnersF.find((p) => p.id === importPartnerId) || null;

  const savePartner = (form) => {
    if (modal?.id) onSavePartners(partners.map((p) => (p.id === modal.id ? { ...p, ...form } : p)));
    else onSavePartners([...partners, { empresaId, ...form }]);
    setModal(null);
  };
  const deletePartner = (p) => {
    if (!confirmDelete(`Excluir o parceiro "${p.nome}"? Isso não afeta lançamentos já feitos com o repasse dele.`)) return;
    onSavePartners(partners.filter((x) => x.id !== p.id));
    if (importPartnerId === p.id) setImportPartnerId("");
  };

  // Relatório de repasse costuma vir em CSV/planilha (exportação do painel
  // da adquirente/plataforma) — o mesmo caminho que extrato/comprovante já
  // usa (extract-document com IA), agora também aceitando texto puro além
  // de PDF/foto.
  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError("");
    setLancadoOk("");
    setFileName(file.name);
    setLinhas(null);
    setExtracting(true);
    (async () => {
      try {
        const fileBase64 = await fileToBase64(file);
        const isText = /\.(csv|txt)$/i.test(file.name) || /^text\//.test(file.type || "");
        const mediaType = isText ? (file.type || "text/csv") : (file.type || (/\.pdf$/i.test(file.name) ? "application/pdf" : "image/jpeg"));
        const ex = await callExtractDocument(fileBase64, mediaType, "settlementReport");
        const parsed = (Array.isArray(ex.linhas) ? ex.linhas : [])
          .filter((l) => l.bruto != null)
          .map((l) => {
            const deducoes = (Array.isArray(l.deducoes) ? l.deducoes : []).map((d) => ({ tipo: d.tipo || "Outra dedução", valor: Number(d.valor) || 0 }));
            const bruto = Number(l.bruto) || 0;
            return {
              data: l.data || null,
              bruto,
              liquido: l.liquido != null ? Number(l.liquido) : bruto - deducoes.reduce((s, d) => s + d.valor, 0),
              dataRepasse: l.dataRepasse || l.data || null,
              deducoes,
            };
          });
        if (parsed.length === 0) {
          setParseError("A IA não encontrou nenhuma venda/lote reconhecível nesse relatório — confira se é um relatório de repasse com valores por venda ou por lote.");
        } else if (ex._truncated) {
          setParseError(`Arquivo grande — a IA só conseguiu ler ${parsed.length} linha(s) de uma vez (parou no meio do documento). Importe em partes menores se faltar período.`);
        }
        setLinhas(parsed);
      } catch (err) {
        setParseError(err?.message || "Erro ao ler o relatório com IA.");
        setLinhas(null);
      } finally {
        setExtracting(false);
      }
    })();
  };

  const tiposDeducao = useMemo(() => {
    if (!linhas) return [];
    const set = new Set();
    linhas.forEach((l) => l.deducoes.forEach((d) => set.add(d.tipo)));
    return [...set];
  }, [linhas]);

  useEffect(() => {
    if (tiposDeducao.length === 0) return;
    setCategoriaPorTipo((prev) => {
      const next = { ...prev };
      let changed = false;
      tiposDeducao.forEach((t) => {
        if (!next[t]) { next[t] = guessDeducaoCategoria(t, despesaCategorias); changed = true; }
      });
      return changed ? next : prev;
    });
  }, [tiposDeducao]); // eslint-disable-line react-hooks/exhaustive-deps

  // Agrupa por data de repasse (não pela data da venda) — é nessa data que
  // o dinheiro efetivamente cai na conta, então é assim que o lançamento
  // em lote (1 recebimento bruto + N pagamentos de taxa) deve ser feito.
  const grupos = useMemo(() => {
    if (!linhas) return [];
    const map = new Map();
    linhas.forEach((l) => {
      const key = l.dataRepasse || l.data || "sem-data";
      if (!map.has(key)) map.set(key, { dataRepasse: key, bruto: 0, liquido: 0, deducoesPorTipo: {}, n: 0 });
      const g = map.get(key);
      g.bruto += l.bruto;
      g.liquido += l.liquido;
      g.n += 1;
      l.deducoes.forEach((d) => { g.deducoesPorTipo[d.tipo] = (g.deducoesPorTipo[d.tipo] || 0) + d.valor; });
    });
    return [...map.values()].sort((a, b) => (a.dataRepasse || "").localeCompare(b.dataRepasse || ""));
  }, [linhas]);

  // Compara a taxa REAL cobrada (deduzida do bruto do relatório) com a taxa
  // CONTRATADA cadastrada no parceiro — divergência acima de 0,3 ponto
  // percentual é sinalizada, porque isso é dinheiro sendo cobrado a mais
  // (ou a menos) do que o contrato prevê.
  const auditoria = useMemo(() => {
    if (!linhas || !partnerSelecionado) return [];
    const totalBruto = linhas.reduce((s, l) => s + l.bruto, 0);
    if (totalBruto === 0) return [];
    return tiposDeducao.map((tipo) => {
      const totalDeducao = linhas.reduce((s, l) => s + (l.deducoes.find((d) => d.tipo === tipo)?.valor || 0), 0);
      const percReal = (totalDeducao / totalBruto) * 100;
      const regra = partnerSelecionado.regras.find((r) => r.tipo.toLowerCase() === tipo.toLowerCase());
      const percContratado = regra ? regra.percentual : null;
      const divergente = percContratado != null && Math.abs(percReal - percContratado) > 0.3;
      return { tipo, percReal, percContratado, divergente, totalDeducao };
    });
  }, [linhas, tiposDeducao, partnerSelecionado]);

  const lancarTudo = () => {
    if (!linhas || !partnerSelecionado || !importContaId) return;
    const { contacts: nextContacts, contact } = resolveContact(contacts, { nome: partnerSelecionado.nome, empresaId });
    const novosReceivables = [];
    const novosPayables = [];
    grupos.forEach((g) => {
      novosReceivables.push({
        id: uid(),
        empresaId,
        cliente: partnerSelecionado.nome,
        categoria: receitaCategoria,
        descricao: `Repasse ${partnerSelecionado.nome} — ${fmtDate(g.dataRepasse)}`,
        valor: g.bruto,
        dataLanc: g.dataRepasse,
        vencimento: g.dataRepasse,
        status: "Recebido",
        dataReceb: g.dataRepasse,
        valorRecebido: g.bruto,
        contaRecebId: importContaId,
        conciliado: true,
        contactId: contact?.id,
      });
      Object.entries(g.deducoesPorTipo).forEach(([tipo, valor]) => {
        if (valor <= 0) return;
        novosPayables.push({
          id: uid(),
          empresaId,
          fornecedor: partnerSelecionado.nome,
          categoria: categoriaPorTipo[tipo] || despesaCategorias[0]?.nome || "",
          descricao: `${tipo} — ${partnerSelecionado.nome} — ${fmtDate(g.dataRepasse)}`,
          valor,
          dataLanc: g.dataRepasse,
          vencimento: g.dataRepasse,
          status: "Pago",
          dataPgto: g.dataRepasse,
          valorPago: valor,
          contaPgtoId: importContaId,
          conciliado: true,
          contactId: contact?.id,
        });
      });
    });
    if (nextContacts !== contacts) onSaveContacts(nextContacts);
    onSaveReceivables([...receivables, ...novosReceivables]);
    onSavePayables([...payables, ...novosPayables]);
    setLancadoOk(`${novosReceivables.length} repasse(s) lançado(s) como recebido + ${novosPayables.length} despesa(s) de taxa lançada(s) como paga, já conciliados.`);
    setLinhas(null);
    setFileName("");
  };

  return (
    <div className="space-y-4">
      <Header title="Repasses de Terceiros" subtitle="Conciliação de cartão e delivery: cadastre adquirentes (maquininha) e plataformas com a taxa contratada, e audite o repasse real deles — cruza o que foi vendido com o que a adquirente de fato pagou, descontando as taxas.">
        <Button onClick={() => setModal({})}><Plus size={15} /> Novo parceiro</Button>
      </Header>

      {partnersF.length === 0 ? (
        <EmptyState icon={Percent} title="Nenhum parceiro de repasse cadastrado" subtitle="Cadastre a adquirente de cartão ou a plataforma de delivery com a taxa contratada, pra poder auditar o relatório de repasse dela." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {partnersF.map((p) => (
            <Card key={p.id} className="p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-sm" style={{ color: COLORS.ink }}>{p.nome}</p>
                  <p className="text-xs capitalize" style={{ color: COLORS.inkSoft }}>{p.tipo}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button title="Editar" onClick={() => setModal(p)}><Pencil size={14} color={COLORS.inkSoft} /></button>
                  <button title="Excluir" onClick={() => deletePartner(p)}><Trash2 size={14} color={COLORS.red} /></button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {(p.regras || []).length === 0 ? (
                  <span className="text-xs" style={{ color: COLORS.inkSoft }}>Sem taxa contratada cadastrada.</span>
                ) : p.regras.map((r, i) => (
                  <span key={i} className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: "#EFEEE8", color: COLORS.ink }}>
                    {r.tipo}: {r.percentual}%
                  </span>
                ))}
              </div>
              {p.contratoArquivoPath && (
                <button type="button" onClick={() => abrirDocumentoLancamento(p.contratoArquivoPath)} className="text-xs underline mt-1.5" style={{ color: COLORS.inkSoft }}>
                  Ver contrato anexado
                </button>
              )}
            </Card>
          ))}
        </div>
      )}

      <Card className="p-4 space-y-3">
        <p className="text-sm font-medium" style={{ color: COLORS.ink }}>Importar relatório de repasse</p>
        <div className="flex items-end gap-3 flex-wrap">
          <Field label="Parceiro">
            <Select value={importPartnerId} onChange={(e) => setImportPartnerId(e.target.value)}>
              <option value="">Selecione...</option>
              {partnersF.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </Select>
          </Field>
          <Field label="Conta de recebimento">
            <Select value={importContaId} onChange={(e) => setImportContaId(e.target.value)}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </Select>
          </Field>
          <Field label="Relatório (.csv, .txt, .pdf ou foto)">
            <label
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-40"
              style={{ background: importPartnerId ? COLORS.primary : COLORS.border, color: importPartnerId ? "#fff" : COLORS.inkSoft }}
            >
              <Upload size={15} /> {extracting ? "Lendo com IA…" : (fileName || "Escolher arquivo")}
              <input type="file" accept=".csv,.txt,.pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleImportFile} disabled={extracting || !importPartnerId} />
            </label>
          </Field>
          {linhas && (
            <Button variant="ghost" onClick={() => { setLinhas(null); setFileName(""); }}><X size={15} /> Limpar</Button>
          )}
        </div>
        {!importPartnerId && <p className="text-xs" style={{ color: COLORS.inkSoft }}>Selecione o parceiro antes de escolher o arquivo.</p>}
        {parseError && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={linhas && linhas.length > 0 ? { background: COLORS.amberSoft, color: COLORS.amber } : { background: COLORS.redSoft, color: COLORS.red }}>
            <AlertTriangle size={15} /> {parseError}
          </div>
        )}
        {lancadoOk && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: COLORS.greenSoft, color: COLORS.green }}>
            <Check size={15} /> {lancadoOk}
          </div>
        )}
      </Card>

      {linhas && linhas.length > 0 && partnerSelecionado && (
        <>
          <ReportCard title="Auditoria das taxas" subtitle={`Taxa contratada com "${partnerSelecionado.nome}" vs. taxa real deduzida no relatório importado.`}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
                  <th className="text-left font-medium px-2 py-1.5">Tipo de dedução</th>
                  <th className="text-right font-medium px-2 py-1.5">Contratada</th>
                  <th className="text-right font-medium px-2 py-1.5">Real (relatório)</th>
                  <th className="text-right font-medium px-2 py-1.5">Total</th>
                  <th className="text-left font-medium px-2 py-1.5">Lançar como (despesa)</th>
                </tr>
              </thead>
              <tbody>
                {auditoria.map((a) => (
                  <tr key={a.tipo} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                    <td className="px-2 py-1.5" style={{ color: COLORS.ink }}>
                      {a.tipo}
                      {a.divergente && (
                        <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: COLORS.redSoft, color: COLORS.red }}>
                          <AlertTriangle size={10} /> Divergente
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: COLORS.inkSoft }}>{a.percContratado != null ? `${a.percContratado}%` : "—"}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: a.divergente ? COLORS.red : COLORS.ink }}>{a.percReal.toFixed(2)}%</td>
                    <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: COLORS.ink }}>{fmtBRL(a.totalDeducao)}</td>
                    <td className="px-2 py-1.5">
                      <Select value={categoriaPorTipo[a.tipo] || ""} onChange={(e) => setCategoriaPorTipo((prev) => ({ ...prev, [a.tipo]: e.target.value }))}>
                        {despesaCategorias.map((c) => <option key={c.codigo} value={c.nome}>{c.nome}</option>)}
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {auditoria.some((a) => a.divergente) && (
              <p className="text-xs mt-2 flex items-center gap-1.5" style={{ color: COLORS.red }}>
                <AlertTriangle size={13} /> Pelo menos uma taxa cobrada real ficou fora do contratado — confira com o parceiro antes de lançar.
              </p>
            )}
          </ReportCard>

          <ReportCard title="Resumo por data de repasse" subtitle="É nessa data que o valor efetivamente cai na conta — é assim que os lançamentos serão agrupados.">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
                  <th className="text-left font-medium px-2 py-1.5">Data de repasse</th>
                  <th className="text-right font-medium px-2 py-1.5">Vendas/lotes</th>
                  <th className="text-right font-medium px-2 py-1.5">Bruto</th>
                  <th className="text-right font-medium px-2 py-1.5">Líquido</th>
                </tr>
              </thead>
              <tbody>
                {grupos.map((g) => (
                  <tr key={g.dataRepasse} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                    <td className="px-2 py-1.5" style={{ color: COLORS.ink }}>{g.dataRepasse === "sem-data" ? "Sem data" : fmtDate(g.dataRepasse)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: COLORS.inkSoft }}>{g.n}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: COLORS.green }}>{fmtBRL(g.bruto)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: COLORS.ink }}>{fmtBRL(g.liquido)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ReportCard>

          <Card className="p-4 flex items-end gap-3 flex-wrap">
            <Field label="Categoria da receita (repasse bruto)">
              <Select value={receitaCategoria} onChange={(e) => setReceitaCategoria(e.target.value)}>
                {receitaCategorias.map((c) => <option key={c.codigo} value={c.nome}>{c.nome}</option>)}
              </Select>
            </Field>
            <Button onClick={lancarTudo} disabled={grupos.some((g) => g.dataRepasse === "sem-data")}>
              <CheckCheck size={15} /> Lançar {grupos.length} repasse(s)
            </Button>
            <p className="text-xs w-full" style={{ color: COLORS.inkSoft }}>
              Cria 1 Conta a Receber (valor bruto, já recebida) + 1 Conta a Pagar por taxa (já paga) para cada data de repasse — tudo já conciliado nesta conta.
            </p>
            {grupos.some((g) => g.dataRepasse === "sem-data") && (
              <p className="text-xs w-full flex items-center gap-1.5" style={{ color: COLORS.red }}>
                <AlertTriangle size={13} /> O relatório tem linha(s) sem nenhuma data reconhecida — corrija o arquivo antes de lançar.
              </p>
            )}
          </Card>
        </>
      )}

      {modal && (
        <SettlementPartnerModal
          initial={modal.id ? modal : null}
          empresaId={empresaId}
          onClose={() => setModal(null)}
          onSubmit={savePartner}
        />
      )}
    </div>
  );
}

const MESES_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
function fmtCompetencia(comp) {
  const [ano, mes] = (comp || "").split("-");
  const nome = MESES_PT[Number(mes) - 1];
  return nome ? `${nome}/${ano}` : comp;
}
/* ---------------------------------------------------------------------- */
/*  Rotina — controle das ações recorrentes do BPO, por empresa           */
/* ---------------------------------------------------------------------- */
const RECORRENCIA_LABEL = { pontual: "Pontual", diaria: "Diária", semanal: "Semanal", mensal: "Mensal" };

function TaskModal({ initial, onClose, onSubmit }) {
  const [form, setForm] = useState({ titulo: "", recorrencia: "pontual", proximaData: todayISO(), responsavelEmail: "", ...initial });
  const [staff, setStaff] = useState([]);
  const valid = form.titulo.trim() && form.proximaData;

  useEffect(() => {
    supabase.from("profiles").select("email, role").in("role", ["gestor", "operador"]).order("email")
      .then(({ data }) => setStaff(data || []));
  }, []);

  return (
    <Modal title={initial?.id ? "Editar tarefa" : "Nova tarefa"} onClose={onClose}>
      <div className="grid gap-3">
        <Field label="Tarefa">
          <TextInput value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} autoFocus placeholder="Ex.: Conciliar extrato do mês" />
        </Field>
        <Field label="Recorrência">
          <Select value={form.recorrencia} onChange={(e) => setForm({ ...form, recorrencia: e.target.value })}>
            {Object.entries(RECORRENCIA_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
        <Field label={form.recorrencia === "pontual" ? "Data" : "Próxima ocorrência"}>
          <TextInput type="date" value={form.proximaData} onChange={(e) => setForm({ ...form, proximaData: e.target.value })} />
        </Field>
        <Field label="Responsável (opcional)">
          <Select value={form.responsavelEmail || ""} onChange={(e) => setForm({ ...form, responsavelEmail: e.target.value || null })}>
            <option value="">Sem responsável definido</option>
            {staff.map((s) => <option key={s.email} value={s.email}>{s.email}</option>)}
          </Select>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => valid && onSubmit(form)} disabled={!valid}>Salvar</Button>
        </div>
      </div>
    </Modal>
  );
}

function fmtDuracao(segundos) {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}min` : `${m}min`;
}

/* ---------------------------------------------------------------------- */
/*  Inconsistência/Pendências — auditoria do operador antes do fechamento */
/* ---------------------------------------------------------------------- */

// Barra horizontal por origem (um valor por categoria é "parte-do-todo",
// não comparação par-a-par — por isso barra em vez de pizza: dá pra ler
// quantidade e valor exatos de cada origem de cabeça, sem precisar
// comparar ângulo/área de fatias).
const ORIGEM_COLORS = {
  "Lançamento Bancário": COLORS.blue,
  "Transferência": COLORS.gold,
  "Conta a Pagar (paga)": COLORS.red,
  "Conta a Receber (recebida)": COLORS.green,
};
function OrigemBreakdownChart({ items }) {
  const grouped = {};
  items.forEach((x) => {
    if (!grouped[x.origem]) grouped[x.origem] = { count: 0, valor: 0 };
    grouped[x.origem].count += 1;
    grouped[x.origem].valor += Number(x.valor) || 0;
  });
  const rows = Object.entries(grouped)
    .map(([origem, v]) => ({ origem, ...v, cor: ORIGEM_COLORS[origem] || COLORS.amber }))
    .sort((a, b) => b.valor - a.valor);
  if (rows.length <= 1) return null;
  const maxValor = Math.max(1, ...rows.map((r) => r.valor));
  return (
    <div className="space-y-2 mb-4 pb-4" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
      {rows.map((r) => (
        <div key={r.origem} className="flex items-center gap-2.5">
          <span className="w-44 text-xs shrink-0 truncate flex items-center gap-1.5" style={{ color: COLORS.inkSoft }}>
            <span className="w-2 h-2 rounded-sm inline-block shrink-0" style={{ background: r.cor }} />
            {r.origem}
          </span>
          <div className="flex-1 rounded overflow-hidden" style={{ height: 14, background: COLORS.bg }}>
            <div style={{ width: `${(r.valor / maxValor) * 100}%`, height: "100%", background: r.cor, opacity: 0.45 }} />
          </div>
          <span className="w-10 text-right text-xs shrink-0" style={{ color: COLORS.inkSoft }}>{r.count}×</span>
          <span className="w-24 text-right text-xs font-semibold tabular-nums shrink-0" style={{ color: COLORS.ink }}>{fmtBRL(r.valor)}</span>
        </div>
      ))}
    </div>
  );
}

function PendenciasView({
  payables, receivables, bankEntries, transfers, empresaId, empresaNome, empresa,
  competenciaFechamento, onFecharMes, onCancelarFechamento,
}) {
  const certAlerta = certificadoAlerta(empresa);
  const scope = (arr) => arr.filter((x) => !x.deletedAt && x.empresaId === empresaId);
  let payablesF = scope(payables);
  let receivablesF = scope(receivables);
  let bankEntriesF = scope(bankEntries);
  let transfersF = scope(transfers);

  // Chegando aqui a partir de "Fechar mês" (Análise → Fechamento), a
  // auditoria é recortada só pra competência sendo fechada — inclui todo
  // lançamento ainda não pago/recebido daquele mês, não só o vencido. Sem
  // isso vindo de lá (navegação direta pelo menu), continua sendo a
  // auditoria de sempre: tudo em aberto na empresa, independente do mês.
  if (competenciaFechamento) {
    const doMes = (arr, dateFn) => arr.filter((x) => competenciaOf(dateFn(x)) === competenciaFechamento);
    payablesF = doMes(payablesF, PERIOD_DATE_FIELD.payables);
    receivablesF = doMes(receivablesF, PERIOD_DATE_FIELD.receivables);
    bankEntriesF = doMes(bankEntriesF, PERIOD_DATE_FIELD.bankEntries);
    transfersF = doMes(transfersF, PERIOD_DATE_FIELD.transfers);
  }

  // "Regra de preenchimento completo": nada deveria chegar no fechamento
  // sem pelo menos a categoria definida — cobre lançamento bancário "A
  // classificar" e também conta a pagar/receber sem categoria (que passa
  // batido no formulário se o Plano de Contas dela estiver vazio).
  const semCategoria = [
    ...bankEntriesF.filter((b) => !b.categoria || b.categoria === "A classificar").map((b) => ({ id: b.id, origem: "Lançamento Bancário", data: b.data, descricao: b.descricao, valor: b.valor })),
    ...payablesF.filter((p) => !p.categoria).map((p) => ({ id: p.id, origem: "Conta a Pagar", data: p.vencimento, descricao: p.fornecedor, valor: p.valor })),
    ...receivablesF.filter((r) => !r.categoria).map((r) => ({ id: r.id, origem: "Conta a Receber", data: r.vencimento, descricao: r.cliente, valor: r.valor })),
  ].sort((a, b) => (a.data || "").localeCompare(b.data || ""));

  // Dinheiro que já andou (lançamento avulso, transferência, ou uma baixa
  // de conta a pagar/receber) mas ainda não foi batido contra o extrato —
  // é exatamente o que a Conciliação Bancária resolve, então cada item
  // aqui aponta pra lá.
  const naoConciliados = [
    ...bankEntriesF.filter((b) => !b.conciliado).map((b) => ({ id: b.id, origem: "Lançamento Bancário", data: b.data, descricao: b.descricao, valor: b.valor })),
    ...transfersF.filter((t) => !t.conciliado).map((t) => ({ id: t.id, origem: "Transferência", data: t.data, descricao: t.descricao, valor: t.valor })),
    ...payablesF.filter((p) => p.status === "Pago" && !p.conciliado).map((p) => ({ id: p.id, origem: "Conta a Pagar (paga)", data: p.dataPgto, descricao: p.fornecedor, valor: p.valorPago ?? p.valor })),
    ...receivablesF.filter((r) => r.status === "Recebido" && !r.conciliado).map((r) => ({ id: r.id, origem: "Conta a Receber (recebida)", data: r.dataReceb, descricao: r.cliente, valor: r.valorRecebido ?? r.valor })),
  ].sort((a, b) => (a.data || "").localeCompare(b.data || ""));

  const payablesVencidos = competenciaFechamento
    ? payablesF.filter((p) => p.status !== "Pago")
    : payablesF.filter((p) => p.status !== "Pago" && (p.vencimento || "") < todayISO());
  const receivablesVencidos = competenciaFechamento
    ? receivablesF.filter((r) => r.status !== "Recebido")
    : receivablesF.filter((r) => r.status !== "Recebido" && (r.vencimento || "") < todayISO());

  const total = semCategoria.length + naoConciliados.length + payablesVencidos.length + receivablesVencidos.length + (certAlerta ? 1 : 0);
  const rotuloPagar = competenciaFechamento ? "A pagar ainda não pagas" : "A pagar vencidas";
  const rotuloReceber = competenciaFechamento ? "A receber ainda não recebidas" : "A receber vencidas";

  return (
    <div className="space-y-4">
      <Header title="Inconsistência/Pendências" subtitle="Auditoria desta empresa antes de fechar o mês — o que ainda precisa ser resolvido com o operador." />

      {competenciaFechamento && (
        <div className="flex items-center justify-between gap-3 flex-wrap px-3 py-2.5 rounded-lg" style={{ background: total === 0 ? COLORS.greenSoft : COLORS.amberSoft }}>
          <p className="text-sm flex items-center gap-1.5" style={{ color: total === 0 ? COLORS.green : COLORS.amber }}>
            {total === 0 ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            {total === 0
              ? `Não há inconsistência ou pendência para ${empresaNome || "esta empresa"} em ${fmtCompetencia(competenciaFechamento)}.`
              : `${total} pendência(s) em ${empresaNome || "esta empresa"} — ${fmtCompetencia(competenciaFechamento)}. Revise abaixo antes de fechar, ou feche mesmo assim.`}
          </p>
          <div className="flex gap-2 shrink-0">
            <Button variant="ghost" onClick={onCancelarFechamento}>Cancelar</Button>
            <Button variant={total === 0 ? "primary" : "subtle"} onClick={() => onFecharMes(competenciaFechamento)}>
              <Lock size={13} /> {total === 0 ? "Fechar mês" : "Fechar mesmo assim"}
            </Button>
          </div>
        </div>
      )}

      {total === 0 ? (
        !competenciaFechamento && (
          <EmptyState icon={CheckCircle2} title="Nada pendente" subtitle="Não encontrei inconsistência nenhuma nessa empresa — pode fechar o mês com tranquilidade em Análise → Fechamento." />
        )
      ) : (
        <>
          {certAlerta && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm" style={{ background: COLORS.redSoft, color: COLORS.red }}>
              <ShieldCheck size={15} />
              Certificado digital {certAlerta.nivel === "vencido" ? `vencido há ${Math.abs(certAlerta.dias)} dia(s)` : `vence em ${certAlerta.dias} dia(s)`} — renove em Cadastros → Editar empresa antes que a emissão de nota pare.
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-3 text-center">
              <p className="text-xs" style={{ color: COLORS.inkSoft }}>Sem categoria</p>
              <p className="text-xl font-semibold" style={{ color: semCategoria.length ? COLORS.amber : COLORS.green }}>{semCategoria.length}</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-xs" style={{ color: COLORS.inkSoft }}>Não conciliados</p>
              <p className="text-xl font-semibold" style={{ color: naoConciliados.length ? COLORS.amber : COLORS.green }}>{naoConciliados.length}</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-xs" style={{ color: COLORS.inkSoft }}>{rotuloPagar}</p>
              <p className="text-xl font-semibold" style={{ color: payablesVencidos.length ? COLORS.red : COLORS.green }}>{payablesVencidos.length}</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-xs" style={{ color: COLORS.inkSoft }}>{rotuloReceber}</p>
              <p className="text-xl font-semibold" style={{ color: receivablesVencidos.length ? COLORS.red : COLORS.green }}>{receivablesVencidos.length}</p>
            </Card>
          </div>

          {semCategoria.length > 0 && (
            <ReportCard title="Sem categoria" subtitle="Preenchimento incompleto — defina a categoria de cada um antes de fechar o mês.">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
                    <th className="text-left font-medium px-2 py-1.5">Data</th>
                    <th className="text-left font-medium px-2 py-1.5">Origem</th>
                    <th className="text-left font-medium px-2 py-1.5">Descrição</th>
                    <th className="text-right font-medium px-2 py-1.5">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {semCategoria.map((b) => (
                    <tr key={`${b.origem}-${b.id}`} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                      <td className="px-2 py-1.5" style={{ color: COLORS.ink }}>{fmtDate(b.data)}</td>
                      <td className="px-2 py-1.5"><Badge tone="neutral">{b.origem}</Badge></td>
                      <td className="px-2 py-1.5" style={{ color: COLORS.inkSoft }}>{b.descricao}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: COLORS.ink }}>{fmtBRL(b.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ReportCard>
          )}

          {naoConciliados.length > 0 && (
            <ReportCard title="Não conciliados" subtitle="Já movimentaram dinheiro mas ainda não foram batidos contra o extrato — resolva em Conciliação Bancária.">
              <OrigemBreakdownChart items={naoConciliados} />
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
                    <th className="text-left font-medium px-2 py-1.5">Data</th>
                    <th className="text-left font-medium px-2 py-1.5">Origem</th>
                    <th className="text-left font-medium px-2 py-1.5">Descrição</th>
                    <th className="text-right font-medium px-2 py-1.5">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {naoConciliados.map((x) => (
                    <tr key={`${x.origem}-${x.id}`} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                      <td className="px-2 py-1.5" style={{ color: COLORS.ink }}>{fmtDate(x.data)}</td>
                      <td className="px-2 py-1.5"><Badge tone="neutral">{x.origem}</Badge></td>
                      <td className="px-2 py-1.5" style={{ color: COLORS.inkSoft }}>{x.descricao}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: COLORS.ink }}>{fmtBRL(x.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ReportCard>
          )}

          {payablesVencidos.length > 0 && (
            <ReportCard title={rotuloPagar === "A pagar vencidas" ? "Contas a pagar vencidas" : "Contas a pagar ainda não pagas neste mês"} subtitle="Confirme se já foram pagas fora do sistema ou se estão realmente em aberto.">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
                    <th className="text-left font-medium px-2 py-1.5">Vencimento</th>
                    <th className="text-left font-medium px-2 py-1.5">Fornecedor</th>
                    <th className="text-right font-medium px-2 py-1.5">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {payablesVencidos.map((p) => (
                    <tr key={p.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                      <td className="px-2 py-1.5" style={{ color: COLORS.red }}>{fmtDate(p.vencimento)}</td>
                      <td className="px-2 py-1.5" style={{ color: COLORS.ink }}>{p.fornecedor}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: COLORS.ink }}>{fmtBRL(p.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ReportCard>
          )}

          {receivablesVencidos.length > 0 && (
            <ReportCard title={rotuloReceber === "A receber vencidas" ? "Contas a receber vencidas" : "Contas a receber ainda não recebidas neste mês"} subtitle="Confirme se já foram recebidas fora do sistema ou se o cliente está mesmo em aberto.">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
                    <th className="text-left font-medium px-2 py-1.5">Vencimento</th>
                    <th className="text-left font-medium px-2 py-1.5">Cliente</th>
                    <th className="text-right font-medium px-2 py-1.5">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {receivablesVencidos.map((r) => (
                    <tr key={r.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                      <td className="px-2 py-1.5" style={{ color: COLORS.red }}>{fmtDate(r.vencimento)}</td>
                      <td className="px-2 py-1.5" style={{ color: COLORS.ink }}>{r.cliente}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: COLORS.ink }}>{fmtBRL(r.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ReportCard>
          )}
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Onboarding — checklist de cliente novo, em quadro Kanban por fase       */
/* ---------------------------------------------------------------------- */
function AddOnboardingItemModal({ onClose, onSubmit }) {
  const [titulo, setTitulo] = useState("");
  const [fase, setFase] = useState(ONBOARDING_FASES[0].key);
  return (
    <Modal title="Novo item do checklist" onClose={onClose}>
      <div className="grid gap-3">
        <Field label="Item">
          <TextInput value={titulo} onChange={(e) => setTitulo(e.target.value)} autoFocus placeholder="Ex.: Validar acesso ao ERP do cliente" />
        </Field>
        <Field label="Fase">
          <Select value={fase} onChange={(e) => setFase(e.target.value)}>
            {ONBOARDING_FASES.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </Select>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => titulo.trim() && onSubmit({ titulo: titulo.trim(), fase })} disabled={!titulo.trim()}>Adicionar</Button>
        </div>
      </div>
    </Modal>
  );
}

// Colunas = as 4 fases do roteiro (categoria fixa do item, não um
// progresso) — concluir é um check dentro do próprio cartão, não uma
// coluna. Arrastar reclassifica o item pra outra fase, se o gestor decidir
// que ele encaixa melhor ali.
function OnboardingView({ items, empresaId, empresaNome, userEmail, onSave, onGerarChecklist }) {
  const [addModal, setAddModal] = useState(false);
  const [dragId, setDragId] = useState(null);
  const itensF = items.filter((i) => i.empresaId === empresaId);
  const concluidos = itensF.filter((i) => i.status === "concluido").length;

  const toggleConcluido = (item) => {
    const novoStatus = item.status === "concluido" ? "pendente" : "concluido";
    onSave(items.map((x) => (x.id === item.id
      ? { ...x, status: novoStatus, concluidoEm: novoStatus === "concluido" ? new Date().toISOString() : null, concluidoPor: novoStatus === "concluido" ? userEmail : null }
      : x)));
  };
  const mover = (id, novaFase) => onSave(items.map((x) => (x.id === id ? { ...x, fase: novaFase } : x)));
  const adicionar = (form) => {
    onSave([...items, { id: uid(), empresaId, fase: form.fase, titulo: form.titulo, status: "pendente" }]);
    setAddModal(false);
  };
  const excluir = (item) => {
    if (!confirmDelete(`Excluir "${item.titulo}" do checklist?`)) return;
    onSave(items.filter((x) => x.id !== item.id));
  };

  if (itensF.length === 0) {
    return (
      <div className="space-y-4">
        <Header title="Onboarding" subtitle={`Checklist de integração — ${empresaNome || "empresa"}`} />
        <Card className="p-8">
          <EmptyState
            icon={ListChecks}
            title="Sem checklist ainda"
            subtitle="Essa empresa não tem o roteiro de onboarding gerado. Empresas criadas de agora em diante já nascem com ele."
          />
          <div className="flex justify-center mt-3">
            <Button onClick={() => onGerarChecklist(empresaId)}>Gerar checklist padrão</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Header title="Onboarding" subtitle={`${concluidos}/${itensF.length} itens concluídos — ${empresaNome || "empresa"}`}>
        <Button variant="ghost" onClick={() => setAddModal(true)}><Plus size={15} /> Novo item</Button>
      </Header>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {ONBOARDING_FASES.map((faseInfo) => {
          const itensFase = itensF.filter((i) => i.fase === faseInfo.key);
          return (
            <div
              key={faseInfo.key}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (dragId) mover(dragId, faseInfo.key); setDragId(null); }}
              className="rounded-xl p-2.5 min-h-[160px]"
              style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}` }}
            >
              <p className="text-xs font-semibold mb-2 px-1 flex items-center justify-between" style={{ color: COLORS.inkSoft }}>
                {faseInfo.label} <Badge tone={faseInfo.tone}>{itensFase.filter((i) => i.status === "concluido").length}/{itensFase.length}</Badge>
              </p>
              <div className="space-y-2">
                {itensFase.map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => setDragId(item.id)}
                    className="rounded-lg p-2.5 cursor-grab active:cursor-grabbing flex items-start gap-2"
                    style={{ background: "#fff", border: `1px solid ${COLORS.border}`, boxShadow: "0 1px 2px rgba(31,58,52,0.06)" }}
                  >
                    <button onClick={() => toggleConcluido(item)} title={item.status === "concluido" ? "Marcar como pendente" : "Marcar como concluído"} className="shrink-0 mt-0.5">
                      {item.status === "concluido" ? <CheckCircle2 size={16} color={COLORS.green} /> : <span className="w-4 h-4 rounded-full inline-block" style={{ border: `1.5px solid ${COLORS.border}` }} />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm" style={{ color: item.status === "concluido" ? COLORS.inkSoft : COLORS.ink, textDecoration: item.status === "concluido" ? "line-through" : "none" }}>
                        {item.titulo}
                      </p>
                      {item.status === "concluido" && item.concluidoPor && (
                        <p className="text-[11px] mt-0.5 truncate" style={{ color: COLORS.inkSoft }}>{item.concluidoPor} · {fmtDate(item.concluidoEm?.slice(0, 10))}</p>
                      )}
                    </div>
                    <button onClick={() => excluir(item)} title="Excluir item" className="shrink-0"><Trash2 size={12} color={COLORS.red} /></button>
                  </div>
                ))}
                {itensFase.length === 0 && (
                  <p className="text-xs text-center py-4" style={{ color: COLORS.inkSoft }}>Arraste um cartão pra aqui</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {addModal && <AddOnboardingItemModal onClose={() => setAddModal(false)} onSubmit={adicionar} />}
    </div>
  );
}

function RotinaView({
  periodLocks, tasks, fiscalObligations, timeSessions,
  empresaId, userEmail,
  onSaveTasks, onSolicitarFechamento, onReabrirMes,
}) {
  const locksF = periodLocks.filter((l) => l.empresaId === empresaId);
  const lockOf = (competencia) => locksF.find((l) => l.competencia === competencia);
  const isLocked = (competencia) => {
    const l = lockOf(competencia);
    return !!l && !l.reabertoEm;
  };

  // Últimos 12 meses, do mais recente pro mais antigo — fechar um mês
  // futuro não faz sentido (ainda não tem lançamento nele), mas não
  // impeço: quem decide fechar sabe o que está fazendo.
  const meses = useMemo(() => {
    const out = [];
    const base = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return out;
  }, []);

  // Dos 12 meses, só os "Aberto" pedem atenção de verdade — os já
  // fechados viram histórico. Aponta pro mais antigo ainda aberto (é o
  // mais atrasado, o que mais precisa ser resolvido primeiro); se estiver
  // tudo fechado, aponta pro mês corrente.
  const mesesAbertos = meses.filter((m) => !isLocked(m));
  const [competenciaSelecionada, setCompetenciaSelecionada] = useState(
    () => mesesAbertos[mesesAbertos.length - 1] || meses[0]
  );
  const [verTodosMeses, setVerTodosMeses] = useState(false);

  const [taskModal, setTaskModal] = useState(null); // null | {} | tarefa
  const tasksF = tasks.filter((t) => t.empresaId === empresaId && t.status !== "concluida");
  // Só obrigação já validada (não "Sugerido", que ainda nem é real) entra
  // na lista unificada — mistura com as tarefas manuais só pra dar uma
  // visão única do que precisa acontecer, sem duplicar o dado: concluir a
  // obrigação em si continua sendo feito no Calendário Fiscal.
  const fiscalF = fiscalObligations.filter((o) => !o.deletedAt && o.empresaId === empresaId && o.status === "Pendente");

  const itensRotina = [
    ...tasksF.map((t) => ({ origem: "tarefa", data: t.proximaData, item: t })),
    ...fiscalF.map((o) => ({ origem: "fiscal", data: o.vencimento, item: o })),
  ].sort((a, b) => (a.data || "").localeCompare(b.data || ""));

  // Filtro + limite de linhas — pra lista não crescer indefinidamente e
  // obrigar scroll: por padrão mostra só os ITENS_ROTINA_LIMITE mais
  // próximos, e "Ver todos" ou um filtro de origem reduzem/expandem o que
  // aparece, sem nunca depender de rolar a tela pra encontrar algo.
  const ITENS_ROTINA_LIMITE = 8;
  const [tarefasOrigemFiltro, setTarefasOrigemFiltro] = useState(""); // "" | "tarefa" | "fiscal"
  const [tarefasVerTodas, setTarefasVerTodas] = useState(false);
  const itensRotinaFiltrados = tarefasOrigemFiltro
    ? itensRotina.filter((i) => i.origem === tarefasOrigemFiltro)
    : itensRotina;
  const itensRotinaExibidos = tarefasVerTodas
    ? itensRotinaFiltrados
    : itensRotinaFiltrados.slice(0, ITENS_ROTINA_LIMITE);

  const saveTask = (form) => {
    if (form.id) onSaveTasks(tasks.map((t) => (t.id === form.id ? { ...t, ...form } : t)));
    else onSaveTasks([...tasks, { id: uid(), empresaId, status: "pendente", ...form }]);
    setTaskModal(null);
  };
  const deleteTask = (t) => {
    if (!confirmDelete(`Excluir a tarefa "${t.titulo}"?`)) return;
    onSaveTasks(tasks.filter((x) => x.id !== t.id));
  };
  // Tarefa pontual concluída some da lista (fica só marcada, pra histórico).
  // Tarefa recorrente não "termina": avança a própria data pro próximo
  // ciclo e continua pendente — é assim que ela vira uma rotina de verdade,
  // sem acumular uma linha nova a cada vez que é feita.
  const concluirTask = (t) => {
    const agora = { concluidaEm: new Date().toISOString(), concluidaPor: userEmail };
    if (t.recorrencia === "pontual") {
      onSaveTasks(tasks.map((x) => (x.id === t.id ? { ...x, status: "concluida", ...agora } : x)));
      return;
    }
    const dias = { diaria: 1, semanal: 7 }[t.recorrencia];
    const proximaData = dias ? addDaysToISODate(t.proximaData, dias) : addMonthsToISODate(t.proximaData, 1);
    onSaveTasks(tasks.map((x) => (x.id === t.id ? { ...x, proximaData, ...agora } : x)));
  };

  // Cronômetro: controle interno de eficiência, nunca visto pelo cliente.
  // Automático desde a Etapa de produtividade — liga/desliga sozinho
  // conforme o usuário navega (ver ROTINA_TRACK_VIEWS no FinanceiroApp),
  // então aqui só exibe o que já está registrado, sem botão nenhum.
  const minhaSessaoAberta = timeSessions.find((s) => s.userEmail === userEmail && !s.fim);
  const sessoesEmpresa = timeSessions
    .filter((s) => s.empresaId === empresaId && s.fim)
    .sort((a, b) => (b.inicio || "").localeCompare(a.inicio || ""));

  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!minhaSessaoAberta || minhaSessaoAberta.empresaId !== empresaId) return;
    const id = setInterval(() => forceTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, [minhaSessaoAberta?.id, empresaId]); // eslint-disable-line react-hooks/exhaustive-deps

  const elapsedSeconds = minhaSessaoAberta && minhaSessaoAberta.empresaId === empresaId
    ? Math.floor((Date.now() - new Date(minhaSessaoAberta.inicio).getTime()) / 1000)
    : 0;

  const totalEmpresaSeg = sessoesEmpresa.reduce((s, x) => s + (new Date(x.fim) - new Date(x.inicio)) / 1000, 0);
  const totalPorAnalista = useMemo(() => {
    const map = new Map();
    sessoesEmpresa.forEach((s) => {
      const dur = (new Date(s.fim) - new Date(s.inicio)) / 1000;
      map.set(s.userEmail, (map.get(s.userEmail) || 0) + dur);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [sessoesEmpresa]);

  return (
    <div className="space-y-4">
      <Header title="Fechamento" subtitle="Controle das ações recorrentes do BPO para esta empresa." />

      <ReportCard
        title="Fechamento mensal"
        subtitle='Fecha um mês depois de entregar o relatório ao cliente — protege contra edição/exclusão/baixa acidental de um lançamento que já foi reportado. "Mês" aqui é a data do lançamento (data de lançamento, ou vencimento quando não houver), não a data de pagamento. Se a empresa tiver contato de contabilidade cadastrado (Cadastros → Editar empresa), o pacote de documentos daquele mês é gerado e enviado por WhatsApp pro contador automaticamente ao fechar.'
      >
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <span
            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
            style={{
              background: mesesAbertos.length === 0 ? COLORS.greenSoft : COLORS.amberSoft,
              color: mesesAbertos.length === 0 ? COLORS.green : COLORS.amber,
            }}
          >
            {mesesAbertos.length === 0 ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
            {mesesAbertos.length === 0 ? "Todos os últimos 12 meses estão fechados" : `${mesesAbertos.length} mês(es) em aberto`}
          </span>
          <button
            onClick={() => setVerTodosMeses((v) => !v)}
            className="text-xs font-medium"
            style={{ color: COLORS.primary }}
          >
            {verTodosMeses ? "Ocultar histórico completo" : "Ver histórico completo (12 meses)"}
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 items-end mb-1">
          <Field label="Exercício">
            <Select value={competenciaSelecionada} onChange={(e) => setCompetenciaSelecionada(e.target.value)}>
              {meses.map((m) => (
                <option key={m} value={m}>{fmtCompetencia(m)} — {isLocked(m) ? "Fechado" : "Aberto"}</option>
              ))}
            </Select>
          </Field>
          <div className="flex items-center justify-between gap-2 pb-0.5">
            {(() => {
              const lock = lockOf(competenciaSelecionada);
              const locked = isLocked(competenciaSelecionada);
              return (
                <>
                  <div>
                    {locked ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: COLORS.redSoft, color: COLORS.red }}>
                        <Lock size={11} /> Fechado em {fmtDateTime(lock.fechadoEm)} por {lock.fechadoPor}
                      </span>
                    ) : lock ? (
                      <span className="text-xs" style={{ color: COLORS.inkSoft }}>Reaberto em {fmtDateTime(lock.reabertoEm)} por {lock.reabertoPor}</span>
                    ) : (
                      <span className="text-xs" style={{ color: COLORS.inkSoft }}>Aberto</span>
                    )}
                  </div>
                  {locked ? (
                    <Button variant="ghost" onClick={() => onReabrirMes(competenciaSelecionada)}><Unlock size={13} /> Reabrir</Button>
                  ) : (
                    <Button variant="subtle" onClick={() => onSolicitarFechamento(competenciaSelecionada)}><Lock size={13} /> Fechar mês</Button>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        {verTodosMeses && (
          <table className="w-full text-sm mt-3" style={{ borderTop: `1px solid ${COLORS.border}` }}>
            <thead>
              <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
                <th className="text-left font-medium px-2 py-1.5">Mês</th>
                <th className="text-left font-medium px-2 py-1.5">Situação</th>
                <th className="text-right font-medium px-2 py-1.5">Ação</th>
              </tr>
            </thead>
            <tbody>
              {meses.map((m) => {
                const lock = lockOf(m);
                const locked = isLocked(m);
                return (
                  <tr key={m} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                    <td className="px-2 py-1.5 capitalize" style={{ color: COLORS.ink }}>{fmtCompetencia(m)}</td>
                    <td className="px-2 py-1.5">
                      {locked ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: COLORS.redSoft, color: COLORS.red }}>
                          <Lock size={11} /> Fechado em {fmtDateTime(lock.fechadoEm)} por {lock.fechadoPor}
                        </span>
                      ) : lock ? (
                        <span className="text-xs" style={{ color: COLORS.inkSoft }}>Reaberto em {fmtDateTime(lock.reabertoEm)} por {lock.reabertoPor} (fechado antes em {fmtDateTime(lock.fechadoEm)})</span>
                      ) : (
                        <span className="text-xs" style={{ color: COLORS.inkSoft }}>Aberto</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      {locked ? (
                        <Button variant="ghost" onClick={() => onReabrirMes(m)}><Unlock size={13} /> Reabrir</Button>
                      ) : (
                        <Button variant="subtle" onClick={() => onSolicitarFechamento(m)}><Lock size={13} /> Fechar mês</Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>
          "Fechar mês" leva pra Análise → Inconsistência/Pendências, recortada pra essa competência, antes de travar de verdade.
        </p>
      </ReportCard>

      <ReportCard
        title="Tarefas e obrigações"
        subtitle="Tarefas manuais (diárias/semanais/mensais/pontuais) misturadas com as obrigações fiscais já validadas desta empresa — uma visão única do que precisa acontecer."
      >
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <Select
            value={tarefasOrigemFiltro}
            onChange={(e) => { setTarefasOrigemFiltro(e.target.value); setTarefasVerTodas(false); }}
            style={{ width: 176 }}
          >
            <option value="">Todas as origens</option>
            <option value="tarefa">Só tarefas manuais</option>
            <option value="fiscal">Só obrigações fiscais</option>
          </Select>
          <Button onClick={() => setTaskModal({})}><Plus size={14} /> Nova tarefa</Button>
        </div>
        {itensRotinaFiltrados.length === 0 ? (
          <p className="text-sm" style={{ color: COLORS.inkSoft }}>Nada pendente por aqui.</p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
                  <th className="text-left font-medium px-2 py-1.5">Data</th>
                  <th className="text-left font-medium px-2 py-1.5">Item</th>
                  <th className="text-left font-medium px-2 py-1.5">Origem</th>
                  <th className="text-right font-medium px-2 py-1.5">Ação</th>
                </tr>
              </thead>
              <tbody>
                {itensRotinaExibidos.map(({ origem, data, item }) => (
                  <tr key={`${origem}-${item.id}`} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                    <td className="px-2 py-1.5" style={{ color: COLORS.ink }}>{fmtDate(data)}</td>
                    <td className="px-2 py-1.5" style={{ color: COLORS.ink }}>{origem === "tarefa" ? item.titulo : item.tributo}</td>
                    <td className="px-2 py-1.5">
                      {origem === "tarefa" ? (
                        <Badge tone="neutral">{RECORRENCIA_LABEL[item.recorrencia]}</Badge>
                      ) : (
                        <Badge tone="gold">Fiscal</Badge>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      {origem === "tarefa" ? (
                        <div className="flex justify-end gap-1.5">
                          <Button variant="ghost" onClick={() => concluirTask(item)}><Check size={13} /> Concluir</Button>
                          <button onClick={() => setTaskModal(item)} title="Editar"><Pencil size={14} color={COLORS.inkSoft} /></button>
                          <button onClick={() => deleteTask(item)} title="Excluir"><Trash2 size={14} color={COLORS.red} /></button>
                        </div>
                      ) : (
                        <span className="text-xs" style={{ color: COLORS.inkSoft }}>Concluir no Calendário Fiscal</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!tarefasVerTodas && itensRotinaFiltrados.length > ITENS_ROTINA_LIMITE && (
              <button
                onClick={() => setTarefasVerTodas(true)}
                className="text-xs font-medium mt-2"
                style={{ color: COLORS.primary }}
              >
                Ver mais {itensRotinaFiltrados.length - ITENS_ROTINA_LIMITE} item(ns)
              </button>
            )}
          </>
        )}
      </ReportCard>

      <ReportCard
        title="Cronômetro"
        subtitle="Controle interno de eficiência — tempo trabalhado por empresa e por analista, contado automaticamente conforme o uso do sistema. O cliente nunca vê isso; não tem relação nenhuma com cobrança."
      >
        {minhaSessaoAberta && minhaSessaoAberta.empresaId === empresaId ? (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: COLORS.green }} />
            <p className="text-2xl font-semibold tabular-nums" style={{ color: COLORS.ink }}>{fmtDuracao(elapsedSeconds)}</p>
            <p className="text-xs" style={{ color: COLORS.inkSoft }}>contando automaticamente</p>
          </div>
        ) : (
          <p className="text-sm" style={{ color: COLORS.inkSoft }}>
            Nenhum cronômetro rodando nesta empresa agora — começa sozinho quando você abre uma tela de rotina (Documentos, Conciliação, Contas a Pagar/Receber, Lançamentos, Fechamento, Pendências…).
          </p>
        )}

        <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${COLORS.border}` }}>
          <p className="text-xs mb-2" style={{ color: COLORS.inkSoft }}>Total registrado nesta empresa: {fmtDuracao(totalEmpresaSeg)}</p>
          {totalPorAnalista.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
                  <th className="text-left font-medium px-2 py-1.5">Analista</th>
                  <th className="text-right font-medium px-2 py-1.5">Tempo total</th>
                </tr>
              </thead>
              <tbody>
                {totalPorAnalista.map(([email, seg]) => (
                  <tr key={email} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                    <td className="px-2 py-1.5" style={{ color: COLORS.ink }}>{email}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: COLORS.ink }}>{fmtDuracao(seg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </ReportCard>

      {taskModal && (
        <TaskModal
          initial={taskModal.id ? taskModal : null}
          onClose={() => setTaskModal(null)}
          onSubmit={saveTask}
        />
      )}
    </div>
  );
}

const NIVEL_BADGE_TONE = { "Básico": "green", "Intermediário": "amber", "Avançado": "gold" };
const NIVEL_ORDEM = { "Avançado": 0, "Intermediário": 1, "Básico": 2 };
const humanizeCampo = (campo) => {
  const s = (campo || "").replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function SkillModal({ initial, onClose, onSubmit }) {
  const [form, setForm] = useState({
    titulo: "", nivel: "Básico", tagsText: "", resumo: "", modelo_sugerido: "", modelo_tier: "padrao", prompt_template: "",
    ...(initial ? { ...initial, tagsText: (initial.tags || []).join(", ") } : {}),
  });
  const valid = form.titulo.trim() && form.prompt_template.trim();

  const submit = () => {
    const campos = [...new Set([...form.prompt_template.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g)].map((m) => m[1]))];
    const tags = form.tagsText.split(",").map((t) => t.trim()).filter(Boolean);
    onSubmit({
      id: form.id,
      codigo: form.codigo,
      titulo: form.titulo.trim(),
      nivel: form.nivel,
      tags,
      campos,
      resumo: form.resumo.trim(),
      modelo_sugerido: form.modelo_sugerido.trim(),
      modelo_tier: form.modelo_tier,
      prompt_template: form.prompt_template,
    });
  };

  return (
    <Modal title={initial ? "Editar skill" : "Nova skill"} onClose={onClose} wide>
      <div className="grid gap-3">
        <Field label="Título">
          <TextInput value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nível">
            <Select value={form.nivel} onChange={(e) => setForm({ ...form, nivel: e.target.value })}>
              <option>Básico</option><option>Intermediário</option><option>Avançado</option>
            </Select>
          </Field>
          <Field label="Modelo de IA">
            <Select value={form.modelo_tier} onChange={(e) => setForm({ ...form, modelo_tier: e.target.value })}>
              <option value="economico">Econômico (tarefa simples)</option>
              <option value="padrao">Padrão (raciocínio mais complexo)</option>
            </Select>
          </Field>
        </div>
        <Field label="Tags (separadas por vírgula)">
          <TextInput value={form.tagsText} onChange={(e) => setForm({ ...form, tagsText: e.target.value })} placeholder="ex.: dre, análise, resultado" />
        </Field>
        <Field label='"O que você recebe" (vitrine, uma linha)'>
          <TextInput value={form.resumo} onChange={(e) => setForm({ ...form, resumo: e.target.value })} />
        </Field>
        <Field label="Modelo sugerido (texto livre, opcional)">
          <TextInput value={form.modelo_sugerido} onChange={(e) => setForm({ ...form, modelo_sugerido: e.target.value })} />
        </Field>
        <Field label="Prompt (use {{campo}} para cada variável a preencher na hora de rodar)">
          <textarea
            value={form.prompt_template}
            onChange={(e) => setForm({ ...form, prompt_template: e.target.value })}
            rows={12}
            className={inputCls}
            style={{ ...inputStyle, fontFamily: "ui-monospace, monospace", fontSize: 13 }}
          />
        </Field>
        <p className="text-xs" style={{ color: COLORS.inkSoft }}>
          Campos detectados: {[...new Set([...form.prompt_template.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g)].map((m) => m[1]))].join(", ") || "nenhum ainda"}
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => valid && submit()} disabled={!valid}>Salvar</Button>
        </div>
      </div>
    </Modal>
  );
}

function RunSkillModal({ skill, onClose, onRun }) {
  const [valores, setValores] = useState({});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState(null);

  const gerar = async () => {
    setError("");
    setRunning(true);
    try {
      const texto = await onRun(skill, valores);
      setResultado(texto);
    } catch (err) {
      setError(err?.message || "Erro ao gerar a análise.");
    } finally {
      setRunning(false);
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(resultado);
    } catch {
      window.prompt("Copie o texto:", resultado);
    }
  };

  return (
    <Modal title={skill.titulo} onClose={onClose} xwide>
      {!resultado ? (
        <div className="grid gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone={NIVEL_BADGE_TONE[skill.nivel] || "neutral"}>{skill.nivel}</Badge>
            {(skill.tags || []).map((t) => <Badge key={t} tone="neutral">{t}</Badge>)}
          </div>
          <p className="text-sm" style={{ color: COLORS.inkSoft }}>{skill.resumo}</p>
          {(skill.campos || []).map((campo) => (
            <Field key={campo} label={humanizeCampo(campo)}>
              <textarea
                value={valores[campo] || ""}
                onChange={(e) => setValores((v) => ({ ...v, [campo]: e.target.value }))}
                rows={3}
                className={inputCls}
                style={inputStyle}
                placeholder="Cole ou digite os dados aqui"
              />
            </Field>
          ))}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: COLORS.redSoft, color: COLORS.red }}>
              <AlertTriangle size={15} /> {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button onClick={gerar} disabled={running}>
              <Sparkles size={14} /> {running ? "Gerando…" : "Gerar análise"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          <div className="rounded-lg p-4 whitespace-pre-wrap text-sm max-h-[60vh] overflow-y-auto" style={{ background: "#FAFAF7", border: `1px solid ${COLORS.border}`, color: COLORS.ink }}>
            {resultado}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setResultado(null)}>Rodar de novo</Button>
            <Button variant="subtle" onClick={copiar}><Copy size={14} /> Copiar</Button>
            <Button onClick={onClose}>Fechar</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function HubSkillsView({ skills, runs, empresaId, userEmail, onSaveSkills, onSaveRuns }) {
  const [nivelFiltro, setNivelFiltro] = useState("");
  const [busca, setBusca] = useState("");
  const [skillModal, setSkillModal] = useState(null); // null | {} | skill
  const [runModal, setRunModal] = useState(null); // skill
  const [viewRun, setViewRun] = useState(null); // run sendo visualizada

  const skillsFiltradas = skills
    .filter((s) => !nivelFiltro || s.nivel === nivelFiltro)
    .filter((s) => {
      if (!busca.trim()) return true;
      const alvo = `${s.titulo} ${(s.tags || []).join(" ")}`.toLowerCase();
      return alvo.includes(busca.trim().toLowerCase());
    })
    .sort((a, b) => {
      const ordem = (NIVEL_ORDEM[a.nivel] ?? 99) - (NIVEL_ORDEM[b.nivel] ?? 99);
      return ordem !== 0 ? ordem : (a.codigo || "").localeCompare(b.codigo || "");
    });

  const runsEmpresa = runs
    .filter((r) => r.empresaId === empresaId)
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

  const saveSkill = (form) => {
    if (form.id) {
      onSaveSkills(skills.map((s) => (s.id === form.id ? { ...s, ...form } : s)));
    } else {
      const id = uid();
      onSaveSkills([...skills, { ...form, id, codigo: id.toUpperCase() }]);
    }
    setSkillModal(null);
  };

  const deleteSkill = (s) => {
    if (!confirmDelete(`Excluir a skill "${s.titulo}"? Isso não apaga o histórico de análises já geradas com ela.`)) return;
    onSaveSkills(skills.filter((x) => x.id !== s.id));
  };

  // Monta o prompt final substituindo cada {{campo}} pelo texto preenchido,
  // chama a IA, e já grava no histórico dessa empresa — pra quem quiser
  // revisitar a análise depois sem ter que rodar de novo.
  const executarSkill = async (skill, valores) => {
    const promptFinal = (skill.campos || []).reduce(
      (txt, campo) => txt.split(`{{${campo}}}`).join(valores[campo] || ""),
      skill.prompt_template
    );
    const resultado = await callRunSkill(promptFinal, skill.modelo_tier);
    onSaveRuns([...runs, {
      id: uid(), empresaId, skillId: skill.id, skillCodigo: skill.codigo, skillTitulo: skill.titulo,
      camposPreenchidos: valores, resultado, userEmail,
    }]);
    return resultado;
  };

  return (
    <div className="space-y-4">
      <Header title="Hub de Skills" subtitle="Biblioteca de prompts prontos de gestão financeira/contábil — gere uma análise sob demanda pra apresentar ao dono da empresa.">
        <Button onClick={() => setSkillModal({})}><Plus size={15} /> Nova skill</Button>
      </Header>

      <Card className="p-4">
        <div className="flex items-end gap-3 flex-wrap">
          <Field label="Nível">
            <Select value={nivelFiltro} onChange={(e) => setNivelFiltro(e.target.value)}>
              <option value="">Todos</option>
              <option>Básico</option><option>Intermediário</option><option>Avançado</option>
            </Select>
          </Field>
          <Field label="Buscar por título ou tag">
            <TextInput value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="ex.: fluxo de caixa, inadimplência..." />
          </Field>
        </div>
      </Card>

      {skillsFiltradas.length === 0 ? (
        <EmptyState icon={Sparkles} title="Nenhuma skill encontrada" subtitle="Ajuste o filtro ou cadastre uma nova skill." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {skillsFiltradas.map((s) => (
            <Card key={s.id} className="p-4 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-mono" style={{ color: COLORS.inkSoft }}>{s.codigo}</p>
                  <p className="font-medium text-sm" style={{ color: COLORS.ink }}>{s.titulo}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button title="Editar" onClick={() => setSkillModal(s)}><Pencil size={14} color={COLORS.inkSoft} /></button>
                  <button title="Excluir" onClick={() => deleteSkill(s)}><Trash2 size={14} color={COLORS.red} /></button>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge tone={NIVEL_BADGE_TONE[s.nivel] || "neutral"}>{s.nivel}</Badge>
                {(s.tags || []).slice(0, 3).map((t) => <Badge key={t} tone="neutral">{t}</Badge>)}
              </div>
              <p className="text-xs flex-1" style={{ color: COLORS.inkSoft }}>{s.resumo}</p>
              <Button onClick={() => setRunModal(s)}><Sparkles size={14} /> Usar</Button>
            </Card>
          ))}
        </div>
      )}

      <ReportCard title="Histórico de análises geradas" subtitle="Por esta empresa — reabra sem precisar rodar de novo.">
        {runsEmpresa.length === 0 ? (
          <p className="text-sm" style={{ color: COLORS.inkSoft }}>Nenhuma análise gerada ainda para esta empresa.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
                <th className="text-left font-medium px-2 py-1.5">Data</th>
                <th className="text-left font-medium px-2 py-1.5">Skill</th>
                <th className="text-left font-medium px-2 py-1.5">Quem gerou</th>
                <th className="text-right font-medium px-2 py-1.5">Ação</th>
              </tr>
            </thead>
            <tbody>
              {runsEmpresa.map((r) => (
                <tr key={r.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                  <td className="px-2 py-1.5" style={{ color: COLORS.ink }}>{fmtDateTime(r.created_at)}</td>
                  <td className="px-2 py-1.5" style={{ color: COLORS.ink }}>{r.skillCodigo} — {r.skillTitulo}</td>
                  <td className="px-2 py-1.5" style={{ color: COLORS.inkSoft }}>{r.userEmail}</td>
                  <td className="px-2 py-1.5 text-right">
                    <Button variant="ghost" onClick={() => setViewRun(r)}>Ver</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ReportCard>

      {skillModal && (
        <SkillModal initial={skillModal.id ? skillModal : null} onClose={() => setSkillModal(null)} onSubmit={saveSkill} />
      )}
      {runModal && (
        <RunSkillModal skill={runModal} onClose={() => setRunModal(null)} onRun={executarSkill} />
      )}
      {viewRun && (
        <Modal title={`${viewRun.skillCodigo} — ${viewRun.skillTitulo}`} onClose={() => setViewRun(null)} xwide>
          <div className="rounded-lg p-4 whitespace-pre-wrap text-sm max-h-[70vh] overflow-y-auto" style={{ background: "#FAFAF7", border: `1px solid ${COLORS.border}`, color: COLORS.ink }}>
            {viewRun.resultado}
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Documentos Recebidos — caixa de entrada do link de upload sem login   */
/* ---------------------------------------------------------------------- */
const CHAMADOS_KANBAN_COLUNAS = [
  { key: "pendente", label: "Pendente", tone: "amber" },
  { key: "em_analise", label: "Em análise", tone: "gold" },
  { key: "aguardando_cliente", label: "Aguardando cliente", tone: "blue" },
  { key: "processado", label: "Resolvido", tone: "green" },
];

// Quadro Kanban de Chamados — mesma tabela documentUploads de sempre (tem
// arquivo puro pra lançar e/ou mensagem de cliente, misturados), só que
// agora com 2 estágios intermediários entre "pendente" e "processado".
// Arrastar só troca o status, igual o botão que já existia fazia — não
// cria lançamento nenhum sozinho (isso só acontece via "Visualizar
// documento e classificar", como sempre foi).
function ChamadosKanban({ uploads, onMoveStatus, onPreview, onReply, onDelete }) {
  const [dragId, setDragId] = useState(null);
  const porColuna = (key) => uploads.filter((u) => u.status === key);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      {CHAMADOS_KANBAN_COLUNAS.map((col) => {
        const itens = porColuna(col.key);
        return (
          <div
            key={col.key}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (dragId) onMoveStatus(dragId, col.key); setDragId(null); }}
            className="rounded-xl p-2.5 min-h-[140px]"
            style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}` }}
          >
            <p className="text-xs font-semibold mb-2 px-1 flex items-center justify-between" style={{ color: COLORS.inkSoft }}>
              {col.label} <Badge tone={col.tone}>{itens.length}</Badge>
            </p>
            <div className="space-y-2">
              {itens.map((u) => (
                <div
                  key={u.id}
                  draggable
                  onDragStart={() => setDragId(u.id)}
                  className="rounded-lg p-2.5 cursor-grab active:cursor-grabbing"
                  style={{ background: "#fff", border: `1px solid ${COLORS.border}`, boxShadow: "0 1px 2px rgba(31,58,52,0.06)" }}
                >
                  {u.fileName && (
                    <button onClick={() => onPreview(u)} className="text-sm font-medium hover:underline text-left block truncate w-full" style={{ color: COLORS.ink }} title="Visualizar documento e classificar">
                      {u.fileName}
                    </button>
                  )}
                  {u.mensagemCliente && (
                    <p className="text-xs mt-0.5 line-clamp-3" style={{ color: u.fileName ? COLORS.inkSoft : COLORS.ink }}>{u.mensagemCliente}</p>
                  )}
                  {u.respostaGestor && (
                    <p className="text-xs mt-1" style={{ color: COLORS.green }}>Respondido: "{u.respostaGestor}"</p>
                  )}
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-xs" style={{ color: COLORS.inkSoft }}>{timeAgo(u.created_at)}</span>
                    <div className="flex gap-1">
                      <button onClick={() => onReply(u)} title="Responder" className="p-1 rounded-md hover:bg-black/5"><MessageCircle size={13} color={COLORS.primary} /></button>
                      <button onClick={() => onDelete(u.id)} title="Excluir" className="p-1 rounded-md hover:bg-black/5"><Trash2 size={13} color={COLORS.red} /></button>
                    </div>
                  </div>
                </div>
              ))}
              {itens.length === 0 && (
                <p className="text-xs text-center py-4" style={{ color: COLORS.inkSoft }}>Arraste um cartão pra aqui</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DocumentUploadsView({ uploads, empresas, selectedEmpresa, userEmail, onSave, onProcess, processError }) {
  const [preview, setPreview] = useState(null); // { item, url }
  const [previewError, setPreviewError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [replyModal, setReplyModal] = useState(null); // item sendo respondido
  const [replyText, setReplyText] = useState("");
  const [modoChamados, setModoChamados] = useState("lista"); // "lista" | "quadro"

  const empresaAtual = empresas.find((e) => e.id === selectedEmpresa);

  const visible = uploads
    .filter((u) => u.empresaId === selectedEmpresa)
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

  const setStatus = (id, status) => onSave(uploads.map((u) => (u.id === id ? { ...u, status } : u)));
  const remove = (id) => {
    if (!confirmDelete("Excluir este documento da caixa de entrada? O arquivo enviado não pode ser recuperado depois.")) return;
    onSave(uploads.filter((u) => u.id !== id));
  };

  // A resposta fica salva no histórico (o cliente vê reabrindo o mesmo
  // link de upload) e, se a empresa tiver celular cadastrado, abre o
  // WhatsApp com o texto pronto — mesmo padrão zero-custo (wa.me, sem API
  // paga) já usado no resto do sistema pra notificar o dono.
  const enviarResposta = () => {
    if (!replyText.trim()) return;
    const agora = new Date().toISOString();
    onSave(uploads.map((u) => (u.id === replyModal.id ? { ...u, respostaGestor: replyText.trim(), respostaEm: agora, respostaPor: userEmail } : u)));
    if (empresaAtual?.contatoCelular) openWhatsApp(empresaAtual.contatoCelular, replyText.trim());
    setReplyModal(null);
    setReplyText("");
  };

  const openPreview = async (item) => {
    setPreviewError("");
    setPreview({ item, url: null });
    const { data, error } = await supabase.storage.from("documentos-recebidos").createSignedUrl(item.storagePath, 300);
    if (error) {
      setPreviewError("Não consegui abrir o arquivo: " + error.message);
      return;
    }
    setPreview({ item, url: data.signedUrl });
  };

  const handleProcess = async (context) => {
    setProcessing(true);
    await onProcess(preview.item, context);
    setProcessing(false);
    setPreview(null);
  };

  return (
    <div className="space-y-4">
      <Header title="Documentos Recebidos" subtitle="Arquivos e mensagens que os clientes enviaram pelo link sem precisar logar no sistema — responda por aqui, sem expor o financeiro a eles." />
      {processError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: COLORS.redSoft, color: COLORS.red }}>
          <AlertTriangle size={15} /> {processError}
        </div>
      )}
      {visible.length > 0 && (
        <div className="inline-flex rounded-lg overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
          <button
            onClick={() => setModoChamados("lista")}
            className="px-3 py-1.5 text-sm"
            style={{ background: modoChamados === "lista" ? COLORS.primary : "transparent", color: modoChamados === "lista" ? "#fff" : COLORS.inkSoft }}
          >
            Lista
          </button>
          <button
            onClick={() => setModoChamados("quadro")}
            className="px-3 py-1.5 text-sm"
            style={{ background: modoChamados === "quadro" ? COLORS.primary : "transparent", color: modoChamados === "quadro" ? "#fff" : COLORS.inkSoft }}
          >
            Quadro
          </button>
        </div>
      )}

      {visible.length > 0 && modoChamados === "quadro" ? (
        <ChamadosKanban
          uploads={visible}
          onMoveStatus={setStatus}
          onPreview={openPreview}
          onReply={(u) => { setReplyModal(u); setReplyText(u.respostaGestor || ""); }}
          onDelete={remove}
        />
      ) : (
      <Card className="overflow-x-auto">
        {visible.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Nenhum documento ou mensagem recebida"
            subtitle='Copie o link de upload no ícone "🔗" do card da empresa (tela Empresas) e envie pro cliente — o que ele mandar (arquivo e/ou mensagem) aparece aqui.'
          />
        ) : (
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
                <th className="text-left font-medium px-4 py-2.5">Arquivo / mensagem</th>
                <th className="text-left font-medium px-4 py-2.5">Recebido</th>
                <th className="text-left font-medium px-4 py-2.5">Status</th>
                <th className="text-right font-medium px-4 py-2.5">Ações</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => (
                <tr key={u.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                  <td className="px-4 py-2.5" style={{ color: COLORS.ink }}>
                    {u.fileName && (
                      <button onClick={() => openPreview(u)} className="hover:underline text-left block" title="Visualizar documento e classificar">
                        {u.fileName}
                      </button>
                    )}
                    {u.mensagemCliente && (
                      <p className={u.fileName ? "text-xs mt-0.5" : ""} style={{ color: u.fileName ? COLORS.inkSoft : COLORS.ink }}>{u.mensagemCliente}</p>
                    )}
                    {u.respostaGestor && (
                      <p className="text-xs mt-0.5" style={{ color: COLORS.green }}>Respondido: "{u.respostaGestor}"</p>
                    )}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: COLORS.inkSoft }}>{timeAgo(u.created_at)}</td>
                  <td className="px-4 py-2.5">
                    <Select value={u.status} onChange={(e) => setStatus(u.id, e.target.value)} style={{ height: 30, padding: "0 8px" }}>
                      {CHAMADOS_KANBAN_COLUNAS.map((col) => <option key={col.key} value={col.key}>{col.label}</option>)}
                    </Select>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      {u.fileName && (
                        <button onClick={() => openPreview(u)} title="Visualizar documento e classificar" className="p-1.5 rounded-md hover:bg-black/5">
                          <FileText size={14} color={COLORS.inkSoft} />
                        </button>
                      )}
                      <button onClick={() => { setReplyModal(u); setReplyText(u.respostaGestor || ""); }} title="Responder" className="p-1.5 rounded-md hover:bg-black/5">
                        <MessageCircle size={14} color={COLORS.primary} />
                      </button>
                      <button onClick={() => remove(u.id)} title="Excluir da caixa de entrada" className="p-1.5 rounded-md hover:bg-black/5">
                        <Trash2 size={14} color={COLORS.red} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      )}

      {preview && (
        <Modal title={preview.item.fileName} onClose={() => setPreview(null)} wide>
          {previewError && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm mb-3" style={{ background: COLORS.redSoft, color: COLORS.red }}>
              <AlertTriangle size={15} /> {previewError}
            </div>
          )}
          <div className="rounded-lg overflow-hidden mb-4" style={{ border: `1px solid ${COLORS.border}`, background: "#FAFAF7", height: "60vh" }}>
            {!preview.url ? (
              <div className="w-full h-full flex items-center justify-center">
                <p className="text-sm" style={{ color: COLORS.inkSoft }}>Carregando…</p>
              </div>
            ) : preview.item.mediaType === "application/pdf" ? (
              <iframe src={preview.url} title={preview.item.fileName} className="w-full h-full" style={{ border: "none" }} />
            ) : (
              <img src={preview.url} alt={preview.item.fileName} className="w-full h-full object-contain" />
            )}
          </div>
          <p className="text-sm mb-2 font-medium" style={{ color: COLORS.ink }}>Classificar como:</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => handleProcess("payable")} disabled={processing}>
              <ArrowUpCircle size={15} /> Conta a Pagar
            </Button>
            <Button onClick={() => handleProcess("receivable")} disabled={processing}>
              <ArrowDownCircle size={15} /> Conta a Receber
            </Button>
            <Button onClick={() => handleProcess("bankEntry")} disabled={processing}>
              <Wallet size={15} /> Lançamento Bancário
            </Button>
            <Button variant="ghost" onClick={() => setPreview(null)} disabled={processing}>Cancelar</Button>
          </div>
          {processing && <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>Lendo documento com IA…</p>}
        </Modal>
      )}

      {replyModal && (
        <Modal title="Responder" onClose={() => setReplyModal(null)}>
          <div className="grid gap-3">
            {replyModal.mensagemCliente && (
              <div className="px-3 py-2 rounded-lg text-sm" style={{ background: "#FAFAF7", color: COLORS.inkSoft }}>
                "{replyModal.mensagemCliente}"
              </div>
            )}
            <Field label="Sua resposta">
              <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={3} className={inputCls} style={inputStyle} autoFocus />
            </Field>
            {!empresaAtual?.contatoCelular && (
              <p className="text-xs" style={{ color: COLORS.amber }}>Essa empresa não tem celular de contato cadastrado — a resposta fica salva no histórico (o cliente vê reabrindo o link de upload), mas não abre o WhatsApp automaticamente.</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setReplyModal(null)}>Cancelar</Button>
              <Button onClick={enviarResposta} disabled={!replyText.trim()}>
                <MessageCircle size={14} /> {empresaAtual?.contatoCelular ? "Salvar e enviar por WhatsApp" : "Salvar resposta"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Lixeira — itens excluídos de qualquer módulo, com opção de restaurar  */
/* ---------------------------------------------------------------------- */
function LixeiraView({
  empresas, payables, receivables, bankEntries, transfers, fiscalObligations, contacts,
  onRestorePayables, onRestoreReceivables, onRestoreBankEntries, onRestoreTransfers, onRestoreFiscal, onRestoreContacts,
}) {
  const empresaNome = (id) => empresas.find((e) => e.id === id)?.nome || "—";

  const items = [
    ...payables.filter((p) => p.deletedAt).map((p) => ({
      id: p.id, tipo: "Conta a pagar", icon: ArrowUpCircle, tone: "red",
      titulo: p.fornecedor || p.descricao || "—", valor: p.valor, data: p.vencimento,
      empresaId: p.empresaId, deletedAt: p.deletedAt,
      restore: () => onRestorePayables(payables.map((x) => (x.id === p.id ? { ...x, deletedAt: null } : x))),
    })),
    ...receivables.filter((r) => r.deletedAt).map((r) => ({
      id: r.id, tipo: "Conta a receber", icon: ArrowDownCircle, tone: "green",
      titulo: r.cliente || r.descricao || "—", valor: r.valor, data: r.vencimento,
      empresaId: r.empresaId, deletedAt: r.deletedAt,
      restore: () => onRestoreReceivables(receivables.map((x) => (x.id === r.id ? { ...x, deletedAt: null } : x))),
    })),
    ...bankEntries.filter((b) => b.deletedAt).map((b) => ({
      id: b.id, tipo: "Lançamento bancário", icon: Wallet, tone: "gold",
      titulo: b.descricao || b.categoria || "—", valor: b.valor, data: b.data,
      empresaId: b.empresaId, deletedAt: b.deletedAt,
      restore: () => onRestoreBankEntries(bankEntries.map((x) => (x.id === b.id ? { ...x, deletedAt: null } : x))),
    })),
    ...transfers.filter((t) => t.deletedAt).map((t) => ({
      id: t.id, tipo: "Transferência", icon: ArrowLeftRight, tone: "neutral",
      titulo: t.descricao || "—", valor: t.valor, data: t.data,
      empresaId: t.empresaId, deletedAt: t.deletedAt,
      restore: () => onRestoreTransfers(transfers.map((x) => (x.id === t.id ? { ...x, deletedAt: null } : x))),
    })),
    ...fiscalObligations.filter((o) => o.deletedAt).map((o) => ({
      id: o.id, tipo: "Obrigação fiscal", icon: Calendar, tone: "amber",
      titulo: o.tributo || o.descricao || "—", valor: o.valor, data: o.vencimento,
      empresaId: o.empresaId, deletedAt: o.deletedAt,
      restore: () => onRestoreFiscal(fiscalObligations.map((x) => (x.id === o.id ? { ...x, deletedAt: null } : x))),
    })),
    ...contacts.filter((c) => c.deletedAt).map((c) => ({
      id: c.id, tipo: "Contato", icon: Contact, tone: "neutral",
      titulo: c.nome || "—", valor: null, data: null,
      empresaId: c.empresaId, deletedAt: c.deletedAt,
      restore: () => onRestoreContacts(contacts.map((x) => (x.id === c.id ? { ...x, deletedAt: null } : x))),
    })),
  ].sort((a, b) => (b.deletedAt || "").localeCompare(a.deletedAt || ""));

  return (
    <div className="space-y-4">
      <Header title="Lixeira" subtitle="Itens excluídos de qualquer módulo. Nada aqui é apagado de vez — restaure quando quiser." />
      <Card className="overflow-x-auto">
        {items.length === 0 ? (
          <EmptyState icon={Trash2} title="Lixeira vazia" subtitle="Itens excluídos de Contas a Pagar, a Receber, Lançamentos Bancários, Transferências, Calendário Fiscal e Contatos aparecem aqui." />
        ) : (
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
                <th className="text-left font-medium px-4 py-2.5">Tipo</th>
                <th className="text-left font-medium px-4 py-2.5">Descrição</th>
                <th className="text-left font-medium px-4 py-2.5">Empresa</th>
                <th className="text-right font-medium px-4 py-2.5">Valor</th>
                <th className="text-left font-medium px-4 py-2.5">Excluído em</th>
                <th className="text-right font-medium px-4 py-2.5">Ação</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const Icon = item.icon;
                const iconColor = { red: COLORS.red, green: COLORS.green, gold: COLORS.gold, amber: COLORS.amber, neutral: COLORS.inkSoft }[item.tone] || COLORS.inkSoft;
                return (
                  <tr key={`${item.tipo}-${item.id}`} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5" style={{ color: iconColor }}>
                        <Icon size={14} /> {item.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-2.5" style={{ color: COLORS.ink }}>{item.titulo}</td>
                    <td className="px-4 py-2.5" style={{ color: COLORS.inkSoft }}>{empresaNome(item.empresaId)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: COLORS.ink }}>{item.valor != null ? fmtBRL(item.valor) : "—"}</td>
                    <td className="px-4 py-2.5" style={{ color: COLORS.inkSoft }}>{fmtDate(item.deletedAt?.slice(0, 10))}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={item.restore}
                        className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full"
                        style={{ background: COLORS.greenSoft, color: COLORS.green }}
                      >
                        <Check size={12} /> Restaurar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Visão Geral (dashboard do gestor — landing pós-login)                  */
/* ---------------------------------------------------------------------- */
function GestorDashboard({ empresas, empresaBreakdown, year, documentUploads, onOpenEmpresa }) {
  if (empresas.length === 0) {
    return (
      <div className="space-y-4">
        <Header title="Visão Geral" subtitle="Seu portfólio de empresas atendidas." />
        <Card className="p-8">
          <EmptyState icon={Building2} title="Nenhuma empresa cadastrada" subtitle="Cadastre a primeira empresa em “Empresas” pra começar." />
        </Card>
      </div>
    );
  }

  // Portfólio do analista BPO: quantas empresas ele atende, de que tipo, e
  // o que está pendente — não o financeiro consolidado (cada empresa tem
  // sua própria contabilidade; misturar os valores de clientes diferentes
  // não faz sentido de negócio pra quem presta o serviço).
  const segmentoCounts = empresas.reduce((acc, e) => {
    if (e.segmento) acc[e.segmento] = (acc[e.segmento] || 0) + 1;
    return acc;
  }, {});
  // Documentos pendentes deixou de ser um total agregado do portfólio —
  // agora é um badge por empresa (nos cards abaixo), mais fácil de agir em
  // cima do que um número solto que não diz qual cliente está parado.
  const pendentesPorEmpresa = (empId) => documentUploads.filter((u) => u.empresaId === empId && u.status !== "processado").length;

  return (
    <div className="space-y-4">
      <Header title="Visão Geral" subtitle="Seu portfólio de empresas atendidas." />

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-xs" style={{ color: COLORS.inkSoft }}>Clientes ativos</p>
          <p className="text-lg font-semibold" style={{ color: COLORS.ink }}>{empresas.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs" style={{ color: COLORS.inkSoft }}>Segmentos atendidos</p>
          <p className="text-lg font-semibold" style={{ color: COLORS.ink }}>{Object.keys(segmentoCounts).length || "—"}</p>
        </Card>
      </div>

      {Object.keys(segmentoCounts).length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium" style={{ color: COLORS.inkSoft }}>Por atividade:</span>
          {Object.entries(segmentoCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([seg, count]) => (
              <Badge key={seg} tone="neutral">{seg} · {count}</Badge>
            ))}
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {empresaBreakdown.map(({ empresa, entradas, saidas, saldo, saldoContas }) => (
          <Card
            key={empresa.id}
            className="p-4 text-left cursor-pointer hover:shadow-sm transition-shadow"
            style={{ cursor: "pointer" }}
          >
            <button onClick={() => onOpenEmpresa(empresa.id)} className="w-full text-left">
              <div className="flex items-center gap-2.5 mb-3">
                {empresa.logoUrl ? (
                  <img src={empresa.logoUrl} alt="" className="w-9 h-9 rounded-full object-cover" style={{ border: `1px solid ${COLORS.border}` }} />
                ) : (
                  <span className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white" style={{ background: empresa.cor }}>
                    {empresa.nome.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <p className="font-semibold text-sm flex items-center gap-1.5 min-w-0" style={{ color: COLORS.ink }}>
                  <span className="truncate">{empresa.nome}</span>
                  {pendentesPorEmpresa(empresa.id) > 0 && (
                    <Badge tone="amber"><Inbox size={11} /> {pendentesPorEmpresa(empresa.id)}</Badge>
                  )}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p style={{ color: COLORS.inkSoft }}>Entradas</p>
                  <p className="font-medium tabular-nums" style={{ color: COLORS.green }}>{fmtBRL(entradas)}</p>
                </div>
                <div>
                  <p style={{ color: COLORS.inkSoft }}>Saídas</p>
                  <p className="font-medium tabular-nums" style={{ color: COLORS.red }}>{fmtBRL(saidas)}</p>
                </div>
                <div>
                  <p style={{ color: COLORS.inkSoft }}>Resultado</p>
                  <p className="font-medium tabular-nums" style={{ color: saldo >= 0 ? COLORS.green : COLORS.red }}>{fmtBRL(saldo)}</p>
                </div>
                <div>
                  <p style={{ color: COLORS.inkSoft }}>Saldo em contas</p>
                  <p className="font-medium tabular-nums" style={{ color: COLORS.ink }}>{fmtBRL(saldoContas)}</p>
                </div>
              </div>
            </button>
          </Card>
        ))}
      </div>

      <ComparativoReport empresaBreakdown={empresaBreakdown} />
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Resumo (visão estilo BPO — saldo, fluxo navegável, próximos/aberto/vencido) */
/* ---------------------------------------------------------------------- */
// Fluxo de caixa diário (não mais por mês): projeta o saldo dia a dia a
// partir do saldo real de hoje, somando o que já foi realizado nos
// últimos PAST_DAYS (reconstrução pra desenhar o trecho sólido do
// gráfico) e o que está agendado/a vencer nos próximos FUTURE_DAYS
// (trecho pontilhado). Além de montar a série, já diagnostica: se o
// saldo projetado vai ficar negativo em algum dia futuro, e se existe um
// único recebível futuro que, antecipado, cobriria o buraco sozinho —
// pra não só mostrar o problema, mas já sugerir a saída (diferente do
// usuário ter que interpretar o gráfico por conta própria).
const FLUXO_PAST_DAYS = 10;
const FLUXO_FUTURE_DAYS = 20;

function addDaysISO(iso, n) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function dailyCashFlow(payables, receivables, bankEntries, totalBalance) {
  const hoje = todayISO();
  const inicioJanela = addDaysISO(hoje, -FLUXO_PAST_DAYS);
  const limiteFuturo = addDaysISO(hoje, FLUXO_FUTURE_DAYS);

  const passados = [];
  receivables.forEach((r) => {
    if (r.status === "Recebido" && r.dataReceb >= inicioJanela && r.dataReceb < hoje) {
      passados.push({ nome: r.cliente, data: r.dataReceb, valor: Number(r.valorRecebido || r.valor || 0), tipo: "entrada" });
    }
  });
  payables.forEach((p) => {
    if (p.status === "Pago" && p.dataPgto >= inicioJanela && p.dataPgto < hoje) {
      passados.push({ nome: p.fornecedor, data: p.dataPgto, valor: Number(p.valorPago || p.valor || 0), tipo: "saida" });
    }
  });
  bankEntries.forEach((b) => {
    if (b.data >= inicioJanela && b.data < hoje) {
      passados.push({ nome: b.descricao || "Lançamento bancário", data: b.data, valor: Number(b.valor || 0), tipo: b.tipo === "Entrada" ? "entrada" : "saida" });
    }
  });
  passados.sort((a, b) => a.data.localeCompare(b.data));

  const futuros = [];
  receivables.forEach((r) => {
    if (r.status !== "Recebido" && r.vencimento > hoje && r.vencimento <= limiteFuturo) {
      futuros.push({ id: r.id, nome: r.cliente, data: r.vencimento, valor: Number(r.valor || 0), tipo: "entrada" });
    }
  });
  payables.forEach((p) => {
    if (p.status !== "Pago" && p.vencimento > hoje && p.vencimento <= limiteFuturo) {
      futuros.push({ id: p.id, nome: p.fornecedor, data: p.vencimento, valor: Number(p.valor || 0), tipo: "saida" });
    }
  });
  futuros.sort((a, b) => a.data.localeCompare(b.data));

  const totalPassados = passados.reduce((s, e) => s + (e.tipo === "entrada" ? e.valor : -e.valor), 0);
  let saldoCursor = totalBalance - totalPassados; // saldo no início da janela (PAST_DAYS atrás)
  const pontos = [];
  for (let off = -FLUXO_PAST_DAYS; off <= FLUXO_FUTURE_DAYS; off++) {
    const data = addDaysISO(hoje, off);
    if (off > -FLUXO_PAST_DAYS) {
      const evDia = off < 0 ? passados.filter((e) => e.data === data) : off > 0 ? futuros.filter((e) => e.data === data) : [];
      evDia.forEach((e) => { saldoCursor += e.tipo === "entrada" ? e.valor : -e.valor; });
    }
    pontos.push({ offset: off, data, saldo: saldoCursor });
  }

  const diaCritico = pontos.find((p) => p.offset > 0 && p.saldo < 0);
  let diagnostico = null;
  if (diaCritico) {
    const deficit = Math.abs(diaCritico.saldo);
    const candidatos = futuros
      .filter((e) => e.tipo === "entrada" && e.data > diaCritico.data && e.valor >= deficit)
      .sort((a, b) => a.data.localeCompare(b.data) || a.valor - b.valor);
    diagnostico = { data: diaCritico.data, deficit, sugestao: candidatos[0] || null };
  }

  return { pontos, passados, futuros, diagnostico };
}

// Lista simples de itens (já filtrados por status) ordenada por vencimento
// — cada aba do ExposureCard já chega aqui só com o que pertence àquele
// status, então não precisa mais filtrar/agrupar por data aqui dentro.
function ExposureTable({ items, nameField }) {
  const rows = [...items].sort((a, b) => (a.vencimento || "").localeCompare(b.vencimento || ""));
  const total = rows.reduce((s, i) => s + Number(i.valor || 0), 0);
  if (rows.length === 0) return <p className="text-sm py-6 text-center" style={{ color: COLORS.inkSoft }}>Nada por aqui.</p>;
  return (
    <div>
      <div className="flex justify-between text-sm pb-2 mb-2 font-semibold" style={{ borderBottom: `1px solid ${COLORS.border}`, color: COLORS.ink }}>
        <span>Total</span>
        <span className="tabular-nums">{fmtBRL(total)}</span>
      </div>
      <div className="space-y-1.5">
        {rows.map((i) => (
          <div key={i.id} className="flex items-center justify-between text-sm py-1" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
            <div>
              <p style={{ color: COLORS.ink }}>{i[nameField]}</p>
              <p className="text-xs" style={{ color: COLORS.inkSoft }}>{fmtDate(i.vencimento)}</p>
            </div>
            <p className="font-medium tabular-nums" style={{ color: COLORS.ink }}>{fmtBRL(i.valor)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// tipo: "pagar" | "receber" — mesma classificação (statusDisplay) e mesmo
// vocabulário já usados em Contas a Pagar/Receber (Atrasado/Inadimplente,
// Próximo (10 dias), A Pagar/A Receber), pra não ter um "Vencido"/"Em
// aberto" genérico aqui e "Atrasado"/"A Pagar" lá — a mesma palavra deve
// sempre significar a mesma coisa em todo o sistema.
function ExposureCard({ title, items, nameField, tipo }) {
  const statusBase = tipo === "pagar" ? "A Pagar" : "A Receber";
  const statusAtrasado = tipo === "pagar" ? "Atrasado" : "Inadimplente";
  const withDerived = items
    .filter((i) => i.status === statusBase)
    .map((i) => {
      let statusDisplay = statusBase;
      if (i.vencimento < todayISO()) statusDisplay = statusAtrasado;
      else if (daysUntil(i.vencimento) <= 10) statusDisplay = "Próximo";
      return { ...i, statusDisplay };
    });

  const tabs = [
    { id: statusAtrasado, label: statusAtrasado },
    { id: "Próximo", label: "Próximo (10 dias)" },
    { id: statusBase, label: statusBase === "A Pagar" ? "A pagar" : "A receber" },
  ];
  const [tab, setTab] = useState(statusAtrasado);
  const pool = withDerived.filter((i) => i.statusDisplay === tab);

  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold mb-3" style={{ color: COLORS.ink }}>{title}</h2>
      <div className="flex gap-1 mb-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-2.5 py-1 rounded-full text-xs font-medium"
            style={{ background: tab === t.id ? COLORS.primary : "#EFEEE8", color: tab === t.id ? "#fff" : COLORS.ink }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <ExposureTable items={pool} nameField={nameField} />
    </Card>
  );
}

function ResumoView({ accounts, payables, receivables, bankEntries, transfers, accountBalance, totalBalance, accountAvailableBalance, totalAvailableBalance, goToView }) {
  const { pontos, passados, futuros, diagnostico } = useMemo(
    () => dailyCashFlow(payables, receivables, bankEntries, totalBalance),
    [payables, receivables, bankEntries, totalBalance]
  );

  const W = 760, H = 190, padX = 6, baseY = 150, topY = 10;
  const saldos = pontos.map((p) => p.saldo);
  const min = Math.min(0, ...saldos), max = Math.max(0, ...saldos);
  const xFor = (i) => padX + (i / (pontos.length - 1)) * (W - padX * 2);
  const yFor = (v) => baseY - ((v - min) / (max - min || 1)) * (baseY - topY);
  const hojeIdx = pontos.findIndex((p) => p.offset === 0);
  const zeroY = yFor(0);
  const hojeX = xFor(hojeIdx);
  const realizadoPts = pontos.slice(0, hojeIdx + 1).map((p, i) => `${xFor(i)},${yFor(p.saldo)}`).join(" ");
  const projetadoPts = pontos.slice(hojeIdx).map((p, i) => `${xFor(i + hojeIdx)},${yFor(p.saldo)}`).join(" ");
  const tickOffsets = [-FLUXO_PAST_DAYS, -Math.round(FLUXO_PAST_DAYS / 2), 0, Math.round(FLUXO_FUTURE_DAYS / 2), FLUXO_FUTURE_DAYS];
  const tickLabels = tickOffsets.map((off) => {
    const idx = pontos.findIndex((p) => p.offset === off);
    return { x: xFor(idx), label: off === 0 ? "Hoje" : fmtDate(pontos[idx].data).slice(0, 5) };
  });

  return (
    <div className="space-y-4">
      <Header title="Resumo" subtitle="Saldos, fluxo de caixa e o que está por vir — tudo em um lugar." />

      <Card className="p-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold" style={{ color: COLORS.ink }}>Saldo</h2>
          <p className="text-lg font-semibold tabular-nums" style={{ color: COLORS.ink }}>{fmtBRL(totalBalance)}</p>
        </div>
        {totalAvailableBalance !== totalBalance && (
          <p className="text-xs mb-2" style={{ color: COLORS.inkSoft }}>
            Disponível após agendamentos: <span className="font-medium">{fmtBRL(totalAvailableBalance)}</span>
          </p>
        )}
        {accounts.length === 0 ? (
          <p className="text-sm" style={{ color: COLORS.inkSoft }}>Nenhuma conta cadastrada.</p>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-1.5">
            {accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm py-1" style={{ borderTop: `1px solid ${COLORS.border}` }}>
                <div>
                  <p style={{ color: COLORS.ink }}>{a.nome}</p>
                  <p className="text-xs" style={{ color: COLORS.inkSoft }}>{a.tipo}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium tabular-nums" style={{ color: COLORS.ink }}>{fmtBRL(accountBalance(a.id))}</p>
                  {accountAvailableBalance(a.id) !== accountBalance(a.id) && (
                    <p className="text-xs tabular-nums" style={{ color: COLORS.inkSoft }}>disp. {fmtBRL(accountAvailableBalance(a.id))}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold" style={{ color: COLORS.ink }}>Fluxo de caixa</h2>
          <div className="flex items-center gap-4 text-xs" style={{ color: COLORS.inkSoft }}>
            <span className="flex items-center gap-1.5"><span style={{ width: 14, height: 2, background: COLORS.green, display: "inline-block" }} />Realizado</span>
            <span className="flex items-center gap-1.5"><span style={{ width: 14, height: 0, borderTop: `2px dashed ${COLORS.gold}`, display: "inline-block" }} />Projetado</span>
          </div>
        </div>
        <p className="text-xs mb-3" style={{ color: COLORS.inkSoft }}>Saldo dia a dia, com o que já foi agendado — se a linha cruzar o zero, ainda dá tempo de agir.</p>

        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ overflow: "visible" }}>
          <line x1={0} y1={zeroY} x2={W} y2={zeroY} stroke={COLORS.border} strokeWidth="1" strokeDasharray="4 4" />
          <line x1={hojeX} y1={8} x2={hojeX} y2={baseY} stroke={COLORS.inkSoft} strokeWidth="1" strokeDasharray="3 3" />
          <text x={hojeX} y={baseY + 14} textAnchor="middle" fontSize="10.5" fontWeight="700" fill={COLORS.ink}>Hoje</text>
          <polyline points={realizadoPts} fill="none" stroke={COLORS.green} strokeWidth="2.5" />
          <polyline points={projetadoPts} fill="none" stroke={COLORS.gold} strokeWidth="2.5" strokeDasharray="6 5" />
          {tickLabels.map((t, i) => (
            <text key={i} x={t.x} y={baseY + 28} textAnchor="middle" fontSize="10" fill="#8A8678">{t.label}</text>
          ))}
          {diagnostico && (
            <circle cx={xFor(pontos.findIndex((p) => p.data === diagnostico.data))} cy={yFor(-diagnostico.deficit)} r="3.5" fill={COLORS.red} />
          )}
        </svg>

        {diagnostico ? (
          <div className="mt-2 p-3 rounded-lg" style={{ background: COLORS.redSoft }}>
            <p className="text-xs font-semibold" style={{ color: COLORS.red }}>
              ⚠ O saldo projetado fica negativo ({fmtBRL(-diagnostico.deficit)}) em {fmtDate(diagnostico.data)}.
            </p>
            {diagnostico.sugestao ? (
              <div className="flex items-center justify-between gap-2 mt-1.5">
                <p className="text-xs" style={{ color: COLORS.ink }}>
                  Antecipando o recebível de <strong>{diagnostico.sugestao.nome}</strong> ({fmtBRL(diagnostico.sugestao.valor)}, venc. {fmtDate(diagnostico.sugestao.data)}) resolve.
                </p>
                <Button variant="subtle" onClick={() => goToView && goToView("receivables")} style={{ padding: "5px 11px", fontSize: 12, whiteSpace: "nowrap" }}>
                  Ver em Contas a Receber
                </Button>
              </div>
            ) : (
              <p className="text-xs mt-1" style={{ color: COLORS.ink }}>Nenhum recebível futuro sozinho cobre o buraco — vale revisar pagamentos ou negociar prazo com fornecedor.</p>
            )}
          </div>
        ) : (
          <p className="text-xs font-medium mt-2" style={{ color: COLORS.green }}>✓ O saldo projetado não fica negativo nos próximos {FLUXO_FUTURE_DAYS} dias.</p>
        )}

        <div className="grid md:grid-cols-2 gap-5 mt-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: COLORS.inkSoft }}>Agendamentos passados</p>
            {passados.length === 0 ? (
              <p className="text-xs" style={{ color: COLORS.inkSoft }}>Nada nos últimos {FLUXO_PAST_DAYS} dias.</p>
            ) : (
              passados.map((e, i) => (
                <div key={i} className="flex items-center justify-between py-1.5" style={{ borderBottom: i < passados.length - 1 ? `1px solid #F0EEE7` : "none" }}>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs" style={{ color: COLORS.ink }}>{e.nome}</p>
                    <p className="text-[11px]" style={{ color: COLORS.inkSoft }}>{fmtDate(e.data)}</p>
                  </div>
                  <p className="text-xs font-semibold tabular-nums" style={{ color: e.tipo === "entrada" ? COLORS.green : COLORS.red }}>
                    {e.tipo === "entrada" ? "+" : "−"}{fmtBRL(e.valor)}
                  </p>
                </div>
              ))
            )}
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: COLORS.inkSoft }}>Agendamentos futuros</p>
            {futuros.length === 0 ? (
              <p className="text-xs" style={{ color: COLORS.inkSoft }}>Nada nos próximos {FLUXO_FUTURE_DAYS} dias.</p>
            ) : (
              futuros.map((e, i) => (
                <div key={i} className="flex items-center justify-between py-1.5" style={{ borderBottom: i < futuros.length - 1 ? `1px solid #F0EEE7` : "none" }}>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs" style={{ color: COLORS.ink }}>{e.nome}</p>
                    <p className="text-[11px]" style={{ color: COLORS.inkSoft }}>{fmtDate(e.data)}</p>
                  </div>
                  <p className="text-xs font-semibold tabular-nums" style={{ color: e.tipo === "entrada" ? COLORS.green : COLORS.red }}>
                    {e.tipo === "entrada" ? "+" : "−"}{fmtBRL(e.valor)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-3">
        <ExposureCard title="Recebimentos" items={receivables} nameField="cliente" tipo="receber" />
        <ExposureCard title="Pagamentos" items={payables} nameField="fornecedor" tipo="pagar" />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Login                                                                  */
/* ---------------------------------------------------------------------- */
function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        // "Invalid login credentials" é o caso comum (senha errada) — qualquer
        // outro texto (rede, configuração) aparece cru, pra não esconder um
        // problema de infraestrutura atrás de uma mensagem genérica de senha.
        setError(err.message === "Invalid login credentials" ? "E-mail ou senha inválidos." : `Não consegui entrar: ${err.message}`);
      }
    } catch (e2) {
      setError(`Não consegui entrar: ${e2.message}`);
    }
    setLoading(false);
  };

  return (
    <div className="w-full min-h-screen flex items-center justify-center p-4" style={{ background: COLORS.bg, fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
      <Card className="w-full max-w-sm p-6">
        <p className="font-semibold text-base mb-0.5" style={{ color: COLORS.ink }}>ESEK</p>
        <p className="text-sm mb-5" style={{ color: COLORS.inkSoft }}>Entrar no ESEK</p>
        <form onSubmit={submit} className="grid gap-3">
          <Field label="E-mail">
            <TextInput type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@suaempresa.com.br" />
          </Field>
          <Field label="Senha">
            <TextInput type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </Field>
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: COLORS.redSoft, color: COLORS.red }}>
              <AlertTriangle size={15} /> {error}
            </div>
          )}
          <Button type="submit" disabled={loading} className="justify-center mt-1">
            {loading ? "Entrando…" : "Entrar"}
          </Button>
        </form>
        <p className="text-xs mt-4" style={{ color: COLORS.inkSoft }}>
          Acesso só pra quem já tem usuário criado. Peça pro administrador te cadastrar no Supabase.
        </p>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Upload público (sem login) — link próprio por empresa                 */
/* ---------------------------------------------------------------------- */
function PublicUploadPage({ token }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState([]); // [{fileName, empresaNome}]
  const [chamados, setChamados] = useState([]);
  const [empresaNomeHist, setEmpresaNomeHist] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

  // Sem login, esse link é a única "identidade" — recarrega o histórico de
  // chamados dessa empresa toda vez que algo novo é enviado, pra quem
  // reabrir o mesmo link depois ver a conversa (inclusive resposta do
  // analista, se já tiver alguma).
  const loadChamados = async () => {
    try {
      const { data } = await supabase.functions.invoke("public-upload", { body: { token, action: "list" } });
      if (data?.ok) {
        setChamados(data.chamados || []);
        setEmpresaNomeHist(data.empresaNome || "");
      }
    } catch {
      // histórico é um extra — se falhar, o envio continua funcionando normalmente
    }
  };

  useEffect(() => { loadChamados(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const extractErr = async (err) => {
    let detail = err.message;
    if (err.context && typeof err.context.json === "function") {
      try {
        const b = await err.context.clone().json();
        if (b?.error) detail = b.error;
      } catch {
        // corpo não era JSON — mantém a mensagem genérica
      }
    }
    return detail;
  };

  const handleFiles = async (fileList) => {
    setError("");
    setUploading(true);
    for (const file of fileList) {
      try {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("Erro lendo o arquivo."));
          reader.readAsDataURL(file);
        });
        const fileBase64 = dataUrl.split(",")[1] || "";
        const { data, error: err } = await supabase.functions.invoke("public-upload", {
          body: { token, fileBase64, mediaType: file.type, fileName: file.name },
        });
        if (err) throw new Error(await extractErr(err));
        if (!data?.ok) throw new Error(data?.error || "Não consegui enviar o arquivo.");
        setSent((prev) => [...prev, { fileName: file.name, empresaNome: data.empresaNome }]);
      } catch (err) {
        setError(err?.message || "Erro ao enviar o documento.");
      }
    }
    setUploading(false);
    loadChamados();
  };

  const enviarMensagem = async () => {
    if (!mensagem.trim()) return;
    setError("");
    setSendingMsg(true);
    try {
      const { data, error: err } = await supabase.functions.invoke("public-upload", { body: { token, mensagemCliente: mensagem.trim() } });
      if (err) throw new Error(await extractErr(err));
      if (!data?.ok) throw new Error(data?.error || "Não consegui enviar a mensagem.");
      setMensagem("");
      loadChamados();
    } catch (err) {
      setError(err?.message || "Erro ao enviar a mensagem.");
    } finally {
      setSendingMsg(false);
    }
  };

  const empresaNome = sent[0]?.empresaNome || empresaNomeHist;

  return (
    <div className="w-full min-h-screen flex items-center justify-center p-4" style={{ background: COLORS.bg, fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
      <Card className="w-full max-w-md p-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: COLORS.primary }}>
            <Sparkles size={16} color="#fff" />
          </span>
          <p className="font-semibold text-base" style={{ color: COLORS.ink }}>ESEK</p>
        </div>
        <p className="text-sm mb-5" style={{ color: COLORS.inkSoft }}>
          {empresaNome ? `Envio de documentos — ${empresaNome}` : "Envie boletos, notas fiscais, comprovantes ou uma mensagem pro seu analista, sem precisar de login."}
        </p>

        <label
          className="flex flex-col items-center justify-center gap-2 py-10 rounded-xl cursor-pointer text-center transition-colors"
          style={{ border: `2px dashed ${COLORS.border}`, background: "#FAFAF7" }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.length) handleFiles(Array.from(e.dataTransfer.files)); }}
        >
          <Upload size={22} color={COLORS.inkSoft} />
          <span className="text-sm font-medium" style={{ color: COLORS.ink }}>
            {uploading ? "Enviando…" : "Clique ou arraste o arquivo aqui"}
          </span>
          <span className="text-xs" style={{ color: COLORS.inkSoft }}>PDF, JPG, PNG ou WEBP</span>
          <input
            type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" disabled={uploading}
            onChange={(e) => { if (e.target.files?.length) handleFiles(Array.from(e.target.files)); e.target.value = ""; }}
          />
        </label>

        <div className="mt-3 flex gap-2">
          <textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            rows={2}
            placeholder="Ou escreva uma mensagem (ex.: uma dúvida, um recado)…"
            className={inputCls}
            style={inputStyle}
            disabled={sendingMsg}
          />
          <Button onClick={enviarMensagem} disabled={sendingMsg || !mensagem.trim()} className="shrink-0 self-end">
            <MessageCircle size={14} /> Enviar
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm mt-3" style={{ background: COLORS.redSoft, color: COLORS.red }}>
            <AlertTriangle size={15} /> {error}
          </div>
        )}

        {sent.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {sent.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg" style={{ background: COLORS.greenSoft, color: COLORS.green }}>
                <CheckCircle2 size={14} className="shrink-0" /> "{s.fileName}" recebido com sucesso.
              </div>
            ))}
          </div>
        )}

        {chamados.length > 0 && (
          <div className="mt-5 pt-4 space-y-2.5" style={{ borderTop: `1px solid ${COLORS.border}` }}>
            <p className="text-xs font-medium" style={{ color: COLORS.inkSoft }}>Histórico</p>
            <div className="max-h-64 overflow-y-auto space-y-2.5">
              {[...chamados].reverse().map((c) => (
                <div key={c.id} className="text-sm">
                  <p style={{ color: COLORS.ink }}>
                    {c.mensagemCliente || (c.fileName ? `Arquivo enviado: "${c.fileName}"` : "")}
                  </p>
                  <p className="text-xs" style={{ color: COLORS.inkSoft }}>{fmtDateTime(c.created_at)}</p>
                  {c.respostaGestor && (
                    <div className="mt-1 px-3 py-2 rounded-lg" style={{ background: COLORS.greenSoft }}>
                      <p style={{ color: COLORS.green }}>{c.respostaGestor}</p>
                      <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>Resposta do analista · {fmtDateTime(c.respostaEm)}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs mt-5" style={{ color: COLORS.inkSoft }}>
          Pode enviar mais de um arquivo ou mensagem. Seu analista financeiro vai revisar e responder por aqui.
        </p>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Auth gate                                                              */
/* ---------------------------------------------------------------------- */
export default function App() {
  // Link de upload sem login (?upload=<token>) — checa ANTES de qualquer
  // coisa de autenticação, porque quem abre esse link não tem (e não
  // precisa ter) usuário no ESEK.
  const uploadToken = new URLSearchParams(window.location.search).get("upload");
  if (uploadToken) return <PublicUploadPage token={uploadToken} />;

  const [session, setSession] = useState(undefined); // undefined = carregando, null = deslogado

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: COLORS.bg, minHeight: 480 }}>
        <p style={{ color: COLORS.inkSoft }} className="text-sm">Carregando sistema financeiro…</p>
      </div>
    );
  }

  if (!session) return <Login />;

  return <FinanceiroApp userEmail={session.user.email} onLogout={() => supabase.auth.signOut()} />;
}
