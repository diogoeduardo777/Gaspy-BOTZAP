const db = require('./connection');

function listarItens(estabelecimentoId, { somenteDisponiveis = false } = {}) {
  const sql = somenteDisponiveis
    ? 'SELECT * FROM cardapio_itens WHERE estabelecimento_id = ? AND disponivel = 1 AND (estoque IS NULL OR estoque > 0) ORDER BY categoria, id'
    : 'SELECT * FROM cardapio_itens WHERE estabelecimento_id = ? ORDER BY categoria, id';
  return db.prepare(sql).all(estabelecimentoId);
}

function buscarItem(estabelecimentoId, itemId) {
  return db.prepare('SELECT * FROM cardapio_itens WHERE estabelecimento_id = ? AND id = ?').get(estabelecimentoId, itemId);
}

function criarItem(estabelecimentoId, { categoria, nome, descricao, precoCentavos, disponivel, estoque }) {
  const info = db.prepare(`
    INSERT INTO cardapio_itens (estabelecimento_id, categoria, nome, descricao, preco_centavos, disponivel, estoque)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    estabelecimentoId,
    categoria || 'Geral',
    nome,
    descricao || '',
    precoCentavos || 0,
    disponivel === false ? 0 : 1,
    estoque === undefined || estoque === null || estoque === '' ? null : Number(estoque)
  );
  return buscarItem(estabelecimentoId, info.lastInsertRowid);
}

function atualizarItem(estabelecimentoId, itemId, dados) {
  const atual = buscarItem(estabelecimentoId, itemId);
  if (!atual) throw new Error(`Item ${itemId} não encontrado`);

  const atualizado = {
    categoria: dados.categoria !== undefined ? dados.categoria : atual.categoria,
    nome: dados.nome !== undefined ? dados.nome : atual.nome,
    descricao: dados.descricao !== undefined ? dados.descricao : atual.descricao,
    preco_centavos: dados.precoCentavos !== undefined ? dados.precoCentavos : atual.preco_centavos,
    disponivel: dados.disponivel !== undefined ? (dados.disponivel ? 1 : 0) : atual.disponivel,
    estoque: dados.estoque !== undefined
      ? (dados.estoque === null || dados.estoque === '' ? null : Number(dados.estoque))
      : atual.estoque,
    id: itemId,
    estabelecimento_id: estabelecimentoId
  };

  db.prepare(`
    UPDATE cardapio_itens SET categoria = @categoria, nome = @nome, descricao = @descricao,
      preco_centavos = @preco_centavos, disponivel = @disponivel, estoque = @estoque
    WHERE id = @id AND estabelecimento_id = @estabelecimento_id
  `).run(atualizado);

  return buscarItem(estabelecimentoId, itemId);
}

function removerItem(estabelecimentoId, itemId) {
  db.prepare('DELETE FROM cardapio_itens WHERE estabelecimento_id = ? AND id = ?').run(estabelecimentoId, itemId);
}

module.exports = { listarItens, buscarItem, criarItem, atualizarItem, removerItem };
