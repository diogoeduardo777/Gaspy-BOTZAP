// "Modo proativo": envia mensagens ao cliente por iniciativa da loja (não em resposta a uma
// mensagem recebida). Guarda a referência do client do WhatsApp e é usado tanto pelo painel
// (quando o dono muda o status de um serviço) quanto pelo agendador (lembrete de retirada).
const { resolverTexto } = require('../config/textos');
const { formatarProtocolo } = require('../flows/manutencaoFlow');
const { fraseStatus } = require('../flows/statusFlow');
const { mascararTelefone } = require('../utils/formatador');

let client = null;
let pronto = false;

// Estado da conexão do WhatsApp, exposto para o painel mostrar o status e o QR Code.
// estadoConexao: 'conectado' | 'desconectado' | 'aguardando_qr'
let ultimoQr = null;
let estadoConexao = 'desconectado';

function configurarCliente(waClient) {
  client = waClient;
}

function marcarPronto(valor) {
  pronto = !!valor;
  if (pronto) {
    // Conectou (evento 'ready'): estado conectado e some com o QR (já foi usado).
    estadoConexao = 'conectado';
    ultimoQr = null;
  } else {
    // Desconectou / falha de auth: o painel mostra vermelho. Um novo QR (definirQr) reativa o
    // estado 'aguardando_qr' quando a biblioteca emitir um.
    estadoConexao = 'desconectado';
  }
}

function estaPronto() {
  return !!client && pronto;
}

// Guarda o último QR recebido (string crua vinda do whatsapp-web.js) e marca que estamos esperando
// o scan. O painel converte essa string em imagem.
function definirQr(qr) {
  ultimoQr = qr;
  estadoConexao = 'aguardando_qr';
}

function limparQr() {
  ultimoQr = null;
}

function obterQr() {
  return ultimoQr;
}

function obterStatusConexao() {
  return { estado: estadoConexao, temQr: !!ultimoQr };
}

// Interruptor geral: NOTIFICACOES_PROATIVAS=false desliga todos os disparos proativos.
function notificacoesAtivas() {
  return process.env.NOTIFICACOES_PROATIVAS !== 'false';
}

async function enviarMensagem(telefone, texto) {
  if (!notificacoesAtivas()) return false;
  if (!estaPronto()) {
    console.warn(`[notificador] Bot ainda não conectado — mensagem não enviada para ${mascararTelefone(telefone)}.`);
    return false;
  }
  try {
    await client.sendMessage(telefone, texto);
    return true;
  } catch (err) {
    console.error(`[notificador] Falha ao enviar mensagem para ${mascararTelefone(telefone)}:`, err.message);
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

// Converte um número "de gente" (ex: 5511999998888, com ou sem símbolos) no id de contato do
// WhatsApp. Retorna null se não houver número — aí não há para quem avisar.
function idWhatsAppDoNumero(numero) {
  const digitos = String(numero || '').replace(/\D/g, '');
  return digitos ? `${digitos}@c.us` : null;
}

// Avisa o DONO (no numero_atendente configurado) que chegou um pedido novo, para ele abrir o
// painel e aceitar/recusar. Se não houver numero_atendente, apenas não envia (o painel ainda
// destaca o pedido pendente). Mensagem fixa, voltada ao dono (não é personalizável pelo cliente).
async function notificarNovoPedidoAoDono(pedido, config) {
  if (!pedido) return false;
  const destino = idWhatsAppDoNumero(config && config.numero_atendente);
  if (!destino) return false;
  const total = (Number(pedido.total_centavos || 0) / 100).toFixed(2).replace('.', ',');
  const texto =
    `🛎️ *Novo pedido #${pedido.id}* em ${config.nome_empresa}\n\n` +
    `👤 ${pedido.cliente_nome || 'Cliente'}\n` +
    `💰 R$ ${total}\n\n` +
    `Abra o painel para *aceitar* ou *recusar* este pedido.`;
  return enviarMensagem(destino, texto);
}

// Avisa o CLIENTE que seu pedido foi aceito ou recusado pelo dono. `novoStatus` é 'aceito' ou
// 'recusado'; usa o texto personalizável correspondente.
async function notificarClientePedido(pedido, config, novoStatus) {
  if (!pedido || !pedido.telefone) return false;
  const chave = novoStatus === 'aceito' ? 'pedido_aceito' : 'pedido_recusado';
  const texto = resolverTexto(config, chave, { pedido: `#${pedido.id}` });
  return enviarMensagem(pedido.telefone, texto);
}

module.exports = {
  configurarCliente,
  marcarPronto,
  estaPronto,
  definirQr,
  limparQr,
  obterQr,
  obterStatusConexao,
  notificacoesAtivas,
  notificarStatusServico,
  notificarLembreteRetirada,
  notificarNovoPedidoAoDono,
  notificarClientePedido
};
