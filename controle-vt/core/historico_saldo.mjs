// O saldo nunca é sobrescrito: cada lançamento é uma linha com a data em que foi lido/registrado.
// Na planilha a data ia dentro do próprio valor ("R$ 572,85 - 14/10"), digitada à mão.

// Edição manual: a data/hora é a do momento da edição, automática.
export function lancarSaldoManual(historico, { cartao, valor_centavos, agora = new Date() }) {
  const lido_em = agora.toISOString().slice(0, 19);
  return [...historico, { cartao, valor_centavos, lido_em, fonte: 'manual' }];
}

export function saldoVigente(historico, cartao) {
  return historico.filter((h) => h.cartao === cartao).sort((a, b) => (a.lido_em < b.lido_em ? 1 : -1))[0] ?? null;
}

// O PDF da Global Mob não traz a data da leitura no texto. Propõe-se a do nome do arquivo (SALDO_CARTAO_20-10-2026.pdf)
// e, na falta dela, a de criação do PDF; o operador confirma na tela de importação.
export function dataLeituraSugerida({ nomeArquivo, criadoEmPdf }) {
  const m = String(nomeArquivo ?? '').match(/(\d{2})[-_.](\d{2})[-_.](\d{4})/);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12 && Number(m[1]) >= 1 && Number(m[1]) <= 31) return { data: `${m[3]}-${m[2]}-${m[1]}`, fonte: 'nome_arquivo' };
  const p = String(criadoEmPdf ?? '').match(/^D:(\d{4})(\d{2})(\d{2})/); // "D:20261020102521+00'00'"
  if (p) return { data: `${p[1]}-${p[2]}-${p[3]}`, fonte: 'metadados_pdf' };
  return { data: null, fonte: null };
}
