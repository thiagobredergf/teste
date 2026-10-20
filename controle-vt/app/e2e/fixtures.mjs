// Dados fictícios: relação do RH (TXT por vírgula, valores entre aspas) e um PDF com a mesma geometria do relatório da Global Mob.
const cpf = (base) => { let d = String(base).padStart(9, '0'); for (const n of [10, 11]) { const r = ([...d].reduce((a, x, i) => a + Number(x) * (n - i), 0) * 10) % 11; d += r === 10 ? 0 : r; } return d; };
const fmtCartao = (c) => { const d = String(c).padStart(13, '0'); return `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4, 10)} ${d.slice(10, 12)}-${d.slice(12)}`; };
const brl = (c) => `${c < 0 ? '-' : ''}R$ ${(Math.abs(c) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

// matrícula, nome, cargo, dias (vazio = pelo cargo), saldo inicial, cartão na relação, cartões na Global Mob [cartão, status, saldo, recargas]
export const PESSOAS = [
  ['1001', 'ANA PAULA TESTE', 'ASG', '', 30000, 600000000001, [[600000000001, 'ATIVO', 5000, 0]]],              // saldo baixo: recarga cheia
  ['1002', 'BRUNO EXEMPLO', 'ASG', '', 30000, 600000000002, [[600000000002, 'ATIVO', 150000, 0]]],             // saldo alto
  ['1003', 'CARLA MODELO', 'DOCENTE', '3', 30000, 600000000003, [[600000000003, 'ATIVO', 10000, 0]]],          // docente, 3 dias
  ['1004', 'DIOGO SEM DIAS', 'DOCENTE', '', 30000, 600000000004, [[600000000004, 'ATIVO', 20000, 0]]],         // docente sem dias: revisar
  ['1005', 'ELAINE MIGRADA', 'ASG', '', 30000, 600000000005, [[600000000005, 'MIGRADO', 0, 0], [600000000015, 'ATIVO', 8000, 0]]], // cartão migrado: sugerir o ativo
  ['1006', 'FABIO SEM CARTAO', 'ASG', '', 30000, 600000000006, []],                                            // nada na Global Mob
  ['1007', 'GISELE RECARGA', 'ASG', '', 30000, 600000000007, [[600000000007, 'ATIVO', 1000, 20000]]],          // coluna RECARGAS
  ['1008', 'HUGO NEGATIVO', 'ASG', '', 30000, 600000000008, [[600000000008, 'ATIVO', -430, 0]]],               // saldo negativo
];
const EXTRAS = Array.from({ length: 14 }, (_, i) => [`9${String(i).padStart(3, '0')}`, `PESSOA ALHEIA ${i + 1}`, 700000000100 + i, 4000 + i * 100]); // não são beneficiárias

export const cpfDe = (matricula) => cpf(100000000 + Number(matricula));

export function relacaoTxt() {
  const linhas = ['Matrícula,Nome,CPF,Cargo,Unidade,Valor da passagem,Dias por semana,Saldo inicial,Desconto,Cartão'];
  for (const [m, nome, cargo, dias, inicial, cartao] of PESSOAS)
    linhas.push([m, nome, cpfDe(m), cargo, 'EM TESTE', '"16,70"', dias, `"${(inicial / 100).toFixed(2).replace('.', ',')}"`, '"113,56"', fmtCartao(cartao)].join(','));
  return linhas.join('\r\n');
}

// PDF mínimo com texto posicionado (Helvetica, WinAnsi). Cada texto é um item separado, como no relatório real.
export function pdfSaldo() {
  const itens = []; // por página: [{s, x, y}]
  const todos = PESSOAS.map(([m, nome, , , , , cartoes]) => ({ nome, doc: cpfDe(m), cartoes }))
    .filter((p) => p.cartoes.length)
    .concat(EXTRAS.map(([m, nome, cartao, saldo]) => ({ nome, doc: cpf(500000000 + Number(m)), cartoes: [[cartao, 'ATIVO', saldo, 0]] })));
  let pag = [{ s: 'Saldo de cartões', x: 214, y: 707 }, ...['NOME', 'DOCUMENTO', 'Nº CARTÃO', 'STATUS', 'APLICAÇÃO', 'SALDO', 'RECARGAS'].map((s, k) => ({ s, x: 85 + k * 60, y: 644 }))];
  let y = 627; let soma = 0;
  const nova = () => { itens.push(pag); pag = []; y = 627; };
  for (const p of todos) {
    const palavras = p.nome.split(' '); const linhasNome = []; for (let i = 0; i < palavras.length; i += 2) linhasNome.push(palavras.slice(i, i + 2).join(' '));
    const altura = Math.max(linhasNome.length * 11, p.cartoes.length * 37);
    if (y - altura < 90) nova();
    linhasNome.forEach((t, k) => pag.push({ s: t, x: 59, y: y - 11 * k }));
    pag.push({ s: String(p.doc), x: 138, y });
    p.cartoes.forEach(([cartao, status, saldo, rec], k) => {
      const yc = y - 37 * k; const f = fmtCartao(cartao);
      pag.push({ s: f.slice(0, 12), x: 209, y: yc }, { s: f.slice(13), x: 209, y: yc - 11 }, { s: status, x: 277, y: yc },
        { s: 'VALE', x: 358, y: yc }, { s: 'TRANSPORT', x: 358, y: yc - 11 }, { s: 'E', x: 358, y: yc - 22 },
        { s: brl(saldo), x: 427, y: yc }, { s: brl(rec), x: 479, y: yc });
      soma += saldo;
    });
    y -= altura + 18;
  }
  pag.push({ s: 'TOTAL', x: 358, y: y }, { s: brl(soma), x: 427, y });
  itens.push(pag);
  itens.forEach((p, i) => p.push({ s: 'Página', x: 300, y: 30 }, { s: `${i + 1}/${itens.length}`, x: 330, y: 30 }));

  const objs = []; // 1 catálogo, 2 páginas, 3 fonte, depois (página, conteúdo) por página
  const kids = itens.map((_, i) => `${4 + i * 2} 0 R`).join(' ');
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[2] = `<< /Type /Pages /Kids [${kids}] /Count ${itens.length} >>`;
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  itens.forEach((p, i) => {
    const esc = (s) => s.replace(/[\\()]/g, '\\$&').replace(/á/g, '\\341').replace(/ç/g, '\\347').replace(/Ç/g, '\\307').replace(/ã/g, '\\343').replace(/º/g, '\\272').replace(/Ã/g, '\\303');
    const fluxo = p.map((t) => `BT /F1 8 Tf ${t.x} ${t.y} Td (${esc(t.s)}) Tj ET`).join('\n');
    objs[4 + i * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${5 + i * 2} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`;
    objs[5 + i * 2] = `<< /Length ${fluxo.length} >>\nstream\n${fluxo}\nendstream`;
  });
  let out = '%PDF-1.4\n'; const off = [];
  for (let i = 1; i < objs.length; i++) { off[i] = out.length; out += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
  const x = out.length;
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n${off.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
  return { bytes: Buffer.from(out, 'latin1'), totalCentavos: soma, paginas: itens.length, cartoes: todos.reduce((a, p) => a + p.cartoes.length, 0) };
}
