import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  LayoutDashboard, Wallet, ArrowDownCircle, ArrowUpCircle, Landmark,
  ArrowLeftRight, ListTree, Plus, X, Check, Trash2, Pencil, AlertTriangle,
  TrendingUp, TrendingDown, CircleDollarSign, ChevronDown, Search, Building2, FileText, Printer,
  CheckCircle2, Upload, HelpCircle, Users, Image as ImageIcon, ChevronLeft, ChevronRight, CalendarClock,
  Calendar, Bell, LogOut, Sparkles
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

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const todayISO = () => new Date().toISOString().slice(0, 10);

const fmtBRL = (n) =>
  (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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

function Button({ children, onClick, variant = "primary", type = "button", className = "", disabled }) {
  const base = "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
  const styles = {
    primary: { background: COLORS.primary, color: "#fff" },
    ghost: { background: "transparent", color: COLORS.primary, border: `1px solid ${COLORS.border}` },
    danger: { background: COLORS.redSoft, color: COLORS.red },
    subtle: { background: "#EFEEE8", color: COLORS.ink },
  };
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`${base} ${className}`} style={styles[variant]}>
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

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(20,24,22,0.45)" }}>
      <div
        className={`w-full ${wide ? "max-w-2xl" : "max-w-md"} rounded-2xl overflow-hidden max-h-[90vh] flex flex-col`}
        style={{ background: COLORS.panel }}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
          <h3 className="font-semibold text-base" style={{ color: COLORS.ink }}>{title}</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-black/5">
            <X size={18} color={COLORS.inkSoft} />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
      </div>
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
  const [view, setView] = useState("gestor");
  const [empresas, setEmpresas] = useState([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState("all");
  const [accounts, setAccounts] = useState([]);
  const [payables, setPayables] = useState([]);
  const [receivables, setReceivables] = useState([]);
  const [bankEntries, setBankEntries] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [fiscalObligations, setFiscalObligations] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [year, setYear] = useState(new Date().getFullYear());
  const [saveError, setSaveError] = useState(null);
  const [navQuery, setNavQuery] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);

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
      setCategories(data.categories || DEFAULT_CATEGORIES);
      // Dono não tem visão consolidada entre empresas — pousa direto no
      // Resumo da(s) empresa(s) dele. Gestor pousa na Visão Geral.
      setSelectedEmpresa(myRole === "owner" ? (data.empresas || [])[0]?.id || "all" : data.selectedEmpresa || "all");
      setView(myRole === "owner" ? "resumo" : "gestor");
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

  const allCategoryNames = useMemo(
    () => [...categories.receitas.map((c) => c.nome), ...categories.despesas.map((c) => c.nome)],
    [categories]
  );

  const inScope = useCallback(
    (item) => selectedEmpresa === "all" || item.empresaId === selectedEmpresa,
    [selectedEmpresa]
  );
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
        .filter((r) => r.status === "Recebido" && r.contaRecebId === accId)
        .reduce((s, r) => s + Number(r.valorRecebido || r.valor || 0), 0);
      const bankIn = bankEntries
        .filter((b) => b.tipo === "Entrada" && b.contaId === accId)
        .reduce((s, b) => s + Number(b.valor || 0), 0);
      const transfIn = transfers
        .filter((t) => t.contaDestinoId === accId)
        .reduce((s, t) => s + Number(t.valor || 0), 0);
      const payOut = payables
        .filter((p) => p.status === "Pago" && p.contaPgtoId === accId)
        .reduce((s, p) => s + Number(p.valorPago || p.valor || 0), 0);
      const bankOut = bankEntries
        .filter((b) => b.tipo === "Saída" && b.contaId === accId)
        .reduce((s, b) => s + Number(b.valor || 0), 0);
      const transfOut = transfers
        .filter((t) => t.contaOrigemId === accId)
        .reduce((s, t) => s + Number(t.valor || 0), 0);
      return (
        Number(acc.saldoInicial || 0) + recIn + bankIn + transfIn - payOut - bankOut - transfOut
      );
    },
    [accounts, receivables, bankEntries, transfers, payables]
  );

  const totalBalance = useMemo(
    () => accountsF.reduce((s, a) => s + accountBalance(a.id), 0),
    [accountsF, accountBalance]
  );

  // monthly realized cash flow for selected year: {entradas[12], saidas[12]}
  const buildMonthlyFlow = useCallback((recArr, payArr, bankArr, yr) => {
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
    let acc = 0;
    const acumulado = entradas.map((e, i) => (acc += e - saidas[i]));
    return { entradas, saidas, acumulado };
  }, []);

  const monthlyFlow = useMemo(
    () => buildMonthlyFlow(receivablesF, payablesF, bankEntriesF, year),
    [receivablesF, payablesF, bankEntriesF, year, buildMonthlyFlow]
  );

  const empresaBreakdown = useMemo(() => {
    if (empresas.length === 0) return [];
    return empresas.map((emp) => {
      const recE = receivables.filter((r) => r.empresaId === emp.id);
      const payE = payables.filter((p) => p.empresaId === emp.id);
      const bankE = bankEntries.filter((b) => b.empresaId === emp.id);
      const accE = accounts.filter((a) => a.empresaId === emp.id);
      const flow = buildMonthlyFlow(recE, payE, bankE, year);
      const entradas = flow.entradas.reduce((a, b) => a + b, 0);
      const saidas = flow.saidas.reduce((a, b) => a + b, 0);
      const saldoContas = accE.reduce((s, a) => s + accountBalance(a.id), 0);
      return { empresa: emp, entradas, saidas, saldo: entradas - saidas, saldoContas };
    });
  }, [empresas, receivables, payables, bankEntries, accounts, year, buildMonthlyFlow, accountBalance]);

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
      map[p.categoria].pago += Number(p.valorPago || p.valor || 0);
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
      map[r.categoria].recebido += Number(r.valorRecebido || r.valor || 0);
    });
    receivablesF.forEach((r) => {
      if (r.status === "Recebido") return;
      map[r.categoria] = map[r.categoria] || { recebido: 0, aReceber: 0 };
      map[r.categoria].aReceber += Number(r.valor || 0);
    });
    return map;
  }, [receivablesF]);

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

  if (!ready) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: COLORS.bg, minHeight: 480 }}>
        <p style={{ color: COLORS.inkSoft }} className="text-sm">Carregando sistema financeiro…</p>
      </div>
    );
  }

  const nav = [
    ...(role === "gestor" ? [{ id: "gestor", label: "Visão Geral", icon: Users }] : []),
    { id: "dashboard", label: "Painel", icon: LayoutDashboard },
    { id: "resumo", label: "Resumo", icon: CalendarClock },
    { id: "empresas", label: "Empresas", icon: Building2 },
    { id: "accounts", label: "Contas", icon: Landmark },
    { id: "payables", label: "Contas a Pagar", icon: ArrowUpCircle },
    { id: "receivables", label: "Contas a Receber", icon: ArrowDownCircle },
    { id: "bank", label: "Lançamentos Bancários", icon: Wallet },
    { id: "transfers", label: "Transferências", icon: ArrowLeftRight },
    { id: "fiscal", label: "Calendário Fiscal", icon: Calendar },
    { id: "categories", label: "Plano de Contas", icon: ListTree },
    { id: "reconciliation", label: "Conciliação Bancária", icon: CheckCircle2 },
    { id: "reports", label: "Relatórios", icon: FileText },
  ];
  const navById = Object.fromEntries(nav.map((n) => [n.id, n]));

  const RAIL_SECTIONS = [
    { id: "visao", label: "Visão Geral", icon: LayoutDashboard, items: ["gestor", "dashboard", "resumo"] },
    { id: "cadastros", label: "Cadastros", icon: Building2, items: ["empresas", "accounts"] },
    { id: "lancamentos", label: "Lançamentos", icon: Wallet, items: ["payables", "receivables", "bank", "transfers"] },
    { id: "fiscal", label: "Fiscal", icon: Calendar, items: ["fiscal", "categories"] },
    { id: "analise", label: "Análise", icon: FileText, items: ["reconciliation", "reports"] },
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
              onClick={() => { setNavQuery(""); setView(first.id); }}
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
        <div className="px-2 pb-3">
          <select
            value={selectedEmpresa}
            onChange={(e) => changeEmpresa(e.target.value)}
            className="w-full text-sm rounded-lg px-2.5 py-2 outline-none"
            style={{ background: COLORS.bg, color: COLORS.ink, border: `1px solid ${COLORS.border}` }}
          >
            <option value="all">Todas as empresas</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>{e.nome}</option>
            ))}
          </select>
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
              onClick={() => setView(n.id)}
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
            <button onClick={() => setUserMenuOpen((v) => !v)} className="flex items-center gap-2">
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
                <Button onClick={() => setView("empresas")}><Plus size={15} /> Cadastrar empresa</Button>
              </div>
            )}
          </Card>
        ) : (
          <>
            {view === "gestor" && (
              <GestorDashboard
                empresas={empresas}
                empresaBreakdown={empresaBreakdown}
                year={year}
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
                selectedEmpresa={selectedEmpresa}
                empresaBreakdown={empresaBreakdown}
              />
            )}

            {view === "empresas" && (
              <EmpresasView empresas={empresas} role={role} onSave={(v) => persist("empresas", v, setEmpresas)} />
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

            {view === "payables" && (
              <PayablesView
                payables={payables}
                accounts={accounts}
                empresas={empresas}
                selectedEmpresa={selectedEmpresa}
                categories={categories.despesas}
                onSave={(v) => persist("payables", v, setPayables)}
              />
            )}

            {view === "receivables" && (
              <ReceivablesView
                receivables={receivables}
                accounts={accounts}
                empresas={empresas}
                selectedEmpresa={selectedEmpresa}
                categories={categories.receitas}
                onSave={(v) => persist("receivables", v, setReceivables)}
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
                empresas={empresas}
                selectedEmpresa={selectedEmpresa}
                onSave={(v) => persist("fiscalObligations", v, setFiscalObligations)}
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
                empresas={empresas}
                selectedEmpresa={selectedEmpresa}
                categoryBreakdown={categoryBreakdown}
                receivableBreakdown={receivableBreakdown}
                empresaBreakdown={empresaBreakdown}
                accountBalance={accountBalance}
                totals={totals}
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
  selectedEmpresa, empresaBreakdown,
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
          <p className="text-sm" style={{ color: COLORS.inkSoft }}>Regime de caixa · visão consolidada do ano</p>
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

      {selectedEmpresa === "all" && empresaBreakdown.length > 1 && (
        <Card className="p-4 overflow-x-auto">
          <h2 className="text-sm font-semibold mb-3" style={{ color: COLORS.ink }}>Resultado por empresa</h2>
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr style={{ color: COLORS.inkSoft }}>
                <th className="text-left font-medium pb-2">Empresa</th>
                <th className="text-right font-medium pb-2">Entradas</th>
                <th className="text-right font-medium pb-2">Saídas</th>
                <th className="text-right font-medium pb-2">Saldo do ano</th>
                <th className="text-right font-medium pb-2">Saldo em contas</th>
              </tr>
            </thead>
            <tbody>
              {empresaBreakdown.map((eb) => (
                <tr key={eb.empresa.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                  <td className="py-2">
                    <span className="inline-flex items-center gap-2" style={{ color: COLORS.ink }}>
                      <span className="w-2 h-2 rounded-full" style={{ background: eb.empresa.cor }} />
                      {eb.empresa.nome}
                    </span>
                  </td>
                  <td className="py-2 text-right tabular-nums" style={{ color: COLORS.green }}>{fmtBRL(eb.entradas)}</td>
                  <td className="py-2 text-right tabular-nums" style={{ color: COLORS.red }}>{fmtBRL(eb.saidas)}</td>
                  <td className="py-2 text-right tabular-nums font-medium" style={{ color: eb.saldo >= 0 ? COLORS.green : COLORS.red }}>{fmtBRL(eb.saldo)}</td>
                  <td className="py-2 text-right tabular-nums" style={{ color: COLORS.ink }}>{fmtBRL(eb.saldoContas)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

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
/*  Accounts                                                               */
/* ---------------------------------------------------------------------- */
function EmpresaTag({ empresas, empresaId }) {
  const emp = empresas.find((e) => e.id === empresaId);
  if (!emp) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: COLORS.inkSoft }}>
      <span className="w-2 h-2 rounded-full" style={{ background: emp.cor }} />
      {emp.nome}
    </span>
  );
}

function EmpresasView({ empresas, role, onSave }) {
  const [modal, setModal] = useState(null);
  const isGestor = role === "gestor";

  const submit = (form) => {
    if (form.id) onSave(empresas.map((e) => (e.id === form.id ? form : e)));
    else onSave([...empresas, { ...form, id: uid() }]);
    setModal(null);
  };
  const remove = (id) => onSave(empresas.filter((e) => e.id !== id));

  return (
    <div className="space-y-4">
      <Header title="Empresas do grupo" subtitle="Cada empresa mantém suas próprias contas, contas a pagar/receber e lançamentos, dentro do mesmo sistema.">
        {isGestor && <Button onClick={() => setModal({})}><Plus size={15} /> Nova empresa</Button>}
      </Header>

      {empresas.length === 0 ? (
        <Card><EmptyState icon={Building2} title="Nenhuma empresa cadastrada" subtitle="Ex.: Casarão, Casa Pôr do Sol, Vai da Praia." /></Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {empresas.map((e) => (
            <Card key={e.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  {e.logoUrl ? (
                    <img src={e.logoUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" style={{ border: `1px solid ${COLORS.border}` }} />
                  ) : (
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: e.cor }} />
                  )}
                  <div>
                    <p className="font-semibold text-sm" style={{ color: COLORS.ink }}>{e.nome}</p>
                    {e.cnpj && <p className="text-xs" style={{ color: COLORS.inkSoft }}>{e.cnpj}</p>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setModal(e)} className="p-1.5 rounded-md hover:bg-black/5"><Pencil size={14} color={COLORS.inkSoft} /></button>
                  {isGestor && (
                    <button onClick={() => remove(e.id)} className="p-1.5 rounded-md hover:bg-black/5"><Trash2 size={14} color={COLORS.red} /></button>
                  )}
                </div>
              </div>
              {isGestor && <EmpresaOwnersPanel empresa={e} />}
            </Card>
          ))}
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
              <button onClick={() => removeOwner(ownerEmail)} className="hover:opacity-70"><X size={11} /></button>
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
        />
        <Button variant="subtle" onClick={addOwner} disabled={busy}>
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
      setCnpjError(err.message || "Falha ao consultar o CNPJ.");
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
        <Field label="Cor de identificação">
          <div className="flex gap-2 pt-1">
            {EMPRESA_CORES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setForm({ ...form, cor: c })}
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

function AccountsView({ accounts, empresas, selectedEmpresa, accountBalance, onSave }) {
  const [modal, setModal] = useState(null); // account being edited, or {} for new
  const visible = accounts.filter((a) => selectedEmpresa === "all" || a.empresaId === selectedEmpresa);

  const submit = (form) => {
    if (form.id) {
      onSave(accounts.map((a) => (a.id === form.id ? form : a)));
    } else {
      onSave([...accounts, { ...form, id: uid() }]);
    }
    setModal(null);
  };

  const remove = (id) => onSave(accounts.filter((a) => a.id !== id));

  return (
    <div className="space-y-4">
      <Header title="Contas (Caixa & Bancos)" subtitle="Cadastre onde o dinheiro entra e sai.">
        <Button onClick={() => setModal({ empresaId: selectedEmpresa !== "all" ? selectedEmpresa : empresas[0]?.id })}>
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
                  {selectedEmpresa === "all" && <div className="pt-1"><EmpresaTag empresas={empresas} empresaId={a.empresaId} /></div>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setModal(a)} className="p-1.5 rounded-md hover:bg-black/5"><Pencil size={14} color={COLORS.inkSoft} /></button>
                  <button onClick={() => remove(a.id)} className="p-1.5 rounded-md hover:bg-black/5"><Trash2 size={14} color={COLORS.red} /></button>
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

      {modal && <AccountModal initial={modal} empresas={empresas} onClose={() => setModal(null)} onSubmit={submit} />}
    </div>
  );
}

function AccountModal({ initial, empresas, onClose, onSubmit }) {
  const [form, setForm] = useState({
    nome: "", tipo: "Conta Corrente", banco: "", agencia: "", contaNum: "",
    saldoInicial: 0, dataInicial: todayISO(), empresaId: empresas[0]?.id || "", ...initial,
  });
  const valid = form.nome.trim() && form.empresaId;
  return (
    <Modal title={initial.id ? "Editar conta" : "Nova conta"} onClose={onClose}>
      <div className="grid gap-3">
        <Field label="Empresa">
          <Select value={form.empresaId} onChange={(e) => setForm({ ...form, empresaId: e.target.value })}>
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </Select>
        </Field>
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
          <Field label="Banco"><TextInput value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} /></Field>
          <Field label="Agência"><TextInput value={form.agencia} onChange={(e) => setForm({ ...form, agencia: e.target.value })} /></Field>
          <Field label="Conta nº"><TextInput value={form.contaNum} onChange={(e) => setForm({ ...form, contaNum: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Saldo inicial (R$)">
            <TextInput type="number" step="0.01" value={form.saldoInicial} onChange={(e) => setForm({ ...form, saldoInicial: e.target.value })} />
          </Field>
          <Field label="Data do saldo inicial">
            <TextInput type="date" value={form.dataInicial} onChange={(e) => setForm({ ...form, dataInicial: e.target.value })} />
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
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative flex-1 min-w-[200px]">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" color={COLORS.inkSoft} />
        <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder={placeholder} className="pl-8" />
      </div>
      <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
        <option value="">Todos os status</option>
        {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
      </Select>
      {setDateFrom && (
        <>
          <TextInput type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" title="Vencimento de" />
          <span className="text-sm" style={{ color: COLORS.inkSoft }}>até</span>
          <TextInput type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" title="Vencimento até" />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-xs font-medium px-2 py-1 rounded-full" style={{ background: "#EFEEE8", color: COLORS.ink }}>
              Limpar período
            </button>
          )}
        </>
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
        const bg = { green: COLORS.greenSoft, red: COLORS.redSoft, amber: COLORS.amberSoft, neutral: "#EEEDE7" }[tone];
        const fg = { green: COLORS.green, red: COLORS.red, amber: COLORS.amber, neutral: COLORS.inkSoft }[tone];
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
function PayablesView({ payables, accounts, empresas, selectedEmpresa, categories, onSave }) {
  const [modal, setModal] = useState(null);
  const [payModal, setPayModal] = useState(null);
  const [scheduleModal, setScheduleModal] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const withDerived = payables
    .filter((p) => selectedEmpresa === "all" || p.empresaId === selectedEmpresa)
    .map((p) => {
      let statusDisplay = p.status;
      if (p.status !== "Pago" && p.vencimento < todayISO()) statusDisplay = "Atrasado";
      else if (p.status !== "Pago" && daysUntil(p.vencimento) <= 10) statusDisplay = "Próximo";
      return { ...p, statusDisplay };
    });

  const filtered = withDerived.filter((p) => {
    if (status && p.statusDisplay !== status) return false;
    if (search && !`${p.fornecedor} ${p.descricao} ${p.categoria}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (dateFrom && (p.vencimento || "") < dateFrom) return false;
    if (dateTo && (p.vencimento || "") > dateTo) return false;
    return true;
  }).sort((a, b) => (b.dataLanc || "").localeCompare(a.dataLanc || ""));

  const submit = (formOrList) => {
    const list = Array.isArray(formOrList) ? formOrList : [formOrList];
    if (list.length === 1 && list[0].id) {
      onSave(payables.map((p) => (p.id === list[0].id ? list[0] : p)));
    } else {
      onSave([...payables, ...list.map((f) => ({ ...f, id: uid() }))]);
    }
    setModal(null);
  };

  const remove = (id) => onSave(payables.filter((p) => p.id !== id));

  const confirmPayment = (id, dataPgto, valorPago, contaPgtoId) => {
    onSave(payables.map((p) => (p.id === id ? { ...p, status: "Pago", dataPgto, valorPago, contaPgtoId } : p)));
    setPayModal(null);
  };

  const confirmSchedule = (ids, dataPgto, contaPgtoId) => {
    const idSet = new Set(ids);
    onSave(payables.map((p) => (idSet.has(p.id) ? { ...p, status: "Pago", dataPgto, valorPago: p.valor, contaPgtoId } : p)));
    setScheduleModal(false);
  };

  const total = filtered.reduce((s, p) => s + Number(p.valor || 0), 0);

  return (
    <div className="space-y-4">
      <Header title="Contas a Pagar" subtitle={`${filtered.length} lançamento(s) · ${fmtBRL(total)}`}>
        <Button variant="ghost" onClick={() => setScheduleModal(true)}>
          <CalendarClock size={15} /> Agendar pagamentos
        </Button>
        <Button onClick={() => setModal({ empresaId: selectedEmpresa !== "all" ? selectedEmpresa : empresas[0]?.id })}>
          <Plus size={15} /> Novo lançamento
        </Button>
      </Header>
      <StatusSummary items={withDerived} statuses={[
        { key: "A Pagar", label: "A pagar", tone: "neutral" },
        { key: "Próximo", label: "Próximo (10 dias)", tone: "amber" },
        { key: "Atrasado", label: "Atrasado", tone: "red" },
        { key: "Pago", label: "Pago", tone: "green" },
      ]} />
      <FilterBar search={search} setSearch={setSearch} status={status} setStatus={setStatus}
        statusOptions={["A Pagar", "Próximo", "Pago", "Atrasado"]} placeholder="Buscar fornecedor, descrição..."
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
                {selectedEmpresa === "all" && <th className="text-left font-medium px-4 py-2.5">Empresa</th>}
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
                  {selectedEmpresa === "all" && <td className="px-4 py-2.5"><EmpresaTag empresas={empresas} empresaId={p.empresaId} /></td>}
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium" style={{ color: COLORS.ink }}>{fmtBRL(p.valor)}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={p.statusDisplay} />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      {p.status !== "Pago" && (
                        <Button variant="subtle" onClick={() => setPayModal(p)}><Check size={13} /> Dar baixa</Button>
                      )}
                      <button onClick={() => setModal(p)} className="p-1.5 rounded-md hover:bg-black/5"><Pencil size={14} color={COLORS.inkSoft} /></button>
                      <button onClick={() => remove(p.id)} className="p-1.5 rounded-md hover:bg-black/5"><Trash2 size={14} color={COLORS.red} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {modal && (
        <PayableModal initial={modal} categories={categories} empresas={empresas} onClose={() => setModal(null)} onSubmit={submit} />
      )}
      {payModal && (
        <SettleModal
          title="Dar baixa — Contas a Pagar"
          label="Valor pago"
          dateLabel="Data do pagamento"
          accountLabel="Conta de pagamento"
          item={payModal}
          accounts={accounts.filter((a) => a.empresaId === payModal.empresaId)}
          onClose={() => setPayModal(null)}
          onConfirm={(data, valor, contaId) => confirmPayment(payModal.id, data, valor, contaId)}
        />
      )}
      {scheduleModal && (
        <ScheduleModal
          title="Agendar pagamentos"
          nameField="fornecedor"
          items={payables.filter((p) => p.status !== "Pago" && (selectedEmpresa === "all" || p.empresaId === selectedEmpresa))}
          accounts={accounts}
          empresas={empresas}
          onClose={() => setScheduleModal(false)}
          onConfirm={confirmSchedule}
        />
      )}
    </div>
  );
}

const stripInstallmentMeta = (f) => {
  const { parcelas, recorrente, repetirMeses, ...rest } = f;
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
  return <Badge tone="neutral">{status}</Badge>;
}

function PayableModal({ initial, categories, empresas, onClose, onSubmit }) {
  const [form, setForm] = useState({
    dataLanc: todayISO(), vencimento: todayISO(), fornecedor: "", categoria: categories[0]?.nome || "",
    descricao: "", valor: "", formaPgto: "PIX", status: "A Pagar", empresaId: empresas[0]?.id || "", ...initial,
  });
  const valid = form.fornecedor.trim() && Number(form.valor) > 0 && form.empresaId;
  return (
    <Modal title={initial.id ? "Editar conta a pagar" : "Nova conta a pagar"} onClose={onClose} wide>
      <div className="grid md:grid-cols-2 gap-3">
        {empresas.length > 1 && (
          <Field label="Empresa">
            <Select value={form.empresaId} onChange={(e) => setForm({ ...form, empresaId: e.target.value })}>
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Fornecedor"><TextInput value={form.fornecedor} onChange={(e) => setForm({ ...form, fornecedor: e.target.value })} /></Field>
        <Field label="Categoria">
          <Select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
            {categories.map((c) => <option key={c.codigo} value={c.nome}>{c.nome}</option>)}
          </Select>
        </Field>
        <Field label="Descrição"><TextInput value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="md:col-span-2" /></Field>
        <Field label="Data de lançamento"><TextInput type="date" value={form.dataLanc} onChange={(e) => setForm({ ...form, dataLanc: e.target.value })} /></Field>
        <Field label="Vencimento"><TextInput type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} /></Field>
        <Field label="Valor (R$)"><TextInput type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></Field>
        <Field label="Forma de pagamento">
          <Select value={form.formaPgto} onChange={(e) => setForm({ ...form, formaPgto: e.target.value })}>
            <option>PIX</option><option>Boleto</option><option>TED</option><option>Dinheiro</option>
            <option>Cartão</option><option>Débito Automático</option>
          </Select>
        </Field>
        {!initial.id && <InstallmentFields form={form} setForm={setForm} />}
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={() => valid && onSubmit(initial.id ? stripInstallmentMeta(form) : expandEntries(form))} disabled={!valid}>Salvar</Button>
      </div>
    </Modal>
  );
}

function SettleModal({ title, label, dateLabel, accountLabel, item, accounts, onClose, onConfirm }) {
  const [data, setData] = useState(todayISO());
  const [valor, setValor] = useState(item.valor);
  const [contaId, setContaId] = useState(accounts[0]?.id || "");
  return (
    <Modal title={title} onClose={onClose}>
      <div className="grid gap-3">
        <Field label={dateLabel}><TextInput type="date" value={data} onChange={(e) => setData(e.target.value)} /></Field>
        <Field label={label}><TextInput type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} /></Field>
        <Field label={accountLabel}>
          <Select value={contaId} onChange={(e) => setContaId(e.target.value)}>
            {accounts.length === 0 && <option value="">Cadastre uma conta primeiro</option>}
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </Select>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onConfirm(data, valor, contaId)} disabled={!contaId}>Confirmar baixa</Button>
        </div>
      </div>
    </Modal>
  );
}

function ScheduleModal({ title, items, nameField, accounts, empresas, onClose, onConfirm }) {
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
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Conta que vai pagar">
            <Select value={contaId} onChange={(e) => { setContaId(e.target.value); setChecked({}); }}>
              <option value="">Selecione uma conta</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.nome}{empresas?.length > 1 ? ` — ${empresas.find((e) => e.id === a.empresaId)?.nome || ""}` : ""}</option>
              ))}
            </Select>
          </Field>
          <Field label="Data do pagamento">
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
              Confirmar {selecionados.length > 0 ? `(${selecionados.length})` : ""}
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
function ReceivablesView({ receivables, accounts, empresas, selectedEmpresa, categories, onSave }) {
  const [modal, setModal] = useState(null);
  const [recModal, setRecModal] = useState(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const withDerived = receivables
    .filter((r) => selectedEmpresa === "all" || r.empresaId === selectedEmpresa)
    .map((r) => {
      let statusDisplay = r.status;
      if (r.status !== "Recebido" && r.vencimento < todayISO()) statusDisplay = "Inadimplente";
      else if (r.status !== "Recebido" && daysUntil(r.vencimento) <= 10) statusDisplay = "Próximo";
      return { ...r, statusDisplay };
    });

  const filtered = withDerived.filter((r) => {
    if (status && r.statusDisplay !== status) return false;
    if (search && !`${r.cliente} ${r.descricao} ${r.categoria}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (dateFrom && (r.vencimento || "") < dateFrom) return false;
    if (dateTo && (r.vencimento || "") > dateTo) return false;
    return true;
  }).sort((a, b) => (b.dataLanc || "").localeCompare(a.dataLanc || ""));

  const submit = (formOrList) => {
    const list = Array.isArray(formOrList) ? formOrList : [formOrList];
    if (list.length === 1 && list[0].id) {
      onSave(receivables.map((r) => (r.id === list[0].id ? list[0] : r)));
    } else {
      onSave([...receivables, ...list.map((f) => ({ ...f, id: uid() }))]);
    }
    setModal(null);
  };
  const remove = (id) => onSave(receivables.filter((r) => r.id !== id));
  const confirmReceipt = (id, dataReceb, valorRecebido, contaRecebId) => {
    onSave(receivables.map((r) => (r.id === id ? { ...r, status: "Recebido", dataReceb, valorRecebido, contaRecebId } : r)));
    setRecModal(null);
  };

  const total = filtered.reduce((s, r) => s + Number(r.valor || 0), 0);

  return (
    <div className="space-y-4">
      <Header title="Contas a Receber" subtitle={`${filtered.length} lançamento(s) · ${fmtBRL(total)}`}>
        <Button onClick={() => setModal({ empresaId: selectedEmpresa !== "all" ? selectedEmpresa : empresas[0]?.id })}>
          <Plus size={15} /> Novo lançamento
        </Button>
      </Header>
      <StatusSummary items={withDerived} statuses={[
        { key: "A Receber", label: "A receber", tone: "neutral" },
        { key: "Próximo", label: "Próximo (10 dias)", tone: "amber" },
        { key: "Inadimplente", label: "Inadimplente", tone: "red" },
        { key: "Recebido", label: "Recebido", tone: "green" },
      ]} />
      <FilterBar search={search} setSearch={setSearch} status={status} setStatus={setStatus}
        statusOptions={["A Receber", "Próximo", "Recebido", "Inadimplente"]} placeholder="Buscar cliente, descrição..."
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
                {selectedEmpresa === "all" && <th className="text-left font-medium px-4 py-2.5">Empresa</th>}
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
                  {selectedEmpresa === "all" && <td className="px-4 py-2.5"><EmpresaTag empresas={empresas} empresaId={r.empresaId} /></td>}
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium" style={{ color: COLORS.ink }}>{fmtBRL(r.valor)}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={r.statusDisplay} /></td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      {r.status !== "Recebido" && (
                        <Button variant="subtle" onClick={() => setRecModal(r)}><Check size={13} /> Dar baixa</Button>
                      )}
                      <button onClick={() => setModal(r)} className="p-1.5 rounded-md hover:bg-black/5"><Pencil size={14} color={COLORS.inkSoft} /></button>
                      <button onClick={() => remove(r.id)} className="p-1.5 rounded-md hover:bg-black/5"><Trash2 size={14} color={COLORS.red} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {modal && (
        <ReceivableModal initial={modal} categories={categories} empresas={empresas} onClose={() => setModal(null)} onSubmit={submit} />
      )}
      {recModal && (
        <SettleModal
          title="Dar baixa — Contas a Receber"
          label="Valor recebido"
          dateLabel="Data do recebimento"
          accountLabel="Conta de recebimento"
          item={recModal}
          accounts={accounts.filter((a) => a.empresaId === recModal.empresaId)}
          onClose={() => setRecModal(null)}
          onConfirm={(data, valor, contaId) => confirmReceipt(recModal.id, data, valor, contaId)}
        />
      )}
    </div>
  );
}

function ReceivableModal({ initial, categories, empresas, onClose, onSubmit }) {
  const [form, setForm] = useState({
    dataLanc: todayISO(), vencimento: todayISO(), cliente: "", categoria: categories[0]?.nome || "",
    descricao: "", valor: "", formaReceb: "PIX", status: "A Receber", empresaId: empresas[0]?.id || "", ...initial,
  });
  const valid = form.cliente.trim() && Number(form.valor) > 0 && form.empresaId;
  return (
    <Modal title={initial.id ? "Editar conta a receber" : "Nova conta a receber"} onClose={onClose} wide>
      <div className="grid md:grid-cols-2 gap-3">
        {empresas.length > 1 && (
          <Field label="Empresa">
            <Select value={form.empresaId} onChange={(e) => setForm({ ...form, empresaId: e.target.value })}>
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Cliente"><TextInput value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} /></Field>
        <Field label="Categoria">
          <Select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
            {categories.map((c) => <option key={c.codigo} value={c.nome}>{c.nome}</option>)}
          </Select>
        </Field>
        <Field label="Descrição"><TextInput value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="md:col-span-2" /></Field>
        <Field label="Data de lançamento"><TextInput type="date" value={form.dataLanc} onChange={(e) => setForm({ ...form, dataLanc: e.target.value })} /></Field>
        <Field label="Vencimento"><TextInput type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} /></Field>
        <Field label="Valor (R$)"><TextInput type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></Field>
        <Field label="Forma de recebimento">
          <Select value={form.formaReceb} onChange={(e) => setForm({ ...form, formaReceb: e.target.value })}>
            <option>PIX</option><option>Boleto</option><option>TED</option><option>Dinheiro</option><option>Cartão</option>
          </Select>
        </Field>
        {!initial.id && <InstallmentFields form={form} setForm={setForm} />}
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={() => valid && onSubmit(initial.id ? stripInstallmentMeta(form) : expandEntries(form))} disabled={!valid}>Salvar</Button>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/*  Lançamentos Bancários                                                  */
/* ---------------------------------------------------------------------- */
function BankEntriesView({ entries, accounts, empresas, selectedEmpresa, categories, onSave }) {
  const [modal, setModal] = useState(null);
  const scopedAccounts = accounts.filter((a) => selectedEmpresa === "all" || a.empresaId === selectedEmpresa);
  const submit = (form) => {
    if (form.id) onSave(entries.map((e) => (e.id === form.id ? form : e)));
    else onSave([...entries, { ...form, id: uid() }]);
    setModal(null);
  };
  const remove = (id) => onSave(entries.filter((e) => e.id !== id));
  const sorted = [...entries]
    .filter((e) => selectedEmpresa === "all" || e.empresaId === selectedEmpresa)
    .sort((a, b) => (b.data || "").localeCompare(a.data || ""));

  return (
    <div className="space-y-4">
      <Header title="Lançamentos Bancários" subtitle="Entradas e saídas avulsas direto do banco: juros, tarifas, IOF, rendimentos.">
        <Button onClick={() => setModal({})} disabled={scopedAccounts.length === 0}><Plus size={15} /> Novo lançamento</Button>
      </Header>
      {scopedAccounts.length === 0 && (
        <p className="text-sm px-1" style={{ color: COLORS.inkSoft }}>Cadastre uma conta antes de lançar movimentos bancários.</p>
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
                {selectedEmpresa === "all" && <th className="text-left font-medium px-4 py-2.5">Empresa</th>}
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
                    {selectedEmpresa === "all" && <td className="px-4 py-2.5"><EmpresaTag empresas={empresas} empresaId={e.empresaId} /></td>}
                    <td className="px-4 py-2.5"><Badge tone={e.tipo === "Entrada" ? "green" : "red"}>{e.tipo}</Badge></td>
                    <td className="px-4 py-2.5" style={{ color: COLORS.inkSoft }}>{e.categoria}</td>
                    <td className="px-4 py-2.5" style={{ color: COLORS.inkSoft }}>{e.descricao}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium" style={{ color: e.tipo === "Entrada" ? COLORS.green : COLORS.red }}>
                      {e.tipo === "Entrada" ? "+" : "−"}{fmtBRL(e.valor)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setModal(e)} className="p-1.5 rounded-md hover:bg-black/5"><Pencil size={14} color={COLORS.inkSoft} /></button>
                        <button onClick={() => remove(e.id)} className="p-1.5 rounded-md hover:bg-black/5"><Trash2 size={14} color={COLORS.red} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
      {modal && <BankEntryModal initial={modal} accounts={scopedAccounts} categories={categories} onClose={() => setModal(null)} onSubmit={submit} />}
    </div>
  );
}

function BankEntryModal({ initial, accounts, categories, suggestion, onClose, onSubmit }) {
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
    <Modal title={initial.id ? "Editar lançamento" : "Novo lançamento bancário"} onClose={onClose}>
      <div className="grid gap-3">
        <Field label="Data"><TextInput type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></Field>
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
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => valid && submit()} disabled={!valid}>Salvar</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/*  Transferências                                                         */
/* ---------------------------------------------------------------------- */
function TransfersView({ transfers, accounts, empresas, selectedEmpresa, onSave }) {
  const [modal, setModal] = useState(null);
  const scopedAccounts = accounts.filter((a) => selectedEmpresa !== "all" && a.empresaId === selectedEmpresa);
  const submit = (form) => {
    if (form.id) onSave(transfers.map((t) => (t.id === form.id ? form : t)));
    else onSave([...transfers, { ...form, id: uid() }]);
    setModal(null);
  };
  const remove = (id) => onSave(transfers.filter((t) => t.id !== id));
  const sorted = [...transfers]
    .filter((t) => selectedEmpresa === "all" || t.empresaId === selectedEmpresa)
    .sort((a, b) => (b.data || "").localeCompare(a.data || ""));

  return (
    <div className="space-y-4">
      <Header title="Transferências entre contas" subtitle="Movimentações internas — não afetam o fluxo de caixa.">
        <Button onClick={() => setModal({})} disabled={scopedAccounts.length < 2}><Plus size={15} /> Nova transferência</Button>
      </Header>
      {selectedEmpresa === "all" ? (
        <p className="text-sm px-1" style={{ color: COLORS.inkSoft }}>Selecione uma empresa específica no menu lateral para registrar uma transferência entre contas dela.</p>
      ) : scopedAccounts.length < 2 ? (
        <p className="text-sm px-1" style={{ color: COLORS.inkSoft }}>Cadastre pelo menos 2 contas nesta empresa para registrar transferências.</p>
      ) : null}
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
                {selectedEmpresa === "all" && <th className="text-left font-medium px-4 py-2.5">Empresa</th>}
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
                    {selectedEmpresa === "all" && <td className="px-4 py-2.5"><EmpresaTag empresas={empresas} empresaId={t.empresaId} /></td>}
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium" style={{ color: COLORS.ink }}>{fmtBRL(t.valor)}</td>
                    <td className="px-4 py-2.5" style={{ color: COLORS.inkSoft }}>{t.descricao}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setModal(t)} className="p-1.5 rounded-md hover:bg-black/5"><Pencil size={14} color={COLORS.inkSoft} /></button>
                        <button onClick={() => remove(t.id)} className="p-1.5 rounded-md hover:bg-black/5"><Trash2 size={14} color={COLORS.red} /></button>
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
        <Field label="Data"><TextInput type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></Field>
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
  return `${MONTHS[Number(m) - 1] || m}/${y}`;
}

function FiscalView({ obligations, accounts, empresas, selectedEmpresa, onSave }) {
  const [modal, setModal] = useState(null);
  const [payModal, setPayModal] = useState(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const withDerived = obligations
    .filter((o) => selectedEmpresa === "all" || o.empresaId === selectedEmpresa)
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
    if (form.id) onSave(obligations.map((o) => (o.id === form.id ? form : o)));
    else onSave([...obligations, { ...form, id: uid() }]);
    setModal(null);
  };
  const remove = (id) => onSave(obligations.filter((o) => o.id !== id));
  const confirmPayment = (id, dataPagamento, valor, contaId) => {
    onSave(obligations.map((o) => (o.id === id ? { ...o, status: "Pago", dataPagamento, valor, contaId } : o)));
    setPayModal(null);
  };

  const total = filtered.reduce((s, o) => s + Number(o.valor || 0), 0);

  return (
    <div className="space-y-4">
      <Header title="Calendário Fiscal" subtitle={`${filtered.length} obrigação(ões) · ${fmtBRL(total)}`}>
        <Button onClick={() => setModal({ empresaId: selectedEmpresa !== "all" ? selectedEmpresa : empresas[0]?.id })}>
          <Plus size={15} /> Nova obrigação
        </Button>
      </Header>
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
                {selectedEmpresa === "all" && <th className="text-left font-medium px-4 py-2.5">Empresa</th>}
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
                  {selectedEmpresa === "all" && <td className="px-4 py-2.5"><EmpresaTag empresas={empresas} empresaId={o.empresaId} /></td>}
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium" style={{ color: COLORS.ink }}>{fmtBRL(o.valor)}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={o.statusDisplay} /></td>
                  <td className="px-4 py-2.5" style={{ color: COLORS.inkSoft }}>{accounts.find((a) => a.id === o.contaId)?.nome || "—"}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      {o.status !== "Pago" && (
                        <Button variant="subtle" onClick={() => setPayModal(o)}><Check size={13} /> Dar baixa</Button>
                      )}
                      <button onClick={() => setModal(o)} className="p-1.5 rounded-md hover:bg-black/5"><Pencil size={14} color={COLORS.inkSoft} /></button>
                      <button onClick={() => remove(o.id)} className="p-1.5 rounded-md hover:bg-black/5"><Trash2 size={14} color={COLORS.red} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {modal && (
        <FiscalModal initial={modal} empresas={empresas} onClose={() => setModal(null)} onSubmit={submit} />
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

function FiscalModal({ initial, empresas, onClose, onSubmit }) {
  const [form, setForm] = useState({
    competencia: todayISO().slice(0, 7), vencimento: todayISO(), tributo: TRIBUTOS_COMUNS[0],
    descricao: "", valor: "", status: "Pendente", empresaId: empresas[0]?.id || "", ...initial,
  });
  const valid = form.tributo.trim() && Number(form.valor) > 0 && form.empresaId;
  return (
    <Modal title={initial.id ? "Editar obrigação" : "Nova obrigação fiscal"} onClose={onClose} wide>
      <div className="grid md:grid-cols-2 gap-3">
        {empresas.length > 1 && (
          <Field label="Empresa">
            <Select value={form.empresaId} onChange={(e) => setForm({ ...form, empresaId: e.target.value })}>
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </Select>
          </Field>
        )}
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
                  <button onClick={() => removeReceita(c.codigo)} className="p-1 rounded hover:bg-black/5"><Trash2 size={13} color={COLORS.red} /></button>
                )}
              </div>
            ))}
          </div>
          {!readOnly && (
            <div className="flex gap-2">
              <TextInput value={newReceita} onChange={(e) => setNewReceita(e.target.value)} placeholder="Nova categoria de receita" onKeyDown={(e) => e.key === "Enter" && addReceita()} />
              <Button variant="subtle" onClick={addReceita}><Plus size={14} /></Button>
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
                  <button onClick={() => removeDespesa(c.codigo)} className="p-1 rounded hover:bg-black/5"><Trash2 size={13} color={COLORS.red} /></button>
                )}
              </div>
            ))}
          </div>
          {!readOnly && (
            <div className="flex gap-2">
              <TextInput value={newDespesa} onChange={(e) => setNewDespesa(e.target.value)} placeholder="Nova categoria de despesa" onKeyDown={(e) => e.key === "Enter" && addDespesa()} />
              <Button variant="subtle" onClick={addDespesa}><Plus size={14} /></Button>
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
  { id: "aging", label: "Aging", Comp: AgingReport },
  { id: "comparativo", label: "Comparativo entre Empresas", Comp: ComparativoReport },
  { id: "extrato", label: "Extrato de Conta", Comp: ExtratoContaReport },
];

function ReportsView(props) {
  const { empresas, selectedEmpresa, year } = props;
  const [tab, setTab] = useState("dre");
  const [printMode, setPrintMode] = useState("current"); // "current" | "all" — decides what shows up when window.print() runs
  const empresaLabel = selectedEmpresa === "all" ? "Todas as empresas" : empresas.find((e) => e.id === selectedEmpresa)?.nome || "";
  const empresaLogo = selectedEmpresa === "all" ? null : empresas.find((e) => e.id === selectedEmpresa)?.logoUrl;
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
            <h2 className="text-lg font-semibold" style={{ color: COLORS.ink }}>{selectedEmpresa === "all" ? "Todas as empresas" : empresaLabel} · {activeReport.label}</h2>
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
                  <h2 className="text-lg font-semibold" style={{ color: COLORS.ink }}>{selectedEmpresa === "all" ? "Todas as empresas" : empresaLabel} · {label}</h2>
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
function DREReport({ year, categoryBreakdown, receivableBreakdown, totals }) {
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
  const resultado = totalReceitas - totalDespesas;

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
function FluxoProjetadoReport({ payables, receivables, accounts, accountBalance }) {
  const today = todayISO();
  const totalBalance = accounts.reduce((s, a) => s + accountBalance(a.id), 0);

  const openPayables = payables.filter((p) => p.status !== "Pago");
  const openReceivables = receivables.filter((r) => r.status !== "Recebido");

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
    const saidas = openPayables
      .filter((p) => b.test(daysBetween(today, p.vencimento)))
      .reduce((s, p) => s + Number(p.valor || 0), 0);
    if (b.label !== "Vencidos") saldoAcumulado += entradas - saidas;
    return { label: b.label, entradas, saidas, saldoAcumulado, vencidos: b.label === "Vencidos" };
  });

  const itemized = [...openPayables.map((p) => ({ ...p, __tipo: "Pagar", __nome: p.fornecedor })), ...openReceivables.map((r) => ({ ...r, __tipo: "Receber", __nome: r.cliente }))]
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
function ExtratoContaReport({ accounts, payables, receivables, bankEntries, transfers, accountBalance }) {
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
    movs.push({ id: `pg-${p.id}`, data: p.dataPgto, tipo: "Saída", valor: Number(p.valorPago || p.valor || 0), descricao: `Pagamento — ${p.fornecedor}` });
  });
  receivables.filter((r) => r.status === "Recebido" && r.contaRecebId === contaId).forEach((r) => {
    movs.push({ id: `rc-${r.id}`, data: r.dataReceb, tipo: "Entrada", valor: Number(r.valorRecebido || r.valor || 0), descricao: `Recebimento — ${r.cliente}` });
  });
  transfers.filter((t) => t.contaOrigemId === contaId).forEach((t) => {
    movs.push({ id: `to-${t.id}`, data: t.data, tipo: "Saída", valor: Number(t.valor || 0), descricao: `Transferência enviada — ${t.descricao || ""}` });
  });
  transfers.filter((t) => t.contaDestinoId === contaId).forEach((t) => {
    movs.push({ id: `td-${t.id}`, data: t.data, tipo: "Entrada", valor: Number(t.valor || 0), descricao: `Transferência recebida — ${t.descricao || ""}` });
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
  bankEntries.filter((b) => b.contaId === contaId).forEach((b) => {
    movs.push({ key: `bank-${b.id}`, source: "bank", id: b.id, data: b.data, tipo: b.tipo, valor: Number(b.valor || 0), descricao: `${b.categoria} — ${b.descricao || ""}`, conciliado: !!b.conciliado });
  });
  payables.filter((p) => p.status === "Pago" && p.contaPgtoId === contaId).forEach((p) => {
    movs.push({ key: `pay-${p.id}`, source: "payable", id: p.id, data: p.dataPgto, tipo: "Saída", valor: Number(p.valorPago || p.valor || 0), descricao: `Pagamento — ${p.fornecedor}`, conciliado: !!p.conciliado });
  });
  receivables.filter((r) => r.status === "Recebido" && r.contaRecebId === contaId).forEach((r) => {
    movs.push({ key: `rec-${r.id}`, source: "receivable", id: r.id, data: r.dataReceb, tipo: "Entrada", valor: Number(r.valorRecebido || r.valor || 0), descricao: `Recebimento — ${r.cliente}`, conciliado: !!r.conciliado });
  });
  transfers.filter((t) => t.contaOrigemId === contaId).forEach((t) => {
    movs.push({ key: `trfo-${t.id}`, source: "transfer", id: t.id, data: t.data, tipo: "Saída", valor: Number(t.valor || 0), descricao: `Transferência enviada — ${t.descricao || ""}`, conciliado: !!t.conciliado });
  });
  transfers.filter((t) => t.contaDestinoId === contaId).forEach((t) => {
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

function ReconciliationView({ accounts, payables, receivables, bankEntries, transfers, categories, onSavePayables, onSaveReceivables, onSaveBankEntries, onSaveTransfers }) {
  const [contaId, setContaId] = useState(accounts[0]?.id || "");
  const [draftModal, setDraftModal] = useState(null); // { line, idx, suggestion }
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
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: line.tipo === "Entrada" ? COLORS.green : COLORS.red }}>
                          {line.tipo === "Entrada" ? "+" : "−"}{fmtBRL(line.valor)}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <button onClick={() => openDraftModal(line, idx)} className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full" style={{ background: COLORS.amberSoft, color: COLORS.amber }}>
                            <Plus size={12} /> Lançar e conciliar
                          </button>
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
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Visão Geral (dashboard do gestor — landing pós-login)                  */
/* ---------------------------------------------------------------------- */
function GestorDashboard({ empresas, empresaBreakdown, year, onOpenEmpresa }) {
  if (empresas.length === 0) {
    return (
      <div className="space-y-4">
        <Header title="Visão Geral" subtitle="Todas as empresas do grupo, num só lugar." />
        <Card className="p-8">
          <EmptyState icon={Building2} title="Nenhuma empresa cadastrada" subtitle="Cadastre a primeira empresa em “Empresas” pra começar." />
        </Card>
      </div>
    );
  }

  const totalEntradas = empresaBreakdown.reduce((s, e) => s + e.entradas, 0);
  const totalSaidas = empresaBreakdown.reduce((s, e) => s + e.saidas, 0);
  const totalSaldoContas = empresaBreakdown.reduce((s, e) => s + e.saldoContas, 0);

  return (
    <div className="space-y-4">
      <Header title="Visão Geral" subtitle={`Todas as empresas do grupo · Ano ${year}`} />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs" style={{ color: COLORS.inkSoft }}>Entradas no ano (todas)</p>
          <p className="text-lg font-semibold" style={{ color: COLORS.green }}>{fmtBRL(totalEntradas)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs" style={{ color: COLORS.inkSoft }}>Saídas no ano (todas)</p>
          <p className="text-lg font-semibold" style={{ color: COLORS.red }}>{fmtBRL(totalSaidas)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs" style={{ color: COLORS.inkSoft }}>Saldo em contas (todas)</p>
          <p className="text-lg font-semibold" style={{ color: COLORS.ink }}>{fmtBRL(totalSaldoContas)}</p>
        </Card>
      </div>

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
              <button onClick={() => setMonthOffset((o) => o - 1)} className="p-1 rounded hover:bg-black/5"><ChevronLeft size={16} color={COLORS.inkSoft} /></button>
              <button onClick={() => setMonthOffset(0)} className="text-xs px-1.5" style={{ color: COLORS.inkSoft }}>hoje</button>
              <button onClick={() => setMonthOffset((o) => o + 1)} className="p-1 rounded hover:bg-black/5"><ChevronRight size={16} color={COLORS.inkSoft} /></button>
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
/*  Auth gate                                                              */
/* ---------------------------------------------------------------------- */
export default function App() {
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
