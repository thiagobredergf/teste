import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { relacaoTxt, pdfSaldo } from './fixtures.mjs';

mkdirSync('dist/e2e', { recursive: true });
const pdf = pdfSaldo();
writeFileSync('dist/e2e/relacao.txt', relacaoTxt(), 'latin1');           // ANSI de propósito: o app deve detectar a codificação
writeFileSync('dist/e2e/SALDO_CARTAO_20-10-2026.pdf', pdf.bytes);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ acceptDownloads: true });
const page = await ctx.newPage();
const erros = []; page.on('pageerror', (e) => erros.push(String(e))); page.on('console', (m) => m.type() === 'error' && erros.push(m.text()));
page.on('dialog', (d) => d.accept());
await page.addInitScript(() => { window.showSaveFilePicker = undefined; window.showOpenFilePicker = undefined; }); // força o caminho de baixar/abrir arquivo comum
await page.goto('file://' + process.cwd() + '/dist/controle-vt.html');
const ok = (m) => console.log('  ✓', m);

// 1. novo arquivo com senha
await page.fill('#senha-nova', 'senha-teste'); await page.fill('#senha-rep', 'senha-teste'); await page.click('#criar');
await page.waitForSelector('#novo-mes'); ok('arquivo novo criado com senha');

// 2. competência novembro/2026
await page.fill('#novo-mes', '11'); await page.fill('#novo-ano', '2026'); await page.click('#nova');
await page.waitForSelector('#feriados');
await page.fill('#feriados', '2026-11-02;Finados\n2026-11-20;Consciência Negra');
await page.fill('#credito', '2026-10-30');
await page.click('#recalcular');                                   // recalcula a tabela de dias pelo calendário
await page.waitForSelector('text=19 dias');
assert.equal(await page.locator('.dias[data-n="5"]').inputValue(), '19'); ok('calendário: 19 dias para 5 dias/semana');
assert.equal(await page.locator('.dias[data-n="3"]').inputValue(), '11');
await page.fill('.dias[data-n="3"]', '300');                       // digitação errada: a validação deve barrar
await page.click('#salvar-comp'); await page.waitForSelector('.toast.erro');
assert.match(await page.locator('.toast.erro').first().innerText(), /mais do que o mês tem/); ok('tabela de dias: erro de digitação barrado');
await page.fill('.dias[data-n="3"]', '11'); await page.click('#salvar-comp'); await page.waitForSelector('.toast.ok');

// 3. relação do RH
await page.click('button[data-aba="relacao"]');
await page.setInputFiles('#arq', 'dist/e2e/relacao.txt'); await page.click('#ler');
await page.waitForSelector('#comparar');
assert.equal(await page.locator('.map[data-campo="valor_diario_centavos"]').inputValue(), 'Valor da passagem'); ok('mapeamento automático das colunas (arquivo em ANSI)');
await page.click('#comparar'); await page.waitForSelector('#aplicar');
assert.equal(await page.locator('.ent').count(), 8); ok('comparação: 8 inclusões');
await page.click('#aplicar'); await page.waitForSelector('#arq');

// segunda importação do mesmo arquivo: nada mudou
await page.setInputFiles('#arq', 'dist/e2e/relacao.txt'); await page.click('#ler'); await page.waitForSelector('#comparar'); await page.click('#comparar'); await page.waitForSelector('#aplicar');
assert.equal(await page.locator('.ent, .alt, .sai').count(), 0); ok('reimportar o mesmo arquivo: nenhuma mudança');
await page.click('#voltar');   // volta à escolha do mapa
await page.click('#voltar');

// 4. saldo da Global Mob (PDF)
await page.click('button[data-aba="saldo"]');
await page.setInputFiles('#pdf', 'dist/e2e/SALDO_CARTAO_20-10-2026.pdf'); await page.click('#ler');
await page.waitForSelector('#aplicar');
const txt = await page.locator('#resultado').innerText();
assert.match(txt, new RegExp(`${pdf.cartoes}\\s*\\n?cartões no PDF`)); assert.match(txt, /confere/); ok(`PDF lido: ${pdf.cartoes} cartões, total conferido`);
assert.equal(await page.locator('#data').inputValue(), '2026-10-20'); ok('data da leitura sugerida pelo nome do arquivo');
assert.match(txt, /14.*descartados/s); ok('cartões de quem não é beneficiário descartados');
await page.click('#aplicar'); await page.waitForSelector('.toast.ok');

// 5. ocorrência do ponto: 2 faltas para a matrícula 1001
await page.click('button[data-aba="ocorrencias"]');
await page.fill('#o-mat', '1001'); await page.selectOption('#o-tipo', 'falta'); await page.fill('#o-dias', '2'); await page.click('#o-add'); await page.waitForSelector('.anular');

