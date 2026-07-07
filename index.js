require('dotenv').config();

const { criarCliente } = require('./src/bot/client');
const { handleMessage } = require('./src/bot/messageHandler');
const { carregarConfig } = require('./src/config/loader');
const { iniciarPainel } = require('./painel/server');
const notificador = require('./src/bot/notificador');
const { iniciarAgendador } = require('./src/bot/agendador');

async function main() {
  console.log('🚀 Iniciando bot de autoatendimento WhatsApp...');

  const config = carregarConfig();
  console.log(`📋 Configuração carregada: ${config.nome_empresa} (plano: ${config.plano})`);

  iniciarPainel();

  const client = criarCliente();

  // Entrega o client ao notificador para o painel/agendador poderem enviar mensagens proativas.
  notificador.configurarCliente(client);
  client.on('ready', () => notificador.marcarPronto(true));
  client.on('disconnected', () => notificador.marcarPronto(false));

  client.on('message', async (message) => {
    await handleMessage(message);
  });

  iniciarAgendador();

  await client.initialize();
}

main().catch(err => {
  console.error('Erro fatal ao iniciar o bot:', err.message);
  process.exit(1);
});
