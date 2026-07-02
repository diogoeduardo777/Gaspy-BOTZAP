const { processarMensagem } = require('../flows');
const { carregarConfig } = require('../config/loader');
const logsRepo = require('../database/logsRepo');

async function handleMessage(message) {
  // Ignora mensagens de grupos, broadcasts e do próprio bot
  if (message.from === 'status@broadcast') return;
  if (message.from.endsWith('@g.us')) return;
  if (message.fromMe) return;

  const telefone = message.from;
  const texto = message.body || '';

  if (!texto.trim()) return;

  try {
    // Busca a configuração a cada mensagem: reflete edições feitas no painel sem reiniciar o bot.
    const config = carregarConfig();
    logsRepo.registrarMensagem(config.id, telefone, 'in', texto);

    const resposta = config.plano === 'profissional'
      ? await require('../ai/atendimentoIA').processarComIA(telefone, texto, config)
      : await processarMensagem(telefone, texto, config);

    if (resposta) {
      logsRepo.registrarMensagem(config.id, telefone, 'out', resposta);
      await message.reply(resposta);
    }
  } catch (err) {
    console.error(`Erro ao processar mensagem de ${telefone}:`, err.message);
    await message.reply('Ocorreu um erro. Por favor, tente novamente ou digite *menu*.');
  }
}

module.exports = { handleMessage };
