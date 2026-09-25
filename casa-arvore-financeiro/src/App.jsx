import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  LayoutDashboard, Wallet, ArrowDownCircle, ArrowUpCircle, Landmark,
  ArrowLeftRight, ListTree, Plus, X, Check, Trash2, Pencil, AlertTriangle,
  TrendingUp, TrendingDown, CircleDollarSign, ChevronDown, Search, Building2, FileText, Printer,
  CheckCircle2, Upload, HelpCircle, Users, Image as ImageIcon, ChevronLeft, ChevronRight, CalendarClock,
  Calendar, Bell, LogOut, Sparkles, Contact, Inbox, Link2, Copy, RotateCcw, ShieldCheck, MessageCircle, ClipboardList, Zap
} from "lucide-react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";
import { storageGet, storageSet } from "./lib/storage";
import { supabase } from "./lib/supabaseClient";

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

const DEFAULT_CATEGORIES = {
  receitas: [
    { codigo: "R01", nome: "Vendas de Produtos" },
    { codigo: "R02", nome: "Prestação de Serviços" },
    { codigo: "R03", nome: "Aluguéis Recebidos" },
    { codigo: "R04", nome: "Juros Recebidos" },
    { codigo: "R05", nome: "Outros Recebimentos" },
  ],
  despesas: [
    { codigo: "D01", nome: "Fornecedores / Compras" },
    { codigo: "D02", nome: "Salários e Pró-labore" },
    { codigo: "D03", nome: "Aluguel" },
    { codigo: "D04", nome: "Energia Elétrica" },
    { codigo: "D05", nome: "Água e Saneamento" },
    { codigo: "D06", nome: "Internet e Telefone" },
    { codigo: "D07", nome: "Contabilidade" },
    { codigo: "D08", nome: "Impostos e Taxas" },
    { codigo: "D09", nome: "Manutenção e Reparos" },
    { codigo: "D10", nome: "Material de Escritório" },
    { codigo: "D11", nome: "Marketing e Publicidade" },
    { codigo: "D12", nome: "Frete e Logística" },
    { codigo: "D13", nome: "Combustível e Transporte" },
    { codigo: "D14", nome: "Seguros" },
    { codigo: "D15", nome: "Empréstimos e Financiamentos" },
    { codigo: "D16", nome: "Despesas Bancárias" },
    { codigo: "D17", nome: "Outras Despesas" },
  ],
};

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
  return data.extracted || {};
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

const inputCls =
  "w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 transition-shadow bg-white";
