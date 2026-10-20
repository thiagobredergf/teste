// Cartão e CPF chegam formatados de formas diferentes em cada fonte:
//   PDF da Global Mob:  "06.04.007259 61-3"   (13 dígitos, com zero à esquerda)
//   Planilha do RH:     604007259613          (número; o Excel perdeu o zero à esquerda)
// A chave canônica é só dígitos, sem zeros à esquerda.

export function normalizarCartao(valor) {
  const d = String(valor ?? '').replace(/\D/g, '').replace(/^0+/, '');
  return d.length >= 8 && d.length <= 20 ? d : null;
}

// "06.04.007259 61-3" para exibição (13 dígitos)
export function formatarCartao(canonico) {
  const d = String(canonico).padStart(13, '0');
  return `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4, 10)} ${d.slice(10, 12)}-${d.slice(12)}`;
}

// CPF completo (11 dígitos válidos) ou null. Mascarado ("74xxxxxx-02") não é utilizável como chave.
export function normalizarCpf(valor) {
  const d = String(valor ?? '').replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return null;
  const dv = (base) => {
    const soma = [...base].reduce((acc, n, i) => acc + Number(n) * (base.length + 1 - i), 0);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(d.slice(0, 9)) === Number(d[9]) && dv(d.slice(0, 10)) === Number(d[10]) ? d : null;
}

export const mascararCpf = (cpf) => `${cpf.slice(0, 3)}.***.***-${cpf.slice(9)}`;
