import * as banco from './db.js';
import * as arq from './arquivo.js';
import { estado } from './estado.js';
import { $, esc, aviso } from './ui.js';

export function render(raiz) {
  if (!banco.temBanco()) {
    raiz.innerHTML = `
      <h2>Controle de Vale-Transporte</h2>
      <p class="mudo">Protótipo para teste. Funciona sem internet; os dados ficam em um único arquivo no seu computador.</p>
      <div class="duas">
        <section class="cartao"><h3>Novo arquivo de dados</h3>
          <label>Senha do arquivo (recomendado) <input type="password" id="senha-nova" autocomplete="new-password"></label>
          <label>Repita a senha <input type="password" id="senha-rep" autocomplete="new-password"></label>
          <p class="mudo">Sem a senha não há como abrir o arquivo. Guarde-a em local seguro.</p>
          <button id="criar" class="primario">Criar</button></section>
        <section class="cartao"><h3>Abrir arquivo existente</h3>
          <label>Senha do arquivo <input type="password" id="senha-abrir" autocomplete="current-password"></label>
          <button id="abrir" class="primario">Escolher arquivo…</button></section>
      </div>`;
    $('#criar').onclick = () => {
      const s = $('#senha-nova').value;
      if (s !== $('#senha-rep').value) return aviso('As senhas não são iguais.', 'erro');
      if (!s && !confirm('Criar o arquivo SEM senha? Qualquer pessoa com acesso ao arquivo poderá ler os dados.')) return;
      banco.novoBanco(); arq.definirSenha(s); estado.irPara('competencia');
    };
    $('#abrir').onclick = async () => {
      try {
        const bytes = await arq.escolherArquivo(); if (!bytes) return;
        banco.carregarBanco(await arq.desempacotar(bytes, $('#senha-abrir').value));
        arq.definirSenha($('#senha-abrir').value); estado.irPara('inicio'); aviso('Arquivo aberto.');
      } catch (e) { aviso(e.message, 'erro'); }
    };
    return;
  }
  const n = (sql) => banco.q(sql)[0].n;
  raiz.innerHTML = `
    <h2>Arquivo de dados</h2>
    <div class="cartoes">
      <div class="cartao num"><b>${n("select count(*) n from servidor where situacao='ativo'")}</b><span>servidores ativos</span></div>
      <div class="cartao num"><b>${n("select count(*) n from servidor where situacao='suspenso'")}</b><span>suspensos</span></div>
      <div class="cartao num"><b>${n('select count(*) n from competencia')}</b><span>competências</span></div>
      <div class="cartao num"><b>${n("select count(*) n from competencia where status='fechada'")}</b><span>fechadas</span></div>
    </div>
    <p>${arq.senhaDefinida() ? 'Arquivo protegido por senha.' : '<b>Atenção:</b> este arquivo não tem senha.'}
       ${arq.apiDeArquivos() ? '' : 'Este navegador não permite gravar direto no arquivo: ao salvar, o arquivo será baixado.'}</p>
    <div class="acoes">
      <button id="salvar" class="primario">Salvar</button>
      <button id="salvar-como">Salvar como…</button>
      <button id="copia">Cópia de segurança datada</button>
      <button id="mudar-senha">Trocar a senha</button>
    </div>
    <h3>Histórico recente</h3>
    <table class="tabela"><thead><tr><th>Quando</th><th>Ação</th><th>Detalhe</th></tr></thead><tbody>
      ${banco.q('select em, acao, detalhe from auditoria order by id desc limit 15').map((a) => `<tr><td>${esc(a.em)}</td><td>${esc(a.acao)}</td><td>${esc(a.detalhe)}</td></tr>`).join('') || '<tr><td colspan="3" class="mudo">Sem registros ainda.</td></tr>'}
    </tbody></table>`;
  $('#salvar').onclick = () => estado.persistir(true);
  $('#salvar-como').onclick = () => estado.persistir(true, true);
  $('#copia').onclick = async () => { await arq.copiaDeSeguranca(banco.exportarBanco()); aviso('Cópia de segurança gerada.'); };
  $('#mudar-senha').onclick = () => {
    const s = prompt('Nova senha (deixe em branco para remover a senha):');
    if (s === null) return;
    arq.definirSenha(s); banco.auditar('senha', 'senha do arquivo alterada'); estado.persistir(true);
  };
}
