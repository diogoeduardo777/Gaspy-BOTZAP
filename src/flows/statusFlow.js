// Fluxo de "Consultar status": cliente informa o protocolo (#0001) ou o nome, e recebemos o
// status atual do serviço (atualizado pelo dono da loja no painel).
const servicosRepo = require('../database/servicosRepo');
const sessoesRepo = require('../database/sessoesRepo');
const { formatarProtocolo } = require('./manutencaoFlow');
const { formatarPreco } = require('../utils/formatador');

const MENSAGENS_STATUS = {
  em_analise: 'Sua solicitação está em análise.',
  em_manutencao: 'Seu aparelho está em manutenção.',
  aguardando_peca: 'Estamos aguardando peça para continuar o serviço.',
  concluido: 'Seu serviço foi concluído, pronto para retirada! 🎉'
};

function iniciarConsultaStatus(telefone, config) {
  sessoesRepo.salvarSessao(config.id, telefone, 'consultando_status', {});
  return 'Para consultar o status, me informe o *número de protocolo* (ex: #0001) ou o seu *nome completo*:';
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
    return 'Não encontrei nenhum serviço com essas informações. Confira o protocolo ou o nome e tente novamente, ou digite *menu* para voltar.';
  }

  return servicos.slice(0, 3).map(montarMensagemStatus).join('\n\n') + '\n\n_Digite *menu* para voltar ao início._';
}

function montarMensagemStatus(registro) {
  const mensagem = MENSAGENS_STATUS[registro.status] || registro.status;
  let texto =
    `🔖 *Protocolo:* ${formatarProtocolo(registro.id)}\n` +
    `📱 *Aparelho:* ${registro.aparelho}\n` +
    `🔧 *Serviço:* ${registro.servico}\n`;
  if (registro.preco_centavos !== null && registro.preco_centavos !== undefined) {
    texto += `💰 *Valor estimado:* ${formatarPreco(registro.preco_centavos)}\n`;
  }
  texto += `📋 *Status:* ${mensagem}`;
  return texto;
}

module.exports = { iniciarConsultaStatus, processarConsulta };
