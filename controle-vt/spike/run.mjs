import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage();
const erros = []; page.on('pageerror', e => erros.push(String(e))); page.on('console', m => m.type()==='error' && erros.push(m.text()));
await page.goto('file://' + process.cwd() + '/spike.html');
const pdfB64 = readFileSync('amostra.pdf').toString('base64');
const r = await page.evaluate(async (pdfB64) => {
  const res = {};
  res.contextoSeguro = window.isSecureContext;
  res.apiArquivos = { showOpenFilePicker: typeof window.showOpenFilePicker, showSaveFilePicker: typeof window.showSaveFilePicker };
  res.subtle = !!(crypto && crypto.subtle);
  // 1) SQLite
  const SQL = await window.SQLP; const db = new SQL.Database();
  db.run('create table t(id integer primary key, v text); insert into t(v) values ("ok-ação");');
  const bytes = db.export();
  res.sqlite = { bytes: bytes.length, leitura: new SQL.Database(bytes).exec('select v from t')[0].values[0][0] };
  // 2) cifra AES-GCM com senha (PBKDF2)
  const enc = new TextEncoder(); const salt = crypto.getRandomValues(new Uint8Array(16)); const iv = crypto.getRandomValues(new Uint8Array(12));
  const km = await crypto.subtle.importKey('raw', enc.encode('senha-teste'), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes));
  const pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct));
  res.cifra = { cifrado: ct.length, igual: pt.length === bytes.length && pt.every((b, i) => b === bytes[i]) };
  try { const k2 = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' }, await crypto.subtle.importKey('raw', enc.encode('errada'), 'PBKDF2', false, ['deriveKey']), { name: 'AES-GCM', length: 256 }, false, ['decrypt']); await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, k2, ct); res.cifra.senhaErradaRejeitada = false; } catch { res.cifra.senhaErradaRejeitada = true; }
  // 3) PDF.js
  const doc = await pdfjsLib.getDocument({ data: window.b64(pdfB64) }).promise;
  const pg = await doc.getPage(1); const tc = await pg.getTextContent();
  res.pdf = { paginas: doc.numPages, itens: tc.items.map(i => i.str) };
  return res;
}, pdfB64);
console.log(JSON.stringify(r, null, 1)); console.log('erros de console:', erros);
await browser.close();
