const db = require('./connection');

function criarServico(estabelecimentoId, { telefone, clienteNome, aparelho, servico, precoCentavos }) {
  const info = db.prepare(`
    INSERT INTO servicos_agendados (estabelecimento_id, telefone, cliente_nome, aparelho, servico, preco_centavos)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(estabelecimentoId, telefone, clienteNome, aparelho, servico, precoCentavos === undefined ? null : precoCentavos);
  return buscarPorId(estabelecimentoId, info.lastInsertRowid);
}

function buscarPorId(estabelecimentoId, id) {
  return db.prepare('SELECT * FROM servicos_agendados WHERE estabelecimento_id = ? AND id = ?').get(estabelecimentoId, id);
}

function buscarPorNome(estabelecimentoId, nome) {
  return db.prepare(`
    SELECT * FROM servicos_agendados WHERE estabelecimento_id = ? AND cliente_nome LIKE ?
    ORDER BY criado_em DESC
  `).all(estabelecimentoId, `%${nome}%`);
}

function listarServicos(estabelecimentoId) {
  return db.prepare('SELECT * FROM servicos_agendados WHERE estabelecimento_id = ? ORDER BY criado_em DESC').all(estabelecimentoId);
}

function atualizarStatus(estabelecimentoId, id, status) {
  const dataConclusao = status === 'concluido' ? "datetime('now')" : 'data_conclusao';
  db.prepare(`
    UPDATE servicos_agendados SET status = ?, data_conclusao = ${dataConclusao}
    WHERE estabelecimento_id = ? AND id = ?
  `).run(status, estabelecimentoId, id);
  return buscarPorId(estabelecimentoId, id);
}

function atualizarDataPrevista(estabelecimentoId, id, dataPrevista) {
  db.prepare(`
    UPDATE servicos_agendados SET data_prevista = ? WHERE estabelecimento_id = ? AND id = ?
  `).run(dataPrevista, estabelecimentoId, id);
  return buscarPorId(estabelecimentoId, id);
}

function marcarRetirado(estabelecimentoId, id, retirado) {
  db.prepare(`
    UPDATE servicos_agendados SET retirado = ? WHERE estabelecimento_id = ? AND id = ?
  `).run(retirado ? 1 : 0, estabelecimentoId, id);
  return buscarPorId(estabelecimentoId, id);
}

// Serviços prontos (concluído) que o cliente ainda não buscou — candidatos ao lembrete de retirada.
function listarPendentesRetirada(estabelecimentoId) {
  return db.prepare(`
    SELECT * FROM servicos_agendados
    WHERE estabelecimento_id = ? AND status = 'concluido' AND retirado = 0
    ORDER BY data_conclusao
  `).all(estabelecimentoId);
}

function registrarLembreteRetirada(estabelecimentoId, id) {
  db.prepare(`
    UPDATE servicos_agendados SET lembretes_retirada = lembretes_retirada + 1
    WHERE estabelecimento_id = ? AND id = ?
  `).run(estabelecimentoId, id);
  return buscarPorId(estabelecimentoId, id);
}

module.exports = {
  criarServico, buscarPorId, buscarPorNome, listarServicos, atualizarStatus,
  atualizarDataPrevista, marcarRetirado, listarPendentesRetirada, registrarLembreteRetirada
};
