import * as banco from './db.js';
import { estado } from './estado.js';
import { $, $$, esc, aviso, brl, ultimoDiaUtilAnterior } from './ui.js';
import { diasLetivosBase, tabelaDiasPorSemana, validarTabelaDias, compararTabelas } from '../../core/calendario.mjs';
import { PARAMETROS_PADRAO } from '../../core/calculo.mjs';
import { normalizarCargo } from '../../core/cargos.mjs';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const rotuloYm = (ym) => `${MESES[Number(ym.slice(5)) - 1]}/${ym.slice(0, 4)}`;
const diasNoMes = (ym) => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5)), 0)).getUTCDate();
const baseDe = (ym, feriados) => diasLetivosBase(Number(ym.slice(0, 4)), Number(ym.slice(5)), feriados.map((f) => f.data));

function criar(ano, mes) {
  const ym = `${ano}-${String(mes).padStart(2, '0')}`;
  if (banco.competencia(ym)) return aviso('Essa competência já existe.', 'erro');
  const tabela = tabelaDiasPorSemana(baseDe(ym, []));
  banco.x('insert into competencia (ym, data_credito, tabela_dias) values (?,?,?)', [ym, ultimoDiaUtilAnterior(ano, mes), JSON.stringify(tabela)]);
  banco.auditar('competência criada', ym);
  estado.ym = ym;
}

const campoMoeda = (id, valor) => `<input id="${id}" inputmode="decimal" value="${valor ? (valor / 100).toFixed(2).replace('.', ',') : ''}">`;
const moedaParaCentavos = (t) => (t.trim() === '' ? 0 : Math.round(Number(t.replace(/\./g, '').replace(',', '.')) * 100));

export function render(raiz) {
  const lista = banco.competencias();
  if (estado.ym && !banco.competencia(estado.ym)) estado.ym = null;
  const c = estado.ym ? banco.competencia(estado.ym) : null;
  const agora = new Date();
  raiz.innerHTML = `
    <h2>Competência e regras</h2>
    <div class="acoes">
      <label>Competência <select id="ym"><option value="">— escolha —</option>${lista.map((l) => `<option value="${l.ym}" ${l.ym === estado.ym ? 'selected' : ''}>${rotuloYm(l.ym)}${l.status === 'fechada' ? ' (fechada)' : ''}</option>`).join('')}</select></label>
      <span class="mudo">ou nova:</span>
      <label>Mês <input id="novo-mes" type="number" min="1" max="12" value="${((agora.getMonth() + 1) % 12) + 1}" style="width:5em"></label>
      <label>Ano <input id="novo-ano" type="number" value="${agora.getMonth() === 11 ? agora.getFullYear() + 1 : agora.getFullYear()}" style="width:6em"></label>
      <button id="nova">Criar competência</button>
    </div>
    ${c ? formulario(c) : '<p class="mudo">Escolha ou crie uma competência para definir o calendário, a tabela de dias e os parâmetros.</p>'}
    <hr>${cargos()}`;

  $('#ym').onchange = (e) => { estado.ym = e.target.value || null; render(raiz); };
  $('#nova').onclick = () => { criar(Number($('#novo-ano').value), Number($('#novo-mes').value)); estado.persistir(); render(raiz); };
  if (c) ligarFormulario(raiz, c);
  ligarCargos(raiz);
}

