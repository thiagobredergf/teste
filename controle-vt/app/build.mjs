// Monta um único arquivo HTML autossuficiente (sem rede): app + SQLite (WASM) + leitor de PDF.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const app = await build({ entryPoints: ['src/main.js'], bundle: true, write: false, format: 'iife', target: 'es2020', minify: true, legalComments: 'none' });
const esc = (s) => s.replace(/<\/script/gi, '<\\/script');
const lib = (p) => readFileSync(`node_modules/${p}`, 'utf8');
const html = readFileSync('src/modelo.html', 'utf8')
  .replace('/*ESTILOS*/', () => readFileSync('src/estilos.css', 'utf8'))
  .replace('/*SQLJS*/', () => esc(lib('sql.js/dist/sql-wasm.js')))
  .replace('/*PDFJS*/', () => esc(lib('pdfjs-dist/build/pdf.min.js')))
  .replace('/*PDFWORKER*/', () => esc(lib('pdfjs-dist/build/pdf.worker.min.js')))
  .replace('/*WASM*/', () => readFileSync('node_modules/sql.js/dist/sql-wasm.wasm').toString('base64'))
  .replace('/*APP*/', () => esc(app.outputFiles[0].text));
mkdirSync('dist', { recursive: true });
writeFileSync('dist/controle-vt.html', html);
console.log(`dist/controle-vt.html: ${(html.length / 1e6).toFixed(2)} MB`);
