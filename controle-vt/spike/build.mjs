import { readFileSync, writeFileSync } from 'node:fs';
const sqlJs = readFileSync('node_modules/sql.js/dist/sql-wasm.js', 'utf8');
const wasm = readFileSync('node_modules/sql.js/dist/sql-wasm.wasm').toString('base64');
const pdf = readFileSync('node_modules/pdfjs-dist/build/pdf.min.js', 'utf8');
const worker = readFileSync('node_modules/pdfjs-dist/build/pdf.worker.min.js', 'utf8');
const esc = (s) => s.replace(/<\/script/gi, '<\\/script');
const html = `<!doctype html><meta charset="utf-8"><title>spike</title><body>
<script>${esc(sqlJs)}</script>
<script>${esc(pdf)}</script>
<script type="text/plain" id="pdfworker">${esc(worker)}</script>
<script>window.__WASM_B64="${wasm}";</script>
<script>
window.b64 = (b)=>Uint8Array.from(atob(b),c=>c.charCodeAt(0));
window.SQLP = initSqlJs({ wasmBinary: window.b64(window.__WASM_B64) });
pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([document.getElementById('pdfworker').textContent], {type:'text/javascript'}));
</script>`;
writeFileSync('spike.html', html);
console.log('tamanho MB', (html.length/1e6).toFixed(2));