function formulario(c) {
  const p = c.parametros;
  const fechada = c.status === 'fechada';
  const base = baseDe(c.ym, c.feriados);
  const calculada = tabelaDiasPorSemana(base);
  const dif = compararTabelas(calculada, c.tabela_dias);
  const msgs = validarTabelaDias(c.tabela_dias, base, diasNoMes(c.ym));
  return `
  <fieldset ${fechada ? 'disabled' : ''}>
  <div class="duas">
    <section class="cartao"><h3>Calendário — ${rotuloYm(c.ym)}</h3>
      <label>Data prevista do crédito da recarga <input type="date" id="credito" value="${esc(c.data_credito)}"></label>
      <label>Feriados do mês (um por linha: <code>AAAA-MM-DD;descrição</code>)
        <textarea id="feriados" rows="4">${esc(c.feriados.map((f) => `${f.data};${f.descricao ?? ''}`).join('\n'))}</textarea></label>
      <p>Segunda a sexta, menos feriados que caem nesses dias: <b>${base} dias</b> para quem trabalha 5 dias por semana.</p>
    </section>
    <section class="cartao"><h3>Dias de trabalho no mês, por dias na semana</h3>
      <p class="mudo">Editável. Por padrão usa a proporção; a regra do RH ainda será confirmada.</p>
      <table class="tabela compacta"><thead><tr><th>Dias/semana</th><th>Dias no mês</th><th>Proporção</th></tr></thead><tbody>
        ${[5, 4, 3, 2, 1].map((n) => `<tr><td>${n}</td><td><input class="dias" data-n="${n}" type="number" min="0" value="${c.tabela_dias[n]}" style="width:5em"></td><td class="mudo">${calculada[n]}</td></tr>`).join('')}
      </tbody></table>
      <button id="recalcular">Usar a proporção do calendário</button>
      ${dif.length ? `<p class="mudo">Diferem da proporção: ${dif.map((d) => `${d.dias_semana} dia(s): ${d.informado} (proporção ${d.calculado})`).join('; ')}.</p>` : ''}
      ${msgs.map((m) => `<p class="${m.nivel === 'erro' ? 'erro' : 'aviso'}">${esc(m.texto)}</p>`).join('')}
    </section>
  </div>
  <section class="cartao"><h3>Parâmetros</h3>
    <div class="grade">
      <label>Alerta de saldo alto acima de (× saldo inicial; vazio = sem alerta)<input id="p-alto" type="number" step="0.1" value="${p.saldo_alto_multiplo ?? ''}"></label>
      <label>Projeção do saldo até o crédito
        <select id="p-proj"><option value="conservador" ${p.projecao_modo === 'conservador' ? 'selected' : ''}>Conservadora (assume consumo integral)</option><option value="nenhum" ${p.projecao_modo === 'nenhum' ? 'selected' : ''}>Nenhuma (saldo como lido)</option></select></label>
      <label>Coluna RECARGAS da Global Mob
        <select id="p-rec"><option value="ignorar" ${p.recargas_modo === 'ignorar' ? 'selected' : ''}>Ignorar (só sinalizar)</option><option value="somar" ${p.recargas_modo === 'somar' ? 'selected' : ''}>Somar ao saldo</option></select></label>
      <label>Saldo mais antigo aceito (dias até o crédito)<input id="p-idade" type="number" min="1" value="${p.saldo_max_idade_dias}"></label>
      <label>Recarga mínima (R$; 0 = sem mínimo)${campoMoeda('p-min', p.recarga_minima_centavos)}</label>
      <label>Recarga em múltiplos de (R$)${campoMoeda('p-mult', p.recarga_multiplo_centavos > 1 ? p.recarga_multiplo_centavos : 0)}</label>
    </div></section>
  <div class="acoes"><button id="salvar-comp" class="primario">Salvar competência</button></div>
  </fieldset>
  ${fechada ? '<p class="aviso">Competência fechada: não pode ser alterada.</p>' : ''}`;
}

