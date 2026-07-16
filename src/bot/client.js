const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');

const clientId = process.env.CLIENT_ID || 'default';
const sessionPath = path.resolve(process.env.SESSION_PATH || './sessions');

// Quando a janela é fechada no "X" (ou falta energia), o Chromium não desliga direito e deixa
// arquivos de trava (SingletonLock/Cookie/Socket) na pasta da sessão. Na próxima abertura, isso
// causa o erro "Execution context was destroyed". Apagar essas travas ao iniciar resolve — e NÃO
// apaga a sessão em si (não precisa escanear o QR de novo).
function limparTravasSessao() {
  try {
    const perfil = path.join(sessionPath, `session-${clientId}`);
    if (!fs.existsSync(perfil)) return;
    for (const nome of fs.readdirSync(perfil)) {
      if (nome.startsWith('Singleton')) {
        try { fs.rmSync(path.join(perfil, nome), { force: true, recursive: true }); } catch {}
      }
    }
  } catch (e) {
    console.warn('Aviso: não consegui limpar travas antigas da sessão:', e.message);
  }
}

function criarCliente() {
  const puppeteerConfig = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
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
    // Reconexão protegida: se falhar, apenas registra — não derruba o processo.
    setTimeout(() => {
      limparTravasSessao();
      client.initialize().catch((err) => {
        console.error('Não consegui reconectar automaticamente:', err.message);
      });
    }, 3000);
  });

  return client;
}

module.exports = { criarCliente, limparTravasSessao };
