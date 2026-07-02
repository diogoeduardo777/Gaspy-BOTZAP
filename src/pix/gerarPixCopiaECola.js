// Gera o payload "PIX Copia e Cola" (BR Code / EMV) localmente, sem depender de gateway de
// pagamento. A confirmação do pagamento é manual (o cliente envia comprovante, ou o dono marca
// o pedido como pago no painel).

function campo(id, valor) {
  const tamanho = String(valor.length).padStart(2, '0');
  return `${id}${tamanho}${valor}`;
}

// Faixa Unicode das marcas diacríticas combinantes (acentos) após normalização NFD.
// Construída via charCode para evitar caracteres não-ASCII literais no arquivo-fonte.
const REGEX_MARCAS_DIACRITICAS = new RegExp(
  `[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`,
  'g'
);

function removerAcentos(texto) {
  return texto.normalize('NFD').replace(REGEX_MARCAS_DIACRITICAS, '');
}

function limparTexto(texto, tamanhoMaximo) {
  return removerAcentos(texto || '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .trim()
    .slice(0, tamanhoMaximo);
}

// CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF) — exigido pelo padrão BR Code.
function calcularCrc16(payload) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * @param {object} opcoes
 * @param {string} opcoes.chavePix
 * @param {string} opcoes.nomeRecebedor
 * @param {string} opcoes.cidade
 * @param {number} opcoes.valorCentavos
 * @param {string} [opcoes.txid]
 */
function gerarPixCopiaECola({ chavePix, nomeRecebedor, cidade, valorCentavos, txid }) {
  if (!chavePix) throw new Error('Chave PIX não configurada para este estabelecimento.');

  const valor = (valorCentavos / 100).toFixed(2);
  const idTxid = limparTexto(txid || '', 25) || '***';

  const merchantAccountInfo = campo('00', 'br.gov.bcb.pix') + campo('01', chavePix);
  const additionalData = campo('05', idTxid);

  let payload =
    campo('00', '01') +
    campo('26', merchantAccountInfo) +
    campo('52', '0000') +
    campo('53', '986') +
    campo('54', valor) +
    campo('58', 'BR') +
    campo('59', limparTexto(nomeRecebedor, 25) || 'ESTABELECIMENTO') +
    campo('60', limparTexto(cidade, 15) || 'SAO PAULO') +
    campo('62', additionalData);

  payload += '6304';
  const crc = calcularCrc16(payload);

  return payload + crc;
}

module.exports = { gerarPixCopiaECola };
