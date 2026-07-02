const db = require('./connection');

function listarServicos(estabelecimentoId, { somenteDisponiveis = false } = {}) {
  const sql = somenteDisponiveis
    ? 'SELECT * FROM servicos_catalogo WHERE estabelecimento_id = ? AND disponivel = 1 ORDER BY id'
    : 'SELECT * FROM servicos_catalogo WHERE estabelecimento_id = ? ORDER BY id';
  return db.prepare(sql).all(estabelecimentoId);
}

function buscarServico(estabelecimentoId, servicoId) {
  return db.prepare('SELECT * FROM servicos_catalogo WHERE estabelecimento_id = ? AND id = ?').get(estabelecimentoId, servicoId);
}

function criarServico(estabelecimentoId, { nome, descricao, precoCentavos, disponivel }) {
  const info = db.prepare(`
    INSERT INTO servicos_catalogo (estabelecimento_id, nome, descricao, preco_centavos, disponivel)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    estabelecimentoId,
    nome,
    descricao || '',
    precoCentavos === undefined || precoCentavos === null || precoCentavos === '' ? null : Number(precoCentavos),
    disponivel === false ? 0 : 1
  );
  return buscarServico(estabelecimentoId, info.lastInsertRowid);
}

function atualizarServico(estabelecimentoId, servicoId, dados) {
  const atual = buscarServico(estabelecimentoId, servicoId);
  if (!atual) throw new Error(`Serviço ${servicoId} não encontrado`);

  const atualizado = {
    nome: dados.nome !== undefined ? dados.nome : atual.nome,
    descricao: dados.descricao !== undefined ? dados.descricao : atual.descricao,
    preco_centavos: dados.precoCentavos !== undefined
      ? (dados.precoCentavos === null || dados.precoCentavos === '' ? null : Number(dados.precoCentavos))
      : atual.preco_centavos,
    disponivel: dados.disponivel !== undefined ? (dados.disponivel ? 1 : 0) : atual.disponivel,
    id: servicoId,
    estabelecimento_id: estabelecimentoId
  };

  db.prepare(`
    UPDATE servicos_catalogo SET nome = @nome, descricao = @descricao,
      preco_centavos = @preco_centavos, disponivel = @disponivel
    WHERE id = @id AND estabelecimento_id = @estabelecimento_id
  `).run(atualizado);

  return buscarServico(estabelecimentoId, servicoId);
}

function removerServico(estabelecimentoId, servicoId) {
  db.prepare('DELETE FROM servicos_catalogo WHERE estabelecimento_id = ? AND id = ?').run(estabelecimentoId, servicoId);
}

module.exports = { listarServicos, buscarServico, criarServico, atualizarServico, removerServico };
