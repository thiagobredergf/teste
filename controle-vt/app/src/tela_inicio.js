import * as banco from './db.js';
import * as arq from './arquivo.js';
import { estado } from './estado.js';
import { $, esc, aviso, confirmar, pedirTexto, emVisualizador } from './ui.js';

export function render(raiz) {
  if (!banco.temBanco()) {
    raiz.innerHTML = `
      <h2>Controle de Vale-Transporte</h2>
      <p class="mudo">Protótipo para teste. Funciona sem internet; os dados ficam em um único arquivo no seu computador.</p>
      <section class="cartao"><label>Seu nome (fica registrado no histórico de tudo o que você fizer)
        <input id="operador" autocomplete="name" placeholder="ex.: Maria Silva" style="max-width:340px"></label>
        <p class="mudo">Várias pessoas podem usar o mesmo arquivo e a mesma senha: o nome é o que permite saber quem fez cada alteração.</p></section>
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
    const operador = () => { const n = $('#operador').value.trim(); if (!n) aviso('Informe o seu nome: ele fica registrado no histórico.', 'erro'); return n; };
    $('#criar').onclick = async () => {
      const nome = operador(); if (!nome) return;
      const s = $('#senha-nova').value;
      if (s !== $('#senha-rep').value) return aviso('As senhas não são iguais.', 'erro');
      if (!s && !(await confirmar('Criar sem senha?', 'Qualquer pessoa com acesso ao arquivo poderá ler os dados.', 'Criar sem senha'))) return;
      if (s && s.length < 8 && !(await confirmar('Senha curta', 'Uma senha com menos de 8 caracteres é fácil de adivinhar, e o arquivo guarda CPF de servidores. Use uma frase ou combine letras, números e símbolos.', 'Usar mesmo assim'))) return;
      banco.novoBanco(); banco.definirOperador(nome); arq.definirSenha(s); banco.auditar('arquivo criado', `por ${nome}`); estado.operador = nome; estado.irPara('competencia');
    };
    $('#abrir').onclick = async () => {
      const nome = operador(); if (!nome) return;
      try {
        const bytes = await arq.escolherArquivo(); if (!bytes) return;
        banco.carregarBanco(await arq.desempacotar(bytes, $('#senha-abrir').value));
        banco.definirOperador(nome); estado.operador = nome;
        arq.definirSenha($('#senha-abrir').value); estado.irPara('inicio'); aviso('Arquivo aberto.');
      } catch (e) { aviso(e.message, 'erro'); }
    };
    return;
  }
  const n = (sql) => banco.q(sql)[0].n;
  raiz.innerHTML = `
    <h2>Arquivo de dados</h2>
    <p>Operador: <b>${esc(estado.operador)}</b></p>
    <div class="cartoes">
      <div class="cartao num"><b>${n("select count(*) n from servidor where situacao='ativo'")}</b><span>servidores ativos</span></div>
      <div class="cartao num"><b>${n("select count(*) n from servidor where situacao='suspenso'")}</b><span>suspensos</span></div>
      <div class="cartao num"><b>${n('select count(*) n from competencia')}</b><span>competências</span></div>
      <div class="cartao num"><b>${n("select count(*) n from competencia where status='fechada'")}</b><span>fechadas</span></div>
    </div>
    <p>${arq.senhaDefinida() ? 'Arquivo protegido por senha.' : '<b>Atenção:</b> este arquivo não tem senha.'}
       ${arq.apiDeArquivos() ? '' : `Ao salvar, o arquivo é baixado${emVisualizador() ? ' (o visualizador pede a sua confirmação)' : ''}. Cada salvamento gera um arquivo novo com data e hora: guarde o mais recente e apague os antigos.`}</p>
    <div class="acoes">
      <button id="salvar" class="primario">Salvar</button>
      <button id="salvar-como">Salvar como…</button>
      <button id="copia">Cópia de segurança datada</button>
      <button id="mudar-senha">Trocar a senha</button>
    </div>
    <h3>Histórico recente</h3>
    <table class="tabela"><thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Detalhe</th></tr></thead><tbody>
      ${banco.q('select em, quem, acao, detalhe from auditoria order by id desc limit 20').map((a) => `<tr><td>${esc(a.em)}</td><td>${esc(a.quem)}</td><td>${esc(a.acao)}</td><td>${esc(a.detalhe)}</td></tr>`).join('') || '<tr><td colspan="4" class="mudo">Sem registros ainda.</td></tr>'}
    </tbody></table>`;
  $('#salvar').onclick = () => estado.persistir(true);
  $('#salvar-como').onclick = () => estado.persistir(true, true);
  $('#copia').onclick = async () => { await arq.copiaDeSeguranca(banco.exportarBanco()); aviso('Cópia de segurança gerada.'); };
  $('#mudar-senha').onclick = async () => {
    const s = await pedirTexto('Trocar a senha', 'Nova senha (em branco remove a senha)', { tipo: 'password' });
    if (s === null) return;
    arq.definirSenha(s); banco.auditar('senha', 'senha do arquivo alterada'); estado.persistir(true);
  };
}
