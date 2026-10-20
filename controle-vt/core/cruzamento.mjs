import { normalizarCpf } from './identificadores.mjs';

// Une a relação do VT (servidores) ao relatório da Global Mob (cartões) pelo CPF, que é a única chave
// presente nas duas fontes. O status MIGRADO/AGUARDANDO é interno da Global Mob: aqui só importa se o cartão está ATIVO.
//
// servidores: [{ matricula, cpf, cartao }]   cartao = chave canônica do cadastro (ou null)
// cartoesGM:  [{ cpf, cartao, status, saldo_centavos, recargas_centavos }]   (saída de extrairSaldoGlobalMob)
export function cruzarSaldos(servidores, cartoesGM) {
  const porCartao = new Map(cartoesGM.map((c) => [c.cartao, c]));
  const porCpf = new Map();
  for (const c of cartoesGM) if (c.cpf) porCpf.set(c.cpf, [...(porCpf.get(c.cpf) ?? []), c]);
  const ativosDo = (cpf) => (porCpf.get(cpf) ?? []).filter((c) => c.status === 'ATIVO');

  const resultado = servidores.map((s) => {
    const flags = [];
    const cpf = normalizarCpf(s.cpf);
    if (!cpf) flags.push('CPF_AUSENTE');
    let usado = null;
    const noCadastro = s.cartao ? porCartao.get(s.cartao) : null;
    if (!s.cartao) flags.push('SEM_CARTAO_NO_CADASTRO');
    else if (!noCadastro) flags.push('CARTAO_NAO_ENCONTRADO');
    else if (cpf && noCadastro.cpf && noCadastro.cpf !== cpf) flags.push('CARTAO_DE_OUTRA_PESSOA'); // nunca usar o saldo de outra pessoa
    else if (noCadastro.status !== 'ATIVO') flags.push('CARTAO_NAO_ATIVO');
    else usado = noCadastro;

    let sugerido = null;
    if (cpf) {
      const ativos = ativosDo(cpf);
      if (!usado) {
        if (ativos.length === 1) sugerido = ativos[0].cartao;
        else if (ativos.length > 1) flags.push('VARIOS_CARTOES_ATIVOS');
        else flags.push('SEM_CARTAO_ATIVO_NA_GLOBALMOB');
      } else if (ativos.length > 1) flags.push('VARIOS_CARTOES_ATIVOS');
    }
    return {
      matricula: s.matricula, cartao_usado: usado?.cartao ?? null, saldo_centavos: usado?.saldo_centavos ?? null,
      recargas_centavos: usado?.recargas_centavos ?? null, cartao_sugerido: sugerido, flags,
    };
  });

  // O relatório traz muito mais gente que os beneficiários: só se guarda o que está vinculado a eles.
  const cpfs = new Set(servidores.map((s) => normalizarCpf(s.cpf)).filter(Boolean));
  const cadastrados = new Set(servidores.map((s) => s.cartao).filter(Boolean));
  const relevantes = cartoesGM.filter((c) => cpfs.has(c.cpf) || cadastrados.has(c.cartao));
  return { servidores: resultado, cartoes_relevantes: relevantes, cartoes_descartados: cartoesGM.length - relevantes.length };
}
