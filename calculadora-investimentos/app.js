(() => {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Formatação e leitura de números (pt-BR)
   * ------------------------------------------------------------------ */
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const num2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = (v, d = 1) =>
    new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v) + '%';

  function compact(v) {
    const abs = Math.abs(v);
    const f = (x) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(x);
    if (abs >= 1e9) return `R$ ${f(v / 1e9)} bi`;
    if (abs >= 1e6) return `R$ ${f(v / 1e6)} mi`;
    if (abs >= 1e3) return `R$ ${f(v / 1e3)} mil`;
    return `R$ ${f(v)}`;
  }

  function parseBR(raw) {
    let s = String(raw).trim().replace(/R\$|\s/g, '');
    if (!s) return null;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
    return Number(s);
  }

  const plural = (n, one, many) => (n === 1 ? one : many);

  /* ------------------------------------------------------------------ *
   * Estado e validação
   * ------------------------------------------------------------------ */
  const DEFAULTS = { initial: '10.000,00', monthly: '1.000,00', years: '10', rate: '10,00', basis: 'year' };
  const MAX_MONEY = 1e9;
  const FIELDS = ['initial', 'monthly', 'years', 'rate'];

  const el = (id) => document.getElementById(id);
  const inputs = Object.fromEntries(FIELDS.map((f) => [f, el(f)]));
  const basisEl = el('basis');
  const rangeEl = el('years-range');
  const touched = new Set();

  function validate() {
    const errors = {};
    const v = {};
    const basis = basisEl.value;

    const money = (key, label, allowEmpty) => {
      const n = parseBR(inputs[key].value);
      if (n === null) { errors[key] = `Informe ${label} (pode ser 0).`; return; }
      if (Number.isNaN(n)) { errors[key] = 'Digite um número válido, como 1.500,00.'; return; }
      if (n < 0) { errors[key] = 'O valor não pode ser negativo.'; return; }
      if (n > MAX_MONEY) { errors[key] = 'O valor máximo é R$ 1.000.000.000,00.'; return; }
      v[key] = n;
    };
    money('initial', 'o valor inicial');
    money('monthly', 'o aporte mensal');

    const y = parseBR(inputs.years.value);
    if (y === null) errors.years = 'Informe o prazo em anos.';
    else if (Number.isNaN(y)) errors.years = 'Digite um número válido.';
    else if (!Number.isInteger(y)) errors.years = 'Use um número inteiro de anos.';
    else if (y < 1 || y > 50) errors.years = 'O prazo deve ficar entre 1 e 50 anos.';
    else v.years = y;

    const r = parseBR(inputs.rate.value);
    const maxRate = basis === 'year' ? 100 : 20;
    if (r === null) errors.rate = 'Informe o percentual de rendimento.';
    else if (Number.isNaN(r)) errors.rate = 'Digite um número válido, como 10,5.';
    else if (r < 0) errors.rate = 'O rendimento não pode ser negativo.';
    else if (r > maxRate) errors.rate = `O máximo é ${maxRate}% ${basis === 'year' ? 'ao ano' : 'ao mês'}.`;
    else v.rate = r;

    if (!errors.initial && !errors.monthly && v.initial === 0 && v.monthly === 0) {
      errors.monthly = 'Informe um valor inicial ou um aporte mensal maior que zero.';
      errors.initial = errors.monthly;
    }
    return { errors, values: { ...v, basis } };
  }

  /* ------------------------------------------------------------------ *
   * Cálculo: juros compostos + aporte no fim de cada mês
   * ------------------------------------------------------------------ */
  function simulate({ initial, monthly, years, rate, basis }) {
    const rm = basis === 'year' ? Math.pow(1 + rate / 100, 1 / 12) - 1 : rate / 100;
    const months = years * 12;
    const invested = new Float64Array(months + 1);
    const total = new Float64Array(months + 1);
    invested[0] = total[0] = initial;
    for (let m = 1; m <= months; m++) {
      total[m] = total[m - 1] * (1 + rm) + monthly;
      invested[m] = invested[m - 1] + monthly;
    }
    const rows = [];
    for (let y = 1; y <= years; y++) {
      const i = y * 12;
      const gain = total[i] - invested[i];
      const prevGain = total[i - 12] - invested[i - 12];
      rows.push({ year: y, invested: invested[i], gain, yearGain: gain - prevGain, total: total[i] });
    }
    const final = total[months];
    const inv = invested[months];
    return {
      rm, months, years, invested, total, rows,
      final, inv, gain: final - inv, share: final > 0 ? ((final - inv) / final) * 100 : 0,
    };
  }

  /* ------------------------------------------------------------------ *
   * Atualização da interface
   * ------------------------------------------------------------------ */
  let current = null;

  function showErrors(errors) {
    let visible = 0;
    FIELDS.forEach((f) => {
      const wrap = inputs[f].closest('.field');
      const msg = el(`${f}-msg`);
      const show = touched.has(f) && errors[f];
      wrap.classList.toggle('invalid', !!show);
      inputs[f].setAttribute('aria-invalid', show ? 'true' : 'false');
      msg.textContent = show ? errors[f] : '';
      if (show) visible++;
    });
    return visible;
  }

  function rateHint(values, errors) {
    if (errors.rate || values.rate == null) return;
    const msg = el('rate-msg');
    if (values.basis === 'year') {
      const m = (Math.pow(1 + values.rate / 100, 1 / 12) - 1) * 100;
      msg.textContent = `Equivale a ${pct(m, 2)} ao mês (taxa efetiva).`;
    } else {
      const a = (Math.pow(1 + values.rate / 100, 12) - 1) * 100;
      msg.textContent = `Equivale a ${pct(a, 2)} ao ano (taxa efetiva).`;
    }
  }

  function update() {
    const { errors, values } = validate();
    const visible = showErrors(errors);
    const hasErrors = Object.keys(errors).length > 0;
    const dash = el('dash');

    if (hasErrors) {
      current = null;
      dash.dataset.state = 'invalid';
      el('empty').hidden = false;
      el('empty-title').textContent = visible ? 'Revise os campos destacados' : 'Preencha a simulação';
      el('empty-text').textContent = visible
        ? 'Assim que os valores estiverem corretos, o resultado aparece aqui.'
        : 'Informe valor inicial ou aporte mensal, prazo e rendimento para ver o resultado.';
      return;
    }

    rateHint(values, errors);
    dash.dataset.state = 'ok';
    el('empty').hidden = true;
    current = simulate(values);
    renderKpis(current, values);
    renderTable(current);
    renderCharts();
    if (+rangeEl.value !== values.years) rangeEl.value = values.years;
  }

  function renderKpis(s, v) {
    el('k-final').textContent = brl.format(s.final);
    el('k-final-sub').textContent =
      `Em ${s.years} ${plural(s.years, 'ano', 'anos')}, com ${brl.format(v.initial)} iniciais e ${brl.format(v.monthly)} por mês.`;
    el('k-invested').textContent = brl.format(s.inv);
    el('k-invested-sub').textContent = `${brl.format(v.initial)} iniciais + ${s.months} aportes`;
    el('k-gain').textContent = brl.format(s.gain);
    el('k-gain-sub').textContent = s.inv > 0 ? `${pct((s.gain / s.inv) * 100)} sobre o total investido` : '–';
    el('k-share').textContent = pct(s.share);
    const invShare = 100 - s.share;
    const split = el('k-split');
    split.children[0].style.width = `${invShare}%`;
    split.children[1].style.width = `${s.share}%`;
    split.setAttribute('aria-label', `${pct(invShare)} investido e ${pct(s.share)} de rendimentos`);
    el('k-split-sub').textContent = `${pct(invShare)} investido · ${pct(s.share)} rendimentos`;
  }

  function renderTable(s) {
    el('tbody').innerHTML = s.rows
      .map(
        (r) => `<tr><td>${r.year}º ano</td><td>${brl.format(r.invested)}</td><td>${brl.format(r.yearGain)}</td>` +
          `<td>${brl.format(r.gain)}</td><td>${brl.format(r.total)}</td></tr>`
      )
      .join('');
  }

  /* ------------------------------------------------------------------ *
   * Gráficos (SVG)
   * ------------------------------------------------------------------ */
  const NS = 'http://www.w3.org/2000/svg';

  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }
  function yTicks(max) {
    const step = niceStep(max / 4 || 1);
    const top = Math.ceil(max / step) * step;
    const ticks = [];
    for (let t = 0; t <= top + step / 1e6; t += step) ticks.push(t);
    return { ticks, top };
  }
  function xYearTicks(years, width) {
    const maxTicks = Math.max(3, Math.floor(width / 70));
    const step = [1, 2, 5, 10, 25].find((s) => years / s <= maxTicks) || 25;
    const t = [];
    for (let y = 0; y <= years; y += step) t.push(y);
    return t;
  }

  function svgEl(name, attrs = {}, text) {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }

  function roundTopPath(x, y, w, h, r) {
    r = Math.min(r, w / 2, h);
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  }

  function prepare(host, height) {
    host.innerHTML = '';
    const w = Math.max(host.clientWidth, 280);
    const svg = svgEl('svg', { viewBox: `0 0 ${w} ${height}`, width: w, height, role: 'img' });
    host.appendChild(svg);
    const tip = document.createElement('div');
    tip.className = 'tip';
    host.appendChild(tip);
    return { w, svg, tip };
  }

  function showTip(host, tip, html, px, py) {
    tip.innerHTML = html;
    tip.classList.add('show');
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    let left = px + 14;
    if (left + tw > host.clientWidth) left = px - tw - 14;
    left = Math.max(0, left);
    const top = Math.min(Math.max(0, py - th / 2), host.clientHeight - th);
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }

  const tipRow = (cls, label, value) =>
    `<div class="row"><i class="sw ${cls}"></i>${label}<b>${value}</b></div>`;

  function axes(svg, m, w, h, ticks, top, yOf) {
    ticks.forEach((t) => {
      const y = yOf(t);
      svg.appendChild(svgEl('line', { class: t === 0 ? 'axis' : 'grid', x1: m.l, x2: w - m.r, y1: y, y2: y }));
      svg.appendChild(svgEl('text', { x: m.l - 8, y: y + 4, 'text-anchor': 'end' }, compact(t)));
    });
  }

  function renderLine() {
    const s = current;
    const host = el('chart-line');
    const h = host.clientWidth < 520 ? 250 : 320;
    const { w, svg, tip } = prepare(host, h);
    const m = { l: 62, r: 14, t: 24, b: 30 };
    const pw = w - m.l - m.r;
    const ph = h - m.t - m.b;
    const { ticks, top } = yTicks(s.final);
    const xOf = (mo) => m.l + (mo / s.months) * pw;
    const yOf = (v) => m.t + ph - (v / top) * ph;

    svg.setAttribute('aria-label',
      `Gráfico de linhas. O patrimônio cresce de ${brl.format(s.total[0])} para ${brl.format(s.final)} em ${s.years} anos; ` +
      `o total investido chega a ${brl.format(s.inv)}.`);
    axes(svg, m, w, h, ticks, top, yOf);

    // eixo X (anos)
    xYearTicks(s.years, pw).forEach((yr) => {
      svg.appendChild(svgEl('text', { x: xOf(yr * 12), y: h - 8, 'text-anchor': yr === 0 ? 'start' : yr === s.years ? 'end' : 'middle' },
        yr === 0 ? 'Início' : `${yr} ${plural(yr, 'ano', 'anos')}`));
    });

    // pontos (limita a ~240 pontos para manter o SVG leve)
    const stride = Math.max(1, Math.ceil(s.months / 240));
    const idx = [];
    for (let i = 0; i <= s.months; i += stride) idx.push(i);
    if (idx[idx.length - 1] !== s.months) idx.push(s.months);
    const pts = (arr) => idx.map((i) => `${xOf(i).toFixed(1)},${yOf(arr[i]).toFixed(1)}`);

    const upper = pts(s.total);
    const lower = pts(s.invested).reverse();
    svg.appendChild(svgEl('polygon', { class: 'band', points: [...upper, ...lower].join(' ') }));
    svg.appendChild(svgEl('polyline', { class: 'ln ln-inv', points: pts(s.invested).join(' ') }));
    svg.appendChild(svgEl('polyline', { class: 'ln ln-total', points: upper.join(' ') }));

    // rótulos diretos no fim das linhas
    const endX = xOf(s.months);
    svg.appendChild(svgEl('text', { class: 'lbl', x: endX, y: yOf(s.final) - 8, 'text-anchor': 'end' }, 'Patrimônio'));
    if (s.gain > 0) {
      svg.appendChild(svgEl('text', { x: endX, y: yOf(s.inv) + 26, 'text-anchor': 'end' }, 'Total investido'));
    }

    // interação
    const cross = svgEl('line', { class: 'cross', y1: m.t, y2: m.t + ph, opacity: 0 });
    const d1 = svgEl('circle', { class: 'dot', r: 5, fill: 'var(--series-total)', opacity: 0 });
    const d2 = svgEl('circle', { class: 'dot', r: 5, fill: 'var(--series-inv)', opacity: 0 });
    svg.append(cross, d1, d2);
    const hit = svgEl('rect', { class: 'hit', x: m.l, y: m.t, width: pw, height: ph });
    svg.appendChild(hit);

    const move = (ev) => {
      const r = svg.getBoundingClientRect();
      const px = ((ev.clientX - r.left) / r.width) * w;
      const mo = Math.min(s.months, Math.max(0, Math.round(((px - m.l) / pw) * s.months)));
      const x = xOf(mo);
      cross.setAttribute('x1', x); cross.setAttribute('x2', x); cross.setAttribute('opacity', 1);
      d1.setAttribute('cx', x); d1.setAttribute('cy', yOf(s.total[mo])); d1.setAttribute('opacity', 1);
      d2.setAttribute('cx', x); d2.setAttribute('cy', yOf(s.invested[mo])); d2.setAttribute('opacity', 1);
      const yrs = Math.floor(mo / 12);
      const rest = mo % 12;
      const when = mo === 0 ? 'Início' : `${yrs ? `${yrs} ${plural(yrs, 'ano', 'anos')}` : ''}${yrs && rest ? ' e ' : ''}${rest ? `${rest} ${plural(rest, 'mês', 'meses')}` : ''}`;
      showTip(host, tip,
        `<strong>${when}</strong>` +
        tipRow('sw-total', 'Patrimônio', brl.format(s.total[mo])) +
        tipRow('sw-inv', 'Total investido', brl.format(s.invested[mo])) +
        tipRow('sw-gain', 'Rendimentos', brl.format(s.total[mo] - s.invested[mo])),
        (x / w) * host.clientWidth, (yOf(s.total[mo]) / h) * host.clientHeight);
    };
    const leave = () => {
      [cross, d1, d2].forEach((n) => n.setAttribute('opacity', 0));
      tip.classList.remove('show');
    };
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerdown', move);
    hit.addEventListener('pointerleave', leave);
  }

  function renderBars() {
    const s = current;
    const host = el('chart-bars');
    const h = host.clientWidth < 520 ? 250 : 320;
    const { w, svg, tip } = prepare(host, h);
    const m = { l: 62, r: 14, t: 16, b: 30 };
    const pw = w - m.l - m.r;
    const ph = h - m.t - m.b;
    const { ticks, top } = yTicks(s.final);
    const yOf = (v) => m.t + ph - (v / top) * ph;
    const band = pw / s.rows.length;
    const bw = Math.max(3, Math.min(band * 0.68, 38));

    svg.setAttribute('aria-label',
      `Gráfico de colunas empilhadas por ano, com total investido e rendimentos acumulados. No último ano: ` +
      `${brl.format(s.inv)} investidos e ${brl.format(s.gain)} de rendimentos.`);
    axes(svg, m, w, h, ticks, top, yOf);

    const labelEvery = Math.ceil(s.rows.length / Math.max(3, Math.floor(pw / 46)));
    const GAP = 2;
    s.rows.forEach((r, i) => {
      const cx = m.l + band * i + band / 2;
      const x = cx - bw / 2;
      const yInv = yOf(r.invested);
      const hInv = Math.max(0, m.t + ph - yInv);
      const yTot = yOf(r.total);
      const g = svgEl('g', { class: 'col' });
      if (hInv > 0) g.appendChild(svgEl('rect', { class: 'bar-inv', x, y: yInv, width: bw, height: hInv }));
      const hGain = yInv - GAP - yTot;
      if (hGain > 0.5) g.appendChild(svgEl('path', { class: 'bar-gain', d: roundTopPath(x, yTot, bw, hGain, 4) }));
      svg.appendChild(g);
      if (r.year % labelEvery === 0) {
        svg.appendChild(svgEl('text', { x: cx, y: h - 8, 'text-anchor': 'middle' }, `${r.year}`));
      }
      const hit = svgEl('rect', { class: 'hit', x: m.l + band * i, y: m.t, width: band, height: ph });
      hit.addEventListener('pointermove', () => {
        host.classList.add('hovering');
        svg.querySelectorAll('.col').forEach((c) => c.classList.remove('on'));
        g.classList.add('on');
        showTip(host, tip,
          `<strong>${r.year}º ano</strong>` +
          tipRow('sw-inv', 'Total investido', brl.format(r.invested)) +
          tipRow('sw-gain', 'Rendimentos', brl.format(r.gain)) +
          tipRow('sw-total', 'Patrimônio', brl.format(r.total)),
          (cx / w) * host.clientWidth, (yTot / h) * host.clientHeight);
      });
      hit.addEventListener('pointerleave', () => {
        host.classList.remove('hovering');
        g.classList.remove('on');
        tip.classList.remove('show');
      });
      svg.appendChild(hit);
    });
  }

  function renderCharts() {
    if (!current) return;
    renderLine();
    renderBars();
  }

  /* ------------------------------------------------------------------ *
   * Eventos
   * ------------------------------------------------------------------ */
  FIELDS.forEach((f) => {
    inputs[f].addEventListener('input', () => {
      touched.add(f);
      update();
    });
    inputs[f].addEventListener('blur', () => {
      // reformata valores monetários válidos (ex.: 1500 -> 1.500,00)
      if (f === 'initial' || f === 'monthly') {
        const n = parseBR(inputs[f].value);
        if (n !== null && !Number.isNaN(n) && n >= 0 && n <= MAX_MONEY) inputs[f].value = num2.format(n);
      }
      touched.add(f);
      update();
    });
  });
  basisEl.addEventListener('change', () => {
    touched.add('rate');
    update();
  });
  rangeEl.addEventListener('input', () => {
    inputs.years.value = rangeEl.value;
    touched.add('years');
    update();
  });

  function fill(values) {
    inputs.initial.value = values.initial;
    inputs.monthly.value = values.monthly;
    inputs.years.value = values.years;
    inputs.rate.value = values.rate;
    basisEl.value = values.basis;
    rangeEl.value = values.years || 10;
    touched.clear();
    update();
  }

  el('btn-reset').addEventListener('click', () => fill(DEFAULTS));
  el('btn-clear').addEventListener('click', () => {
    fill({ initial: '', monthly: '', years: '', rate: '', basis: 'year' });
    inputs.initial.focus();
  });
  el('form').addEventListener('submit', (e) => e.preventDefault());

  let resizeTimer;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderCharts, 80);
  }).observe(el('dash'));

  fill(DEFAULTS);
})();
