import * as banco from './db.js';
import { estado } from './estado.js';
import { $, $$, esc, aviso, brl, lerTexto } from './ui.js';
import { lerTexto as lerTxt, aplicarMapa } from '../../core/mapeamento.mjs';
import { compararRelacao } from '../../core/relacao.mjs';
import { normalizarCpf, normalizarCartao } from '../../core/identificadores.mjs';

// Campos que a ferramenta quer da relação do RH. "chaves": nomes de colunas reconhecidos automaticamente.
const CAMPOS = [
  ['matricula', 'Matrícula', 'texto', true, ['matricula', 'matric']],
  ['nome', 'Nome', 'texto', true, ['nome', 'servidor']],
  ['cpf', 'CPF', 'texto', true, ['cpf', 'documento']],
  ['cargo', 'Cargo', 'texto', false, ['cargo', 'funcao']],
  ['unidade', 'Unidade (escola/setor)', 'texto', false, ['unidade', 'escola', 'setor', 'lotacao']],
  ['valor_diario_centavos', 'Valor diário da passagem', 'dinheiro', true, ['valor diario', 'valor_diario', 'passagem', 'valor da passagem']],
  ['dias_semana', 'Dias por semana', 'inteiro', false, ['dias semana', 'dias_semana', 'dias por semana', 'dias trabalhados']],
  ['saldo_inicial_centavos', 'Saldo inicial', 'dinheiro', false, ['saldo inicial', 'saldo_inicial']],
  ['desconto_centavos', 'Desconto em folha (valor)', 'dinheiro', false, ['desconto']],
  ['cartao', 'Nº do cartão', 'texto', false, ['cartao', 'n do cartao']],
];
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
const SEP = { ',': 'vírgula (,)', ';': 'ponto e vírgula (;)', '\t': 'tabulação' };
let sessao = null; // { texto, separador, colunas, mapa, resultado }

const noCadastro = () => banco.q("select * from servidor").map((s) => ({ ...s, cartao: s.cartao || null }));

export function render(raiz) {
  if (!sessao) {
    raiz.innerHTML = `
      <h2>Relação de beneficiários (RH)</h2>
      <p class="mudo">Carregue o TXT do RH. A ferramenta compara com o cadastro e mostra só o que mudou.
         ${banco.q('select count(*) n from servidor')[0].n === 0 ? '<b>Cadastro vazio: todos entrarão como inclusão.</b>' : ''}</p>
      <div class="acoes">
        <label>Arquivo TXT/CSV <input type="file" id="arq" accept=".txt,.csv"></label>
        <label>Separador <select id="sep">${Object.entries(SEP).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
        <button id="ler" class="primario">Ler arquivo</button>
      </div>`;
    $('#ler').onclick = async () => {
      const f = $('#arq').files[0]; if (!f) return aviso('Escolha um arquivo.', 'erro');
      const { texto, codificacao } = await lerTexto(f);
      const separador = $('#sep').value;
      const linhas = lerTxt(texto, { tipo: 'delimitado', separador, cabecalho: true });
      const colunas = linhas.find((l) => l.campos)?.campos ? Object.keys(linhas.find((l) => l.campos).campos) : (texto.split(/\r?\n/)[0] ?? '').split(separador).map((s) => s.trim());
      const salvo = banco.q("select * from perfil_importacao where nome = 'relacao_rh'")[0];
      const salvoMapa = salvo ? JSON.parse(salvo.mapa) : {};
      const mapa = {};
      for (const [campo, , , , chaves] of CAMPOS) {
        const usado = salvoMapa[campo] && colunas.includes(salvoMapa[campo]) ? salvoMapa[campo] : colunas.find((c) => chaves.some((k) => norm(c) === k || norm(c).includes(k)));
        if (usado) mapa[campo] = usado;
      }
      sessao = { texto, separador, colunas, mapa, codificacao, nomeArquivo: f.name, resultado: null };
      render(raiz);
    };
    return;
  }
  if (!sessao.resultado) return renderMapa(raiz);
  renderComparacao(raiz);
}

