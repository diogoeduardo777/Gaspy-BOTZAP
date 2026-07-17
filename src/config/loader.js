const estabelecimentoRepo = require('../database/estabelecimentoRepo');

// A configuração agora mora no SQLite (editável em tempo real pelo painel web), em vez de um
// JSON estático lido só na inicialização. Buscamos a cada chamada para refletir edições do painel
// sem precisar reiniciar o bot.
function carregarConfig() {
  const clientId = process.env.CLIENT_ID || 'exemplo';
  const config = estabelecimentoRepo.buscarPorClientId(clientId);

  if (!config) {
    throw new Error(`Estabelecimento com client_id="${clientId}" não encontrado no banco. Rode "npm run seed" ou configure pelo painel.`);
  }

  return config;
}

module.exports = { carregarConfig };
