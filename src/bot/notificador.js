// "Modo proativo": envia mensagens ao cliente por iniciativa da loja (não em resposta a uma
// mensagem recebida). Guarda a referência do client do WhatsApp e é usado tanto pelo painel
// (quando o dono muda o status de um serviço) quanto pelo agendador (lembrete de retirada).
const { resolverTexto } = require('../config/textos');
const { formatarProtocolo } = require('../flows/manutencaoFlow');
const { fraseStatus } = require('../flows/statusFlow');

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

async function notificarStatusServico(servico, config) {
  if (!servico || !servico.telefone) return false;
  const texto = resolverTexto(config, 'aviso_status', {
    protocolo: formatarProtocolo(servico.id),
    aparelho: servico.aparelho,
    servico: servico.servico,
    status: fraseStatus(config, servico.status)
  });
  return enviarMensagem(servico.telefone, texto);
}

async function notificarLembreteRetirada(servico, config) {
  if (!servico || !servico.telefone) return false;
  const texto = resolverTexto(config, 'aviso_lembrete', {
    protocolo: formatarProtocolo(servico.id),
    aparelho: servico.aparelho,
    servico: servico.servico
  });
  return enviarMensagem(servico.telefone, texto);
}

module.exports = {
  configurarCliente,
  marcarPronto,
  estaPronto,
  notificacoesAtivas,
  notificarStatusServico,
  notificarLembreteRetirada
};
