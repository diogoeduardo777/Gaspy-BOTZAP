const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');

const clientId = process.env.CLIENT_ID || 'default';
const sessionPath = path.resolve(process.env.SESSION_PATH || './sessions');

function criarCliente() {
  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: clientId,
      dataPath: sessionPath
    }),
    puppeteer: {
      headless: true,
      executablePath: 'C:\\Users\\Diogo\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    }
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
