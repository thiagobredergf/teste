import { parseValorBR } from './dinheiro.mjs';

// Leitor de arquivos TXT de layout configurável. O layout do RH/Global Mob ainda não é conhecido:
// o operador define uma vez o formato e o mapa de colunas, e a ferramenta guarda como perfil de importação.
//
// formato: { tipo: 'delimitado', separador: ';', cabecalho: true, pular: 0 }
//        | { tipo: 'posicional', colunas: [{ nome, inicio, tamanho }], pular: 0 }   (inicio base 0)
// Divide uma linha respeitando aspas ("16,70" é um campo só mesmo com vírgula como separador).
function dividirLinha(linha, sep) {
  const campos = [];
  let atual = '';
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i];
    if (aspas) {
      if (ch === '"') { if (linha[i + 1] === '"') { atual += '"'; i++; } else aspas = false; } else atual += ch;
    } else if (ch === '"' && atual.trim() === '') { aspas = true; atual = ''; }
    else if (ch === sep) { campos.push(atual.trim()); atual = ''; }
    else atual += ch;
  }
  campos.push(atual.trim());
  return campos;
}

export function lerTexto(texto, formato) {
  const linhas = texto.split(/\r?\n/);
  const pular = formato.pular ?? 0;
  const out = [];
  let nomes = formato.tipo === 'posicional' ? formato.colunas.map((c) => c.nome) : null;
  for (let i = pular; i < linhas.length; i++) {
    const bruta = linhas[i];
    if (!bruta.trim()) continue;
    if (formato.tipo === 'delimitado') {
      const partes = dividirLinha(bruta, formato.separador);
      if (formato.cabecalho && !nomes) { nomes = partes; continue; }
      nomes ??= partes.map((_, k) => `col${k + 1}`);
      if (partes.length !== nomes.length) {
        const dica = formato.separador === ',' ? ' (vírgula decimal sem aspas? peça o valor entre aspas, com ponto decimal, ou separador ";")' : '';
        out.push({ linha: i + 1, erro: `esperadas ${nomes.length} colunas, encontradas ${partes.length}${dica}`, conteudo: bruta });
        continue;
      }
      out.push({ linha: i + 1, campos: Object.fromEntries(nomes.map((n, k) => [n, partes[k] ?? ''])) });
    } else {
      out.push({ linha: i + 1, campos: Object.fromEntries(formato.colunas.map((c) => [c.nome, bruta.substr(c.inicio, c.tamanho).trim()])) });
    }
  }
  return out;
}

function datahora(v) {
  const m = v.match(/^(?:(\d{4})-(\d{2})-(\d{2})|(\d{2})\/(\d{2})\/(\d{4}))(?:[ T](\d{2}):(\d{2}))?$/);
  if (!m) return null;
  const [a, mo, d] = m[1] ? [m[1], m[2], m[3]] : [m[6], m[5], m[4]];
  const dt = new Date(`${a}-${mo}-${d}T00:00:00Z`);
  if (Number.isNaN(dt.getTime()) || dt.toISOString().slice(0, 10) !== `${a}-${mo}-${d}`) return null;
  return `${a}-${mo}-${d}T${m[7] ?? '00'}:${m[8] ?? '00'}`;
}

const CONVERSORES = {
  cartao: (v) => (/^\d{8,20}$/.test(v) ? v : null),
  datahora,
  texto: (v) => v,
  inteiro: (v) => (/^\d+$/.test(v) ? Number(v) : null),
  dinheiro: (v) => parseValorBR(v)?.centavos ?? null,
};

// mapa: { campo_destino: { coluna: 'nome da coluna na origem', tipo: 'texto'|'inteiro'|'dinheiro', obrigatorio?: true } }
export function aplicarMapa(linhas, mapa) {
  const ok = [];
  const rejeitadas = [];
  for (const { linha, campos, erro, conteudo } of linhas) {
    if (erro) { rejeitadas.push({ linha, motivo: erro, conteudo }); continue; }
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