const inputStyle = { border: `1px solid ${COLORS.border}` };

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
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
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
      setCategories(data.categories || DEFAULT_CATEGORIES);
      // Dono não tem visão consolidada entre empresas — pousa direto no
      // Resumo da empresa dele. Gestor pousa no Cadastro de Empresas (os
      // cards de todas), pra escolher com qual vai trabalhar.
      setSelectedEmpresa(myRole === "owner" ? (data.empresas || [])[0]?.id || null : null);
      setView(myRole === "owner" ? "resumo" : "empresas");
      setReady(true);
    })();
  }, []);

  const persist = useCallback(async (key, value, setter) => {
    setter(value);
    const ok = await saveKey(key, value);
    if (!ok) setSaveError("Não foi possível salvar agora. Suas alterações podem não persistir — tente novamente em instantes.");
    else setSaveError(null);
  }, []);

  const changeEmpresa = useCallback((id) => {
    setSelectedEmpresa(id);
    saveKey("selectedEmpresa", id);
  }, []);

  // Navegação genérica do menu (rail, painel de itens, botões "Ir para
  // Empresas"): ao voltar pra Cadastro de Empresas ou Visão Geral, a empresa
  // selecionada é esquecida de propósito — senão o operador clicava numa
  // ação (lançamento, fiscal, análise) sem escolher empresa e o sistema
  // silenciosamente reaproveitava a última empresa que ele tinha olhado.
  const goToView = useCallback((id) => {
    setView(id);
    if (id === "empresas" || id === "gestor") setSelectedEmpresa(null);
  }, []);

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

  const allCategoryNames = useMemo(
    () => [...categories.receitas.map((c) => c.nome), ...categories.despesas.map((c) => c.nome)],
    [categories]
  );

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
    { id: "dashboard", label: "Painel", icon: LayoutDashboard },
    { id: "accounts", label: "Contas", icon: Landmark },
    { id: "contacts", label: "Contatos", icon: Contact },
    { id: "payables", label: "Contas a Pagar", icon: ArrowUpCircle },
    { id: "receivables", label: "Contas a Receber", icon: ArrowDownCircle },
    { id: "bank", label: "Lançamentos Bancários", icon: Wallet },
    { id: "transfers", label: "Transferências", icon: ArrowLeftRight },
    { id: "fiscal", label: "Calendário Fiscal", icon: Calendar },
    { id: "categories", label: "Plano de Contas", icon: ListTree },
    { id: "reconciliation", label: "Conciliação Bancária", icon: CheckCircle2 },
    { id: "reports", label: "Relatórios", icon: FileText },
    { id: "documentUploads", label: "Documentos Recebidos", icon: Inbox },
    { id: "lixeira", label: "Lixeira", icon: Trash2 },
  ];
  const navById = Object.fromEntries(nav.map((n) => [n.id, n]));

  const RAIL_SECTIONS = [
    { id: "cadastros", label: "Cadastros", icon: Building2, items: ["empresas"] },
    ...(role === "gestor" ? [{ id: "visao", label: "Visão Geral", icon: Users, items: ["gestor"] }] : []),
    { id: "painel", label: "Painel", icon: LayoutDashboard, items: ["resumo", "dashboard"] },
    { id: "lancamentos", label: "Lançamentos", icon: Wallet, items: ["payables", "receivables", "bank", "transfers"] },
    { id: "fiscal", label: "Fiscal", icon: Calendar, items: ["fiscal", "categories"] },
    { id: "analise", label: "Análise", icon: FileText, items: ["reconciliation", "reports", "documentUploads", "lixeira"] },
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
                onSave={(v) => persist("empresas", v, setEmpresas)}
                onOpenAccounts={(id) => { changeEmpresa(id); setView("accounts"); }}
                onOpenContacts={(id) => { changeEmpresa(id); setView("contacts"); }}
                onOpenEmpresa={(id) => { changeEmpresa(id); setView("resumo"); }}
              />
            )}

            {view === "accounts" && (
              <AccountsView
                accounts={accounts}
                empresas={empresas}
                selectedEmpresa={selectedEmpresa}
                accountBalance={accountBalance}
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
                categories={categories.despesas}
                contacts={contacts}
                onSaveContacts={(v) => persist("contacts", v, setContacts)}
                onSave={(v) => persist("payables", v, setPayables)}
                pendingImport={pendingImport?.context === "payable" ? pendingImport : null}
                onImportProcessed={handleImportProcessed}
                userEmail={userEmail}
              />
            )}

            {view === "receivables" && (
              <ReceivablesView
                receivables={receivables}
                accounts={accounts}
                empresas={empresas}
                selectedEmpresa={selectedEmpresa}
                categories={categories.receitas}
                contacts={contacts}
                onSaveContacts={(v) => persist("contacts", v, setContacts)}
                onSave={(v) => persist("receivables", v, setReceivables)}
                pendingImport={pendingImport?.context === "receivable" ? pendingImport : null}
                onImportProcessed={handleImportProcessed}
                userEmail={userEmail}
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
              />
            )}

            {view === "transfers" && (
              <TransfersView
                transfers={transfers}
                accounts={accounts}
                empresas={empresas}
                selectedEmpresa={selectedEmpresa}
                onSave={(v) => persist("transfers", v, setTransfers)}
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
              />
            )}

            {view === "categories" && (
              <CategoriesView categories={categories} readOnly={role !== "gestor"} onSave={(v) => persist("categories", v, setCategories)} />
            )}

            {view === "reconciliation" && (
              <ReconciliationView
                accounts={accountsF}
                payables={payables}
                receivables={receivables}
                bankEntries={bankEntries}
                transfers={transfers}
                categories={allCategoryNames}
                onSavePayables={(v) => persist("payables", v, setPayables)}
                onSaveReceivables={(v) => persist("receivables", v, setReceivables)}
                onSaveBankEntries={(v) => persist("bankEntries", v, setBankEntries)}
                onSaveTransfers={(v) => persist("transfers", v, setTransfers)}
              />
            )}

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
              />
            )}

            {view === "documentUploads" && (
              <DocumentUploadsView
                uploads={documentUploads}
                empresas={empresas}
                selectedEmpresa={selectedEmpresa}
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

          {/* Atividade recente */}
          <aside
            className="w-72 shrink-0 p-5 space-y-4 print:hidden hidden xl:flex xl:flex-col overflow-y-auto"
            style={{ background: COLORS.panel, borderLeft: `1px solid ${COLORS.border}` }}
          >
            <div>
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

            {selectedEmpresa && (
              <div className="pt-4 mt-1" style={{ borderTop: `1px solid ${COLORS.border}` }}>
                <p className="font-semibold text-sm" style={{ color: COLORS.ink }}>Pendências</p>
                <p className="text-xs mb-3" style={{ color: COLORS.inkSoft }}>O que precisa de atenção nesta empresa</p>
                {pendingDocs.length === 0 && pendingContacts.length === 0 ? (
                  <p className="text-sm" style={{ color: COLORS.inkSoft }}>Nada pendente por aqui.</p>
                ) : (
                  <div className="space-y-1.5">
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

  const kpis = [
    { label: "Entradas no ano", value: totals.totalEntradas, icon: TrendingUp, tone: "green" },
    { label: "Saídas no ano", value: totals.totalSaidas, icon: TrendingDown, tone: "red" },
    { label: "Saldo líquido", value: totals.saldo, icon: CircleDollarSign, tone: totals.saldo >= 0 ? "green" : "red" },
    { label: "Saldo em contas", value: totalBalance, icon: Landmark, tone: "gold" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: COLORS.ink }}>Painel financeiro</h1>
          <p className="text-sm" style={{ color: COLORS.inkSoft }}>Regime de caixa · visão do ano desta empresa</p>
        </div>
        <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-28">
          {[year - 1, year, year + 1].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          const toneColor = k.tone === "green" ? COLORS.green : k.tone === "red" ? COLORS.red : COLORS.gold;
          return (
            <Card key={k.label} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium" style={{ color: COLORS.inkSoft }}>{k.label}</span>
                <Icon size={16} color={toneColor} />
              </div>
              <p className="text-lg font-semibold tabular-nums" style={{ color: toneColor, fontVariantNumeric: "tabular-nums" }}>
                {fmtBRL(k.value)}
              </p>
            </Card>
          );
        })}
      </div>

      <Card className="p-4">
        <h2 className="text-sm font-semibold mb-3" style={{ color: COLORS.ink }}>Entradas × Saídas × Saldo acumulado</h2>
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 12, fill: COLORS.inkSoft }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: COLORS.inkSoft }} axisLine={false} tickLine={false} width={70}
                tickFormatter={(v) => v.toLocaleString("pt-BR", { notation: "compact", compactDisplay: "short" })} />
              <Tooltip formatter={(v) => fmtBRL(v)} contentStyle={{ borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Entradas" fill={COLORS.green} radius={[3, 3, 0, 0]} />
              <Bar dataKey="Saídas" fill={COLORS.red} radius={[3, 3, 0, 0]} />
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
            <div className="space-y-2">
              {accounts.map((a) => (
                <div key={a.id} className="flex items-center justify-between py-1.5" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: COLORS.ink }}>{a.nome}</p>
                    <p className="text-xs" style={{ color: COLORS.inkSoft }}>{a.tipo}</p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums" style={{ color: accountBalance(a.id) >= 0 ? COLORS.green : COLORS.red }}>
                    {fmtBRL(accountBalance(a.id))}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3" style={{ color: COLORS.ink }}>Próximos vencimentos</h2>
          <div className="space-y-3">
            {upcomingPayables.length === 0 && upcomingReceivables.length === 0 && (
              <p className="text-sm" style={{ color: COLORS.inkSoft }}>Nada pendente no momento.</p>
            )}
            {upcomingPayables.map((p) => (
              <div key={p.id} className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm truncate" style={{ color: COLORS.ink }}>{p.fornecedor}</p>
                  <p className="text-xs" style={{ color: COLORS.inkSoft }}>Pagar · {fmtDate(p.vencimento)}</p>
                </div>
                <p className="text-sm font-medium tabular-nums shrink-0 ml-2" style={{ color: COLORS.red }}>
                  −{fmtBRL(p.valor)}
                </p>
              </div>
            ))}
            {upcomingReceivables.map((r) => (
              <div key={r.id} className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm truncate" style={{ color: COLORS.ink }}>{r.cliente}</p>
                  <p className="text-xs" style={{ color: COLORS.inkSoft }}>Receber · {fmtDate(r.vencimento)}</p>
                </div>
                <p className="text-sm font-medium tabular-nums shrink-0 ml-2" style={{ color: COLORS.green }}>
                  +{fmtBRL(r.valor)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3" style={{ color: COLORS.ink }}>Despesas por categoria</h2>
          <BreakdownTable
            data={categoryBreakdown}
            columns={[{ key: "pago", label: "Pago" }, { key: "aPagar", label: "A pagar" }]}
          />
        </Card>
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3" style={{ color: COLORS.ink }}>Receitas por categoria</h2>
          <BreakdownTable
            data={receivableBreakdown}
            columns={[{ key: "recebido", label: "Recebido" }, { key: "aReceber", label: "A receber" }]}
          />
        </Card>
      </div>
    </div>
  );
}

function BreakdownTable({ data, columns }) {
  const rows = Object.entries(data);
  if (rows.length === 0) return <p className="text-sm" style={{ color: COLORS.inkSoft }}>Sem lançamentos ainda.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr style={{ color: COLORS.inkSoft }}>
          <th className="text-left font-medium pb-2">Categoria</th>
          {columns.map((c) => (
            <th key={c.key} className="text-right font-medium pb-2">{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(([cat, vals]) => (
          <tr key={cat} style={{ borderTop: `1px solid ${COLORS.border}` }}>
            <td className="py-1.5" style={{ color: COLORS.ink }}>{cat}</td>
            {columns.map((c) => (
              <td key={c.key} className="py-1.5 text-right tabular-nums" style={{ color: COLORS.ink }}>
                {fmtBRL(vals[c.key] || 0)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ---------------------------------------------------------------------- */
/*  Empresas                                                               */
/* ---------------------------------------------------------------------- */
function EmpresasView({ empresas, role, onSave, onOpenAccounts, onOpenContacts, onOpenEmpresa }) {
  const [modal, setModal] = useState(null);
  const isGestor = role === "gestor";

  const submit = (form) => {
    if (form.id) onSave(empresas.map((e) => (e.id === form.id ? form : e)));
    else onSave([...empresas, { ...form, id: uid() }]);
    setModal(null);
  };
  // Empresa nunca é excluída pelo app — só inativada. Mantém o histórico
  // (contas, lançamentos) intacto pra auditoria, e permite reativar se a
  // empresa voltar a ser cliente no futuro.
  const toggleAtiva = (e) => {
    const ativa = e.ativa === false; // reativando se já estava inativa
    const msg = ativa
      ? `Reativar "${e.nome}"? Ela volta a aparecer no seletor de empresas.`
      : `Inativar "${e.nome}"? Ela some do seletor do dia a dia, mas os dados continuam guardados e você pode reativar quando quiser.`;
    if (!confirmDelete(msg)) return;
    onSave(empresas.map((x) => (x.id === e.id ? { ...x, ativa } : x)));
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
      <div className="flex justify-end">
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
                    </p>
                    {e.cnpj && <p className="text-xs" style={{ color: COLORS.inkSoft }}>{e.cnpj}</p>}
                  </div>
                </div>
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
                  {isGestor && (
                    <button
                      onClick={() => toggleAtiva(e)}
                      title={e.ativa === false ? "Reativar empresa" : "Inativar empresa"}
                      className="p-1.5 rounded-md hover:bg-black/5"
                    >
                      {e.ativa === false ? <Check size={14} color={COLORS.green} /> : <Trash2 size={14} color={COLORS.red} />}
                    </button>
                  )}
                </div>
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

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("empresa_owners")
      .select("user_id, profiles(email)")
      .eq("empresaId", empresa.id);
    if (err) { setOwners([]); return; }
    setOwners(data.map((r) => r.profiles?.email || r.user_id));
  }, [empresa.id]);

  useEffect(() => { load(); }, [load]);

  const addOwner = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setError("");
    const { error: err } = await supabase.rpc("assign_empresa_owner", { p_empresa_id: empresa.id, p_email: email.trim() });
    setBusy(false);
    if (err) { setError(err.message.includes("não encontrado") ? "Usuário não encontrado — crie o login dele no Supabase primeiro." : err.message); return; }
    setEmail("");
    load();
  };

  const removeOwner = async (ownerEmail) => {
    await supabase.rpc("remove_empresa_owner", { p_empresa_id: empresa.id, p_email: ownerEmail });
    load();
  };

  return (
    <div className="pt-3" style={{ borderTop: `1px solid ${COLORS.border}` }}>
      <p className="text-xs font-medium mb-2" style={{ color: COLORS.inkSoft }}>Donos com acesso a esta empresa</p>
      {owners === null ? (
        <p className="text-xs" style={{ color: COLORS.inkSoft }}>Carregando…</p>
      ) : owners.length === 0 ? (
        <p className="text-xs mb-2" style={{ color: COLORS.inkSoft }}>Ninguém tem acesso restrito ainda — só quem for gestor vê essa empresa.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {owners.map((ownerEmail) => (
            <span key={ownerEmail} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs" style={{ background: "#EFEEE8", color: COLORS.ink }}>
              {ownerEmail}
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
        <Field label="Proprietário">
          <TextInput value={form.proprietario || ""} onChange={(e) => setForm({ ...form, proprietario: e.target.value })} placeholder="Nome do(a) proprietário(a)" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="E-mail de contato">
            <TextInput type="email" value={form.contatoEmail || ""} onChange={(e) => setForm({ ...form, contatoEmail: e.target.value })} />
          </Field>
          <Field label="Celular de contato">
            <TextInput value={form.contatoCelular || ""} onChange={(e) => setForm({ ...form, contatoCelular: e.target.value })} placeholder="(00) 00000-0000" />
          </Field>
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
          <Button onClick={() => form.nome.trim() && onSubmit(form)} disabled={!form.nome.trim()}>Salvar</Button>
        </div>
      </div>
    </Modal>
  );
}

function AccountsView({ accounts, selectedEmpresa, accountBalance, onSave }) {
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
function ContactsView({ contacts, selectedEmpresa, onSave }) {
  const [modal, setModal] = useState(null);
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
    </div>
  );
}

function ContactModal({ initial, contacts = [], onClose, onSubmit }) {
  const [form, setForm] = useState({
    nome: "", documento: "", contato: "", email: "", ...initial,
  });
  const [autoFillNote, setAutoFillNote] = useState("");
  const valid = form.nome.trim() && form.empresaId;

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
        <Field label="CPF/CNPJ"><TextInput value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} placeholder="000.000.000-00 ou 00.000.000/0000-00" /></Field>
        <Field label="Contato (telefone/WhatsApp)"><TextInput value={form.contato} onChange={(e) => setForm({ ...form, contato: e.target.value })} /></Field>
        <Field label="E-mail"><TextInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
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
      <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-44" style={{ height: 38 }}>
        <option value="">Todos os status</option>
        {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
      </Select>
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
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${statuses.length}, minmax(0,1fr))` }}>
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

/* ---------------------------------------------------------------------- */
/*  Contas a Pagar                                                         */
/* ---------------------------------------------------------------------- */
function PayablesView({
  payables, accounts, empresas, selectedEmpresa, categories, contacts, onSaveContacts, onSave,
  pendingImport, onImportProcessed, userEmail,
}) {
  const [modal, setModal] = useState(null);
  const [payModal, setPayModal] = useState(null);
  const [scheduleModal, setScheduleModal] = useState(false);
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

  const submit = (formOrList, contactInfo) => {
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
    if (withContact.length === 1 && withContact[0].id) {
      onSave(payables.map((p) => (p.id === withContact[0].id ? withContact[0] : p)));
    } else {
      onSave([...payables, ...withContact.map((f) => ({ ...f, id: uid() }))]);
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

  const confirmPayment = (id, dataPgto, valorPago, contaPgtoId, adj) => {
    const { juros = 0, multa = 0, desconto = 0 } = adj || {};
    onSave(payables.map((p) => (p.id === id ? { ...p, status: "Pago", dataPgto, valorPago, contaPgtoId, juros, multa, desconto } : p)));
    const detalheAdj = (juros || multa || desconto)
      ? ` (juros ${fmtBRL(juros)}, multa ${fmtBRL(multa)}, desconto ${fmtBRL(desconto)})`
      : "";
    logAudit(selectedEmpresa, "payable", id, "baixa", `Dar baixa — ${fmtBRL(valorPago)} em ${fmtDate(dataPgto)}${detalheAdj}`, userEmail);
    setPayModal(null);
  };

  // "Agendar pagamentos" NÃO é uma baixa — é a proposta do analista BPO de
  // quando/de qual conta cada conta será paga, virando a "relação" que o
  // dono autoriza. Por isso a data é livre (inclusive futura) e nada em
  // valorPago/dataPgto/contaPgtoId é tocado aqui — só a baixa de verdade
  // (Dar baixa) mexe nesses campos.
  const confirmSchedule = (ids, agendadoPara, contaAgendadaId) => {
    const idSet = new Set(ids);
    onSave(payables.map((p) => (idSet.has(p.id) ? { ...p, status: "Agendado", agendadoPara, contaAgendadaId } : p)));
    ids.forEach((id) => logAudit(selectedEmpresa, "payable", id, "agendar", `Incluído na ordem de pagamento — proposto pra ${fmtDate(agendadoPara)}`, userEmail));
    setScheduleModal(false);
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
    logAudit(selectedEmpresa, "payable", p.id, "cancelar_baixa", `Cancelou baixa de ${fmtBRL(p.valorPago || p.valor)}`, userEmail);
  };

  const total = filtered.reduce((s, p) => s + Number(p.valor || 0), 0);
  const empresa = empresas.find((e) => e.id === selectedEmpresa);
  const agendados = withDerived.filter((p) => p.status === "Agendado");

  const notifyOwner = () => {
    const linhas = agendados.map((p) => `• ${p.fornecedor} — ${fmtBRL(p.valor)} — proposto pra ${fmtDate(p.agendadoPara)}`);
    const mensagem = [
      `Olá! Segue a relação de pagamentos aguardando sua autorização${empresa ? ` (${empresa.nome})` : ""}:`,
      "",
      ...linhas,
      "",
      `Total: ${fmtBRL(agendados.reduce((s, p) => s + Number(p.valor || 0), 0))}`,
      "",
      "Pode confirmar a autorização e/ou efetivação desses pagamentos?",
    ].join("\n");
    if (!openWhatsApp(empresa?.contatoCelular, mensagem)) {
      alert("Cadastre o celular do dono em Cadastros → Editar empresa antes de notificar.");
    }
  };

  return (
    <div className="space-y-4">
      <Header title="Contas a Pagar" subtitle={`${filtered.length} lançamento(s) · ${fmtBRL(total)}`}>
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
        {agendados.length > 0 && (
          <Button variant="ghost" onClick={notifyOwner} title="Abre o WhatsApp com uma mensagem pronta, listando os pagamentos agendados que aguardam autorização">
            <MessageCircle size={15} /> Notificar dono ({agendados.length})
          </Button>
        )}
        <Button onClick={() => { setAiNote(""); setModal({ empresaId: selectedEmpresa }); }}>
          <Plus size={15} /> Novo lançamento
        </Button>
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
                        <button onClick={() => cancelPayment(p)} title="Cancelar baixa" className="p-1.5 rounded-md hover:bg-black/5"><RotateCcw size={14} color={COLORS.amber} /></button>
                      )}
                      {p.status === "Agendado" && (
                        <>
                          <Button variant="subtle" onClick={() => authorizePayment(p)} title={`Proposto pra ${fmtDate(p.agendadoPara)}`}><ShieldCheck size={13} /> Autorizar</Button>
                          <button onClick={() => cancelSchedule(p)} title="Cancelar agendamento (volta pra A Pagar)" className="p-1.5 rounded-md hover:bg-black/5"><RotateCcw size={14} color={COLORS.amber} /></button>
                        </>
                      )}
                      {p.status === "Autorizado" && (
                        <button onClick={() => cancelSchedule(p)} title="Cancelar agendamento (volta pra A Pagar)" className="p-1.5 rounded-md hover:bg-black/5"><RotateCcw size={14} color={COLORS.amber} /></button>
                      )}
                      {p.status !== "Pago" && (
                        <Button variant="subtle" onClick={() => setPayModal(p)}><Check size={13} /> Dar baixa</Button>
                      )}
                      <button onClick={() => { setAiNote(""); setModal(p); }} title="Editar lançamento" className="p-1.5 rounded-md hover:bg-black/5"><Pencil size={14} color={COLORS.inkSoft} /></button>
                      <button onClick={() => remove(p.id)} title="Excluir lançamento" className="p-1.5 rounded-md hover:bg-black/5"><Trash2 size={14} color={COLORS.red} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {modal && (
        <PayableModal
          initial={modal} categories={categories} contacts={contacts} aiNote={aiNote} previewDoc={previewDoc}
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
          items={payables.filter((p) => p.status === "A Pagar" && p.empresaId === selectedEmpresa)}
          accounts={accounts.filter((a) => a.empresaId === selectedEmpresa)}
          onClose={() => setScheduleModal(false)}
          onConfirm={confirmSchedule}
        />
      )}
    </div>
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

function PayableModal({ initial, categories, contacts = [], aiNote, previewDoc, onClose, onSubmit }) {
  const linkedContact = contacts.find((c) => c.id === initial.contactId);
  const [form, setForm] = useState({
    dataLanc: todayISO(), vencimento: todayISO(), fornecedor: "", categoria: categories[0]?.nome || "",
    descricao: "", valor: "", formaPgto: "PIX", status: "A Pagar",
    documento: linkedContact?.documento || "", contato: linkedContact?.contato || "", ...initial,
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
          {!initial.id && <InstallmentFields form={form} setForm={setForm} />}
        </div>
        <DocumentPreviewPanel doc={previewDoc} />
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button
          onClick={() => valid && onSubmit(initial.id ? stripInstallmentMeta(form) : expandEntries(form), { documento: form.documento, contato: form.contato })}
          disabled={!valid}
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

/* ---------------------------------------------------------------------- */
/*  Contas a Receber                                                       */
/* ---------------------------------------------------------------------- */
function ReceivablesView({
  receivables, accounts, selectedEmpresa, categories, contacts, onSaveContacts, onSave,
  pendingImport, onImportProcessed, userEmail,
}) {
  const [modal, setModal] = useState(null);
  const [recModal, setRecModal] = useState(null);
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

  const submit = (formOrList, contactInfo) => {
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
    if (withContact.length === 1 && withContact[0].id) {
      onSave(receivables.map((r) => (r.id === withContact[0].id ? withContact[0] : r)));
    } else {
      onSave([...receivables, ...withContact.map((f) => ({ ...f, id: uid() }))]);
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
  const confirmReceipt = (id, dataReceb, valorRecebido, contaRecebId, adj) => {
    const { juros = 0, multa = 0, desconto = 0 } = adj || {};
    onSave(receivables.map((r) => (r.id === id ? { ...r, status: "Recebido", dataReceb, valorRecebido, contaRecebId, juros, multa, desconto } : r)));
    const detalheAdj = (juros || multa || desconto)
      ? ` (juros ${fmtBRL(juros)}, multa ${fmtBRL(multa)}, desconto ${fmtBRL(desconto)})`
      : "";
    logAudit(selectedEmpresa, "receivable", id, "baixa", `Dar baixa — ${fmtBRL(valorRecebido)} em ${fmtDate(dataReceb)}${detalheAdj}`, userEmail);
    setRecModal(null);
  };
  const cancelReceipt = (r) => {
    const revertStatus = r.agendadoPara ? "Antecipado" : "A Receber";
    if (!confirmDelete(`Cancelar o recebimento de "${r.cliente}"? Ele volta pra "${revertStatus}".`)) return;
    onSave(receivables.map((x) => (x.id === r.id ? { ...x, status: revertStatus, dataReceb: null, valorRecebido: null, contaRecebId: null } : x)));
    logAudit(selectedEmpresa, "receivable", r.id, "cancelar_baixa", `Cancelou recebimento de ${fmtBRL(r.valorRecebido || r.valor)}`, userEmail);
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

  return (
    <div className="space-y-4">
      <Header title="Contas a Receber" subtitle={`${filtered.length} lançamento(s) · ${fmtBRL(total)}`}>
        <label
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-40"
          style={{ background: "transparent", color: COLORS.primary, border: `1px solid ${COLORS.border}` }}
        >
          <Upload size={15} /> {importing ? "Lendo documento…" : "Importar documento"}
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleImportDocument} disabled={importing} />
        </label>
        <Button onClick={() => { setAiNote(""); setModal({ empresaId: selectedEmpresa }); }}>
          <Plus size={15} /> Novo lançamento
        </Button>
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
                      {r.status === "Recebido" ? (
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
                      )}
                      <button onClick={() => setModal(r)} title="Editar lançamento" className="p-1.5 rounded-md hover:bg-black/5"><Pencil size={14} color={COLORS.inkSoft} /></button>
                      <button onClick={() => remove(r.id)} title="Excluir lançamento" className="p-1.5 rounded-md hover:bg-black/5"><Trash2 size={14} color={COLORS.red} /></button>
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
          initial={modal} categories={categories} contacts={contacts} aiNote={aiNote} previewDoc={previewDoc}
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
    </div>
  );
}

function ReceivableModal({ initial, categories, contacts = [], aiNote, previewDoc, onClose, onSubmit }) {
  const linkedContact = contacts.find((c) => c.id === initial.contactId);
  const [form, setForm] = useState({
    dataLanc: todayISO(), vencimento: todayISO(), cliente: "", categoria: categories[0]?.nome || "",
    descricao: "", valor: "", formaReceb: "PIX", status: "A Receber",
    documento: linkedContact?.documento || "", contato: linkedContact?.contato || "", ...initial,
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
          {!initial.id && <InstallmentFields form={form} setForm={setForm} />}
        </div>
        <DocumentPreviewPanel doc={previewDoc} />
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button
          onClick={() => valid && onSubmit(initial.id ? stripInstallmentMeta(form) : expandEntries(form), { documento: form.documento, contato: form.contato })}
          disabled={!valid}
        >
          Salvar
        </Button>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/*  Lançamentos Bancários                                                  */
/* ---------------------------------------------------------------------- */
function BankEntriesView({ entries, accounts, selectedEmpresa, categories, onSave, pendingImport, onImportProcessed }) {
  const [modal, setModal] = useState(null);
  const [aiNote, setAiNote] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [previewDoc, setPreviewDoc] = useState(null);
  const scopedAccounts = accounts.filter((a) => a.empresaId === selectedEmpresa);
  const submit = (form) => {
    if (form.id) onSave(entries.map((e) => (e.id === form.id ? form : e)));
    else onSave([...entries, { ...form, id: uid() }]);
    setModal(null);
    setPreviewDoc(null);
    if (pendingUploadRef.current) {
      onImportProcessed?.(pendingUploadRef.current);
      pendingUploadRef.current = null;
    }
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
        <label
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-40"
          style={{ background: "transparent", color: COLORS.primary, border: `1px solid ${COLORS.border}` }}
        >
          <Upload size={15} /> {importing ? "Lendo comprovante…" : "Importar documento"}
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleImportDocument} disabled={importing || scopedAccounts.length === 0} />
        </label>
        <Button onClick={() => { setAiNote(""); setModal({}); }} disabled={scopedAccounts.length === 0}><Plus size={15} /> Novo lançamento</Button>
      </Header>
      {scopedAccounts.length === 0 && (
        <p className="text-sm px-1" style={{ color: COLORS.inkSoft }}>Cadastre uma conta antes de lançar movimentos bancários.</p>
      )}
      {importError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: COLORS.redSoft, color: COLORS.red }}>
          <AlertTriangle size={15} /> {importError}
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
                        <button onClick={() => setModal(e)} title="Editar lançamento" className="p-1.5 rounded-md hover:bg-black/5"><Pencil size={14} color={COLORS.inkSoft} /></button>
                        <button onClick={() => remove(e.id)} title="Excluir lançamento" className="p-1.5 rounded-md hover:bg-black/5"><Trash2 size={14} color={COLORS.red} /></button>
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
          initial={modal} accounts={scopedAccounts} categories={categories} aiNote={aiNote} previewDoc={previewDoc}
          onClose={() => { setModal(null); setAiNote(""); setPreviewDoc(null); pendingUploadRef.current = null; }}
          onSubmit={submit}
        />
      )}
    </div>
  );
}

function BankEntryModal({ initial, accounts, categories, suggestion, aiNote, previewDoc, onClose, onSubmit }) {
  const [form, setForm] = useState({
    data: todayISO(), contaId: accounts[0]?.id || "", tipo: "Saída", categoria: categories[0] || "",
    descricao: "", valor: "", ...initial,
  });
  const valid = form.contaId && Number(form.valor) > 0;
  const submit = () => {
    const acc = accounts.find((a) => a.id === form.contaId);
    onSubmit({ ...form, empresaId: acc?.empresaId || form.empresaId });
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
          {suggestion && form.categoria === suggestion.categoria && (
            <p className="text-xs -mt-2" style={{ color: COLORS.green }}>
              Categoria sugerida automaticamente, com base em lançamento parecido: “{suggestion.exemplo}”. Confira antes de salvar.
            </p>
          )}
          <Field label="Descrição"><TextInput value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></Field>
          <Field label="Valor (R$)"><TextInput type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></Field>
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

/* ---------------------------------------------------------------------- */
/*  Transferências                                                         */
/* ---------------------------------------------------------------------- */
function TransfersView({ transfers, accounts, selectedEmpresa, onSave }) {
  const [modal, setModal] = useState(null);
  const scopedAccounts = accounts.filter((a) => a.empresaId === selectedEmpresa);
  const submit = (form) => {
    if (form.id) onSave(transfers.map((t) => (t.id === form.id ? form : t)));
    else onSave([...transfers, { ...form, id: uid() }]);
    setModal(null);
  };
  const remove = (id) => {
    if (!confirmDelete("Mover esta transferência pra lixeira? Você pode restaurar depois, em Lixeira.")) return;
    onSave(transfers.map((t) => (t.id === id ? { ...t, deletedAt: new Date().toISOString() } : t)));
  };
  const sorted = [...transfers]
    .filter((t) => !t.deletedAt && t.empresaId === selectedEmpresa)
    .sort((a, b) => (b.data || "").localeCompare(a.data || ""));

  return (
    <div className="space-y-4">
      <Header title="Transferências entre contas" subtitle="Movimentações internas — não afetam o fluxo de caixa.">
        <Button onClick={() => setModal({})} disabled={scopedAccounts.length < 2}><Plus size={15} /> Nova transferência</Button>
      </Header>
      {scopedAccounts.length < 2 && (
        <p className="text-sm px-1" style={{ color: COLORS.inkSoft }}>Cadastre pelo menos 2 contas nesta empresa para registrar transferências.</p>
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
                        <button onClick={() => setModal(t)} title="Editar transferência" className="p-1.5 rounded-md hover:bg-black/5"><Pencil size={14} color={COLORS.inkSoft} /></button>
                        <button onClick={() => remove(t.id)} title="Excluir transferência" className="p-1.5 rounded-md hover:bg-black/5"><Trash2 size={14} color={COLORS.red} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
      {modal && <TransferModal initial={modal} accounts={scopedAccounts} onClose={() => setModal(null)} onSubmit={submit} />}
    </div>
  );
}

function TransferModal({ initial, accounts, onClose, onSubmit }) {
  const [form, setForm] = useState({
    data: todayISO(), contaOrigemId: accounts[0]?.id || "", contaDestinoId: accounts[1]?.id || "",
    valor: "", descricao: "", empresaId: accounts[0]?.empresaId || "", ...initial,
  });
  const valid = form.contaOrigemId && form.contaDestinoId && form.contaOrigemId !== form.contaDestinoId && Number(form.valor) > 0;
  return (
    <Modal title={initial.id ? "Editar transferência" : "Nova transferência"} onClose={onClose}>
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
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => valid && onSubmit(form)} disabled={!valid}>Salvar</Button>
        </div>
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

function FiscalView({ obligations, accounts, empresas, selectedEmpresa, onSave, userEmail }) {
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
    onSave(obligations.map((o) => (o.id === id ? { ...o, status: "Pago", dataPagamento, valor, contaId } : o)));
    logAudit(selectedEmpresa, "fiscalObligation", id, "baixa", `Dar baixa — ${fmtBRL(valor)} em ${fmtDate(dataPagamento)}`, userEmail);
    setPayModal(null);
  };
  const cancelPayment = (o) => {
    if (!confirmDelete(`Cancelar a baixa de "${o.tributo}"? Ela volta pra "Pendente".`)) return;
    onSave(obligations.map((x) => (x.id === o.id ? { ...x, status: "Pendente", dataPagamento: null, contaId: null } : x)));
    logAudit(selectedEmpresa, "fiscalObligation", o.id, "cancelar_baixa", `Cancelou baixa de ${fmtBRL(o.valor)}`, userEmail);
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
        <Button variant="ghost" onClick={generateSuggestions} title="Sugere as obrigações do ano a partir do regime tributário da empresa">
          <Sparkles size={15} /> Gerar obrigações do ano
        </Button>
        <Button onClick={() => setModal({ empresaId: selectedEmpresa })}>
          <Plus size={15} /> Nova obrigação
        </Button>
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
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setModal(o)} title="Editar antes de validar" className="p-1.5 rounded-md hover:bg-black/5"><Pencil size={14} color={COLORS.inkSoft} /></button>
                  <Button variant="subtle" onClick={() => validateSuggestion(o.id)} disabled={!o.vencimento} title={o.vencimento ? "Confirmar esta obrigação" : "Defina a data de vencimento antes de validar"}>
                    <Check size={13} /> Validar
                  </Button>
                  <button onClick={() => discardSuggestion(o.id)} title="Não se aplica a esta empresa" className="p-1.5 rounded-md hover:bg-black/5"><X size={14} color={COLORS.red} /></button>
                </div>
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
                    <div className="flex justify-end gap-1">
                      {o.status !== "Pago" ? (
                        <Button variant="subtle" onClick={() => setPayModal(o)}><Check size={13} /> Dar baixa</Button>
                      ) : (
                        <button onClick={() => cancelPayment(o)} title="Cancelar baixa (volta pra Pendente)" className="p-1.5 rounded-md hover:bg-black/5"><RotateCcw size={14} color={COLORS.amber} /></button>
                      )}
                      <button onClick={() => setModal(o)} title="Editar obrigação" className="p-1.5 rounded-md hover:bg-black/5"><Pencil size={14} color={COLORS.inkSoft} /></button>
                      <button onClick={() => remove(o.id)} title="Excluir obrigação" className="p-1.5 rounded-md hover:bg-black/5"><Trash2 size={14} color={COLORS.red} /></button>
                    </div>
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
function CategoriesView({ categories, readOnly, onSave }) {
  const [newReceita, setNewReceita] = useState("");
  const [newDespesa, setNewDespesa] = useState("");

  const addReceita = () => {
    if (!newReceita.trim()) return;
    const codigo = `R${String(categories.receitas.length + 1).padStart(2, "0")}`;
    onSave({ ...categories, receitas: [...categories.receitas, { codigo, nome: newReceita.trim() }] });
    setNewReceita("");
  };
  const addDespesa = () => {
    if (!newDespesa.trim()) return;
    const codigo = `D${String(categories.despesas.length + 1).padStart(2, "0")}`;
    onSave({ ...categories, despesas: [...categories.despesas, { codigo, nome: newDespesa.trim() }] });
    setNewDespesa("");
  };
  const removeReceita = (codigo) => onSave({ ...categories, receitas: categories.receitas.filter((c) => c.codigo !== codigo) });
  const removeDespesa = (codigo) => onSave({ ...categories, despesas: categories.despesas.filter((c) => c.codigo !== codigo) });

  return (
    <div className="space-y-4">
      <Header title="Plano de Contas" subtitle={readOnly ? "Categorias usadas nos lançamentos — só o gestor pode editar." : "Categorias usadas nos lançamentos de receitas e despesas."} />
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3" style={{ color: COLORS.green }}>Receitas</h2>
          <div className="space-y-1.5 mb-3">
            {categories.receitas.map((c) => (
              <div key={c.codigo} className="flex items-center justify-between text-sm py-1">
                <span style={{ color: COLORS.ink }}>{c.codigo} · {c.nome}</span>
                {!readOnly && (
                  <button onClick={() => removeReceita(c.codigo)} title="Excluir categoria" className="p-1 rounded hover:bg-black/5"><Trash2 size={13} color={COLORS.red} /></button>
                )}
              </div>
            ))}
          </div>
          {!readOnly && (
            <div className="flex gap-2">
              <TextInput value={newReceita} onChange={(e) => setNewReceita(e.target.value)} placeholder="Nova categoria de receita" onKeyDown={(e) => e.key === "Enter" && addReceita()} />
              <Button variant="subtle" onClick={addReceita} title="Adicionar categoria de receita"><Plus size={14} /></Button>
            </div>
          )}
        </Card>
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3" style={{ color: COLORS.red }}>Despesas</h2>
          <div className="space-y-1.5 mb-3 max-h-72 overflow-y-auto">
            {categories.despesas.map((c) => (
              <div key={c.codigo} className="flex items-center justify-between text-sm py-1">
                <span style={{ color: COLORS.ink }}>{c.codigo} · {c.nome}</span>
                {!readOnly && (
                  <button onClick={() => removeDespesa(c.codigo)} title="Excluir categoria" className="p-1 rounded hover:bg-black/5"><Trash2 size={13} color={COLORS.red} /></button>
                )}
              </div>
            ))}
          </div>
          {!readOnly && (
            <div className="flex gap-2">
              <TextInput value={newDespesa} onChange={(e) => setNewDespesa(e.target.value)} placeholder="Nova categoria de despesa" onKeyDown={(e) => e.key === "Enter" && addDespesa()} />
              <Button variant="subtle" onClick={addDespesa} title="Adicionar categoria de despesa"><Plus size={14} /></Button>
            </div>
          )}
        </Card>
      </div>
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
  { id: "fluxo", label: "Fluxo Projetado", Comp: FluxoProjetadoReport },
  { id: "ordem", label: "Ordem de Pagamento", Comp: PaymentOrderReport },
  { id: "cobranca", label: "Relação de Cobrança", Comp: CollectionsReport },
  { id: "aging", label: "Aging", Comp: AgingReport },
  { id: "comparativo", label: "Comparativo entre Empresas", Comp: ComparativoReport },
  { id: "extrato", label: "Extrato de Conta", Comp: ExtratoContaReport },
  { id: "auditoria", label: "Auditoria", Comp: AuditLogReport },
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
function DREReport({ year, categoryBreakdown, receivableBreakdown, financialAdjustments, totals }) {
  const receitas = Object.entries(receivableBreakdown)
    .map(([nome, v]) => ({ nome, valor: v.recebido }))
    .filter((r) => r.valor > 0)
    .sort((a, b) => b.valor - a.valor);
  const despesas = Object.entries(categoryBreakdown)
    .map(([nome, v]) => ({ nome, valor: v.pago }))
    .filter((d) => d.valor > 0)
    .sort((a, b) => b.valor - a.valor);
  const totalReceitas = receitas.reduce((s, r) => s + r.valor, 0);
  const totalDespesas = despesas.reduce((s, d) => s + d.valor, 0);
  const resultadoOperacional = totalReceitas - totalDespesas;
  const resultado = resultadoOperacional + (financialAdjustments?.resultado || 0);

  return (
    <div className="space-y-4">
      <ReportCard title={`DRE (regime de caixa) · ${year}`} subtitle="Receitas e despesas efetivamente realizadas (recebidas/pagas), por categoria.">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: COLORS.green }}>Receitas</p>
            {receitas.length === 0 ? (
              <p className="text-sm" style={{ color: COLORS.inkSoft }}>Sem receitas recebidas no período.</p>
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
              <p className="text-sm" style={{ color: COLORS.inkSoft }}>Sem despesas pagas no período.</p>
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

      {financialAdjustments && (financialAdjustments.receitas > 0 || financialAdjustments.despesas > 0) && (
        <ReportCard title="Resultado financeiro" subtitle="Juros e multas pagos/recebidos, e descontos concedidos/obtidos em baixas — separado do operacional de propósito.">
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
        Margem: {totals.totalEntradas > 0 ? `${(totals.margem * 100).toFixed(1)}%` : "—"}
      </p>
    </div>
  );
}

/* --- Fluxo de Caixa Projetado --- */
function FluxoProjetadoReport({ payables, receivables, fiscalObligations, accounts, accountBalance }) {
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
    .sort((a, b) => (a.vencimento || "").localeCompare(b.vencimento || ""));

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
        {itemized.length === 0 ? (
          <EmptyState icon={FileText} title="Nada em aberto" subtitle="Não há contas a pagar/receber pendentes nos próximos 90 dias." />
        ) : (
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
              {itemized.map((i) => (
                <tr key={i.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                  <td className="px-2 py-2" style={{ color: daysBetween(today, i.vencimento) < 0 ? COLORS.red : COLORS.ink }}>{fmtDate(i.vencimento)}</td>
                  <td className="px-2 py-2"><Badge tone={i.__tipo === "Receber" ? "green" : "amber"}>{i.__tipo}</Badge></td>
                  <td className="px-2 py-2" style={{ color: COLORS.ink }}>{i.__nome}</td>
                  <td className="px-2 py-2 text-right tabular-nums" style={{ color: i.__tipo === "Receber" ? COLORS.green : COLORS.red }}>{fmtBRL(i.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ReportCard>
    </div>
  );
}

const PAYMENT_ORDER_STATUS = ["Agendado", "Autorizado", "Pago"];

// Relação de ordem de pagamento — a "prestação de contas" que o analista
// mostra pro dono (o que foi proposto, o que ele já autorizou, o que já
// foi de fato pago), despesa por despesa. Fica disponível pra consulta
// e impressão a qualquer momento — usa o mesmo Exportar PDF de Relatórios.
function PaymentOrderReport({ payables, accounts }) {
  const items = payables
    .filter((p) => PAYMENT_ORDER_STATUS.includes(p.status))
    .sort((a, b) => (b.agendadoPara || b.dataPgto || b.vencimento || "").localeCompare(a.agendadoPara || a.dataPgto || a.vencimento || ""));
  const total = items.reduce((s, p) => s + Number(p.valorPago || p.valor || 0), 0);

  return (
    <ReportCard title="Ordem de pagamento" subtitle="Pagamentos agendados, autorizados ou já pagos — despesa por despesa, pra apresentar ao dono, auditoria ou reunião.">
      {items.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Nada agendado, autorizado ou pago ainda" subtitle="Assim que agendar um pagamento em Contas a Pagar, ele aparece aqui." />
      ) : (
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
            {items.map((p) => {
              const contaId = p.status === "Pago" ? p.contaPgtoId : p.contaAgendadaId;
              return (
                <tr key={p.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                  <td className="px-2 py-2" style={{ color: COLORS.ink }}>
                    <p className="font-medium">{p.fornecedor}</p>
                    <p className="text-xs" style={{ color: COLORS.inkSoft }}>{p.descricao}</p>
                  </td>
                  <td className="px-2 py-2" style={{ color: COLORS.inkSoft }}>{fmtDate(p.vencimento)}</td>
                  <td className="px-2 py-2" style={{ color: COLORS.ink }}>{fmtDate(p.status === "Pago" ? p.dataPgto : p.agendadoPara)}</td>
                  <td className="px-2 py-2" style={{ color: COLORS.inkSoft }}>{accounts.find((a) => a.id === contaId)?.nome || "—"}</td>
                  <td className="px-2 py-2"><StatusBadge status={p.status} /></td>
                  <td className="px-2 py-2" style={{ color: COLORS.inkSoft }}>{p.autorizadoPor || "—"}</td>
                  <td className="px-2 py-2 text-right tabular-nums font-medium" style={{ color: COLORS.ink }}>{fmtBRL(p.valorPago || p.valor)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: `2px solid ${COLORS.border}` }}>
              <td colSpan={6} className="px-2 py-2 text-right font-semibold" style={{ color: COLORS.ink }}>Total</td>
              <td className="px-2 py-2 text-right tabular-nums font-semibold" style={{ color: COLORS.ink }}>{fmtBRL(total)}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </ReportCard>
  );
}

// Relação de cobrança — o espelho, do lado de receber, da Ordem de
// Pagamento: tudo que ainda está em aberto, pra acompanhar inadimplência,
// repassar pra quem for cobrar, ou levar numa reunião com o dono.
function CollectionsReport({ receivables, contacts }) {
  const today = todayISO();
  const items = receivables
    .filter((r) => r.status !== "Recebido")
    .map((r) => {
      let statusDisplay = r.status;
      if (r.status === "A Receber" && r.vencimento < today) statusDisplay = "Inadimplente";
      else if (r.status === "A Receber" && daysUntil(r.vencimento) <= 10) statusDisplay = "Próximo";
      return { ...r, statusDisplay, contato: contacts.find((c) => c.id === r.contactId)?.contato || "" };
    })
    .sort((a, b) => (a.vencimento || "").localeCompare(b.vencimento || ""));
  const total = items.reduce((s, r) => s + Number(r.valor || 0), 0);

  return (
    <ReportCard title="Relação de cobrança" subtitle="Contas a receber em aberto — pra acompanhar inadimplência, repassar pra quem for cobrar, ou levar numa reunião.">
      {items.length === 0 ? (
        <EmptyState icon={MessageCircle} title="Nada em aberto" subtitle="Todas as contas a receber estão em dia ou já recebidas." />
      ) : (
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
            {items.map((r) => (
              <tr key={r.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                <td className="px-2 py-2" style={{ color: COLORS.ink }}>
                  <p className="font-medium">{r.cliente}</p>
                  <p className="text-xs" style={{ color: COLORS.inkSoft }}>{r.descricao}</p>
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
              <td colSpan={4} className="px-2 py-2 text-right font-semibold" style={{ color: COLORS.ink }}>Total em aberto</td>
              <td className="px-2 py-2 text-right tabular-nums font-semibold" style={{ color: COLORS.ink }}>{fmtBRL(total)}</td>
            </tr>
          </tfoot>
        </table>
      )}
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
      <div className="grid grid-cols-5 gap-2 mb-4">
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
function ExtratoContaReport({ accounts, payables, receivables, bankEntries, transfers, fiscalObligations, accountBalance }) {
  const [contaId, setContaId] = useState(accounts[0]?.id || "");
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
      {withRunning.length === 0 ? (
        <EmptyState icon={Wallet} title="Sem movimentos" subtitle="Essa conta ainda não tem lançamentos, baixas ou transferências." />
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
            <tr style={{ borderTop: `1px solid ${COLORS.border}` }}>
              <td className="px-2 py-2" style={{ color: COLORS.inkSoft }}>{fmtDate(conta?.dataInicial)}</td>
              <td className="px-2 py-2" style={{ color: COLORS.inkSoft }}>Saldo inicial</td>
              <td className="px-2 py-2 text-right tabular-nums" style={{ color: COLORS.inkSoft }}>—</td>
              <td className="px-2 py-2 text-right tabular-nums font-medium" style={{ color: COLORS.ink }}>{fmtBRL(conta?.saldoInicial || 0)}</td>
            </tr>
            {withRunning.map((m) => (
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
    </ReportCard>
  );
}

const AUDIT_ENTITY_LABEL = { payable: "Conta a pagar", receivable: "Conta a receber", fiscalObligation: "Obrigação fiscal" };
const AUDIT_ACTION_LABEL = {
  baixa: "Dar baixa",
  cancelar_baixa: "Cancelar baixa",
  agendar: "Agendar pagamento",
  autorizar: "Autorizar pagamento",
  cancelar_agendamento: "Cancelar agendamento",
  cobranca: "Cobrança enviada",
  antecipar: "Marcar antecipação",
  cancelar_antecipacao: "Cancelar antecipação",
};
const AUDIT_ACTION_TONE = {
  baixa: "green",
  cancelar_baixa: "amber",
  agendar: "gold",
  autorizar: "blue",
  cancelar_agendamento: "amber",
  cobranca: "neutral",
  antecipar: "gold",
  cancelar_antecipacao: "amber",
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
function AuditLogReport({ selectedEmpresa }) {
  const [rows, setRows] = useState(null); // null = carregando

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    (async () => {
      const { data, error } = await supabase
        .from("auditLog")
        .select("*")
        .eq("empresaId", selectedEmpresa)
        .order("created_at", { ascending: false })
        .limit(200);
      if (!cancelled) setRows(error ? [] : data);
    })();
    return () => { cancelled = true; };
  }, [selectedEmpresa]);

  return (
    <ReportCard title="Log de auditoria" subtitle="Toda baixa e cancelamento de baixa fica registrado aqui — data, hora, usuário e ação. Ninguém, nem o gestor, consegue editar ou apagar essas linhas por dentro do sistema.">
      {rows === null ? (
        <p className="text-sm py-6 text-center" style={{ color: COLORS.inkSoft }}>Carregando…</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Nada registrado ainda" subtitle="Assim que alguém der ou cancelar uma baixa nessa empresa, aparece aqui." />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
              <th className="text-left font-medium px-2 py-2">Quando</th>
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

function ReconciliationView({ accounts, payables, receivables, bankEntries, transfers, categories, onSavePayables, onSaveReceivables, onSaveBankEntries, onSaveTransfers }) {
  const [contaId, setContaId] = useState(accounts[0]?.id || "");
  const [draftModal, setDraftModal] = useState(null); // { line, idx, suggestion }
  const [transferDraft, setTransferDraft] = useState(null); // { line, idx, suggestion }
  useEffect(() => {
    if (!accounts.find((a) => a.id === contaId)) setContaId(accounts[0]?.id || "");
  }, [accounts]); // eslint-disable-line react-hooks/exhaustive-deps

  const [fileName, setFileName] = useState("");
  const [statementLines, setStatementLines] = useState(null);
  const [parseError, setParseError] = useState("");

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError("");
    setFileName(file.name);
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

  if (accounts.length === 0) {
    return <EmptyState icon={Landmark} title="Nenhuma conta cadastrada" subtitle="Cadastre uma conta para conciliar o extrato bancário." />;
  }

  return (
    <div className="space-y-4">
      <Header title="Conciliação Bancária" subtitle="Importe o extrato do banco (CSV ou OFX) e cruze automaticamente com os lançamentos do sistema." />

      <Card className="p-4 space-y-3">
        <div className="flex items-end gap-3 flex-wrap">
          <Field label="Conta">
            <Select value={contaId} onChange={(e) => { setContaId(e.target.value); setStatementLines(null); }}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </Select>
          </Field>
          <Field label="Extrato do banco (.csv ou .ofx)">
            <label
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium cursor-pointer"
              style={{ background: COLORS.primary, color: "#fff" }}
            >
              <Upload size={15} /> {fileName || "Escolher arquivo"}
              <input type="file" accept=".csv,.ofx,.txt" className="hidden" onChange={handleFile} />
            </label>
          </Field>
          {result && (
            <Button variant="ghost" onClick={() => { setStatementLines(null); setFileName(""); }}>
              <X size={15} /> Limpar
            </Button>
          )}
        </div>
        {parseError && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: COLORS.redSoft, color: COLORS.red }}>
            <AlertTriangle size={15} /> {parseError}
          </div>
        )}
        <div className="flex items-start gap-2 text-xs" style={{ color: COLORS.inkSoft }}>
          <HelpCircle size={14} className="shrink-0 mt-0.5" />
          <span>Aceita OFX exportado do internet banking, ou CSV com colunas de data e valor (com ou sem cabeçalho) — serve pra extrato de banco, fatura de cartão de crédito, relatório de repasse de maquininha ou de delivery, desde que a compra/venda esteja lançada com essa mesma conta. O sistema casa cada linha do extrato com um lançamento já cadastrado pelo mesmo valor, em até 3 dias de diferença.</span>
        </div>
      </Card>

      {result && (
        <>
          <div className="grid grid-cols-3 gap-3">
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
                          <div className="flex justify-end gap-1.5">
                            {transferSuggestion && otherAcc && (
                              <button
                                onClick={() => openTransferDraft(line, idx, transferSuggestion)}
                                className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full"
                                style={{ background: COLORS.goldSoft, color: COLORS.gold }}
                              >
                                <ArrowLeftRight size={12} /> Confirmar transferência
                              </button>
                            )}
                            <button onClick={() => openDraftModal(line, idx)} className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full" style={{ background: COLORS.amberSoft, color: COLORS.amber }}>
                              <Plus size={12} /> Lançar e conciliar
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
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Documentos Recebidos — caixa de entrada do link de upload sem login   */
/* ---------------------------------------------------------------------- */
function DocumentUploadsView({ uploads, selectedEmpresa, onSave, onProcess, processError }) {
  const [preview, setPreview] = useState(null); // { item, url }
  const [previewError, setPreviewError] = useState("");
  const [processing, setProcessing] = useState(false);

  const visible = uploads
    .filter((u) => u.empresaId === selectedEmpresa)
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

  const setStatus = (id, status) => onSave(uploads.map((u) => (u.id === id ? { ...u, status } : u)));
  const remove = (id) => {
    if (!confirmDelete("Excluir este documento da caixa de entrada? O arquivo enviado não pode ser recuperado depois.")) return;
    onSave(uploads.filter((u) => u.id !== id));
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
      <Header title="Documentos Recebidos" subtitle="Arquivos que os clientes enviaram pelo link de upload, sem precisar logar no sistema." />
      {processError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: COLORS.redSoft, color: COLORS.red }}>
          <AlertTriangle size={15} /> {processError}
        </div>
      )}
      <Card className="overflow-x-auto">
        {visible.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Nenhum documento recebido"
            subtitle='Copie o link de upload no ícone "🔗" do card da empresa (tela Empresas) e envie pro cliente — os arquivos que ele mandar aparecem aqui.'
          />
        ) : (
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr style={{ color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.border}` }}>
                <th className="text-left font-medium px-4 py-2.5">Arquivo</th>
                <th className="text-left font-medium px-4 py-2.5">Recebido</th>
                <th className="text-left font-medium px-4 py-2.5">Status</th>
                <th className="text-right font-medium px-4 py-2.5">Ações</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => (
                <tr key={u.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                  <td className="px-4 py-2.5" style={{ color: COLORS.ink }}>
                    <button onClick={() => openPreview(u)} className="hover:underline text-left" title="Visualizar documento e classificar">
                      {u.fileName}
                    </button>
                  </td>
                  <td className="px-4 py-2.5" style={{ color: COLORS.inkSoft }}>{timeAgo(u.created_at)}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={u.status === "processado" ? "green" : "amber"}>{u.status === "processado" ? "Processado" : "Pendente"}</Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openPreview(u)} title="Visualizar documento e classificar" className="p-1.5 rounded-md hover:bg-black/5">
                        <FileText size={14} color={COLORS.inkSoft} />
                      </button>
                      <button
                        onClick={() => setStatus(u.id, u.status === "processado" ? "pendente" : "processado")}
                        title={u.status === "processado" ? "Marcar como pendente" : "Marcar como processado"}
                        className="p-1.5 rounded-md hover:bg-black/5"
                      >
                        <Check size={14} color={u.status === "processado" ? COLORS.inkSoft : COLORS.green} />
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
  const pendentesTotal = documentUploads.filter((u) => u.status !== "processado").length;

  return (
    <div className="space-y-4">
      <Header title="Visão Geral" subtitle="Seu portfólio de empresas atendidas." />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs" style={{ color: COLORS.inkSoft }}>Clientes ativos</p>
          <p className="text-lg font-semibold" style={{ color: COLORS.ink }}>{empresas.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs" style={{ color: COLORS.inkSoft }}>Segmentos atendidos</p>
          <p className="text-lg font-semibold" style={{ color: COLORS.ink }}>{Object.keys(segmentoCounts).length || "—"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs" style={{ color: COLORS.inkSoft }}>Documentos pendentes no portfólio</p>
          <p className="text-lg font-semibold" style={{ color: pendentesTotal > 0 ? COLORS.amber : COLORS.ink }}>{pendentesTotal}</p>
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
                <p className="font-semibold text-sm" style={{ color: COLORS.ink }}>{empresa.nome}</p>
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
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Resumo (visão estilo BPO — saldo, fluxo navegável, próximos/aberto/vencido) */
/* ---------------------------------------------------------------------- */
function monthFlowFor(payables, receivables, bankEntries, y, m) {
  let entradas = 0, saidas = 0;
  receivables.forEach((r) => {
    if (r.status === "Recebido" && yearOf(r.dataReceb) === y && monthIndex(r.dataReceb) === m) {
      entradas += Number(r.valorRecebido || r.valor || 0);
    }
  });
  payables.forEach((p) => {
    if (p.status === "Pago" && yearOf(p.dataPgto) === y && monthIndex(p.dataPgto) === m) {
      saidas += Number(p.valorPago || p.valor || 0);
    }
  });
  bankEntries.forEach((b) => {
    if (yearOf(b.data) === y && monthIndex(b.data) === m) {
      if (b.tipo === "Entrada") entradas += Number(b.valor || 0);
      else saidas += Number(b.valor || 0);
    }
  });
  return { entradas, saidas };
}

function ExposureTable({ items, nameField, mode }) {
  // mode: "proximos" | "aberto" | "vencido"
  const today = todayISO();
  if (mode === "proximos") {
    const rows = items
      .filter((i) => (i.vencimento || "") >= today)
      .sort((a, b) => (a.vencimento || "").localeCompare(b.vencimento || ""))
      .slice(0, 8);
    if (rows.length === 0) return <p className="text-sm py-6 text-center" style={{ color: COLORS.inkSoft }}>Nada agendado.</p>;
    return (
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
    );
  }

  const pool = mode === "vencido" ? items.filter((i) => (i.vencimento || "") < today) : items;
  const total = pool.reduce((s, i) => s + Number(i.valor || 0), 0);
  const byName = {};
  pool.forEach((i) => {
    const key = i[nameField] || "—";
    byName[key] = (byName[key] || 0) + Number(i.valor || 0);
  });
  const rows = Object.entries(byName).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <div className="flex justify-between text-sm pb-2 mb-2 font-semibold" style={{ borderBottom: `1px solid ${COLORS.border}`, color: COLORS.ink }}>
        <span>Total {mode === "vencido" ? "vencido" : "em aberto"}</span>
        <span className="tabular-nums">{fmtBRL(total)}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm py-4 text-center" style={{ color: COLORS.inkSoft }}>Nada por aqui.</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map(([name, valor]) => (
            <div key={name} className="flex items-center justify-between text-sm py-0.5">
              <span style={{ color: COLORS.ink }}>{name}</span>
              <span className="font-medium tabular-nums" style={{ color: COLORS.ink }}>{fmtBRL(valor)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExposureCard({ title, items, nameField }) {
  const [tab, setTab] = useState("proximos");
  const tabs = [
    { id: "proximos", label: "Próximos" },
    { id: "aberto", label: "Em aberto" },
    { id: "vencido", label: "Vencido" },
  ];
  const open = items.filter((i) => i.status !== "Recebido" && i.status !== "Pago");
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
      <ExposureTable items={open} nameField={nameField} mode={tab} />
    </Card>
  );
}

function ResumoView({ accounts, payables, receivables, bankEntries, transfers, accountBalance, totalBalance }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const now = new Date();

  const months = [-1, 0, 1].map((d) => {
    const dt = new Date(now.getFullYear(), now.getMonth() + monthOffset + d, 1);
    return { y: dt.getFullYear(), m: dt.getMonth() };
  });
  const flow = months.map(({ y, m }) => ({ y, m, ...monthFlowFor(payables, receivables, bankEntries, y, m) }));

  return (
    <div className="space-y-4">
      <Header title="Resumo" subtitle="Saldos, fluxo de caixa e o que está por vir — tudo em um lugar." />

      <div className="grid md:grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold" style={{ color: COLORS.ink }}>Saldo</h2>
            <p className="text-lg font-semibold tabular-nums" style={{ color: COLORS.ink }}>{fmtBRL(totalBalance)}</p>
          </div>
          {accounts.length === 0 ? (
            <p className="text-sm" style={{ color: COLORS.inkSoft }}>Nenhuma conta cadastrada.</p>
          ) : (
            <div className="space-y-1.5">
              {accounts.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-sm py-1" style={{ borderTop: `1px solid ${COLORS.border}` }}>
                  <div>
                    <p style={{ color: COLORS.ink }}>{a.nome}</p>
                    <p className="text-xs" style={{ color: COLORS.inkSoft }}>{a.tipo}</p>
                  </div>
                  <p className="font-medium tabular-nums" style={{ color: COLORS.ink }}>{fmtBRL(accountBalance(a.id))}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold" style={{ color: COLORS.ink }}>Fluxo de caixa</h2>
            <div className="flex items-center gap-1">
              <button onClick={() => setMonthOffset((o) => o - 1)} title="Mês anterior" className="p-1 rounded hover:bg-black/5"><ChevronLeft size={16} color={COLORS.inkSoft} /></button>
              <button onClick={() => setMonthOffset(0)} title="Voltar pro mês atual" className="text-xs px-1.5" style={{ color: COLORS.inkSoft }}>hoje</button>
              <button onClick={() => setMonthOffset((o) => o + 1)} title="Próximo mês" className="p-1 rounded hover:bg-black/5"><ChevronRight size={16} color={COLORS.inkSoft} /></button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {flow.map(({ y, m, entradas, saidas }) => (
              <div key={`${y}-${m}`} className="rounded-lg p-2.5" style={{ background: "#F8F7F3" }}>
                <p className="text-xs font-medium mb-1.5" style={{ color: COLORS.inkSoft }}>{MONTH_NAMES[m].slice(0, 3)}/{String(y).slice(2)}</p>
                <p className="text-xs" style={{ color: COLORS.green }}>+{fmtBRL(entradas)}</p>
                <p className="text-xs" style={{ color: COLORS.red }}>−{fmtBRL(saidas)}</p>
                <p className="text-xs font-semibold mt-1" style={{ color: entradas - saidas >= 0 ? COLORS.green : COLORS.red }}>
                  {fmtBRL(entradas - saidas)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <ExposureCard title="Recebimentos" items={receivables} nameField="cliente" />
        <ExposureCard title="Pagamentos" items={payables} nameField="fornecedor" />
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
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) setError("E-mail ou senha inválidos.");
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
        if (err) {
          let detail = err.message;
          if (err.context && typeof err.context.json === "function") {
            try {
              const b = await err.context.clone().json();
              if (b?.error) detail = b.error;
            } catch {
              // corpo não era JSON — mantém a mensagem genérica
            }
          }
          throw new Error(detail);
        }
        if (!data?.ok) throw new Error(data?.error || "Não consegui enviar o arquivo.");
        setSent((prev) => [...prev, { fileName: file.name, empresaNome: data.empresaNome }]);
      } catch (err) {
        setError(err?.message || "Erro ao enviar o documento.");
      }
    }
    setUploading(false);
  };

  const empresaNome = sent[0]?.empresaNome;

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
          {empresaNome ? `Envio de documentos — ${empresaNome}` : "Envie boletos, notas fiscais e comprovantes pro seu analista, sem precisar de login."}
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

        <p className="text-xs mt-5" style={{ color: COLORS.inkSoft }}>
          Pode enviar mais de um arquivo. Seu analista financeiro vai revisar e lançar cada documento no sistema.
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
