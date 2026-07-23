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

// Debita o estoque dos itens do pedido no momento do ACEITE. Tudo em UMA transação:
//   - trava contra dupla-baixa: só debita se `estoque_baixado` ainda for 0, e marca 1 no fim
//     (se o dono aceitar/mexer no status várias vezes, o estoque é debitado uma única vez);
//   - só mexe em itens com estoque numérico (estoque NULL = não controla, é ignorado);
//   - nunca deixa negativo: usa max(estoque - qtd, 0);
//   - devolve a lista de itens que não tinham saldo suficiente, para o painel avisar o dono.
// Toca a tabela cardapio_itens aqui de propósito (em vez de chamar o cardapioRepo) para que a
// baixa e a marcação da trava fiquem na MESMA transação — ou tudo acontece, ou nada.
// A decisão de SÓ chamar quando o tipo é 'loja' fica no chamador (a rota do painel).
function baixarEstoqueAoAceitar(estabelecimentoId, pedidoId) {
  const buscarItem = db.prepare('SELECT id, nome, estoque FROM cardapio_itens WHERE estabelecimento_id = ? AND id = ?');
  const atualizarEstoque = db.prepare('UPDATE cardapio_itens SET estoque = ? WHERE estabelecimento_id = ? AND id = ?');
  const marcarBaixado = db.prepare('UPDATE pedidos SET estoque_baixado = 1 WHERE estabelecimento_id = ? AND id = ?');

  const transacao = db.transaction(() => {
    const pedido = db.prepare('SELECT itens_json, estoque_baixado FROM pedidos WHERE estabelecimento_id = ? AND id = ?')
      .get(estabelecimentoId, pedidoId);
    if (!pedido || pedido.estoque_baixado) return { jaBaixado: true, faltas: [] };

    let itens = [];
    try { itens = JSON.parse(pedido.itens_json || '[]'); } catch { itens = []; }

    const faltas = [];
    for (const linha of itens) {
      if (!linha || !linha.itemId) continue; // item sem vínculo com o cardápio: nada a debitar
      const item = buscarItem.get(estabelecimentoId, linha.itemId);
      if (!item || item.estoque === null || item.estoque === undefined) continue; // não controla estoque
      const quantidade = Number(linha.quantidade) || 0;
      if (item.estoque < quantidade) {
        faltas.push({ nome: item.nome, disponivel: item.estoque, pedido: quantidade });
      }
      atualizarEstoque.run(Math.max(item.estoque - quantidade, 0), estabelecimentoId, linha.itemId);
    }

    marcarBaixado.run(estabelecimentoId, pedidoId);
    return { jaBaixado: false, faltas };
  });

  return transacao();
}

module.exports = { criarPedido, buscarPedido, listarPedidos, atualizarStatus, baixarEstoqueAoAceitar };
