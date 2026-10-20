import { parseValorBR } from './dinheiro.mjs';

// Leitor de arquivos TXT de layout configurável. O layout do RH/Global Mob ainda não é conhecido:
// o operador define uma vez o formato e o mapa de colunas, e a ferramenta guarda como perfil de importação.
//
// formato: { tipo: 'delimitado', separador: ';', cabecalho: true, pular: 0 }
//        | { tipo: 'posicional', colunas: [{ nome, inicio, tamanho }], pular: 0 }   (inicio base 0)
export function lerTexto(texto, formato) {
  const linhas = texto.split(/\r?\n/);
  const pular = formato.pular ?? 0;
  const out = [];
  let nomes = formato.tipo === 'posicional' ? formato.colunas.map((c) => c.nome) : null;
  for (let i = pular; i < linhas.length; i++) {
    const bruta = linhas[i];
    if (!bruta.trim()) continue;
    if (formato.tipo === 'delimitado') {
      const partes = bruta.split(formato.separador).map((x) => x.trim());
      if (formato.cabecalho && !nomes) { nomes = partes; continue; }
      nomes ??= partes.map((_, k) => `col${k + 1}`);
      out.push({ linha: i + 1, campos: Object.fromEntries(nomes.map((n, k) => [n, partes[k] ?? ''])) });
    } else {
      out.push({ linha: i + 1, campos: Object.fromEntries(formato.colunas.map((c) => [c.nome, bruta.substr(c.inicio, c.tamanho).trim()])) });
    }
  }
  return out;
}

const CONVERSORES = {
  texto: (v) => v,
  inteiro: (v) => (/^\d+$/.test(v) ? Number(v) : null),
  dinheiro: (v) => parseValorBR(v)?.centavos ?? null,
};

// mapa: { campo_destino: { coluna: 'nome da coluna na origem', tipo: 'texto'|'inteiro'|'dinheiro', obrigatorio?: true } }
export function aplicarMapa(linhas, mapa) {
  const ok = [];
  const rejeitadas = [];
  for (const { linha, campos } of linhas) {
    const registro = {};
    let motivo = null;
    for (const [destino, def] of Object.entries(mapa)) {
      if (!(def.coluna in campos)) { motivo = `coluna "${def.coluna}" não existe no arquivo`; break; }
      const bruto = campos[def.coluna];
      if (bruto === '') {
        if (def.obrigatorio) { motivo = `campo obrigatório vazio: ${destino}`; break; }
        registro[destino] = null; continue;
      }
      const valor = CONVERSORES[def.tipo ?? 'texto'](bruto);
      if (valor === null) { motivo = `valor inválido em ${destino}: "${bruto}"`; break; }
      registro[destino] = valor;
    }
    if (motivo) rejeitadas.push({ linha, motivo, conteudo: JSON.stringify(campos) }); else ok.push(registro);
  }
  return { ok, rejeitadas };
}
