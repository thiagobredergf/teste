import * as banco from './db.js';
import { estado } from './estado.js';
import { $, esc, brl, SINAIS, entregar, emVisualizador, aviso } from './ui.js';
import { calcularMes, totais } from './calc.js';
import { formatarCartao } from '../../core/identificadores.mjs';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const FAIXAS = { minimo: 'mínimo', medio: 'médio', alto: 'alto' };
const TIPOS_SUSP = { licenca_maternidade: 'licença maternidade', licenca_premio: 'licença prêmio', licenca_medica: 'licença médica', saldo_alto: 'saldo alto', bloqueio_solicitado: 'bloqueio solicitado', outro: 'outro' };
const opcoes = { recargas: true, pendencias: true, contestacoes: true };

// Estilo do relatório: papel branco, independente do tema do aplicativo, e o mesmo no HTML baixado.
export const CSS_RELATORIO = `
.rel{background:#fff;color:#111;font:12px/1.45 system-ui,"Segoe UI",Arial,sans-serif;padding:26px 30px;max-width:920px;margin:0 auto}
.rel h1{font-size:19px;margin:0 0 2px}.rel .sub{color:#444;margin:0 0 10px}
.rel h2{font-size:13.5px;margin:20px 0 6px;padding-bottom:2px;border-bottom:1.5px solid #222;text-transform:uppercase;letter-spacing:.04em}
.rel table{border-collapse:collapse;width:100%;font-size:11px;margin:4px 0}
.rel th,.rel td{padding:3px 6px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top}.rel thead th{border-bottom:1.5px solid #333;font-weight:600}
.rel .n{text-align:right;white-space:nowrap}.rel tfoot td{font-weight:700;border-top:1.5px solid #333}
.rel .resumo{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:8px 0}.rel .resumo div{border:1px solid #bbb;padding:6px 9px}.rel .resumo b{display:block;font-size:16px}.rel .resumo span{color:#444;font-size:11px}
.rel .par{display:grid;grid-template-columns:auto 1fr;gap:2px 14px;font-size:11.5px}.rel .par dt{color:#444}.rel .par dd{margin:0}
.rel .vazio{color:#555;font-style:italic}.rel .quebra{break-before:page}.rel .ass{display:grid;grid-template-columns:repeat(3,1fr);gap:34px;margin-top:46px}
.rel .ass div{border-top:1px solid #222;padding-top:4px;text-align:center;font-size:11px}.rel .rodape{margin-top:18px;color:#555;font-size:10px}
@media print{@page{size:A4;margin:12mm}.rel{padding:0;max-width:none}.rel tr{break-inside:avoid}.rel h2{break-after:avoid}}`;

const rotuloYm = (ym) => `${MESES[Number(ym.slice(5)) - 1]} de ${ym.slice(0, 4)}`;
const fdata = (d) => (d ? d.split('-').reverse().join('/') : '—');
const motivos = (l) => l.sinalizadores.filter((f) => SINAIS[f]?.[1] === 'bloqueio').map((f) => SINAIS[f][0]).join('; ');

function agrupar(linhas, chave) {
  const m = new Map();
  for (const l of linhas) {
    const k = l[chave] || '(não informado)';
    const g = m.get(k) ?? { nome: k, servidores: 0, recarregar: 0, direito: 0, repasse: 0, revisar: 0 };
    g.servidores++; g.direito += l.direito_centavos ?? 0; g.repasse += l.repasse_centavos ?? 0;
    if (l.acao === 'RECARREGAR') g.recarregar++; if (l.acao === 'REVISAR') g.revisar++;
    m.set(k, g);
  }
  return [...m.values()].sort((a, b) => b.repasse - a.repasse || a.nome.localeCompare(b.nome));
}

const tabelaGrupo = (titulo, grupos) => {
  const t = grupos.reduce((a, g) => ({ s: a.s + g.servidores, r: a.r + g.recarregar, d: a.d + g.direito, p: a.p + g.repasse, v: a.v + g.revisar }), { s: 0, r: 0, d: 0, p: 0, v: 0 });
  return `<table><thead><tr><th>${titulo}</th><th class="n">Servidores</th><th class="n">A recarregar</th><th class="n">A revisar</th><th class="n">Direito</th><th class="n">Repasse</th></tr></thead><tbody>
    ${grupos.map((g) => `<tr><td>${esc(g.nome)}</td><td class="n">${g.servidores}</td><td class="n">${g.recarregar}</td><td class="n">${g.revisar || ''}</td><td class="n">${brl(g.direito)}</td><td class="n">${brl(g.repasse)}</td></tr>`).join('')}
    </tbody><tfoot><tr><td>Total</td><td class="n">${t.s}</td><td class="n">${t.r}</td><td class="n">${t.v || ''}</td><td class="n">${brl(t.d)}</td><td class="n">${brl(t.p)}</td></tr></tfoot></table>`;
};

