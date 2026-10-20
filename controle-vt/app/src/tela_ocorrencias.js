import * as banco from './db.js';
import { estado } from './estado.js';
import { $, $$, esc, aviso } from './ui.js';

export function render(raiz) {
  if (!estado.ym) { raiz.innerHTML = '<h2>Ocorrências do ponto</h2><p class="aviso">Escolha uma competência em "Competência e regras".</p>'; return; }
  const comp = banco.competencia(estado.ym);
  const tipos = banco.q('select * from regra_ocorrencia order by descricao');
  const lista = banco.q(`select o.*, s.nome from ocorrencia o left join servidor s on s.matricula = o.matricula where o.ym = ? order by o.id desc`, [estado.ym]);
  raiz.innerHTML = `
    <h2>Ocorrências do ponto — ${esc(estado.ym)}</h2>
    <p class="mudo">Faltas, licenças e férias que reduzem os dias de vale-transporte do mês. Cada situação tem a sua regra (desconta ou não).</p>
    ${comp.status === 'fechada' ? '<p class="aviso">Competência fechada: não aceita novos lançamentos.</p>' : `
    <div class="acoes">
      <label>Matrícula <input id="o-mat" list="o-lista"></label>
      <datalist id="o-lista">${banco.q('select matricula, nome from servidor').map((s) => `<option value="${esc(s.matricula)}">${esc(s.nome)}</option>`).join('')}</datalist>
      <label>Situação <select id="o-tipo">${tipos.map((t) => `<option value="${t.tipo}">${esc(t.descricao)}${t.desconta_vt ? '' : ' (não desconta)'}</option>`).join('')}</select></label>
      <label>Dias <input id="o-dias" type="number" min="1" style="width:5em"></label>
      <label>Observação <input id="o-obs"></label>
      <button id="o-add" class="primario">Lançar</button></div>`}
    <table class="tabela"><thead><tr><th>Matrícula</th><th>Nome</th><th>Situação</th><th>Dias</th><th>Observação</th><th></th></tr></thead><tbody>
      ${lista.map((o) => `<tr class="${o.ativo ? '' : 'anulada'}"><td>${esc(o.matricula)}</td><td>${esc(o.nome)}</td><td>${esc(tipos.find((t) => t.tipo === o.tipo)?.descricao)}</td><td>${o.dias}</td><td>${esc(o.observacao)}</td>
        <td>${o.ativo ? `<button class="anular" data-id="${o.id}">Anular</button>` : '<span class="mudo">anulada</span>'}</td></tr>`).join('') || '<tr><td colspan="6" class="mudo">Nenhuma ocorrência lançada.</td></tr>'}
    </tbody></table>`;
  const add = $('#o-add');
  if (add) add.onclick = () => {
    const mat = $('#o-mat').value.trim(); const dias = Number($('#o-dias').value);
    if (!banco.q('select 1 from servidor where matricula = ?', [mat]).length) return aviso('Matrícula não encontrada.', 'erro');
    if (!Number.isInteger(dias) || dias < 1) return aviso('Informe os dias (inteiro maior que zero).', 'erro');
    try {
      banco.x('insert into ocorrencia (ym, matricula, tipo, dias, observacao) values (?,?,?,?,?)', [estado.ym, mat, $('#o-tipo').value, dias, $('#o-obs').value || null]);
      banco.auditar('ocorrência lançada', `${estado.ym} ${mat}: ${$('#o-tipo').value} ${dias} dia(s)`); estado.persistir(); render(raiz);
    } catch (e) { aviso(e.message, 'erro'); }
  };
  $$('.anular').forEach((b) => { b.onclick = () => {
    banco.x('update ocorrencia set ativo = 0 where id = ?', [Number(b.dataset.id)]);
    banco.auditar('ocorrência anulada', `id ${b.dataset.id}`); estado.persistir(); render(raiz);
  }; });
}
