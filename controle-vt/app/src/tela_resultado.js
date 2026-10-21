import * as banco from './db.js';
import { estado } from './estado.js';
import { $, $$, esc, brl, aviso, selo, SINAIS, baixarCsv, reais, dialogo, confirmar } from './ui.js';
import { calcularMes, totais } from './calc.js';
import { revisarSuspensoes } from '../../core/suspensoes.mjs';
import { formatarCartao } from '../../core/identificadores.mjs';

const FAIXAS = { minimo: 'mínimo', medio: 'médio', alto: 'alto' };
const ACOES = { RECARREGAR: ['Recarregar', 'ok'], NAO_RECARREGAR: ['Não recarregar', 'info'], REVISAR: ['Revisar', 'bloqueio'] };
const MOTIVOS = [['licenca_maternidade', 'Licença maternidade'], ['licenca_premio', 'Licença prêmio'], ['licenca_medica', 'Licença médica'], ['saldo_alto', 'Saldo alto'], ['bloqueio_solicitado', 'Bloqueio solicitado pelo servidor'], ['outro', 'Outro']];
const filtro = { texto: '', acao: '', alerta: '', unidade: '' };
let cache = null;

export function render(raiz) {
  if (!estado.ym) { raiz.innerHTML = '<h2>Resultado do mês</h2><p class="aviso">Escolha uma competência em "Competência e regras".</p>'; return; }
  cache = calcularMes(estado.ym);
  const { comp, linhas, fechada } = cache;
  const t = totais(linhas);
  const unidades = [...new Set(linhas.map((l) => l.unidade).filter(Boolean))].sort();
  const alertas = [...new Set(linhas.flatMap((l) => l.sinalizadores))].sort();
  raiz.innerHTML = `
    <h2>Resultado — ${esc(estado.ym)} ${fechada ? '<span class="selo info">fechada</span>' : ''}</h2>
    ${!comp.data_leitura && !fechada ? '<p class="aviso">Nenhum saldo da Global Mob foi importado para esta competência: os servidores sem saldo recebem o direito cheio.</p>' : ''}
    <div class="cartoes">
      <div class="cartao num"><b>${t.servidores}</b><span>servidores</span></div>
      <div class="cartao num"><b>${brl(t.direito)}</b><span>direito do mês</span></div>
      <div class="cartao num ok"><b>${brl(t.repasse)}</b><span>repasse (recarga)</span></div>
      <div class="cartao num"><b>${brl(t.direito - t.repasse)}</b><span>abatido pelo saldo</span></div>
      <div class="cartao num ${t.revisar ? 'erro' : ''}"><b>${t.revisar}</b><span>a revisar</span></div>
    </div>
    <div class="acoes filtros">
      <label>Buscar <input id="f-texto" value="${esc(filtro.texto)}" placeholder="nome, matrícula ou cartão"></label>
      <label>Ação <select id="f-acao"><option value="">todas</option>${Object.entries(ACOES).map(([k, [r]]) => `<option value="${k}" ${filtro.acao === k ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
      <label>Alerta <select id="f-alerta"><option value="">todos</option>${alertas.map((a) => `<option value="${a}" ${filtro.alerta === a ? 'selected' : ''}>${esc(SINAIS[a]?.[0] ?? a)}</option>`).join('')}</select></label>
      <label>Unidade <select id="f-unidade"><option value="">todas</option>${unidades.map((u) => `<option ${filtro.unidade === u ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select></label>
    </div>
    <div class="acoes">
      <button id="exp-completa">Exportar planilha completa</button>
      <button id="exp-recarga">Exportar recarga (provisório)</button>
      <button id="exp-folha">Exportar desconto p/ folha (provisório)</button>
      <button id="exp-contest">Exportar contestações</button>
      ${fechada ? '' : '<button id="fechar" class="primario">Fechar competência</button>'}
    </div>
    <div class="rolagem"><table class="tabela grade-resultado"><thead><tr>
      <th>Matrícula</th><th>Nome</th><th>CPF</th><th>Cartão</th><th>Cargo</th><th>Unidade</th><th class="n">Dias/sem</th><th class="n">Valor diário</th><th class="n">Dias</th>
      <th class="n">Direito</th><th class="n">Saldo (GM)</th><th class="n">Recargas (GM)</th><th class="n">Saldo proj.</th><th>Faixa</th><th class="n">Recarga R$</th><th class="n">Desconto</th><th>Ação</th><th>Alertas</th><th></th>
    </tr></thead><tbody id="corpo"></tbody><tfoot id="rodape"></tfoot></table></div>
    ${fechada ? '' : suspensoes(linhas, comp)}`;
  desenharTabela(raiz);
  for (const [id, chave] of [['f-texto', 'texto'], ['f-acao', 'acao'], ['f-alerta', 'alerta'], ['f-unidade', 'unidade']])
    $('#' + id).oninput = (e) => { filtro[chave] = e.target.value; desenharTabela(raiz); };
  $('#exp-completa').onclick = exportarCompleta; $('#exp-recarga').onclick = exportarRecarga;
  $('#exp-folha').onclick = exportarFolha; $('#exp-contest').onclick = exportarContestacoes;
  if ($('#fechar')) $('#fechar').onclick = () => fechar(raiz);
  $$('.reativar').forEach((b) => { b.onclick = () => situacao(raiz, b.dataset.m, 'reativacao'); });
}

const visiveis = () => cache.linhas.filter((l) => {
  const t = filtro.texto.trim().toLowerCase();
  return (!t || [l.nome, l.matricula, l.cartao].some((v) => String(v ?? '').toLowerCase().includes(t)))
    && (!filtro.acao || l.acao === filtro.acao) && (!filtro.alerta || l.sinalizadores.includes(filtro.alerta)) && (!filtro.unidade || l.unidade === filtro.unidade);
});

function desenharTabela(raiz) {
  const linhas = visiveis();
  const dec = new Map(banco.q('select matricula, decisao from desconto_decisao where ym = ?', [estado.ym]).map((d) => [d.matricula, d.decisao]));
  const cont = new Map(banco.q('select matricula, count(*) n from contestacao where ym = ? group by matricula', [estado.ym]).map((c) => [c.matricula, c.n]));
  $('#corpo').innerHTML = linhas.map((l) => {
    const [rot, g] = ACOES[l.acao];
    const precisaDec = l.sinalizadores.includes('DESCONTO_ACIMA_DA_RECARGA') || l.sinalizadores.includes('DESCONTO_ACIMA_DO_DIREITO');
    return `<tr>
      <td>${esc(l.matricula)}</td><td>${esc(l.nome)}</td><td class="mudo">${esc(l.cpf_mascarado ?? '—')}</td><td>${l.cartao ? esc(formatarCartao(l.cartao)) : ''}${l.cartao_sugerido ? `<br><span class="selo atencao">sugerido ${esc(formatarCartao(l.cartao_sugerido))}</span>` : ''}</td>
      <td>${esc(l.cargo)}</td><td>${esc(l.unidade)}</td><td class="n">${l.dias_semana ?? ''}</td><td class="n">${brl(l.valor_diario_centavos)}</td><td class="n">${l.dias_efetivos ?? ''}</td>
      <td class="n">${brl(l.direito_centavos)}</td><td class="n">${brl(l.saldo_lido_centavos)}</td><td class="n">${l.recargas_centavos ? brl(l.recargas_centavos) : ''}</td><td class="n">${brl(l.saldo_projetado_centavos)}</td>
      <td>${l.faixa_saldo ? `<span class="selo faixa-${l.faixa_saldo}">${FAIXAS[l.faixa_saldo]}</span>` : ''}</td>
      <td class="n"><b>${brl(l.repasse_centavos)}</b></td><td class="n">${brl(l.desconto_centavos)}${precisaDec && !cache.fechada ? `<br><select class="dec" data-m="${esc(l.matricula)}"><option value="">decidir</option><option value="descontar" ${dec.get(l.matricula) === 'descontar' ? 'selected' : ''}>descontar</option><option value="nao_descontar" ${dec.get(l.matricula) === 'nao_descontar' ? 'selected' : ''}>não descontar</option></select>` : (dec.get(l.matricula) ? `<br><span class="mudo">${dec.get(l.matricula) === 'descontar' ? 'descontar' : 'não descontar'}</span>` : '')}</td>
      <td><span class="selo ${g}">${rot}</span></td><td>${l.sinalizadores.map(selo).join(' ')}</td>
      <td class="acoes-linha"><button class="contestar" data-m="${esc(l.matricula)}" title="Registrar contestação">${cont.get(l.matricula) ? `✎ ${cont.get(l.matricula)}` : '✎'}</button>${cache.fechada ? '' : `<button class="sit" data-m="${esc(l.matricula)}" title="Alterar situação">⚙</button>`}</td></tr>`;
  }).join('') || '<tr><td colspan="19" class="mudo">Nenhum servidor para os filtros escolhidos.</td></tr>';
  const t = totais(linhas);
  $('#rodape').innerHTML = `<tr><td colspan="9"><b>${linhas.length} servidor(es) exibido(s)</b></td><td class="n"><b>${brl(t.direito)}</b></td><td colspan="4"></td><td class="n"><b>${brl(t.repasse)}</b></td><td colspan="4"></td></tr>`;
  $$('.contestar').forEach((b) => { b.onclick = () => contestar(raiz, b.dataset.m); });
  $$('.sit').forEach((b) => { b.onclick = () => situacao(raiz, b.dataset.m); });
  $$('.dec').forEach((s) => { s.onchange = () => {
    if (s.value) banco.x('insert or replace into desconto_decisao values (?,?,?)', [estado.ym, s.dataset.m, s.value]);
    else banco.x('delete from desconto_decisao where ym = ? and matricula = ?', [estado.ym, s.dataset.m]);
    estado.persistir();
  }; });
}

function contestar(raiz, matricula) {
  const antigas = banco.q('select texto, criado_em from contestacao where ym = ? and matricula = ? order by id', [estado.ym, matricula]);
  dialogo(`Contestação — matrícula ${matricula}`, `${antigas.map((a) => `<p class="mudo">${esc(a.criado_em)}: ${esc(a.texto)}</p>`).join('')}<label>O que está errado ou foi questionado?<textarea name="texto" rows="4" required></textarea></label>`, (f) => {
    const texto = f.texto.value.trim(); if (!texto) return false;
    banco.x('insert into contestacao (ym, matricula, texto) values (?,?,?)', [estado.ym, matricula, texto]);
    banco.auditar('contestação', `${estado.ym} ${matricula}`); estado.persistir(); render(raiz);
  });
}

function situacao(raiz, matricula, sugerido) {
  const s = banco.q('select nome, situacao from servidor where matricula = ?', [matricula])[0];
  dialogo(`Situação — ${s.nome}`, `<p class="mudo">Situação atual: <b>${esc(s.situacao)}</b>. O histórico é mantido; nada é excluído.</p>
    <label>Nova situação <select name="tipo">${s.situacao === 'ativo' ? '' : `<option value="reativacao" ${sugerido === 'reativacao' ? 'selected' : ''}>Reativar (volta a receber recarga)</option>`}
      ${s.situacao === 'ativo' ? '<option value="suspensao">Suspender a recarga</option>' : ''}<option value="cancelamento">Cancelar (desligamento/desistência)</option></select></label>
    <label>Motivo <select name="motivo">${MOTIVOS.map(([k, r]) => `<option value="${k}">${r}</option>`).join('')}<option value="retorno">Retorno</option><option value="desligamento">Desligamento</option><option value="desistencia">Desistência</option></select></label>
    <label>Até (prazo da licença, se houver) <input type="date" name="ate"></label>
    <label>Observação (nunca diagnóstico de saúde) <input name="obs"></label>`, (f) => {
    const novo = { reativacao: 'ativo', suspensao: 'suspenso', cancelamento: 'cancelado' }[f.tipo.value];
    banco.transacao(() => {
      banco.x("update servidor set situacao = ?, atualizado_em = datetime('now') where matricula = ?", [novo, matricula]);
      banco.x("insert into evento (matricula, tipo, motivo_tipo, data_efeito, ate, motivo, origem) values (?,?,?,date('now'),?,?,'operador')", [matricula, f.tipo.value, f.motivo.value, f.ate.value || null, f.obs.value || null]);
      banco.auditar('situação alterada', `${matricula}: ${s.situacao} → ${novo} (${f.motivo.value})`);
    });
    estado.persistir(); render(raiz);
  });
}

function suspensoes(linhas, comp) {
  const susp = banco.q(`select s.matricula, s.nome, e.motivo_tipo, e.data_efeito as desde, e.ate from servidor s
     join evento e on e.id = (select max(id) from evento where matricula = s.matricula and tipo in ('suspensao','reativacao','cancelamento','inclusao'))
     where s.situacao = 'suspenso'`);
  if (!susp.length) return '';
  const por = new Map(linhas.map((l) => [l.matricula, l]));
  const r = revisarSuspensoes(susp, { inicioCompetencia: `${estado.ym}-01`,
    saldoProjetado: new Map(linhas.map((l) => [l.matricula, l.saldo_lido_centavos == null ? null : (l.saldo_projetado_centavos ?? l.saldo_lido_centavos)])),
    saldoInicial: new Map(banco.q('select matricula, saldo_inicial_centavos as v from servidor').map((s) => [s.matricula, s.v])) });
  const nome = (m) => esc(por.get(m)?.nome ?? m);
  const bloco = (titulo, itens, fmt) => itens.length ? `<h4>${titulo}</h4><table class="tabela compacta"><tbody>${itens.map(fmt).join('')}</tbody></table>` : '';
  return `<hr><h3>Suspensões para revisar</h3>
    ${bloco('Licença com prazo vencido', r.prazoVencido, (x) => `<tr><td>${nome(x.matricula)}</td><td>até ${esc(x.ate)}</td><td><button class="reativar" data-m="${esc(x.matricula)}">Reativar…</button></td></tr>`)}
    ${bloco('Licença sem prazo informado', r.semPrazo, (x) => `<tr><td>${nome(x.matricula)}</td><td>${esc(x.motivo_tipo)}</td><td class="mudo">informe o prazo</td></tr>`)}
    ${bloco('Saldo voltou ao nível mínimo (saldo inicial)', r.reativacaoSugerida, (x) => `<tr><td>${nome(x.matricula)}</td><td>${brl(x.saldo_projetado_centavos)} ≤ ${brl(x.saldo_inicial_centavos)}</td><td><button class="reativar" data-m="${esc(x.matricula)}">Reativar…</button></td></tr>`)}
    ${!r.prazoVencido.length && !r.semPrazo.length && !r.reativacaoSugerida.length ? '<p class="mudo">Nenhuma suspensão precisa de revisão neste mês.</p>' : ''}`;
}

const cabecalhoCompleto = ['Matrícula', 'Nome', 'CPF', 'Cartão', 'Cargo', 'Unidade', 'Dias por semana', 'Valor diário', 'Dias efetivos', 'Valor mensal (direito)', 'Saldo Global Mob', 'Recargas Global Mob', 'Saldo projetado', 'Faixa de saldo', 'Recarga R$', 'Desconto', 'Situação', 'Ação', 'Alertas'];
function exportarCompleta() {
  baixarCsv(`controle-vt-${estado.ym}-completo.csv`, cabecalhoCompleto, visiveis().map((l) => [l.matricula, l.nome, l.cpf_mascarado, l.cartao ? formatarCartao(l.cartao) : '', l.cargo, l.unidade, l.dias_semana, reais(l.valor_diario_centavos), l.dias_efetivos,
    reais(l.direito_centavos), reais(l.saldo_lido_centavos), reais(l.recargas_centavos), reais(l.saldo_projetado_centavos), FAIXAS[l.faixa_saldo] ?? '', reais(l.repasse_centavos), reais(l.desconto_centavos), l.situacao, ACOES[l.acao][0], l.sinalizadores.map((f) => SINAIS[f]?.[0] ?? f).join(' | ')]));
}
function exportarRecarga() {
  const l = cache.linhas.filter((x) => x.acao === 'RECARREGAR' && x.cartao);
  baixarCsv(`recarga-${estado.ym}.csv`, ['Cartão', 'Valor da recarga'], l.map((x) => [formatarCartao(x.cartao), reais(x.repasse_centavos)]));
}
function exportarFolha() {
  const dec = new Map(banco.q('select matricula, decisao from desconto_decisao where ym = ?', [estado.ym]).map((d) => [d.matricula, d.decisao]));
  baixarCsv(`desconto-folha-${estado.ym}.csv`, ['Matrícula', 'Nome', 'Desconto', 'Decisão do operador', 'Pendência'],
    cache.linhas.filter((l) => l.desconto_centavos != null).map((l) => [l.matricula, l.nome, reais(l.desconto_centavos), dec.get(l.matricula) ?? '',
      l.sinalizadores.filter((f) => f.startsWith('DESCONTO_')).map((f) => SINAIS[f][0]).join(' | ')]));
}
function exportarContestacoes() {
  baixarCsv(`contestacoes-${estado.ym}.csv`, ['Matrícula', 'Nome', 'Registrada em', 'Contestação'],
    banco.q('select c.matricula, s.nome, c.criado_em, c.texto from contestacao c left join servidor s on s.matricula = c.matricula where c.ym = ? order by c.id', [estado.ym]).map((c) => [c.matricula, c.nome, c.criado_em, c.texto]));
}

async function fechar(raiz) {
  const t = totais(cache.linhas);
  const pend = banco.q('select count(*) n from contestacao where ym = ?', [estado.ym])[0].n;
  const msg = `${estado.ym}: ${t.recarregar} recargas, ${brl(t.repasse)} de repasse.${t.revisar ? `\n\nATENÇÃO: ${t.revisar} servidor(es) ainda estão "a revisar" e ficarão sem recarga.` : ''}${pend ? `\n${pend} contestação(ões) registrada(s).` : ''}\n\nDepois de fechada, a competência não pode ser alterada.`;
  if (!(await confirmar('Fechar a competência', msg, 'Fechar competência'))) return;
  banco.transacao(() => {
    banco.x('insert or replace into fechamento (ym, resumo, linhas) values (?,?,?)', [estado.ym, JSON.stringify({ ...t, parametros: cache.comp.parametros, tabela_dias: cache.comp.tabela_dias, data_credito: cache.comp.data_credito, data_leitura: cache.comp.data_leitura }), JSON.stringify(cache.linhas)]);
    banco.x("update competencia set status = 'fechada' where ym = ?", [estado.ym]);
    banco.auditar('competência fechada', `${estado.ym}: ${t.recarregar} recargas, ${brl(t.repasse)}`);
  });
  await estado.persistir(true); aviso('Competência fechada.'); render(raiz);
}
