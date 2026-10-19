// Dinheiro sempre em centavos inteiros.

// "R$ 1.030,65" | "845,9" | "R$ 572,85 - 14/10" -> { centavos, data: "14/10" | null }
export function parseValorBR(texto) {
  if (typeof texto === 'number') return { centavos: Math.round(texto * 100), data: null };
  if (typeof texto !== 'string') return null;
  const m = texto.replace(/\s+/g, ' ').trim().match(/^R?\$?\s*(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?\s*(?:-\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?))?$/);
  if (!m) return null;
  const inteiro = Number(m[1].replace(/\./g, ''));
  const frac = m[2] ? Number(m[2].padEnd(2, '0')) : 0;
  return { centavos: inteiro * 100 + frac, data: m[3] ?? null };
}

export function paraCentavos(reais) {
  return Math.round(Number(reais) * 100);
}

export function formatarBRL(centavos) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
