import * as banco from './db.js';
import * as arq from './arquivo.js';
import { estado } from './estado.js';
import { $, $$, aviso } from './ui.js';
import * as inicio from './tela_inicio.js';
import * as competencia from './tela_competencia.js';
import * as relacao from './tela_relacao.js';
import * as saldo from './tela_saldo.js';
import * as ocorrencias from './tela_ocorrencias.js';
import * as resultado from './tela_resultado.js';
import * as relatorio from './tela_relatorio.js';
import * as painel from './tela_painel.js';

const ABAS = [['inicio', 'Arquivo'], ['competencia', 'Competência e regras'], ['relacao', 'Relação do RH'], ['saldo', 'Saldo Global Mob'], ['ocorrencias', 'Ocorrências do ponto'], ['resultado', 'Resultado'], ['relatorio', 'Relatório'], ['painel', 'Painel']];
// Indicador no topo; com alterações pendentes, mostra o botão Salvar (na versão publicada cada salvamento é um download).
function mostrarEstado() {
  const el = $('#estado');
  if (!el) return;
  if (!banco.temBanco()) { el.innerHTML = ''; return; }
  el.innerHTML = banco.foiAlterado() ? '<span class="selo atencao">alterações não salvas</span> <button id="salvar-topo" class="primario pequeno">Salvar</button>' : '<span class="selo ok">salvo</span>';
  const b = $('#salvar-topo');
  if (b) b.onclick = () => estado.persistir(true);
}

const TELAS = { inicio, competencia, relacao, saldo, ocorrencias, resultado, relatorio, painel };

function desenhar() {
  const com = banco.temBanco();
  if (com && !estado.ym) estado.ym = banco.competencias()[0]?.ym ?? null; // abre sempre na competência mais recente
  $('#abas').innerHTML = ABAS.map(([k, r]) => `<button class="aba ${estado.aba === k ? 'ativa' : ''}" data-aba="${k}" ${!com && k !== 'inicio' ? 'disabled' : ''}>${r}</button>`).join('');
  $$('.aba').forEach((b) => { b.onclick = () => estado.irPara(b.dataset.aba); });
  mostrarEstado();
  try { TELAS[estado.aba].render($('#conteudo')); } catch (e) { $('#conteudo').innerHTML = `<p class="erro">Erro ao montar a tela: ${e.message}</p>`; console.error(e); }
}

estado.irPara = (aba) => { estado.aba = aba; desenhar(); window.scrollTo(0, 0); };

// Grava no arquivo vinculado (sem perguntar) ou, se não houver vínculo, só marca como alterado.
estado.persistir = async (forcar = false, comoNovo = false) => {
  try {
    if (forcar || arq.temArquivoVinculado()) {
      const r = await arq.salvar(banco.exportarBanco(), { comoNovo });
      if (r) { banco.marcarSalvo(); if (forcar) aviso(r === 'arquivo' ? 'Arquivo salvo.' : 'Arquivo baixado. Guarde-o no lugar de costume.'); }
    }
  } catch (e) { aviso(`Não foi possível salvar: ${e.message}`, 'erro'); }
  mostrarEstado();
};

window.addEventListener('beforeunload', (e) => { if (banco.temBanco() && banco.foiAlterado()) { e.preventDefault(); e.returnValue = ''; } });
document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 's' && banco.temBanco()) { e.preventDefault(); estado.persistir(true); } });

// Gancho para os testes automatizados.
window.__vt = { banco, arq, estado };

banco.iniciarMotor().then(desenhar).catch((e) => { $('#conteudo').innerHTML = `<p class="erro">Não foi possível iniciar o banco de dados local: ${e.message}</p>`; });
