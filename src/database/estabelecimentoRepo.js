const db = require('./connection');

function buscarPorClientId(clientId) {
  const row = db.prepare('SELECT * FROM estabelecimentos WHERE client_id = ?').get(clientId);
  if (!row) return null;
  return paraConfig(row);
}

function buscarPorId(id) {
  const row = db.prepare('SELECT * FROM estabelecimentos WHERE id = ?').get(id);
  if (!row) return null;
  return paraConfig(row);
}

// Monta o objeto de configuração no mesmo formato que o motor de fluxos (src/flows) já espera.
function paraConfig(row) {
  const menu = JSON.parse(row.config_menu_json || '{}');
  return {
    id: row.id,
    client_id: row.client_id,
    nome_empresa: row.nome,
    saudacao: row.saudacao,
    numero_atendente: row.numero_atendente,
    horario_atendimento: row.horario_atendimento,
    mensagem_fora_horario: row.mensagem_fora_horario,
    mensagem_encerramento: row.mensagem_encerramento,
    chave_pix: row.chave_pix,
    pix_nome_recebedor: row.pix_nome_recebedor,
    pix_cidade: row.pix_cidade,
    plano: row.plano,
    rotulo_catalogo: row.rotulo_catalogo,
    menu_principal: menu.menu_principal || { titulo: 'Escolha uma opção:', opcoes: [] },
    submenus: menu.submenus || {}
  };
}

function atualizarConfig(id, dados) {
  const atual = db.prepare('SELECT * FROM estabelecimentos WHERE id = ?').get(id);
  if (!atual) throw new Error(`Estabelecimento ${id} não encontrado`);

  const campos = [
    'nome', 'saudacao', 'numero_atendente', 'horario_atendimento',
    'mensagem_fora_horario', 'mensagem_encerramento', 'chave_pix',
    'pix_nome_recebedor', 'pix_cidade', 'plano', 'rotulo_catalogo'
  ];
  const atualizado = { ...atual };
  campos.forEach((campo) => {
    if (dados[campo] !== undefined) atualizado[campo] = dados[campo];
  });

  db.prepare(`
    UPDATE estabelecimentos SET
      nome = @nome, saudacao = @saudacao, numero_atendente = @numero_atendente,
      horario_atendimento = @horario_atendimento, mensagem_fora_horario = @mensagem_fora_horario,
      mensagem_encerramento = @mensagem_encerramento, chave_pix = @chave_pix,
      pix_nome_recebedor = @pix_nome_recebedor, pix_cidade = @pix_cidade, plano = @plano,
      rotulo_catalogo = @rotulo_catalogo
    WHERE id = @id
  `).run(atualizado);

  return buscarPorId(id);
}

module.exports = { buscarPorClientId, buscarPorId, atualizarConfig };
