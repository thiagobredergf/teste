// Arquivo de dados: SQLite exportado, com cifra opcional (AES-256-GCM, chave por PBKDF2 a partir da senha).
// Formato: "VTDB" + 0x01 + flag(0 = sem senha, 1 = cifrado) + [salt(16) + iv(12)] + conteúdo.
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

export async function desempacotar(arq, senha) {
  if (!MAGIC.every((b, i) => arq[i] === b)) throw new Error('não é um arquivo de dados do Controle de VT');
  const o = MAGIC.length;
  if (arq[o] === 0) return arq.slice(o + 1);
  if (!senha) throw new Error('senha necessária');
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: arq.slice(o + 17, o + 29) }, await chave(senha, arq.slice(o + 1, o + 17)), arq.slice(o + 29)));
  } catch { throw new Error('senha incorreta ou arquivo danificado'); }
}

export const definirSenha = (s) => { senhaAtual = s || null; };
export const senhaDefinida = () => senhaAtual !== null;
export const temArquivoVinculado = () => handle !== null;
export const apiDeArquivos = () => typeof window.showOpenFilePicker === 'function';

const FILTRO = { description: 'Arquivo de dados do Controle de VT', accept: { 'application/octet-stream': ['.vtdb'] } };

// Devolve os bytes do arquivo escolhido. Sem a API de arquivos do navegador, cai para o seletor comum.
export async function escolherArquivo() {
  if (apiDeArquivos()) {
    try { [handle] = await window.showOpenFilePicker({ types: [FILTRO] }); return new Uint8Array(await (await handle.getFile()).arrayBuffer()); }
    catch (e) { if (e.name === 'AbortError') return null; throw e; }
  }
  return new Promise((resolve) => {
    const inp = Object.assign(document.createElement('input'), { type: 'file', accept: '.vtdb' });
    inp.onchange = async () => resolve(inp.files[0] ? new Uint8Array(await inp.files[0].arrayBuffer()) : null);
    inp.click();
  });
}

function baixar(bytes, nome) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([bytes])), download: nome });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Grava no arquivo vinculado; sem vínculo (ou sem a API), baixa o arquivo.
export async function salvar(bytesBanco, { comoNovo = false } = {}) {
  const dados = await empacotar(bytesBanco, senhaAtual);
  if (apiDeArquivos()) {
    try {
      if (!handle || comoNovo) handle = await window.showSaveFilePicker({ suggestedName: 'controle-vt.vtdb', types: [FILTRO] });
      const w = await handle.createWritable(); await w.write(dados); await w.close();
      return 'arquivo';
    } catch (e) { if (e.name === 'AbortError') return null; throw e; }
  }
  baixar(dados, 'controle-vt.vtdb');
  return 'download';
}

export async function copiaDeSeguranca(bytesBanco) {
  const d = new Date(); const p = (n) => String(n).padStart(2, '0');
  baixar(await empacotar(bytesBanco, senhaAtual), `controle-vt-copia-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.vtdb`);
}
