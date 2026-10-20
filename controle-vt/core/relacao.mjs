// Compara a relação mensal de beneficiários (relatório do RH) com o cadastro vigente.
// O operador não revisa ~570 linhas: revisa só as mudanças (cerca de 10% ao mês).
//
// nova:     [{ matricula, nome, valor_diario_centavos, dias_semana, cartao, desconto_centavos, unidade }]
// cadastro: [{ matricula, situacao: 'ativo'|'suspenso'|'cancelado', ...mesmos campos }]
const CAMPOS = ['valor_diario_centavos', 'dias_semana', 'cartao', 'desconto_centavos', 'unidade'];
const chave = (m) => String(m ?? '').trim();

export function compararRelacao(nova, cadastro) {
  const semMatricula = nova.filter((r) => !chave(r.matricula));
  const contagem = new Map();
  for (const r of nova) if (chave(r.matricula)) contagem.set(chave(r.matricula), (contagem.get(chave(r.matricula)) ?? 0) + 1);
  const duplicadas = [...contagem].filter(([, n]) => n > 1).map(([matricula, n]) => ({ matricula, ocorrencias: n }));
  const duplicadasSet = new Set(duplicadas.map((d) => d.matricula));

  const novaMap = new Map(nova.filter((r) => chave(r.matricula) && !duplicadasSet.has(chave(r.matricula))).map((r) => [chave(r.matricula), r]));
  const cadMap = new Map(cadastro.map((c) => [chave(c.matricula), c]));

  const entradas = [];
  const alteracoes = [];
  let inalterados = 0;
  for (const [mat, r] of novaMap) {
    const c = cadMap.get(mat);
    if (!c) entradas.push({ matricula: mat, nome: r.nome, evento_sugerido: 'inclusao' });
    else if (c.situacao !== 'ativo') entradas.push({ matricula: mat, nome: r.nome, evento_sugerido: 'reativacao', situacao_anterior: c.situacao });
    else {
      const difs = CAMPOS.filter((k) => r[k] !== undefined && (r[k] ?? null) !== (c[k] ?? null));
      if (difs.length) for (const campo of difs) alteracoes.push({ matricula: mat, nome: r.nome ?? c.nome, campo, de: c[campo] ?? null, para: r[campo] });
      else inalterados++;
    }
  }
  // Quem estava ativo e sumiu da relação: o motivo (cancelamento, licença, saldo alto…) é o operador quem classifica.
  const saidas = cadastro
    .filter((c) => c.situacao === 'ativo' && !novaMap.has(chave(c.matricula)) && !duplicadasSet.has(chave(c.matricula)))
    .map((c) => ({ matricula: chave(c.matricula), nome: c.nome, evento_sugerido: 'a_classificar' }));

  const base = cadastro.filter((c) => c.situacao === 'ativo').length;
  return {
    entradas, saidas, alteracoes, duplicadas, semMatricula, inalterados,
    resumo: { na_relacao: nova.length, ativos_no_cadastro: base, entradas: entradas.length, saidas: saidas.length,
      servidores_com_alteracao: new Set(alteracoes.map((a) => a.matricula)).size,
      movimento_pct: base ? +(((entradas.length + saidas.length) / base) * 100).toFixed(1) : null },
  };
}
