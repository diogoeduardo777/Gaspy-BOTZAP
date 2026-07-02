require('dotenv').config();

const { criarCliente } = require('./src/bot/client');
const { handleMessage } = require('./src/bot/messageHandler');
const { carregarConfig } = require('./src/config/loader');
const { iniciarPainel } = require('./painel/server');

async function main() {
  console.log('🚀 Iniciando bot de autoatendimento WhatsApp...');

  const config = carregarConfig();
  console.log(`📋 Configuração carregada: ${config.nome_empresa} (plano: ${config.plano})`);

  iniciarPainel();

  const client = criarCliente();

  client.on('message', async (message) => {
    await handleMessage(message);
  });

  await client.initialize();
}

main().catch(err => {
  console.error('Erro fatal ao iniciar o bot:', err.message);
  process.exit(1);
});