function renderMapa(raiz) {
  raiz.innerHTML = `
    <h2>Relação de beneficiários (RH)</h2>
    <p>Arquivo <b>${esc(sessao.nomeArquivo)}</b> (${esc(sessao.codificacao)}), ${sessao.colunas.length} colunas. Confira qual coluna é cada campo.</p>
    <table class="tabela compacta"><thead><tr><th>Campo</th><th>Coluna do arquivo</th></tr></thead><tbody>
      ${CAMPOS.map(([campo, rotulo, , obrig]) => `<tr><td>${rotulo}${obrig ? ' <b title="obrigatório">*</b>' : ''}</td><td><select class="map" data-campo="${campo}"><option value="">— não vem no arquivo —</option>${sessao.colunas.map((c) => `<option ${sessao.mapa[campo] === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></td></tr>`).join('')}
    </tbody></table>
    <label class="inline"><input type="checkbox" id="guardar" checked> Guardar este mapeamento para as próximas importações</label>
    <div class="acoes"><button id="voltar">Outro arquivo</button><button id="comparar" class="primario">Ler e comparar com o cadastro</button></div>`;
  $('#voltar').onclick = () => { sessao = null; render(raiz); };
  $('#comparar').onclick = () => {
    const mapa = {};
    $$('.map').forEach((s) => { if (s.value) mapa[s.dataset.campo] = s.value; });
    const falta = CAMPOS.filter(([c, , , o]) => o && !mapa[c]).map(([, r]) => r);
    if (falta.length) return aviso(`Falta indicar: ${falta.join(', ')}.`, 'erro');
    sessao.mapa = mapa;
    if ($('#guardar').checked) banco.x("insert or replace into perfil_importacao values ('relacao_rh', ?, ?)", [JSON.stringify({ separador: sessao.separador }), JSON.stringify(mapa)]);
    comparar();
    render(raiz);
  };
}

function comparar() {
  const mapaDef = Object.fromEntries(CAMPOS.filter(([c]) => sessao.mapa[c]).map(([c, , tipo, obrig]) => [c, { coluna: sessao.mapa[c], tipo, obrigatorio: obrig }]));
  const { ok, rejeitadas } = aplicarMapa(lerTxt(sessao.texto, { tipo: 'delimitado', separador: sessao.separador, cabecalho: true }), mapaDef);
  const avisos = { cpf_invalido: 0, cartao_invalido: 0 };
  const lista = ok.map((r) => {
    const o = { ...r };
    if ('cpf' in o) { const c = normalizarCpf(o.cpf); if (!c) avisos.cpf_invalido++; o.cpf = c; }
    if ('cartao' in o) { const c = normalizarCartao(o.cartao); if (o.cartao && !c) avisos.cartao_invalido++; o.cartao = c; }
    return o;
  });
  sessao.lista = lista;
  sessao.resultado = { ...compararRelacao(lista, noCadastro()), rejeitadas, avisos };
}

const rotuloCampo = { valor_diario_centavos: 'Valor diário', dias_semana: 'Dias/semana', saldo_inicial_centavos: 'Saldo inicial', cartao: 'Cartão', desconto_centavos: 'Desconto', unidade: 'Unidade' };
const fmtCampo = (campo, v) => (v == null ? '—' : campo.endsWith('_centavos') ? brl(v) : esc(v));

function renderComparacao(raiz) {
  const r = sessao.resultado;
  raiz.innerHTML = `
    <h2>Comparação com o cadastro</h2>
    <div class="cartoes">
      <div class="cartao num"><b>${r.resumo.na_relacao}</b><span>na relação do RH</span></div>
      <div class="cartao num"><b>${r.entradas.length}</b><span>entradas</span></div>
      <div class="cartao num"><b>${r.saidas.length}</b><span>saídas a classificar</span></div>
      <div class="cartao num"><b>${r.resumo.servidores_com_alteracao}</b><span>com alteração</span></div>
      <div class="cartao num"><b>${r.inalterados}</b><span>sem mudança</span></div>
    </div>
    ${r.rejeitadas.length ? `<details open><summary class="erro">${r.rejeitadas.length} linha(s) rejeitada(s)</summary><table class="tabela compacta"><tbody>${r.rejeitadas.slice(0, 30).map((x) => `<tr><td>linha ${x.linha}</td><td>${esc(x.motivo)}</td></tr>`).join('')}</tbody></table></details>` : ''}
    ${r.duplicadas.length ? `<p class="erro">Matrículas duplicadas na relação (não comparadas): ${r.duplicadas.map((d) => esc(d.matricula)).join(', ')}</p>` : ''}
    ${r.semMatricula.length ? `<p class="erro">${r.semMatricula.length} linha(s) sem matrícula.</p>` : ''}
    ${r.avisos.cpf_invalido ? `<p class="aviso">${r.avisos.cpf_invalido} CPF(s) ausente(s) ou inválido(s): sem CPF não há cruzamento seguro com a Global Mob.</p>` : ''}
    ${r.entradas.length ? `<h3>Entradas</h3><table class="tabela compacta"><thead><tr><th></th><th>Matrícula</th><th>Nome</th><th>Tipo</th></tr></thead><tbody>
      ${r.entradas.map((e, i) => `<tr><td><input type="checkbox" class="ent" data-i="${i}" checked></td><td>${esc(e.matricula)}</td><td>${esc(e.nome)}</td><td>${e.evento_sugerido === 'reativacao' ? `reativação (estava ${esc(e.situacao_anterior)})` : 'inclusão'}</td></tr>`).join('')}</tbody></table>` : ''}
    ${r.saidas.length ? `<h3>Saíram da relação — classifique</h3><p class="mudo">Quem está suspenso por saldo alto ou licença continua na relação; aqui aparece quem deixou de constar.</p>
      <table class="tabela compacta"><thead><tr><th>Matrícula</th><th>Nome</th><th>O que aconteceu</th></tr></thead><tbody>
      ${r.saidas.map((s, i) => `<tr><td>${esc(s.matricula)}</td><td>${esc(s.nome)}</td><td><select class="sai" data-i="${i}"><option value="">decidir depois</option><option value="desligamento">desligamento</option><option value="desistencia">desistência (não quer descontar)</option><option value="outro">outro (cancelar)</option></select></td></tr>`).join('')}</tbody></table>` : ''}
    ${r.alteracoes.length ? `<h3>Alterações</h3><table class="tabela compacta"><thead><tr><th></th><th>Matrícula</th><th>Nome</th><th>Campo</th><th>De</th><th>Para</th></tr></thead><tbody>
      ${r.alteracoes.map((a, i) => `<tr><td><input type="checkbox" class="alt" data-i="${i}" checked></td><td>${esc(a.matricula)}</td><td>${esc(a.nome)}</td><td>${rotuloCampo[a.campo] ?? a.campo}</td><td>${fmtCampo(a.campo, a.de)}</td><td>${fmtCampo(a.campo, a.para)}</td></tr>`).join('')}</tbody></table>` : ''}
    <div class="acoes"><button id="voltar">Voltar</button><button id="aplicar" class="primario">Aplicar o que está marcado</button></div>`;
  $('#voltar').onclick = () => { sessao.resultado = null; render(raiz); };
  $('#aplicar').onclick = () => aplicar(raiz);
}

function aplicar(raiz) {
  const r = sessao.resultado;
  const por = new Map(sessao.lista.map((x) => [String(x.matricula).trim(), x]));
  const hoje = new Date().toISOString().slice(0, 10);
  const origem = `relação RH: ${sessao.nomeArquivo}`;
  const cont = { entradas: 0, saidas: 0, alteracoes: 0 };
  banco.transacao(() => {
    for (const cb of $$('.ent').filter((c) => c.checked)) {
      const e = r.entradas[Number(cb.dataset.i)]; const x = por.get(e.matricula);
      if (e.evento_sugerido === 'inclusao') {
        banco.x(`insert into servidor (matricula, nome, cpf, cargo, unidade, cartao, valor_diario_centavos, dias_semana, saldo_inicial_centavos, desconto_centavos, situacao) values (?,?,?,?,?,?,?,?,?,?, 'ativo')`,
          [e.matricula, x.nome, x.cpf ?? null, x.cargo ?? null, x.unidade ?? null, x.cartao ?? null, x.valor_diario_centavos ?? null, x.dias_semana ?? null, x.saldo_inicial_centavos ?? null, x.desconto_centavos ?? null]);
        banco.x("insert into evento (matricula, tipo, motivo_tipo, data_efeito, origem) values (?, 'inclusao', 'adesao', ?, ?)", [e.matricula, hoje, origem]);
      } else {
        banco.x("update servidor set situacao = 'ativo', atualizado_em = datetime('now') where matricula = ?", [e.matricula]);
        banco.x("insert into evento (matricula, tipo, motivo_tipo, data_efeito, origem) values (?, 'reativacao', 'retorno', ?, ?)", [e.matricula, hoje, origem]);
      }
      cont.entradas++;
    }
    for (const sel of $$('.sai').filter((s) => s.value)) {
      const s = r.saidas[Number(sel.dataset.i)];
      banco.x("update servidor set situacao = 'cancelado', atualizado_em = datetime('now') where matricula = ?", [s.matricula]);
      banco.x("insert into evento (matricula, tipo, motivo_tipo, data_efeito, origem) values (?, 'cancelamento', ?, ?, ?)", [s.matricula, sel.value === 'outro' ? 'outro' : sel.value, hoje, origem]);
      cont.saidas++;
    }
    for (const cb of $$('.alt').filter((c) => c.checked)) {
      const a = r.alteracoes[Number(cb.dataset.i)];
      banco.x(`update servidor set ${a.campo} = ?, atualizado_em = datetime('now') where matricula = ?`, [a.para, a.matricula]);
      banco.x("insert into evento (matricula, tipo, motivo_tipo, data_efeito, motivo, origem) values (?, 'alteracao', 'outro', ?, ?, ?)", [a.matricula, hoje, `${a.campo}: ${a.de ?? 'vazio'} → ${a.para ?? 'vazio'}`, origem]);
      cont.alteracoes++;
    }
    // dados de identificação (nome, CPF, cargo) acompanham a relação do RH sem exigir confirmação
    for (const x of sessao.lista) {
      const m = String(x.matricula).trim();
      banco.x("update servidor set nome = coalesce(?, nome), cpf = coalesce(?, cpf), cargo = coalesce(?, cargo) where matricula = ?", [x.nome ?? null, x.cpf ?? null, x.cargo ?? null, m]);
    }
    banco.auditar('relação do RH aplicada', `${sessao.nomeArquivo}: ${cont.entradas} entradas, ${cont.saidas} saídas, ${cont.alteracoes} alterações`);
  });
  sessao = null;
  estado.persistir();
  aviso(`Aplicado: ${cont.entradas} entrada(s), ${cont.saidas} saída(s), ${cont.alteracoes} alteração(ões).`);
  render(raiz);
}
