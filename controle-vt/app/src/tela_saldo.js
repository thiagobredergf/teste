import * as banco from './db.js';
import { estado } from './estado.js';
import { $, $$, esc, aviso, brl, selo } from './ui.js';
import { extrairSaldoGlobalMob, lerPaginasPdfjs } from '../../core/pdfsaldo.mjs';
import { cruzarSaldos } from '../../core/cruzamento.mjs';
import { dataLeituraSugerida } from '../../core/historico_saldo.mjs';
import { normalizarCartao } from '../../core/identificadores.mjs';

let sessao = null; // { nome, extracao, data, fonte }

export const servidoresParaCruzar = () => banco.q("select matricula, cpf, cartao, nome from servidor where situacao <> 'cancelado'");

// Último saldo de cada cartão, no formato que o cruzamento espera.
export const cartoesDoBanco = () => banco.q(`
  select s.cartao, s.cpf, s.status_cartao as status, s.valor_centavos as saldo_centavos, s.recargas_centavos, s.lido_em
  from saldo s join (select cartao, max(lido_em) m from saldo group by cartao) t on t.cartao = s.cartao and t.m = s.lido_em`);

export function render(raiz) {
  const comp = estado.ym ? banco.competencia(estado.ym) : null;
  raiz.innerHTML = `
    <h2>Saldo dos cartões (Global Mob)</h2>
    <p class="mudo">Carregue o PDF "Saldo de cartões". A leitura só é aceita se a soma dos saldos bater com o total impresso no próprio relatório.</p>
    <div class="acoes"><label>PDF <input type="file" id="pdf" accept=".pdf,application/pdf"></label><button id="ler" class="primario">Ler PDF</button></div>
    <div id="resultado">${sessao ? corpo() : ''}</div>
    <hr>${manual()}
    <hr><h3>Saldos já guardados</h3>${resumoBanco(comp)}`;
  $('#ler').onclick = lerPdf.bind(null, raiz);
  if (sessao) ligarCorpo(raiz);
  $('#manual-salvar').onclick = () => salvarManual(raiz);
}

async function lerPdf(raiz) {
  const f = $('#pdf').files[0]; if (!f) return aviso('Escolha o PDF.', 'erro');
  $('#ler').disabled = true; $('#ler').textContent = 'Lendo…';
  try {
    const dados = new Uint8Array(await f.arrayBuffer());
    const paginas = await lerPaginasPdfjs(window.pdfjsLib, dados);
    const extracao = extrairSaldoGlobalMob(paginas);
    const { data, fonte } = dataLeituraSugerida({ nomeArquivo: f.name });
    sessao = { nome: f.name, extracao, data, fonte };
  } catch (e) { sessao = null; aviso(`Não foi possível ler o PDF: ${e.message}`, 'erro'); }
  render(raiz);
}

function corpo() {
  const { extracao: e } = sessao;
  const cruz = cruzarSaldos(servidoresParaCruzar().map((s) => ({ ...s, cartao: normalizarCartao(s.cartao) })), e.cartoes);
  sessao.cruz = cruz;
  const cont = {};
  for (const s of cruz.servidores) for (const f of s.flags) cont[f] = (cont[f] ?? 0) + 1;
  const sugest = cruz.servidores.filter((s) => s.cartao_sugerido);
  const nomes = new Map(servidoresParaCruzar().map((s) => [s.matricula, s.nome]));
  return `
    <div class="cartoes">
      <div class="cartao num"><b>${e.cartoes.length}</b><span>cartões no PDF</span></div>
      <div class="cartao num"><b>${brl(e.total_impresso_centavos)}</b><span>total impresso</span></div>
      <div class="cartao num"><b>${brl(e.soma_saldos_centavos)}</b><span>soma extraída</span></div>
      <div class="cartao num ${e.confere ? 'ok' : 'erro'}"><b>${e.confere ? 'confere' : 'NÃO confere'}</b><span>conferência</span></div>
    </div>
    ${e.avisos.map((a) => `<p class="erro">${esc(a)}</p>`).join('')}
    <label>Data da leitura do saldo <input type="date" id="data" value="${esc(sessao.data ?? '')}">
      <span class="mudo">${sessao.fonte === 'nome_arquivo' ? 'sugerida pelo nome do arquivo — confirme' : 'o PDF não traz a data: informe'}</span></label>
    <h3>Cruzamento com os beneficiários (por CPF)</h3>
    <p>${cruz.servidores.length - cruz.servidores.filter((s) => !s.cartao_usado).length} de ${cruz.servidores.length} com cartão ativo encontrado.
       Serão guardados <b>${cruz.cartoes_relevantes.length}</b> cartões; os outros <b>${cruz.cartoes_descartados}</b> (pessoas que não são beneficiárias) são descartados.</p>
    <p>${Object.entries(cont).map(([f, n]) => `${selo(f)} ${n}`).join(' &nbsp; ') || '<span class="mudo">Nenhuma pendência.</span>'}</p>
    ${sugest.length ? `<h4>Cartão do cadastro ausente ou desatualizado — há um único cartão ativo para o mesmo CPF</h4>
      <p><button id="adotar-todos">Adotar os ${sugest.length} cartões sugeridos</button> <span class="mudo">Só há sugestão quando o CPF tem exatamente um cartão ativo.</span></p><table class="tabela compacta"><tbody>
      ${sugest.slice(0, 50).map((s) => `<tr><td>${esc(s.matricula)}</td><td>${esc(nomes.get(s.matricula))}</td><td>${esc(s.cartao_sugerido)}</td><td><button class="adotar" data-m="${esc(s.matricula)}" data-c="${esc(s.cartao_sugerido)}">Adotar este cartão</button></td></tr>`).join('')}</tbody></table>` : ''}
    <div class="acoes"><button id="aplicar" class="primario" ${e.confere ? '' : 'disabled'}>Guardar saldos</button>
      ${e.confere ? '' : '<span class="erro">Bloqueado: a extração não confere com o total do relatório.</span>'}</div>`;
}

