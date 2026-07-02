const fs = require('fs');
const path = require('path');

const clientId = process.env.CLIENT_ID || 'default';
const dataDir = path.resolve('./sessions');
const sessoesPath = path.join(dataDir, `${clientId}_sessoes.json`);
const agendamentosPath = path.join(dataDir, `${clientId}_agendamentos.json`);

function garantirArquivo(filePath, valorInicial) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(valorInicial, null, 2), 'utf-8');
  }
}

function lerJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function salvarJson(filePath, dados) {
  fs.writeFileSync(filePath, JSON.stringify(dados, null, 2), 'utf-8');
}

// Garante que os arquivos existem ao iniciar
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
garantirArquivo(sessoesPath, {});
garantirArquivo(agendamentosPath, []);

function obterSessao(telefone) {
  const sessoes = lerJson(sessoesPath) || {};
  return sessoes[telefone] || { estado: 'inicio', dados: {} };
}

function salvarSessao(telefone, estado, dados = {}) {
  const sessoes = lerJson(sessoesPath) || {};
  sessoes[telefone] = { estado, dados, atualizado_em: Date.now() };
  salvarJson(sessoesPath, sessoes);
}

function resetarSessao(telefone) {
  const sessoes = lerJson(sessoesPath) || {};
  delete sessoes[telefone];
  salvarJson(sessoesPath, sessoes);
}

function salvarAgendamento(telefone, nome, servico, dataHora) {
  const agendamentos = lerJson(agendamentosPath) || [];
  agendamentos.push({ id: Date.now(), telefone, nome, servico, dataHora, criado_em: new Date().toISOString() });
  salvarJson(agendamentosPath, agendamentos);
}

function listarAgendamentos() {
  return lerJson(agendamentosPath) || [];
}

module.exports = { obterSessao, salvarSessao, resetarSessao, salvarAgendamento, listarAgendamentos };
