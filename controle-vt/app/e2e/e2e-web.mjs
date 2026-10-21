// Modo "hospedado em endereço comum": a API de arquivos do navegador existe. Aqui ela é simulada em memória
// (o seletor de arquivos do sistema não pode ser acionado por robô) para exercitar a nossa lógica de salvar,
// regravar sozinho a cada alteração e reabrir.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const ctx = await browser.newContext();
const ok = (m) => console.log('  ✓', m);
const SIM = (discoInicial) => {
  window.__disco = discoInicial ? Uint8Array.from(atob(discoInicial), (c) => c.charCodeAt(0)) : null; window.__gravacoes = 0; window.__pickers = 0;
  const handle = { async getFile() { return { arrayBuffer: async () => window.__disco.buffer.slice(0) }; },
    async createWritable() { const partes = []; return { write: async (d) => partes.push(d), close: async () => { window.__disco = new Uint8Array(await new Blob(partes).arrayBuffer()); window.__gravacoes++; } }; } };
  window.showSaveFilePicker = async () => { window.__pickers++; return handle; };
  window.showOpenFilePicker = async () => { window.__pickers++; return [handle]; };
};
const erros = [];
const pagina = async (disco) => { const p = await ctx.newPage(); p.on('pageerror', (e) => { erros.push(String(e)); console.log('[pageerror]', String(e)); }); p.on('console', (m) => m.type() === 'error' && console.log('[console]', m.text())); await p.addInitScript(SIM, disco); await p.goto('file://' + process.cwd() + '/dist/controle-vt.html'); return p; };

const a = await pagina(null);
await a.fill('#operador', 'Operadora Um'); await a.fill('#senha-nova', 'uma frase longa'); await a.fill('#senha-rep', 'uma frase longa'); await a.click('#criar'); await a.waitForSelector('#novo-mes');
assert.match(await a.locator('#estado').innerText(), /alterações não salvas/); ok('arquivo novo ainda não está salvo e o topo avisa');
await a.click('#salvar-topo'); await a.waitForFunction(() => window.__gravacoes === 1);
assert.equal(await a.evaluate(() => window.__pickers), 1); await a.waitForSelector('#estado .selo.ok'); ok('Salvar pede o local uma vez e grava no arquivo');
const tam1 = await a.evaluate(() => window.__disco.length);
await a.fill('#novo-mes', '11'); await a.fill('#novo-ano', '2026'); await a.click('#nova'); await a.waitForSelector('#feriados');
await a.waitForFunction(() => window.__gravacoes >= 2); await a.waitForSelector('#estado .selo.ok');
assert.equal(await a.evaluate(() => window.__pickers), 1, 'não pode pedir o local de novo'); ok('depois do primeiro salvamento, cada alteração regrava sozinha no mesmo arquivo');
const gravacoes = await a.evaluate(() => window.__gravacoes);
await a.evaluate(() => { for (let i = 0; i < 5; i++) window.__vt.estado.persistir(true); }); // várias gravações ao mesmo tempo
await a.waitForFunction((n) => window.__gravacoes === n + 5, gravacoes); ok('gravações simultâneas entram em fila (5 pedidas, 5 feitas, uma por vez)');

// reabre em outra "sessão", com o conteúdo que ficou no disco simulado
const disco = await a.evaluate(() => { let t = ''; for (let i = 0; i < window.__disco.length; i += 0x8000) t += String.fromCharCode(...window.__disco.subarray(i, i + 0x8000)); return btoa(t); });
const b = await pagina(disco);
await b.fill('#operador', 'Operador Dois'); await b.fill('#senha-abrir', 'uma frase longa'); await b.click('#abrir');
await b.waitForSelector('text=servidores ativos');
await b.click('button[data-aba="competencia"]'); await b.waitForSelector('#feriados'); assert.equal(await b.locator('#ym').inputValue(), '2026-11'); ok('reaberto pelo seletor de arquivos: competência criada pela outra pessoa está lá');
await b.click('button[data-aba="inicio"]'); await b.waitForSelector('text=Operadora Um'); ok('o histórico mostra quem criou o arquivo');
assert.deepEqual(erros, [], erros.join(' | '));
console.log('\nModo web: tudo certo.');
await browser.close();
