// Dias por semana padrão de cada cargo. Semeado a partir da planilha de novembro/2026:
// só entram cargos com pelo menos 10 pessoas e 95% no mesmo valor. Cargos com variação (docente, vigia, motorista)
// ficam sem padrão: os dias têm de ser informados por servidor. O usuário do VT edita esta lista no sistema.
export const normalizarCargo = (c) =>
  String(c ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();

export const CARGOS_PADRAO = [
  ['ASG', 5], ['INSPETOR DE ALUNOS', 5], ['AUXILIAR DE CLASSE', 5], ['AGENTE ADMINISTRATIVO', 5],
  ['COZINHEIRO', 5], ['SECRETARIO ESCOLAR', 5],
  ['DOCENTE', null], ['VIGIA', null], ['MOTORISTA', null],
];
