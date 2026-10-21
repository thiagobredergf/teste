// Arquivo de dados: SQLite exportado, com cifra opcional (AES-256-GCM, chave por PBKDF2 a partir da senha).
// Conteúdo binário: "VTDB" + 0x01 + flag(0 = sem senha, 1 = cifrado) + [salt(16) + iv(12)] + dados.
// No disco vai dentro de um JSON {"app":"controle-vt","versao":1,"dados":"<base64>"} (extensão .json: é a que o
// visualizador de artefatos permite baixar). Arquivos binários antigos (.vtdb) continuam abrindo.
import { entregar } from './ui.js';
const MAGIC = [0x56, 0x54, 0x44, 0x42, 0x01];
const ITER = 200000;
let handle = null;
let senhaAtual = null;

const chave = async (senha, salt) => crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' },
  await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveKey']),
  { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);

export async function empacotar(bytes, senha) {
  if (!senha) return new Uint8Array([...MAGIC, 0, ...bytes]);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await chave(senha, salt), bytes));
  const out = new Uint8Array(MAGIC.length + 1 + 28 + ct.length);
  out.set(MAGIC); out[MAGIC.length] = 1; out.set(salt, MAGIC.length + 1); out.set(iv, MAGIC.length + 17); out.set(ct, MAGIC.length + 29);
  return out;
}

export const estaCifrado = (arq) => MAGIC.every((b, i) => arq[i] === b) && arq[MAGIC.length] === 1;

export async function desempacotar(arqBruto, senha) {
  const arq = paraBinario(arqBruto);
  if (!MAGIC.every((b, i) => arq[i] === b)) throw new Error('não é um arquivo de dados do Controle de VT');
  const o = MAGIC.length;
  if (arq[o] === 0) return arq.slice(o + 1);
  if (!senha) throw new Error('senha necessária');
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: arq.slice(o + 17, o + 29) }, await chave(senha, arq.slice(o + 1, o + 17)), arq.slice(o + 29)));
  } catch { throw new Error('senha incorreta ou arquivo danificado'); }
}

const paraBase64 = (b) => { let t = ''; for (let i = 0; i < b.length; i += 0x8000) t += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(t); };
const deBase64 = (t) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0));
export const paraArquivo = (binario) => new TextEncoder().encode(JSON.stringify({ app: 'controle-vt', versao: 1, dados: paraBase64(binario) }));
function paraBinario(arq) {
  if (arq[0] === 0x7b) { // "{": arquivo JSON
    try { const j = JSON.parse(new TextDecoder().decode(arq)); if (j.app === 'controle-vt') return deBase64(j.dados); } catch { /* cai no erro abaixo */ }
    throw new Error('não é um arquivo de dados do Controle de VT');
  }
  return arq;
}
export const arquivoCifrado = (arq) => estaCifrado(paraBinario(arq));

export const definirSenha = (s) => { senhaAtual = s || null; };
export const senhaDefinida = () => senhaAtual !== null;
export const temArquivoVinculado = () => handle !== null;
// A API de arquivos do navegador não funciona dentro de iframes (como o visualizador de artefatos): nesse caso cai para baixar/abrir.
export const apiDeArquivos = () => typeof window.showOpenFilePicker === 'function' && window.self === window.top;

const FILTRO = { description: 'Arquivo de dados do Controle de VT', accept: { 'application/json': ['.json', '.vtdb'] } };

// Devolve os bytes do arquivo escolhido. Sem a API de arquivos do navegador, cai para o seletor comum.
export async function escolherArquivo() {
  if (apiDeArquivos()) {
    try { [handle] = await window.showOpenFilePicker({ types: [FILTRO] }); return new Uint8Array(await (await handle.getFile()).arrayBuffer()); }
    catch (e) { if (e.name === 'AbortError') return null; throw e; }
  }
  return new Promise((resolve) => {
    const inp = Object.assign(document.createElement('input'), { type: 'file', accept: '.json,.vtdb' });
    inp.onchange = async () => resolve(inp.files[0] ? new Uint8Array(await inp.files[0].arrayBuffer()) : null);
    inp.click();
  });
}

let fila = Promise.resolve();
// Grava no arquivo vinculado; sem vínculo (ou sem a API), baixa o arquivo.
export function salvar(bytesBanco, opcoes) { // uma gravação por vez: duas simultâneas no mesmo arquivo se atropelariam
  const r = fila.then(() => gravar(bytesBanco, opcoes));
  fila = r.catch(() => {});
  return r;
}

async function gravar(bytesBanco, { comoNovo = false } = {}) {
  const dados = paraArquivo(await empacotar(bytesBanco, senhaAtual));
  if (apiDeArquivos()) {
    try {
      if (!handle || comoNovo) handle = await window.showSaveFilePicker({ suggestedName: 'controle-vt.json', types: [FILTRO] });
      const w = await handle.createWritable(); await w.write(dados); await w.close();
      return 'arquivo';
    } catch (e) { if (e.name === 'AbortError') return null; throw e; }
  }
  const r = await entregar(nomeComData('controle-vt'), dados);
  return r ? 'download' : null;
}

function nomeComData(base) {
  const d = new Date(); const p = (n) => String(n).padStart(2, '0');
  return `${base}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
}

export async function copiaDeSeguranca(bytesBanco) {
  return entregar(nomeComData('controle-vt-copia'), paraArquivo(await empacotar(bytesBanco, senhaAtual)));
}
