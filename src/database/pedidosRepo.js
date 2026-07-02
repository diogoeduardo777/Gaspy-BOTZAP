const db = require('./connection');

function criarPedido(estabelecimentoId, { telefone, clienteNome, tipo, itens, totalCentavos, pixTxid }) {
  const info = db.prepare(`
    INSERT INTO pedidos (estabelecimento_id, telefone, cliente_nome, tipo, itens_json, total_centavos, pix_txid)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    estabelecimentoId,
    telefone,
    clienteNome || '',
    tipo || 'pedido',
    JSON.stringify(itens || []),
    totalCentavos || 0,
    pixTxid || ''
  );
  return buscarPedido(estabelecimentoId, info.lastInsertRowid);
}

function buscarPedido(estabelecimentoId, pedidoId) {
  return db.prepare('SELECT * FROM pedidos WHERE estabelecimento_id = ? AND id = ?').get(estabelecimentoId, pedidoId);
}

function listarPedidos(estabelecimentoId) {
  return db.prepare('SELECT * FROM pedidos WHERE estabelecimento_id = ? ORDER BY criado_em DESC').all(estabelecimentoId);
}

function atualizarStatus(estabelecimentoId, pedidoId, status) {
  db.prepare(`
    UPDATE pedidos SET status = ?, atualizado_em = datetime('now')
    WHERE estabelecimento_id = ? AND id = ?
  `).run(status, estabelecimentoId, pedidoId);
  return buscarPedido(estabelecimentoId, pedidoId);
}

module.exports = { criarPedido, buscarPedido, listarPedidos, atualizarStatus };
