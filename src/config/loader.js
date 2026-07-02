const path = require('path');
const fs = require('fs');

function carregarConfig() {
  const clientId = process.env.CLIENT_ID || 'default';
  const configPath = path.resolve(`./clients/${clientId}.json`);

  if (!fs.existsSync(configPath)) {
    throw new Error(`Arquivo de configuração não encontrado: ${configPath}`);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  return config;
}

module.exports = { carregarConfig };
