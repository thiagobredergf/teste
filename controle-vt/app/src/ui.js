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

// Entrega de arquivos. No visualizador de artefatos a página não pode iniciar downloads: usa a permissão `downloads`
// (o visualizador pede confirmação). Fora dele, baixa direto.
let permissaoDownloads;
async function downloads() {
  if (permissaoDownloads !== undefined) return permissaoDownloads;
  try { permissaoDownloads = window.claude?.use ? await window.claude.use('downloads') : null; } catch { permissaoDownloads = null; }
  return permissaoDownloads;
}
export const emVisualizador = () => typeof window.claude?.use === 'function';

export async function entregar(nome, dados) {
  const dl = await downloads();
  if (dl) {
    try { await dl.save({ filename: nome, data: dados }); return 'salvo'; }
    catch (e) { if (e.code !== 'declined') aviso(`Não foi possível salvar "${nome}": ${e.message}`, 'erro'); return null; }
  }
  if (emVisualizador()) { // no visualizador, um download direto é ignorado sem aviso: melhor dizer claramente
    aviso('Este ambiente não permite baixar arquivos. Use a versão em arquivo (controle-vt.html) para salvar e exportar.', 'erro');
    return null;
  }
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(dados instanceof Blob ? dados : new Blob([dados])), download: nome });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return 'salvo';
}

// CSV no padrão do Excel em português: ";" como separador, UTF-8 com BOM.
export function baixarCsv(nome, cabecalho, linhas) {
  const cel = (v) => { const t = String(v ?? ''); return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  return entregar(nome, '\ufeff' + [cabecalho, ...linhas].map((l) => l.map(cel).join(';')).join('\r\n'));
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

function caixa(corpo, aoFechar) {
  const d = document.createElement('dialog');
  d.innerHTML = `<form method="dialog">${corpo}</form>`;
  d.onclose = () => { d.remove(); aoFechar(); };
  document.body.appendChild(d); d.showModal();
  return d;
}

// Substitui confirm(): o visualizador de artefatos nunca mostra confirm/prompt/alert.
export function confirmar(titulo, texto, rotuloOk = 'Confirmar') {
  return new Promise((resolve) => {
    let r = false;
    const d = caixa(`<h3>${esc(titulo)}</h3><p style="white-space:pre-line">${esc(texto)}</p>
      <div class="acoes"><button type="button" class="cancelar">Cancelar</button><button class="primario">${esc(rotuloOk)}</button></div>`, () => resolve(r));
    d.querySelector('.cancelar').onclick = () => d.close();
    d.querySelector('form').onsubmit = (e) => { e.preventDefault(); r = true; d.close(); };
  });
}

// Substitui prompt(). Devolve o texto digitado ou null se cancelado.
export function pedirTexto(titulo, rotulo, { tipo = 'text', dica = '' } = {}) {
  return new Promise((resolve) => {
    let r = null;
    const d = caixa(`<h3>${esc(titulo)}</h3><label>${esc(rotulo)}<input name="v" type="${tipo}" autocomplete="off"></label>${dica ? `<p class="mudo">${esc(dica)}</p>` : ''}
      <div class="acoes"><button type="button" class="cancelar">Cancelar</button><button class="primario">Confirmar</button></div>`, () => resolve(r));
    d.querySelector('.cancelar').onclick = () => d.close();
    d.querySelector('form').onsubmit = (e) => { e.preventDefault(); r = d.querySelector('input').value; d.close(); };
  });
}

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
