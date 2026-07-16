require('dotenv').config();

const { criarCliente, limparTravasSessao } = require('./src/bot/client');
const { handleMessage } = require('./src/bot/messageHandler');
const { carregarConfig } = require('./src/config/loader');
const { iniciarPainel } = require('./painel/server');
const notificador = require('./src/bot/notificador');
const { iniciarAgendador } = require('./src/bot/agendador');

const MAX_TENTATIVAS_WHATSAPP = 3;

// Cria o cliente do WhatsApp com todos os "escutadores" (mensagens, pronto, desconectado) ligados.
function montarClienteComHandlers() {
  const client = criarCliente();

  // Entrega o client ao notificador para o painel/agendador enviarem mensagens proativas.
  notificador.configurarCliente(client);
  client.on('ready', () => notificador.marcarPronto(true));
  client.on('disconnected', () => notificador.marcarPronto(false));

  client.on('message', async (message) => {
    await handleMessage(message);
  });

  return client;
}

// Tenta iniciar o WhatsApp algumas vezes. Cada tentativa limpa travas antigas e usa um cliente
// novo. Se todas falharem, NÃO derruba o programa — o painel continua funcionando e os dados
// permanecem salvos; basta reabrir para tentar de novo.
async function iniciarWhatsApp() {
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS_WHATSAPP; tentativa++) {
    limparTravasSessao();
    const client = montarClienteComHandlers();
    try {
      await client.initialize();
      return; // conectou (ou está aguardando o QR) — tudo certo
    } catch (err) {
      console.error(`⚠️  Falha ao conectar o WhatsApp (tentativa ${tentativa}/${MAX_TENTATIVAS_WHATSAPP}): ${err.message}`);
      try { await client.destroy(); } catch {}
      if (tentativa < MAX_TENTATIVAS_WHATSAPP) {
        console.log('   Limpando e tentando novamente em 5 segundos...');
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }

  console.error('\n⚠️  Não foi possível conectar ao WhatsApp agora.');
  console.error('   O PAINEL continua funcionando normalmente e seus dados estão salvos.');
  console.error('   Feche esta janela e abra o "iniciar.bat" de novo para tentar reconectar.\n');
}

async function main() {
  console.log('🚀 Iniciando bot de autoatendimento WhatsApp...');

  const config = carregarConfig();
  console.log(`📋 Configuração carregada: ${config.nome_empresa} (plano: ${config.plano})`);

  // O painel sobe primeiro e é independente do WhatsApp — assim, mesmo que o WhatsApp tenha
  // problema, o dono continua acessando pedidos, ordens de serviço e cadastros.
  iniciarPainel();
  iniciarAgendador();

  await iniciarWhatsApp();
}

main().catch(err => {
  console.error('Erro fatal ao iniciar o sistema:', err.message);
  process.exit(1);
});
