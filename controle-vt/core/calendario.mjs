// Calendário letivo único para todos os cargos; o que varia é quantos dias por semana cada servidor trabalha.

// Dias de trabalho de quem vai 5 dias por semana: segunda a sexta, menos feriados que caem nesses dias.
export function diasLetivosBase(ano, mes, feriados = []) {
  const fer = new Set(feriados);
  let n = 0;
  for (let d = new Date(Date.UTC(ano, mes - 1, 1)); d.getUTCMonth() === mes - 1; d = new Date(d.getTime() + 86400000)) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6 && !fer.has(d.toISOString().slice(0, 10))) n++;
  }
  return n;
}

// Dias do mês para quem trabalha N dias por semana.
//   { tipo: 'proporcional' }                : arredonda base5 × N / 5
//   { tipo: 'manual', tabela: {4: 17, ...} }: valores informados pelo RH para o mês (como na aba "Dias Letivos")
export function tabelaDiasPorSemana(base5, regra = { tipo: 'proporcional' }) {
  const tabela = {};
  for (const n of [1, 2, 3, 4, 5]) tabela[n] = regra.tipo === 'manual' && regra.tabela?.[n] != null ? regra.tabela[n] : Math.round((base5 * n) / 5);
  tabela[5] = regra.tipo === 'manual' && regra.tabela?.[5] != null ? regra.tabela[5] : base5;
  return tabela;
}

// Mostra onde uma regra calculada diverge da tabela que o RH usa de fato.
export function compararTabelas(calculada, informada) {
  return Object.keys(informada).filter((n) => calculada[n] !== informada[n]).map((n) => ({ dias_semana: Number(n), calculado: calculada[n], informado: informada[n] }));
}