function ligarFormulario(raiz, c) {
  const ler = () => {
    const feriados = $('#feriados').value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const [data, ...d] = l.split(';'); return { data: data.trim(), descricao: d.join(';').trim() }; });
    return { feriados, tabela: Object.fromEntries($$('.dias').map((i) => [Number(i.dataset.n), i.value === '' ? NaN : Number(i.value)])) };
  };
  $('#recalcular').onclick = () => {
    const { feriados } = ler();
    banco.x('update competencia set feriados = ?, tabela_dias = ? where ym = ?', [JSON.stringify(feriados), JSON.stringify(tabelaDiasPorSemana(baseDe(c.ym, feriados))), c.ym]);
    render(raiz);
  };
  $('#salvar-comp').onclick = () => {
    const { feriados, tabela } = ler();
    if (feriados.some((f) => !/^\d{4}-\d{2}-\d{2}$/.test(f.data))) return aviso('Feriado em formato inválido. Use AAAA-MM-DD;descrição.', 'erro');
    const erros = validarTabelaDias(tabela, baseDe(c.ym, feriados), diasNoMes(c.ym)).filter((m) => m.nivel === 'erro');
    if (erros.length) return aviso(erros[0].texto, 'erro');
    const alto = $('#p-alto').value;
    const parametros = {
      saldo_alto_multiplo: alto === '' ? null : Number(alto), projecao_modo: $('#p-proj').value, recargas_modo: $('#p-rec').value,
      saldo_max_idade_dias: Number($('#p-idade').value) || PARAMETROS_PADRAO.saldo_max_idade_dias,
      recarga_minima_centavos: moedaParaCentavos($('#p-min').value), recarga_multiplo_centavos: moedaParaCentavos($('#p-mult').value) || 1,
    };
    banco.x('update competencia set data_credito = ?, feriados = ?, tabela_dias = ?, parametros = ? where ym = ?',
      [$('#credito').value, JSON.stringify(feriados), JSON.stringify(tabela), JSON.stringify(parametros), c.ym]);
    banco.auditar('competência alterada', `${c.ym}: tabela de dias ${JSON.stringify(tabela)}; parâmetros ${JSON.stringify(parametros)}`);
    estado.persistir(); aviso('Competência salva.'); render(raiz);
  };
}

function cargos() {
  const regras = banco.q('select cargo, dias_semana from cargo_regra order by cargo');
  const conhecidos = new Set(regras.map((r) => r.cargo));
  const faltando = [...new Set(banco.q('select cargo from servidor').map((s) => normalizarCargo(s.cargo)).filter((cg) => cg && !conhecidos.has(cg)))].sort();
  return `<h3>Dias por semana padrão de cada cargo</h3>
    <p class="mudo">Vale para quem não tem os dias informados na relação do RH. Cargo sem padrão (ex.: docente) exige informar por servidor.</p>
    <table class="tabela compacta"><thead><tr><th>Cargo</th><th>Dias por semana</th></tr></thead><tbody>
      ${regras.map((r) => `<tr><td>${esc(r.cargo)}</td><td><select class="cargo-dias" data-cargo="${esc(r.cargo)}"><option value="">sem padrão</option>${[1, 2, 3, 4, 5].map((n) => `<option ${r.dias_semana === n ? 'selected' : ''}>${n}</option>`).join('')}</select></td></tr>`).join('')}
    </tbody></table>
    ${faltando.length ? `<p class="aviso">Cargos da relação sem regra cadastrada: ${faltando.map((f) => `<button class="add-cargo" data-cargo="${esc(f)}">${esc(f)}</button>`).join(' ')}</p>` : ''}
    <label>Novo cargo <input id="novo-cargo"></label> <button id="add-novo-cargo">Adicionar</button>`;
}

function ligarCargos(raiz) {
  $$('.cargo-dias').forEach((s) => { s.onchange = () => {
    banco.x('update cargo_regra set dias_semana = ? where cargo = ?', [s.value === '' ? null : Number(s.value), s.dataset.cargo]);
    banco.auditar('regra de cargo', `${s.dataset.cargo}: ${s.value || 'sem padrão'} dias/semana`); estado.persistir();
  }; });
  $$('.add-cargo').forEach((b) => { b.onclick = () => { banco.x('insert or ignore into cargo_regra values (?, null)', [b.dataset.cargo]); render(raiz); }; });
  $('#add-novo-cargo').onclick = () => {
    const nome = normalizarCargo($('#novo-cargo').value); if (!nome) return;
    banco.x('insert or ignore into cargo_regra values (?, null)', [nome]); render(raiz);
  };
}
