// A relação do RH quase não muda, mas muita gente fica suspensa da recarga sem sair dela
// (saldo alto, licença). Estas suspensões são revisadas todo mês.
//
// suspensoes: [{ matricula, motivo_tipo, desde, ate }]   (suspensões vigentes)
// contexto:   { inicioCompetencia: 'AAAA-MM-DD', saldoProjetado: Map(matricula → centavos|null), direito: Map(matricula → centavos) }
export function revisarSuspensoes(suspensoes, { inicioCompetencia, saldoProjetado, direito }, { saldo_alto_desbloqueio_multiplo = 1 } = {}) {
  const prazoVencido = [];
  const semPrazo = [];
  const reativacaoSugerida = [];
  for (const s of suspensoes) {
    const licenca = s.motivo_tipo === 'licenca_medica' || s.motivo_tipo === 'licenca_premio';
    if (licenca && !s.ate) semPrazo.push({ matricula: s.matricula, motivo_tipo: s.motivo_tipo });
    if (s.ate && s.ate < inicioCompetencia) prazoVencido.push({ matricula: s.matricula, motivo_tipo: s.motivo_tipo, ate: s.ate });
    if (s.motivo_tipo === 'saldo_alto') {
      const saldo = saldoProjetado.get(s.matricula);
      const dir = direito.get(s.matricula);
      if (saldo != null && dir > 0 && saldo <= saldo_alto_desbloqueio_multiplo * dir)
        reativacaoSugerida.push({ matricula: s.matricula, saldo_projetado_centavos: saldo, direito_centavos: dir });
    }
  }
  return { prazoVencido, semPrazo, reativacaoSugerida };
}
