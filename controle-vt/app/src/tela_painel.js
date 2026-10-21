import * as banco from './db.js';
import { estado } from './estado.js';
import { $, esc, brl, SINAIS } from './ui.js';
import { calcularMes, totais } from './calc.js';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const CORES = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#6b7280'];
const filtro = { unidade: '', cargo: '', limiar: 100 };

// Pizza em SVG, sem biblioteca. Só faz sentido com poucas categorias.
function pizza(dados) {
  const total = dados.reduce((a, d) => a + d.valor, 0);
  if (!total) return '<p class="mudo">Sem dados.</p>';
  let ang = -Math.PI / 2;
  const ativos = dados.filter((d) => d.valor > 0);
  const fatias = ativos.map((d, i) => {
    const a2 = ang + (d.valor / total) * 2 * Math.PI;
    const [x1, y1, x2, y2] = [Math.cos(ang), Math.sin(ang), Math.cos(a2), Math.sin(a2)].map((v) => 60 + 56 * v);
    const forma = d.valor === total ? `<circle cx="60" cy="60" r="56" fill="${CORES[i % 6]}"` : `<path d="M60 60 L${x1} ${y1} A56 56 0 ${a2 - ang > Math.PI ? 1 : 0} 1 ${x2} ${y2} Z" fill="${CORES[i % 6]}" stroke="var(--papel)" stroke-width="1"`;
    ang = a2;
    return `${forma}><title>${esc(d.rotulo)}: ${d.valor}</title>${d.valor === total ? '</circle>' : '</path>'}`;
  }).join('');
  return `<div class="pizza"><svg viewBox="0 0 120 120" width="140" height="140" role="img" aria-label="Distribuição">${fatias}</svg><ul>${ativos.map((d, i) =>
    `<li><i style="background:${CORES[i % 6]}"></i>${esc(d.rotulo)}: <b>${d.valor}</b> (${Math.round((d.valor / total) * 100)}%)</li>`).join('')}</ul></div>`;
}

// Barras horizontais: rótulo à esquerda, valor à direita, escala única.
function barras(itens, fmt) {
  if (!itens.length) return '<p class="mudo">Sem dados.</p>';
  const max = Math.max(...itens.map((i) => i.valor)) || 1;
  const H = 22, W = 520, ROT = 190, VAL = 80;
  return `<svg viewBox="0 0 ${W} ${itens.length * H + 4}" width="100%" style="max-width:640px" role="img" aria-label="Repasse por unidade">${itens.map((it, i) => {
    const y = i * H + 2, w = Math.max(1, ((W - ROT - VAL) * it.valor) / max);
    const nome = it.rotulo.length > 30 ? `${it.rotulo.slice(0, 29)}…` : it.rotulo;
    return `<text x="${ROT - 6}" y="${y + 14}" font-size="11" text-anchor="end" fill="var(--texto)">${esc(nome)}</text>
      <rect x="${ROT}" y="${y + 3}" width="${w}" height="${H - 8}" rx="2" fill="var(--azul)"><title>${esc(it.rotulo)}: ${fmt(it.valor)}</title></rect>
      <text x="${ROT + w + 5}" y="${y + 14}" font-size="11" fill="var(--mudo)">${fmt(it.valor)}</text>`;
  }).join('')}</svg>`;
}