// 6. resultado
await page.click('button[data-aba="resultado"]');
await page.waitForSelector('#corpo tr');
const linha = async (mat) => (await page.locator('#corpo tr', { hasText: mat }).first().innerText()).replace(/\s+/g, ' ');
const centavos = (t) => Number(t.replace(/[^\d-]/g, '')) ;
const dado = async (mat) => { const tds = await page.locator('#corpo tr', { hasText: mat }).first().locator('td').allInnerTexts(); return tds.map((t) => t.trim()); };
const r1 = await dado('1001'), r2 = await dado('1002'), r3 = await dado('1003'), r4 = await dado('1004'), r5 = await dado('1005'), r6 = await dado('1006'), r7 = await dado('1007'), r8 = await dado('1008');
// colunas: 8 dias efetivos, 9 direito, 10 saldo, 11 recargas, 12 saldo proj, 14 repasse, 16 ação
const brl = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\s/g, ' ');
const n = (t) => t.replace(/\s/g, ' ');
assert.equal(r1[8], '17'); assert.equal(n(r1[14]), brl((17 * 1670))); ok('1001: 2 faltas → 17 dias; saldo baixo → recarga do direito');
assert.equal(n(r2[14]), n(brl(0))); assert.match(await linha('1002'), /Saldo alto/); ok('1002: saldo alto → repasse zero e alerta');
assert.equal(r3[6], '3'); assert.equal(n(r3[14]), brl(11 * 1670 - Math.max(0, 10000 - Math.round(7 * 1670 * 3 / 5)))); ok('1003: docente com 3 dias → tabela do mês, saldo projetado abatido');
assert.match(await linha('1004'), /Informe os dias por semana/); assert.match(r4[16], /Revisar/); ok('1004: docente sem dias → revisar');
assert.match(r5[16], /Revisar/); assert.match(await linha('1005'), /sugerido/); ok('1005: cartão migrado → sugestão do cartão ativo');
assert.match(r6[16], /Revisar/); ok('1006: sem cartão na Global Mob → revisar');
assert.match(await linha('1007'), /RECARGA/i); assert.equal(n(r7[14]), brl(19 * 1670)); ok('1007: coluna RECARGAS sinalizada e ignorada (padrão)');
assert.match(await linha('1008'), /Saldo negativo/); assert.equal(n(r8[14]), brl(19 * 1670 + 430)); ok('1008: saldo negativo → a recarga cobre o débito');
// filtro
await page.selectOption('#f-acao', 'REVISAR'); assert.equal(await page.locator('#corpo tr').count(), 3); await page.selectOption('#f-acao', ''); ok('filtro por ação');
// contestação
await page.locator('#corpo tr', { hasText: '1001' }).locator('.contestar').click();
await page.fill('dialog textarea', 'Servidora diz que teve só 1 falta.'); await page.click('dialog button.primario'); await page.waitForSelector('dialog', { state: 'detached' });
await page.waitForSelector('.contestar:has-text("✎ 1")'); ok('contestação registrada');
// adotar o cartão sugerido (cruzamento por CPF) e recalcular
await page.click('button[data-aba="saldo"]'); await page.setInputFiles('#pdf', 'dist/e2e/SALDO_CARTAO_20-10-2026.pdf'); await page.click('#ler');
await page.waitForSelector('#adotar-todos'); await page.click('#adotar-todos'); await page.waitForSelector('.toast:has-text("cartões adotados")');
await page.click('button[data-aba="resultado"]'); await page.waitForSelector('#corpo tr');
const r5b = await dado('1005');
assert.match(r5b[16], /Recarregar/); assert.equal(r5b[14].replace(/\s/g, ' '), brl(19 * 1670)); ok('1005: depois de adotar o cartão sugerido → recarga normal');
// painel
await page.click('button[data-aba="painel"]'); await page.waitForSelector('.pizza svg'); ok('painel renderiza');

// 7. salvar (download cifrado), reabrir em outra página
await page.click('button[data-aba="inicio"]');
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#salvar')]);
await dl.saveAs('dist/e2e/dados.vtdb');
const bytes = readFileSync('dist/e2e/dados.vtdb');
assert.equal(bytes.slice(0, 4).toString(), 'VTDB'); assert.equal(bytes[5], 1); assert.ok(!bytes.includes(Buffer.from('ANA PAULA')), 'o arquivo não pode conter nomes em claro'); ok('arquivo salvo cifrado (sem nomes em claro)');
const p2 = await ctx.newPage(); p2.on('pageerror', (e) => erros.push(String(e))); p2.on('dialog', (d) => d.accept());
await p2.addInitScript(() => { window.showOpenFilePicker = undefined; });
await p2.goto('file://' + process.cwd() + '/dist/controle-vt.html');
await p2.fill('#senha-abrir', 'errada');
let [fc] = await Promise.all([p2.waitForEvent('filechooser'), p2.click('#abrir')]); await fc.setFiles('dist/e2e/dados.vtdb');
await p2.waitForSelector('.toast.erro'); assert.match(await p2.locator('.toast.erro').innerText(), /senha incorreta/); ok('senha errada rejeitada');
await p2.fill('#senha-abrir', 'senha-teste');
[fc] = await Promise.all([p2.waitForEvent('filechooser'), p2.click('#abrir')]); await fc.setFiles('dist/e2e/dados.vtdb');
await p2.waitForSelector('text=servidores ativos');
assert.match(await p2.locator('.cartoes').innerText(), /8\s*servidores ativos/); ok('arquivo reaberto com a senha: 8 servidores');
await p2.click('button[data-aba="resultado"]'); await p2.waitForSelector('#corpo tr');
assert.equal((await p2.locator('#corpo tr', { hasText: '1001' }).first().locator('td').allInnerTexts())[14].replace(/\s/g, ' '), brl(17 * 1670)); ok('resultado idêntico depois de reabrir');

// 8. fechar competência: congela e bloqueia ocorrências
await p2.click('#fechar'); await p2.waitForSelector('text=fechada');
await p2.click('button[data-aba="ocorrencias"]'); assert.match(await p2.locator('.aviso').innerText(), /fechada/); ok('competência fechada: sem novos lançamentos');
let barrou = false; try { await p2.evaluate(() => window.__vt.banco.x("insert into ocorrencia (ym, matricula, tipo, dias) values ('2026-11','1001','falta',1)")); } catch { barrou = true; }
assert.ok(barrou); ok('banco recusa ocorrência em competência fechada (gatilho)');

assert.deepEqual(erros, [], 'erros de console: ' + erros.join(' | '));
console.log('\nTudo certo: fluxo completo passou, sem erros de console.');
await browser.close();
