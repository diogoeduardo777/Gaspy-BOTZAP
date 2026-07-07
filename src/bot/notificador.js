// "Modo proativo": envia mensagens ao cliente por iniciativa da loja (não em resposta a uma
// mensagem recebida). Guarda a referência do client do WhatsApp e é usado tanto pelo painel
// (quando o dono muda o status de um serviço) quanto pelo agendador (lembrete de retirada).
const { MENSAGENS_STATUS } = require('../flows/statusFlow');
const { formatarProtocolo } = require('../flows/manutencaoFlow');

let client = null;
let pronto = false;

function configurarCliente(waClient) {
  client = waClient;
}

function marcarPronto(valor) {
  pronto = !!valor;
}

function estaPronto() {
  return !!client && pronto;
}

// Interruptor geral: NOTIFICACOES_PROATIVAS=false desliga todos os disparos proativos.
function notificacoesAtivas() {
  return process.env.NOTIFICACOES_PROATIVAS !== 'false';
}

async function enviarMensagem(telefone, texto) {
  if (!notificacoesAtivas()) return false;
  if (!estaPronto()) {
    console.warn(`[notificador] Bot ainda não conectado — mensagem não enviada para ${telefone}.`);
    return false;
  }
  try {
    await client.sendMessage(telefone, texto);
    return true;
  } catch (err) {
    console.error(`[notificador] Falha ao enviar mensagem para ${telefone}:`, err.message);
    return false;
  }
}

function montarMensagemStatus(servico, nomeEmpresa) {
  const statusTexto = MENSAGENS_STATUS[servico.status] || servico.status;
  return (
    `🔧 *${nomeEmpresa}* — atualização do seu aparelho\n\n` +
    `🔖 Protocolo: ${formatarProtocolo(servico.id)}\n` +
    `📱 Aparelho: ${servico.aparelho}\n` +
    `🔧 Serviço: ${servico.servico}\n\n` +
    `📋 ${statusTexto}`
  );
}

async function notificarStatusServico(servico, nomeEmpresa) {
  if (!servico || !servico.telefone) return false;
  return enviarMensagem(servico.telefone, montarMensagemStatus(servico, nomeEmpresa));
}

function montarMensagemLembrete(servico, nomeEmpresa) {
  return (
    `🔔 *${nomeEmpresa}* — seu aparelho está te esperando!\n\n` +
    `🔖 Protocolo: ${formatarProtocolo(servico.id)}\n` +
    `📱 ${servico.aparelho} (${servico.servico})\n\n` +
    `Seu aparelho já está *pronto para retirada*. Pode passar aqui para buscar! 😊`
  );
}

async function notificarLembreteRetirada(servico, nomeEmpresa) {
  if (!servico || !servico.telefone) return false;
  return enviarMensagem(servico.telefone, montarMensagemLembrete(servico, nomeEmpresa));
}

module.exports = {
  configurarCliente,
  marcarPronto,
  estaPronto,
  notificacoesAtivas,
  notificarStatusServico,
  notificarLembreteRetirada
};