function linha(pontos) {
  if (pontos.length < 2) return '<p class="mudo">O gráfico de linha aparece a partir do segundo mês fechado.</p>';
  const max = Math.max(...pontos.flatMap((p) => [p.direito, p.repasse])) || 1;
  const W = 420, H = 160, px = (i) => 34 + (i * (W - 56)) / (pontos.length - 1), py = (v) => H - 24 - (v / max) * (H - 44);
  const serie = (k, cor) => `<polyline fill="none" stroke="${cor}" stroke-width="2" points="${pontos.map((p, i) => `${px(i)},${py(p[k])}`).join(' ')}"/>${pontos.map((p, i) => `<circle cx="${px(i)}" cy="${py(p[k])}" r="3.5" fill="${cor}"><title>${esc(p.rotulo)}: ${brl(p[k])}</title></circle>`).join('')}`;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:520px" role="img" aria-label="Direito e repasse por mês"><line x1="30" x2="${W - 10}" y1="${H - 24}" y2="${H - 24}" stroke="var(--borda)"/>${serie('direito', '#6b7280')}${serie('repasse', '#2563eb')}
    ${pontos.map((p, i) => `<text x="${px(i)}" y="${H - 8}" font-size="10" text-anchor="middle" fill="var(--mudo)">${esc(p.rotulo)}</text>`).join('')}</svg>
    <p class="mudo"><i style="background:#6b7280" class="cor"></i> direito &nbsp; <i style="background:#2563eb" class="cor"></i> repasse</p>`;
}

// Mês anterior fechado: quem entrou, saiu ou mudou de valor. Um lançamento errado quase sempre aparece como variação.
function variacoes(linhas, ym, limiar) {
  const ant = banco.q('select ym, linhas from fechamento where ym < ? order by ym desc limit 1', [ym])[0];
  if (!ant) return { texto: 'Disponível depois do primeiro mês fechado.' };
  const antes = new Map(JSON.parse(ant.linhas).map((l) => [l.matricula, l]));
  const agora = new Map(linhas.map((l) => [l.matricula, l]));
  const itens = [];
  for (const [m, l] of agora) {
    const a = antes.get(m);
    if (!a) itens.push({ l, tipo: 'novo', de: 0, para: l.repasse_centavos });
    else if (Math.abs(l.repasse_centavos - a.repasse_centavos) >= limiar * 100) itens.push({ l, tipo: l.repasse_centavos > a.repasse_centavos ? 'subiu' : 'caiu', de: a.repasse_centavos, para: l.repasse_centavos });
  }
  for (const [m, a] of antes) if (!agora.has(m)) itens.push({ l: a, tipo: 'saiu', de: a.repasse_centavos, para: 0 });
  itens.sort((x, y) => Math.abs(y.para - y.de) - Math.abs(x.para - x.de));
  return { ant: ant.ym, itens };
}

export function render(raiz) {
  if (!estado.ym) { raiz.innerHTML = '<h2>Painel</h2><p class="aviso">Escolha uma competência.</p>'; return; }
  const tudo = calcularMes(estado.ym).linhas;
  const unidades = [...new Set(tudo.map((l) => l.unidade).filter(Boolean))].sort();
  const cargos = [...new Set(tudo.map((l) => l.cargo).filter(Boolean))].sort();
  const linhas = tudo.filter((l) => (!filtro.unidade || l.unidade === filtro.unidade) && (!filtro.cargo || l.cargo === filtro.cargo));
  const conta = (f) => linhas.filter(f).length;
  const faixas = [['mínimo', 'minimo'], ['médio', 'medio'], ['alto', 'alto']].map(([r, k]) => ({ rotulo: r, valor: conta((l) => l.faixa_saldo === k) }));
  faixas.push({ rotulo: 'sem faixa', valor: conta((l) => !l.faixa_saldo) });
  const acoes = [['Recarregar', 'RECARREGAR'], ['Não recarregar', 'NAO_RECARREGAR'], ['Revisar', 'REVISAR']].map(([r, k]) => ({ rotulo: r, valor: conta((l) => l.acao === k) }));
  const alertas = Object.entries(linhas.flatMap((l) => l.sinalizadores).reduce((m, f) => ({ ...m, [f]: (m[f] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([f, n]) => ({ rotulo: SINAIS[f]?.[0] ?? f, valor: n }));
  const porUnidade = Object.values(linhas.reduce((m, l) => { const k = l.unidade || '(não informado)'; m[k] = m[k] ?? { rotulo: k, valor: 0 }; m[k].valor += l.repasse_centavos; return m; }, {})).sort((a, b) => b.valor - a.valor).slice(0, 12);
  const hist = banco.q('select ym, resumo from fechamento order by ym').map((f) => { const r = JSON.parse(f.resumo); return { rotulo: `${MESES[Number(f.ym.slice(5)) - 1]}/${f.ym.slice(2, 4)}`, direito: r.direito, repasse: r.repasse }; });
  const t = totais(linhas);
  const v = variacoes(linhas, estado.ym, filtro.limiar);
  raiz.innerHTML = `
    <h2>Painel — ${esc(estado.ym)}</h2>
    <div class="acoes filtros">
      <label>Unidade <select id="p-unidade"><option value="">todas</option>${unidades.map((u) => `<option ${filtro.unidade === u ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select></label>
      <label>Cargo <select id="p-cargo"><option value="">todos</option>${cargos.map((c) => `<option ${filtro.cargo === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      ${filtro.unidade || filtro.cargo ? '<button id="p-limpar">Limpar filtros</button>' : ''}
    </div>
    <div class="cartoes">
      <div class="cartao num"><b>${t.servidores}</b><span>servidores</span></div>
      <div class="cartao num"><b>${brl(t.direito)}</b><span>direito</span></div>
      <div class="cartao num ok"><b>${brl(t.repasse)}</b><span>repasse</span></div>
      <div class="cartao num"><b>${t.direito ? Math.round((1 - t.repasse / t.direito) * 100) : 0}%</b><span>abatido pelo saldo</span></div>
      <div class="cartao num ${t.revisar ? 'erro' : ''}"><b>${t.revisar}</b><span>a revisar</span></div>
    </div>
    <div class="duas">
      <section class="cartao"><h3>Ação do mês</h3>${pizza(acoes)}</section>
      <section class="cartao"><h3>Faixa de saldo</h3>${pizza(faixas)}</section>
      <section class="cartao"><h3>Alertas mais frequentes</h3>${pizza(alertas)}</section>
      <section class="cartao"><h3>Direito × repasse por mês (fechados)</h3>${linha(hist)}</section>
    </div>
    <section class="cartao"><h3>Repasse por unidade${porUnidade.length === 12 ? ' (12 maiores)' : ''}</h3>${barras(porUnidade, brl)}</section>
    <section class="cartao"><h3>Variações em relação ao mês anterior</h3>
      ${v.texto ? `<p class="mudo">${v.texto}</p>` : `
      <div class="acoes"><label>Variação mínima (R$) <input id="p-limiar" type="number" min="0" value="${filtro.limiar}" style="width:7em"></label>
        <span class="mudo">Comparado a ${esc(v.ant)}. Quem entrou, saiu ou mudou de valor.</span></div>
      ${v.itens.length ? `<div class="rolagem" style="max-height:340px"><table class="tabela"><thead><tr><th>Matrícula</th><th>Nome</th><th>Unidade</th><th>O que houve</th><th class="n">Mês anterior</th><th class="n">Este mês</th><th class="n">Diferença</th></tr></thead><tbody>
        ${v.itens.slice(0, 30).map((i) => `<tr><td>${esc(i.l.matricula)}</td><td>${esc(i.l.nome)}</td><td>${esc(i.l.unidade)}</td><td><span class="selo ${i.tipo === 'caiu' || i.tipo === 'saiu' ? 'info' : 'atencao'}">${{ novo: 'entrou', saiu: 'saiu', subiu: 'subiu', caiu: 'caiu' }[i.tipo]}</span></td>
          <td class="n">${brl(i.de)}</td><td class="n">${brl(i.para)}</td><td class="n">${i.para - i.de > 0 ? '+' : ''}${brl(i.para - i.de)}</td></tr>`).join('')}</tbody></table></div>
        ${v.itens.length > 30 ? `<p class="mudo">Mostrando as 30 maiores de ${v.itens.length}.</p>` : ''}` : '<p class="mudo">Nenhuma variação acima do limite.</p>'}`}
    </section>`;
  $('#p-unidade').onchange = (e) => { filtro.unidade = e.target.value; render(raiz); };
  $('#p-cargo').onchange = (e) => { filtro.cargo = e.target.value; render(raiz); };
  if ($('#p-limpar')) $('#p-limpar').onclick = () => { filtro.unidade = ''; filtro.cargo = ''; render(raiz); };
  if ($('#p-limiar')) $('#p-limiar').onchange = (e) => { filtro.limiar = Math.max(0, Number(e.target.value) || 0); render(raiz); };
}
