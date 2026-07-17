// Compatibilidade com scripts antigos (ex: ver-agendamentos.js) que liam agendamentos
// diretamente daqui. A lógica real agora mora em estabelecimentoRepo/pedidosRepo (SQLite).
const estabelecimentoRepo = require('./estabelecimentoRepo');
const pedidosRepo = require('./pedidosRepo');

function estabelecimentoAtual() {
  const clientId = process.env.CLIENT_ID || 'exemplo';
  const config = estabelecimentoRepo.buscarPorClientId(clientId);
  if (!config) throw new Error(`Estabelecimento com client_id="${clientId}" não encontrado no banco.`);
  return config;
}

function listarAgendamentos() {
  const config = estabelecimentoAtual();
  return pedidosRepo.listarPedidos(config.id).map((pedido) => {
    const itens = JSON.parse(pedido.itens_json || '[]');
    return {
      nome: pedido.cliente_nome,
      servico: itens.map((i) => i.nome).join(', '),
      dataHora: itens[0] && itens[0].observacao ? itens[0].observacao : pedido.status,
      telefone: pedido.telefone,
      criado_em: pedido.criado_em
    };
  });
}

module.exports = { listarAgendamentos };
