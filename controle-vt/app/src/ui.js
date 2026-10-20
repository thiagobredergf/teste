export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const brl = (c) => (c == null ? '' : (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

// Rótulos e gravidade dos sinalizadores do cálculo. "bloqueio": o servidor não pode ser recarregado sem resolver.
export const SINAIS = {
  SEM_CARTAO: ['Sem cartão utilizável', 'bloqueio'], SEM_CARTAO_NO_CADASTRO: ['Sem cartão no cadastro', 'bloqueio'],
  CARTAO_NAO_ENCONTRADO: ['Cartão do cadastro não está na Global Mob', 'bloqueio'], CARTAO_NAO_ATIVO: ['Cartão não está ativo', 'bloqueio'],
  CARTAO_DE_OUTRA_PESSOA: ['Cartão pertence a outro CPF', 'bloqueio'], SEM_CARTAO_ATIVO_NA_GLOBALMOB: ['Nenhum cartão ativo para o CPF', 'bloqueio'],
  VARIOS_CARTOES_ATIVOS: ['Vários cartões ativos para o CPF', 'atencao'], CPF_AUSENTE: ['CPF ausente ou inválido', 'atencao'],
  SEM_DIAS_SEMANA: ['Informe os dias por semana', 'bloqueio'], SEM_VALOR_DIARIO: ['Sem valor diário', 'bloqueio'], SEM_BENEFICIO: ['Sem benefício', 'bloqueio'],
  SEM_SALDO: ['Sem saldo da Global Mob', 'atencao'], SALDO_ANTIGO: ['Saldo antigo (ignorado)', 'atencao'], SALDO_COBRE_DIREITO: ['Saldo cobre o mês', 'info'],
  SALDO_ALTO: ['Saldo alto', 'atencao'], SALDO_NEGATIVO: ['Saldo negativo no cartão', 'atencao'], SEM_SALDO_INICIAL: ['Sem saldo inicial na relação', 'atencao'], RECARGA_PENDENTE_NA_GLOBALMOB: ['Há RECARGA na Global Mob', 'atencao'],
  DIAS_ZERADOS: ['Dias efetivos zerados', 'info'], SERVIDOR_SUSPENSO: ['Suspenso', 'info'], SERVIDOR_CANCELADO: ['Cancelado', 'info'],
  SEM_DESCONTO_INFORMADO: ['Sem desconto informado', 'atencao'], DESCONTO_ACIMA_DO_DIREITO: ['Desconto maior que o direito', 'atencao'], DESCONTO_ACIMA_DA_RECARGA: ['Desconto maior que a recarga', 'atencao'],
};
export const selo = (f) => { const [t, g] = SINAIS[f] ?? [f, 'info']; return `<span class="selo ${g}" title="${esc(f)}">${esc(t)}</span>`; };

export function aviso(texto, tipo = 'ok') {
  const el = document.createElement('div');
  el.className = `toast ${tipo}`; el.textContent = texto; el.setAttribute('role', 'status');
  document.body.appendChild(el);
  setTimeout(() => el.remove(), tipo === 'erro' ? 8000 : 3500);
}

// CSV no padrão do Excel em português: ";" como separador, UTF-8 com BOM.
export function baixarCsv(nome, cabecalho, linhas) {
  const cel = (v) => { const t = String(v ?? ''); return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const txt = '﻿' + [cabecalho, ...linhas].map((l) => l.map(cel).join(';')).join('\r\n');
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' })), download: nome });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export const reais = (c) => (c == null ? '' : (c / 100).toFixed(2).replace('.', ','));

// TXT do RH pode estar em UTF-8 ou Windows-1252 (ANSI): tenta UTF-8 estrito e cai para ANSI.
export async function lerTexto(arquivo) {
  const buf = await arquivo.arrayBuffer();
  try { return { texto: new TextDecoder('utf-8', { fatal: true }).decode(buf), codificacao: 'UTF-8' }; }
  catch { return { texto: new TextDecoder('windows-1252').decode(buf), codificacao: 'Windows-1252' }; }
}

export const hoje = () => new Date().toISOString().slice(0, 10);
export const ultimoDiaUtilAnterior = (ano, mes) => { // último dia útil do mês anterior ao da competência
  const d = new Date(Date.UTC(ano, mes - 1, 0));
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

// Diálogo modal simples. `corpoHtml` contém os campos; `aoConfirmar(form)` recebe o <form> e devolve false para manter aberto.
export function dialogo(titulo, corpoHtml, aoConfirmar) {
  const d = document.createElement('dialog');
  d.innerHTML = `<form method="dialog"><h3>${esc(titulo)}</h3>${corpoHtml}<div class="acoes"><button value="cancelar" type="button" class="cancelar">Cancelar</button><button class="primario" value="ok">Confirmar</button></div></form>`;
  document.body.appendChild(d);
  d.querySelector('.cancelar').onclick = () => d.close();
  d.querySelector('form').onsubmit = (e) => { e.preventDefault(); if (aoConfirmar(d.querySelector('form')) !== false) d.close(); };
  d.onclose = () => d.remove();
  d.showModal();
}
