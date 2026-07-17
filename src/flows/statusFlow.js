// Fluxo de "Consultar status": cliente informa o protocolo (#0001) ou o nome, e recebemos o
// status atual do serviço (atualizado pelo dono da loja no painel).
const servicosRepo = require('../database/servicosRepo');
const sessoesRepo = require('../database/sessoesRepo');
const { formatarProtocolo } = require('./manutencaoFlow');
const { formatarPreco } = require('../utils/formatador');
const { resolverTexto } = require('../config/textos');

// Mapa do status (valor no banco) para a chave do texto personalizável correspondente.
const CHAVE_STATUS = {
  em_analise: 'status_em_analise',
  em_manutencao: 'status_em_manutencao',
  aguardando_peca: 'status_aguardando_peca',
  concluido: 'status_concluido'
};

// Frase amigável (personalizável) para um status. Usada aqui e no notificador (avisos proativos).
function fraseStatus(config, status) {
  const chave = CHAVE_STATUS[status];
  return chave ? resolverTexto(config, chave) : status;
}

function iniciarConsultaStatus(telefone, config) {
  sessoesRepo.salvarSessao(config.id, telefone, 'consultando_status', {});
  return resolverTexto(config, 'status_pedir');
}

function processarConsulta(telefone, texto, config) {
  sessoesRepo.resetarSessao(config.id, telefone);

  const entrada = texto.trim();
  const somenteDigitos = entrada.replace(/\D/g, '');

  let servicos = [];
  if (somenteDigitos && /^#?\d+$/.test(entrada)) {
    const registro = servicosRepo.buscarPorId(config.id, parseInt(somenteDigitos, 10));
    if (registro) servicos = [registro];
  } else {
    servicos = servicosRepo.buscarPorNome(config.id, entrada);
  }

  if (servicos.length === 0) {
    return resolverTexto(config, 'status_nao_encontrado');
  }

  return servicos.slice(0, 3).map((s) => montarMensagemStatus(s, config)).join('\n\n') + '\n\n_Digite *menu* para voltar ao início._';
}

function montarMensagemStatus(registro, config) {
  let texto =
    `🔖 *Protocolo:* ${formatarProtocolo(registro.id)}\n` +
    `📱 *Aparelho:* ${registro.aparelho}\n` +
    `🔧 *Serviço:* ${registro.servico}\n`;
  if (registro.preco_centavos !== null && registro.preco_centavos !== undefined) {
    texto += `💰 *Valor estimado:* ${formatarPreco(registro.preco_centavos)}\n`;
  }
  texto += `📋 *Status:* ${fraseStatus(config, registro.status)}`;
  return texto;
}

module.exports = { iniciarConsultaStatus, processarConsulta, fraseStatus, CHAVE_STATUS };
