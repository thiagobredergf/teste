import { parseValorBR } from './dinheiro.mjs';

// Contrato canônico de importação de saldo (um registro por linha, separador ";"):
//   numero_cartao;valor;data_hora_leitura
//   604007259613;572,85;2026-10-14T18:00
// O layout real do TXT/PDF da concessionária ainda não foi recebido: um adaptador vai converter
// o arquivo deles para este formato, mantendo validação e rejeição num lugar só.
export function parseSaldoCanonico(texto) {
  const ok = [];
  const rejeitadas = [];
  texto.split(/\r?\n/).forEach((linha, i) => {
    const n = i + 1;
    if (!linha.trim() || /^numero/i.test(linha.trim())) return;
    const partes = linha.split(';'); // só ";" — a vírgula é decimal nos valores em reais
    if (partes.length < 3) return rejeitadas.push({ linha: n, motivo: 'esperado: cartão;valor;data', conteudo: linha });
    const [cartao, valorTxt, lido] = partes.map((x) => x.trim());
    if (!/^\d{8,20}$/.test(cartao)) return rejeitadas.push({ linha: n, motivo: 'número de cartão inválido', conteudo: linha });
    const valor = parseValorBR(valorTxt);
    if (!valor) return rejeitadas.push({ linha: n, motivo: 'valor inválido', conteudo: linha });
    if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/.test(lido) || Number.isNaN(Date.parse(lido)))
      return rejeitadas.push({ linha: n, motivo: 'data/hora inválida (use AAAA-MM-DDTHH:MM)', conteudo: linha });
    ok.push({ cartao, valor_centavos: valor.centavos, lido_em: lido });
  });
  const vistos = new Set();
  return {
    ok: ok.filter((r) => {
      const k = `${r.cartao}|${r.lido_em}`;
      if (vistos.has(k)) { rejeitadas.push({ linha: 0, motivo: 'cartão repetido na mesma leitura', conteudo: k }); return false; }
      vistos.add(k); return true;
    }),
    rejeitadas,
  };
}