export function dadosRelatorio(ym) {
  const { comp, linhas, fechada } = calcularMes(ym);
  const q = (sql) => banco.q(sql, [ym]);
  return {
    ym, comp, linhas, fechada, t: totais(linhas),
    ocorrencias: q('select o.tipo, o.dias, o.observacao, o.matricula, s.nome, r.descricao from ocorrencia o left join servidor s on s.matricula = o.matricula left join regra_ocorrencia r on r.tipo = o.tipo where o.ym = ? and o.ativo = 1 order by s.nome'),
    decisoes: new Map(q('select matricula, decisao from desconto_decisao where ym = ?').map((d) => [d.matricula, d.decisao])),
    contestacoes: q('select c.matricula, s.nome, c.criado_em, c.texto from contestacao c left join servidor s on s.matricula = c.matricula where c.ym = ? order by c.id'),
    suspensos: banco.q(`select s.matricula, s.nome, e.motivo_tipo, e.data_efeito, e.ate from servidor s
      join evento e on e.id = (select max(id) from evento where matricula = s.matricula and tipo in ('suspensao','reativacao','cancelamento','inclusao')) where s.situacao = 'suspenso' order by s.nome`),
  };
}

export function corpoRelatorio(d, op = opcoes) {
  const { comp, linhas, t } = d;
  const p = comp.parametros;
  const conta = (f) => linhas.filter(f).length;
  const lista = (itens, cab, linha, vazio) => (itens.length ? `<table><thead><tr>${cab.map((c) => `<th${c.n ? ' class="n"' : ''}>${c.t}</th>`).join('')}</tr></thead><tbody>${itens.map(linha).join('')}</tbody></table>` : `<p class="vazio">${vazio}</p>`);
  const pend = linhas.filter((l) => l.acao === 'REVISAR');
  const semDecisao = linhas.filter((l) => (l.sinalizadores.includes('DESCONTO_ACIMA_DA_RECARGA') || l.sinalizadores.includes('DESCONTO_ACIMA_DO_DIREITO')) && !d.decisoes.has(l.matricula));
  const altos = linhas.filter((l) => l.sinalizadores.includes('SALDO_ALTO'));
  const outros = ['SALDO_NEGATIVO', 'RECARGA_PENDENTE_NA_GLOBALMOB', 'VARIOS_CARTOES_ATIVOS', 'SALDO_ANTIGO'].map((f) => [f, conta((l) => l.sinalizadores.includes(f))]).filter(([, n]) => n);
  const recargas = linhas.filter((l) => l.acao === 'RECARREGAR' && l.cartao).sort((a, b) => (a.unidade ?? '').localeCompare(b.unidade ?? '') || a.nome.localeCompare(b.nome));
  return `<div class="rel">
  <h1>Relatório de recarga de vale-transporte</h1>
  <p class="sub"><b>Competência ${esc(rotuloYm(d.ym))}</b> ${d.fechada ? '— FECHADA' : '— em aberto (valores provisórios)'} · emitido em ${esc(new Date().toLocaleString('pt-BR'))}</p>

  <h2>Resumo</h2>
  <div class="resumo">
    <div><b>${brl(t.repasse)}</b><span>repasse a creditar</span></div><div><b>${t.recarregar}</b><span>servidores a recarregar</span></div>
    <div><b>${brl(t.direito)}</b><span>direito do mês</span></div><div><b>${brl(t.direito - t.repasse)}</b><span>abatido pelo saldo dos cartões${t.direito ? ` (${Math.round((1 - t.repasse / t.direito) * 100)}%)` : ''}</span></div>
    <div><b>${t.servidores}</b><span>servidores na competência</span></div><div><b>${conta((l) => l.acao === 'NAO_RECARREGAR')}</b><span>sem recarga neste mês</span></div>
    <div><b>${t.revisar}</b><span>a revisar (sem recarga até resolver)</span></div><div><b>${conta((l) => l.situacao === 'suspenso')}</b><span>suspensos</span></div>
  </div>
  <dl class="par"><dt>Crédito previsto</dt><dd>${fdata(comp.data_credito)}</dd><dt>Saldo lido em</dt><dd>${fdata(comp.data_leitura)}</dd>
    <dt>Dias no mês (por dias/semana)</dt><dd>${[5, 4, 3, 2, 1].map((n) => `${n}: ${comp.tabela_dias[n]}`).join(' · ')}</dd>
    <dt>Regras aplicadas</dt><dd>projeção do saldo ${p.projecao_modo === 'conservador' ? 'conservadora' : 'nenhuma'} · alerta de saldo alto ${p.saldo_alto_multiplo == null ? 'desligado' : `acima de ${p.saldo_alto_multiplo}× o saldo inicial`} · coluna RECARGAS da Global Mob ${p.recargas_modo === 'somar' ? 'somada ao saldo' : 'ignorada'}</dd></dl>

  <h2>Por unidade</h2>${tabelaGrupo('Unidade', agrupar(linhas, 'unidade'))}
  <h2>Por cargo</h2>${tabelaGrupo('Cargo', agrupar(linhas, 'cargo'))}
  <h2>Situação do saldo</h2>
  <p>Faixas (saldo projetado × saldo inicial): ${Object.entries(FAIXAS).map(([k, r]) => `${r}: <b>${conta((l) => l.faixa_saldo === k)}</b>`).join(' · ')} · sem faixa: <b>${conta((l) => !l.faixa_saldo)}</b></p>
  ${outros.length ? `<p>Alertas: ${outros.map(([f, n]) => `${esc(SINAIS[f][0])}: <b>${n}</b>`).join(' · ')}</p>` : ''}

  ${op.pendencias ? `<h2>Servidores a revisar</h2>${lista(pend, [{ t: 'Matrícula' }, { t: 'Nome' }, { t: 'Unidade' }, { t: 'Motivo' }], (l) => `<tr><td>${esc(l.matricula)}</td><td>${esc(l.nome)}</td><td>${esc(l.unidade)}</td><td>${esc(motivos(l))}${l.cartao_sugerido ? `; sugerido ${esc(formatarCartao(l.cartao_sugerido))}` : ''}</td></tr>`, 'Nenhum servidor pendente.')}
  <h2>Saldo alto</h2>${lista(altos, [{ t: 'Matrícula' }, { t: 'Nome' }, { t: 'Unidade' }, { t: 'Saldo projetado', n: 1 }], (l) => `<tr><td>${esc(l.matricula)}</td><td>${esc(l.nome)}</td><td>${esc(l.unidade)}</td><td class="n">${brl(l.saldo_projetado_centavos)}</td></tr>`, 'Nenhum servidor acima do limite.')}
  <h2>Suspensos</h2>${lista(d.suspensos, [{ t: 'Matrícula' }, { t: 'Nome' }, { t: 'Motivo' }, { t: 'Desde' }, { t: 'Até' }], (s) => `<tr><td>${esc(s.matricula)}</td><td>${esc(s.nome)}</td><td>${esc(TIPOS_SUSP[s.motivo_tipo] ?? s.motivo_tipo)}</td><td>${fdata(s.data_efeito)}</td><td>${fdata(s.ate)}</td></tr>`, 'Nenhum servidor suspenso.')}` : ''}

  <h2>Ocorrências do ponto</h2>${lista(d.ocorrencias, [{ t: 'Matrícula' }, { t: 'Nome' }, { t: 'Situação' }, { t: 'Dias', n: 1 }, { t: 'Observação' }], (o) => `<tr><td>${esc(o.matricula)}</td><td>${esc(o.nome)}</td><td>${esc(o.descricao)}</td><td class="n">${o.dias}</td><td>${esc(o.observacao)}</td></tr>`, 'Nenhuma ocorrência lançada.')}

  <h2>Desconto em folha</h2>
  <p>${linhas.filter((l) => d.decisoes.has(l.matricula)).length} decisão(ões) registrada(s); <b>${semDecisao.length}</b> pendente(s) (desconto maior que a recarga ou que o direito; a política aguarda o jurídico).</p>
  ${semDecisao.length ? lista(semDecisao, [{ t: 'Matrícula' }, { t: 'Nome' }, { t: 'Desconto', n: 1 }, { t: 'Recarga', n: 1 }], (l) => `<tr><td>${esc(l.matricula)}</td><td>${esc(l.nome)}</td><td class="n">${brl(l.desconto_centavos)}</td><td class="n">${brl(l.repasse_centavos)}</td></tr>`, '') : ''}

  ${op.contestacoes ? `<h2>Contestações registradas</h2>${lista(d.contestacoes, [{ t: 'Matrícula' }, { t: 'Nome' }, { t: 'Registrada em' }, { t: 'Contestação' }], (c) => `<tr><td>${esc(c.matricula)}</td><td>${esc(c.nome)}</td><td>${esc(c.criado_em)}</td><td>${esc(c.texto)}</td></tr>`, 'Nenhuma contestação registrada.')}` : ''}

  ${op.recargas ? `<h2 class="quebra">Relação de recargas (${recargas.length})</h2>
  ${lista(recargas, [{ t: 'Cartão' }, { t: 'Matrícula' }, { t: 'Nome' }, { t: 'Unidade' }, { t: 'Recarga', n: 1 }], (l) => `<tr><td>${esc(formatarCartao(l.cartao))}</td><td>${esc(l.matricula)}</td><td>${esc(l.nome)}</td><td>${esc(l.unidade)}</td><td class="n">${brl(l.repasse_centavos)}</td></tr>`, 'Nenhuma recarga a creditar.')}
  <table><tfoot><tr><td>Total a creditar</td><td class="n">${brl(recargas.reduce((a, l) => a + l.repasse_centavos, 0))}</td></tr></tfoot></table>` : ''}

  <div class="ass"><div>Elaborado por<br>${esc(estado.operador)}</div><div>Conferido por</div><div>Autorizado por</div></div>
  <p class="rodape">CPF omitido neste relatório. Valores calculados pelo Controle de VT a partir da relação do RH, do saldo da Global Mob e das ocorrências do ponto lançadas.</p>
</div>`;
}

