const db = require('./connection');

function obterSessao(estabelecimentoId, telefone) {
  const row = db.prepare('SELECT * FROM sessoes WHERE telefone = ? AND estabelecimento_id = ?').get(telefone, estabelecimentoId);
  if (!row) return { estado: 'inicio', dados: {} };
  return { estado: row.estado, dados: JSON.parse(row.dados_json || '{}') };
}

function salvarSessao(estabelecimentoId, telefone, estado, dados = {}) {
  db.prepare(`
    INSERT INTO sessoes (telefone, estabelecimento_id, estado, dados_json, atualizado_em)
    VALUES (@telefone, @estabelecimento_id, @estado, @dados_json, datetime('now'))
    ON CONFLICT(telefone) DO UPDATE SET
      estabelecimento_id = excluded.estabelecimento_id,
      estado = excluded.estado,
      dados_json = excluded.dados_json,
      atualizado_em = excluded.atualizado_em
  `).run({
    telefone,
    estabelecimento_id: estabelecimentoId,
    estado,
    dados_json: JSON.stringify(dados)
  });
}

function resetarSessao(estabelecimentoId, telefone) {
  db.prepare('DELETE FROM sessoes WHERE telefone = ? AND estabelecimento_id = ?').run(telefone, estabelecimentoId);
}

module.exports = { obterSessao, salvarSessao, resetarSessao };
