// Monta um único arquivo HTML autossuficiente (sem rede): app + SQLite (JavaScript puro) + leitor de PDF.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const app = await build({ entryPoints: ['src/main.js'], bundle: true, write: false, format: 'iife', target: 'es2020', minify: true, legalComments: 'none' });
const esc = (s) => s.replace(/<\/script/gi, '<\\/script');
const lib = (p) => readFileSync(`node_modules/${p}`, 'utf8');
const montar = (modelo) => readFileSync(modelo, 'utf8')
  .replace('/*ESTILOS*/', () => readFileSync('src/estilos.css', 'utf8'))
  .replace('/*SQLJS*/', () => esc(lib('sql.js/dist/sql-asm-memory-growth.js')))
  .replace('/*PDFJS*/', () => esc(lib('pdfjs-dist/build/pdf.min.js')))
  .replace('/*PDFWORKER*/', () => esc(lib('pdfjs-dist/build/pdf.worker.min.js')))
  .replace('/*APP*/', () => esc(app.outputFiles[0].text));
mkdirSync('dist', { recursive: true });
// controle-vt.html: arquivo autônomo, para abrir direto do disco. artefato.html: fragmento para o visualizador de artefatos
// (a plataforma coloca o <html>/<body> em volta; por isso o título e as margens seguras vão no próprio arquivo).
for (const [saida, modelo] of [['dist/controle-vt.html', 'src/modelo.html'], ['dist/artefato.html', 'src/modelo-artefato.html']]) {
  const html = montar(modelo);
  writeFileSync(saida, html);
  console.log(`${saida}: ${(html.length / 1e6).toFixed(2)} MB`);
}