export const documentoRelatorio = (d, op) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de VT ${esc(d.ym)}</title><style>body{margin:0;background:#f3f4f6}${CSS_RELATORIO}@media print{body{background:#fff}}</style></head><body>${corpoRelatorio(d, op)}</body></html>`;

export function render(raiz) {
  if (!estado.ym) { raiz.innerHTML = '<h2>Relatório</h2><p class="aviso">Escolha uma competência em "Competência e regras".</p>'; return; }
  const d = dadosRelatorio(estado.ym);
  raiz.innerHTML = `
    <style>${CSS_RELATORIO}.rel-previa{margin-top:12px;border:1px solid var(--borda);border-radius:8px;overflow:auto;background:#fff}
      @media print{.topo,.abas,.nao-imprimir{display:none!important}.conteudo{padding:0;max-width:none}.rel-previa{border:none;overflow:visible}}</style>
    <div class="nao-imprimir">
      <h2>Relatório — ${esc(estado.ym)}</h2>
      <p class="mudo">Relatório para conferência e autorização do repasse. Sem CPF.</p>
      <div class="acoes">
        <label class="inline"><input type="checkbox" id="o-pend" ${opcoes.pendencias ? 'checked' : ''}> Pendências, saldo alto e suspensos</label>
        <label class="inline"><input type="checkbox" id="o-cont" ${opcoes.contestacoes ? 'checked' : ''}> Contestações</label>
        <label class="inline"><input type="checkbox" id="o-rec" ${opcoes.recargas ? 'checked' : ''}> Relação completa de recargas</label>
      </div>
      <div class="acoes">
        <button id="baixar" class="primario">Baixar relatório (HTML)</button>
        ${emVisualizador() ? '' : '<button id="imprimir">Imprimir / salvar em PDF</button>'}
      </div>
      <p class="mudo">${emVisualizador() ? 'Abra o arquivo baixado e use Ctrl+P → "Salvar como PDF" para imprimir.' : 'Em "Imprimir", escolha "Salvar como PDF" para gerar o arquivo.'}</p>
    </div>
    <div class="rel-previa">${corpoRelatorio(d)}</div>`;
  const ler = () => { opcoes.pendencias = $('#o-pend').checked; opcoes.contestacoes = $('#o-cont').checked; opcoes.recargas = $('#o-rec').checked; };
  for (const id of ['#o-pend', '#o-cont', '#o-rec']) $(id).onchange = () => { ler(); render(raiz); };
  $('#baixar').onclick = async () => { ler(); const r = await entregar(`relatorio-vt-${estado.ym}.html`, documentoRelatorio(d, opcoes)); if (r) aviso('Relatório gerado.'); };
  if ($('#imprimir')) $('#imprimir').onclick = () => window.print();
}
