// Datas "AAAA-MM-DD" tratadas em UTC, sem fuso.
const toDate = (s) => new Date(`${s}T00:00:00Z`);
const iso = (d) => d.toISOString().slice(0, 10);

// Dias úteis estritamente entre `de` e `ate` (ambos excluídos), ignorando fins de semana e feriados.
export function diasUteisEntre(de, ate, feriados = []) {
  const fer = new Set(feriados);
  let n = 0;
  for (let d = toDate(de), fim = toDate(ate); ; ) {
    d = new Date(d.getTime() + 86400000);
    if (d >= fim) break;
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6 && !fer.has(iso(d))) n++;
  }
  return n;
}

export function diasEntre(de, ate) {
  return Math.round((toDate(ate) - toDate(de)) / 86400000);
}
