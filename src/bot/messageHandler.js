const { processarMensagem } = require('../flows');

async function handleMessage(message, config) {
  // Ignora mensagens de grupos, broadcasts e do próprio bot
  if (message.from === 'status@broadcast') return;
  if (message.from.endsWith('@g.us')) return;
  if (message.fromMe) return;

  const telefone = message.from;
  const texto = message.body || '';

  if (!texto.trim()) return;

  try {
    const resposta = await processarMensagem(telefone, texto, config);
    if (resposta) {
      await message.reply(resposta);
    }
  } catch (err) {
    console.error(`Erro ao processar mensagem de ${telefone}:`, err.message);
    await message.reply('Ocorreu um erro. Por favor, tente novamente ou digite *menu*.');
  }
}

module.exports = { handleMessage };
