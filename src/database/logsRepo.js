const db = require('./connection');

function registrarMensagem(estabelecimentoId, telefone, direcao, mensagem) {
  db.prepare(`
    INSERT INTO mensagens_log (estabelecimento_id, telefone, direcao, mensagem)
    VALUES (?, ?, ?, ?)
  `).run(estabelecimentoId, telefone, direcao, mensagem || '');
}

function listarMensagens(estabelecimentoId, telefone, limite = 50) {
  return db.prepare(`
    SELECT * FROM mensagens_log WHERE estabelecimento_id = ? AND telefone = ?
    ORDER BY id DESC LIMIT ?
  `).all(estabelecimentoId, telefone, limite).reverse();
}

module.exports = { registrarMensagem, listarMensagens };
