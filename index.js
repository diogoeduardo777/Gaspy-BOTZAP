require('dotenv').config();

const { criarCliente, limparTravasSessao } = require('./src/bot/client');
const { handleMessage } = require('./src/bot/messageHandler');
const { carregarConfig } = require('./src/config/loader');
const { iniciarPainel } = require('./painel/server');
const notificador = require('./src/bot/notificador');
const { iniciarAgendador } = require('./src/bot/agendador');

const MAX_TENTATIVAS_WHATSAPP = 5;
const ESPERA_RECONEXAO_MS = 8000;

let tentativas = 0;
let clienteAtual = null;
let reconexaoAgendada = false;

// Erros do puppeteer/whatsapp-web.js que indicam que a página caiu/navegou e vale reconectar.
function ehErroDeConexaoWhatsApp(mensagem) {
  const m = String(mensagem || '').toLowerCase();
  return (
    m.includes('execution context was destroyed') ||
    m.includes('protocol error') ||
    m.includes('target closed') ||
    m.includes('session closed') ||
    m.includes('navigation')
  );
}

async function conectarWhatsApp() {
  reconexaoAgendada = false;
  tentativas += 1;

  // Cada tentativa começa do zero: fecha o cliente anterior e limpa travas do Chromium.
  if (clienteAtual) {
    try { await clienteAtual.destroy(); } catch {}
    clienteAtual = null;
  }
  limparTravasSessao();

  const client = criarCliente();
  clienteAtual = client;

  notificador.configurarCliente(client);
  client.on('ready', () => {
    tentativas = 0; // conectou: zera o contador
    notificador.marcarPronto(true);
  });
  client.on('disconnected', (motivo) => {
    console.warn('⚠️  WhatsApp desconectado:', motivo);
    notificador.marcarPronto(false);
    agendarReconexao('desconexão');
  });
  client.on('message', async (message) => {
    await handleMessage(message);
  });

  try {
    await client.initialize();
  } catch (err) {
    console.error(`⚠️  Falha ao conectar o WhatsApp (tentativa ${tentativas}/${MAX_TENTATIVAS_WHATSAPP}): ${err.message}`);
    agendarReconexao('erro na inicialização');
  }
}

function agendarReconexao(motivo) {
  if (reconexaoAgendada) return; // evita agendar várias ao mesmo tempo
  if (tentativas >= MAX_TENTATIVAS_WHATSAPP) {
    console.error('\n⚠️  Não consegui conectar ao WhatsApp após várias tentativas.');
    console.error('   O PAINEL continua funcionando e seus dados estão salvos.');
    console.error('   Feche esta janela e abra o "iniciar.bat" de novo mais tarde para tentar reconectar.\n');
    return;
  }
  reconexaoAgendada = true;
  console.log(`🔄 Vou tentar reconectar o WhatsApp em ${ESPERA_RECONEXAO_MS / 1000}s (${motivo})...`);
  setTimeout(() => { conectarWhatsApp().catch(() => agendarReconexao('nova falha')); }, ESPERA_RECONEXAO_MS);
}

// Guardas globais: erros assíncronos jogados de dentro do whatsapp-web.js/puppeteer NÃO podem
// derrubar o programa inteiro. Se for erro de conexão, agenda reconexão; o painel segue no ar.
process.on('unhandledRejection', (err) => {
  const msg = (err && err.message) || err;
  if (ehErroDeConexaoWhatsApp(msg)) {
    console.error('⚠️  Problema de conexão do WhatsApp (recuperável):', msg);
    agendarReconexao('erro assíncrono');
  } else {
    console.error('Erro não tratado (ignorado para manter o sistema no ar):', msg);
  }
});
process.on('uncaughtException', (err) => {
  const msg = (err && err.message) || err;
  if (ehErroDeConexaoWhatsApp(msg)) {
    console.error('⚠️  Problema de conexão do WhatsApp (recuperável):', msg);
    agendarReconexao('exceção não capturada');
  } else {
    console.error('Erro inesperado (ignorado para manter o sistema no ar):', msg);
  }
});

async function main() {
  console.log('🚀 Iniciando bot de autoatendimento WhatsApp...');

  const config = carregarConfig();
  console.log(`📋 Configuração carregada: ${config.nome_empresa} (plano: ${config.plano})`);

  // O painel sobe primeiro e é independente do WhatsApp: mesmo que o WhatsApp tenha problema,
  // o dono continua acessando pedidos, ordens de serviço e cadastros.
  iniciarPainel();
  iniciarAgendador();

  await conectarWhatsApp();
}

main().catch(err => {
  console.error('Erro fatal ao iniciar o sistema:', err.message);
  process.exit(1);
});
