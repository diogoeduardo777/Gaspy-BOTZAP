const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');

const clientId = process.env.CLIENT_ID || 'default';
const sessionPath = path.resolve(process.env.SESSION_PATH || './sessions');

// Quando a janela é fechada no "X" (ou falta energia), o Chromium não desliga direito e deixa
// arquivos de trava (SingletonLock/Cookie/Socket) na pasta da sessão. Na próxima abertura, isso
// atrapalha a restauração da sessão. Apagar essas travas ao iniciar resolve — e NÃO apaga a
// sessão em si (não precisa escanear o QR de novo).
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
    protocolTimeout: 120000,
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

  const opcoes = {
    authStrategy: new LocalAuth({ clientId: clientId, dataPath: sessionPath }),
    puppeteer: puppeteerConfig,
    takeoverOnConflict: true
  };

  // Alavanca opcional: se o WhatsApp Web quebrar a injeção ("Execution context was destroyed"),
  // dá para fixar uma versão conhecida da página definindo WWEB_VERSION no .env (ex:
  // WWEB_VERSION=2.3000.1023201347). Sem isso, usa o comportamento padrão da biblioteca.
  if (process.env.WWEB_VERSION) {
    opcoes.webVersionCache = {
      type: 'remote',
      remotePath: `https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/${process.env.WWEB_VERSION}.html`
    };
  }

  const client = new Client(opcoes);

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

  return client;
}

module.exports = { criarCliente, limparTravasSessao };
