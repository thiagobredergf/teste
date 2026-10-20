// A relação do RH quase não muda, mas muita gente fica suspensa da recarga sem sair dela
// (saldo alto, licença). Estas suspensões são revisadas todo mês.
//
// suspensoes: [{ matricula, motivo_tipo, desde, ate }]   (suspensões vigentes)
// contexto:   { inicioCompetencia: 'AAAA-MM-DD', saldoProjetado: Map(matricula → centavos|null), saldoInicial: Map(matricula → centavos) }
// Regra do RH: a suspensão por saldo alto termina quando o saldo atinge o limite mínimo, que é o saldo inicial da relação.
export function revisarSuspensoes(suspensoes, { inicioCompetencia, saldoProjetado, saldoInicial }, { saldo_alto_desbloqueio_multiplo = 1 } = {}) {
  const prazoVencido = [];
  const semPrazo = [];
  const reativacaoSugerida = [];
  for (const s of suspensoes) {
    const licenca = s.motivo_tipo === 'licenca_medica' || s.motivo_tipo === 'licenca_premio';
    if (licenca && !s.ate) semPrazo.push({ matricula: s.matricula, motivo_tipo: s.motivo_tipo });
    if (s.ate && s.ate < inicioCompetencia) prazoVencido.push({ matricula: s.matricula, motivo_tipo: s.motivo_tipo, ate: s.ate });
    if (s.motivo_tipo === 'saldo_alto') {
      const saldo = saldoProjetado.get(s.matricula);
      const inicial = saldoInicial.get(s.matricula);
      if (saldo != null && inicial > 0 && saldo <= saldo_alto_desbloqueio_multiplo * inicial)
        reativacaoSugerida.push({ matricula: s.matricula, saldo_projetado_centavos: saldo, saldo_inicial_centavos: inicial });
    }
  }
  return { prazoVencido, semPrazo, reativacaoSugerida };
}
