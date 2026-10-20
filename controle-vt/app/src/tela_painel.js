import * as banco from './db.js';
import { estado } from './estado.js';
import { esc, brl } from './ui.js';
import { calcularMes, totais } from './calc.js';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const CORES = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#6b7280'];

// Pizza em SVG, sem biblioteca. Só faz sentido com poucas categorias.
function pizza(dados) {
  const total = dados.reduce((a, d) => a + d.valor, 0);
  if (!total) return '<p class="mudo">Sem dados.</p>';
  let ang = -Math.PI / 2;
  const fatias = dados.filter((d) => d.valor > 0).map((d, i) => {
    const a2 = ang + (d.valor / total) * 2 * Math.PI;
    const [x1, y1, x2, y2] = [Math.cos(ang), Math.sin(ang), Math.cos(a2), Math.sin(a2)].map((v) => 60 + 56 * v);
    const caminho = d.valor === total ? '<circle cx="60" cy="60" r="56"' : `<path d="M60 60 L${x1} ${y1} A56 56 0 ${a2 - ang > Math.PI ? 1 : 0} 1 ${x2} ${y2} Z"`;
    ang = a2;
    return `${caminho} fill="${CORES[i % CORES.length]}"><title>${esc(d.rotulo)}: ${d.valor}</title>${d.valor === total ? '</circle>' : '</path>'}`;
  }).join('');
  return `<div class="pizza"><svg viewBox="0 0 120 120" width="140" height="140" role="img">${fatias}</svg><ul>${dados.filter((d) => d.valor > 0).map((d, i) =>
    `<li><i style="background:${CORES[i % CORES.length]}"></i>${esc(d.rotulo)}: <b>${d.valor}</b> (${Math.round((d.valor / total) * 100)}%)</li>`).join('')}</ul></div>`;
}

function linha(pontos) {
  if (pontos.length < 2) return '<p class="mudo">O gráfico de linha aparece a partir do segundo mês fechado.</p>';
  const max = Math.max(...pontos.flatMap((p) => [p.direito, p.repasse])) || 1;
  const W = 360, H = 140, px = (i) => 30 + (i * (W - 50)) / (pontos.length - 1), py = (v) => H - 20 - (v / max) * (H - 40);
  const serie = (k, cor) => `<polyline fill="none" stroke="${cor}" stroke-width="2" points="${pontos.map((p, i) => `${px(i)},${py(p[k])}`).join(' ')}"/>${pontos.map((p, i) => `<circle cx="${px(i)}" cy="${py(p[k])}" r="3" fill="${cor}"><title>${esc(p.rotulo)}: ${brl(p[k])}</title></circle>`).join('')}`;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Direito e repasse por mês">${serie('direito', '#6b7280')}${serie('repasse', '#2563eb')}
    ${pontos.map((p, i) => `<text x="${px(i)}" y="${H - 4}" font-size="9" text-anchor="middle">${esc(p.rotulo)}</text>`).join('')}</svg>
    <p class="mudo"><i style="background:#6b7280" class="cor"></i> direito &nbsp; <i style="background:#2563eb" class="cor"></i> repasse</p>`;
}

export function render(raiz) {
  if (!estado.ym) { raiz.innerHTML = '<h2>Painel</h2><p class="aviso">Escolha uma competência.</p>'; return; }
  const { linhas } = calcularMes(estado.ym);
  const conta = (f) => linhas.filter(f).length;
  const faixas = [['mínimo', 'minimo'], ['médio', 'medio'], ['alto', 'alto']].map(([r, k]) => ({ rotulo: r, valor: conta((l) => l.faixa_saldo === k) }));
  faixas.push({ rotulo: 'sem faixa', valor: conta((l) => !l.faixa_saldo) });
  const acoes = [['Recarregar', 'RECARREGAR'], ['Não recarregar', 'NAO_RECARREGAR'], ['Revisar', 'REVISAR']].map(([r, k]) => ({ rotulo: r, valor: conta((l) => l.acao === k) }));
  const sit = ['ativo', 'suspenso'].map((s) => ({ rotulo: s, valor: conta((l) => l.situacao === s) }));
  const hist = banco.q('select ym, resumo from fechamento order by ym').map((f) => { const r = JSON.parse(f.resumo); return { rotulo: `${MESES[Number(f.ym.slice(5)) - 1]}/${f.ym.slice(2, 4)}`, direito: r.direito, repasse: r.repasse }; });
  const t = totais(linhas);
  raiz.innerHTML = `
    <h2>Painel — ${esc(estado.ym)}</h2>
    <div class="cartoes">
      <div class="cartao num"><b>${brl(t.direito)}</b><span>direito</span></div>
      <div class="cartao num ok"><b>${brl(t.repasse)}</b><span>repasse</span></div>
      <div class="cartao num"><b>${t.direito ? Math.round((1 - t.repasse / t.direito) * 100) : 0}%</b><span>abatido pelo saldo</span></div>
    </div>
    <div class="duas">
      <section class="cartao"><h3>Faixa de saldo</h3>${pizza(faixas)}</section>
      <section class="cartao"><h3>Ação do mês</h3>${pizza(acoes)}</section>
      <section class="cartao"><h3>Situação</h3>${pizza(sit)}</section>
      <section class="cartao"><h3>Direito × repasse por mês (fechados)</h3>${linha(hist)}</section>
    </div>`;
}
