const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');

const clientId = process.env.CLIENT_ID || 'default';
const sessionPath = path.resolve(process.env.SESSION_PATH || './sessions');

function criarCliente() {
  const puppeteerConfig = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  };
  // Por padrão, usa o Chromium que o próprio pacote "puppeteer" baixa na instalação.
  // Só sobrescreve se PUPPETEER_EXECUTABLE_PATH for definido explicitamente no .env.
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    puppeteerConfig.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: clientId,
      dataPath: sessionPath
    }),
    puppeteer: puppeteerConfig
  });

  client.on('qr', (qr) => {
    console.log('\n📱 Escaneie o QR Code abaixo com o WhatsApp:\n');
    qrcode.generate(qr, { small: true });
  });

  client.on('ready', () => {
    console.log(`\n✅ Bot conectado! Cliente: ${clientId}\n`);
  });

  client.on('auth_failure', (msg) => {
    console.error('❌ Falha na autenticação:', msg);
  });

  client.on('disconnected', (reason) => {
    console.warn('⚠️  Bot desconectado:', reason);
    console.log('🔄 Tentando reconectar...');
    client.initialize();
  });

  return client;
}

module.exports = { criarCliente };
