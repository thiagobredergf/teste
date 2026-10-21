// Copia o build para os lugares de entrega: entrega/ (arquivo avulso) e docs/ na raiz do repositório (GitHub Pages).
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
mkdirSync('entrega', { recursive: true });
mkdirSync('../../docs', { recursive: true });
copyFileSync('dist/controle-vt.html', 'entrega/controle-vt.html');
copyFileSync('dist/controle-vt.html', '../../docs/index.html');
writeFileSync('../../docs/.nojekyll', '');
console.log('Publicado em app/entrega/controle-vt.html e docs/index.html');