function ligarCorpo(raiz) {
  const todos = $('#adotar-todos');
  if (todos) todos.onclick = () => {
    const lista = sessao.cruz.servidores.filter((s) => s.cartao_sugerido);
    if (!confirm(`Adotar o cartão sugerido para ${lista.length} servidor(es)? Cada troca fica registrada no histórico.`)) return;
    banco.transacao(() => {
      for (const s of lista) {
        banco.x('update servidor set cartao = ? where matricula = ?', [s.cartao_sugerido, s.matricula]);
        banco.x("insert into evento (matricula, tipo, motivo_tipo, data_efeito, motivo, origem) values (?, 'alteracao', 'outro', date('now'), ?, 'cruzamento com a Global Mob')", [s.matricula, `cartão → ${s.cartao_sugerido}`]);
      }
      banco.auditar('cartões adotados', `${lista.length} cartões sugeridos pelo cruzamento por CPF`);
    });
    estado.persistir(); aviso(`${lista.length} cartões adotados.`); render(raiz);
  };
  $$('.adotar').forEach((b) => { b.onclick = () => {
    banco.x('update servidor set cartao = ? where matricula = ?', [b.dataset.c, b.dataset.m]);
    banco.x("insert into evento (matricula, tipo, motivo_tipo, data_efeito, motivo, origem) values (?, 'alteracao', 'outro', date('now'), ?, 'cruzamento com a Global Mob')", [b.dataset.m, `cartão → ${b.dataset.c}`]);
    estado.persistir(); render(raiz);
  }; });
  $('#aplicar').onclick = () => {
    const data = $('#data').value; if (!data) return aviso('Informe a data da leitura do saldo.', 'erro');
    const lido = `${data}T00:00:00`;
    let n = 0;
    banco.transacao(() => {
      for (const c of sessao.cruz.cartoes_relevantes) {
        banco.x('insert or replace into saldo (cartao, cpf, valor_centavos, recargas_centavos, status_cartao, lido_em, fonte, arquivo) values (?,?,?,?,?,?,?,?)',
          [c.cartao, c.cpf, c.saldo_centavos, c.recargas_centavos, c.status, lido, 'pdf', sessao.nome]); n++;
      }
      if (estado.ym) banco.x("update competencia set data_leitura = ? where ym = ? and status = 'aberta'", [data, estado.ym]);
      banco.auditar('saldo importado', `${sessao.nome}: ${n} cartões, leitura em ${data}, total ${brl(sessao.extracao.total_impresso_centavos)} conferido`);
    });
    sessao = null; estado.persistir(); aviso(`${n} saldos guardados.`); render(raiz);
  };
}

function manual() {
  return `<h3>Lançar saldo manualmente</h3>
    <p class="mudo">A data e a hora são registradas automaticamente no momento do lançamento. O valor anterior não é apagado.</p>
    <div class="acoes"><label>Matrícula <input id="manual-mat" list="lista-mat"></label>
      <datalist id="lista-mat">${banco.q('select matricula, nome from servidor').map((s) => `<option value="${esc(s.matricula)}">${esc(s.nome)}</option>`).join('')}</datalist>
      <label>Saldo (R$) <input id="manual-valor" inputmode="decimal" style="width:8em"></label>
      <button id="manual-salvar">Lançar</button></div>`;
}

function salvarManual(raiz) {
  const mat = $('#manual-mat').value.trim();
  const s = banco.q('select cartao, cpf from servidor where matricula = ?', [mat])[0];
  if (!s || !s.cartao) return aviso('Matrícula não encontrada ou sem cartão cadastrado.', 'erro');
  const v = Number($('#manual-valor').value.replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(v)) return aviso('Informe o valor do saldo.', 'erro');
  const agora = new Date().toISOString().slice(0, 19);
  banco.x("insert into saldo (cartao, cpf, valor_centavos, recargas_centavos, status_cartao, lido_em, fonte) values (?,?,?,0,'ATIVO',?,'manual')", [normalizarCartao(s.cartao), s.cpf, Math.round(v * 100), agora]);
  banco.auditar('saldo manual', `${mat}: ${brl(Math.round(v * 100))} em ${agora}`);
  estado.persistir(); aviso(`Saldo lançado em ${agora.replace('T', ' ')}.`); render(raiz);
}

function resumoBanco() {
  const r = banco.q(`select count(*) n, max(lido_em) ultimo, sum(case when fonte='manual' then 1 else 0 end) manuais from saldo`)[0];
  return r.n ? `<p>${r.n} registro(s) de saldo, o mais recente de <b>${esc(String(r.ultimo).replace('T', ' '))}</b> (${r.manuais} manual/manuais).</p>` : '<p class="mudo">Nenhum saldo guardado ainda.</p>';
}
