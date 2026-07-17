const fs = require('fs');
const path = require('path');

// Popula o banco na primeira execução usando o JSON de exemplo como dado inicial.
// Depois disso, toda edição passa a ser feita pelo painel web (gravada no SQLite).
function rodarSeed(db) {
  const clientId = process.env.CLIENT_ID || 'exemplo';
  let configPath = path.resolve(`./clients/${clientId}.json`);
  if (!fs.existsSync(configPath)) {
    configPath = path.resolve('./clients/exemplo.json');
  }
  if (!fs.existsSync(configPath)) {
    console.warn('⚠️  Nenhum arquivo de configuração inicial encontrado em clients/. Pulei o seed.');
    return;
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  const inserirEstabelecimento = db.prepare(`
    INSERT INTO estabelecimentos
      (client_id, nome, saudacao, numero_atendente, horario_atendimento,
       mensagem_fora_horario, mensagem_encerramento, chave_pix,
       pix_nome_recebedor, pix_cidade, plano, rotulo_catalogo, config_menu_json)
    VALUES (@client_id, @nome, @saudacao, @numero_atendente, @horario_atendimento,
            @mensagem_fora_horario, @mensagem_encerramento, @chave_pix,
            @pix_nome_recebedor, @pix_cidade, @plano, @rotulo_catalogo, @config_menu_json)
  `);

  const info = inserirEstabelecimento.run({
    client_id: clientId,
    nome: config.nome_empresa || 'Meu Estabelecimento',
    saudacao: config.saudacao || '',
    numero_atendente: config.numero_atendente || '',
    horario_atendimento: config.horario_atendimento || '',
    mensagem_fora_horario: config.mensagem_fora_horario || '',
    mensagem_encerramento: config.mensagem_encerramento || '',
    chave_pix: '',
    pix_nome_recebedor: config.nome_empresa || '',
    pix_cidade: 'SAO PAULO',
    plano: 'basico',
    rotulo_catalogo: config.rotulo_catalogo || '🍽️ Cardápio',
    config_menu_json: JSON.stringify({
      menu_principal: config.menu_principal || { titulo: 'Escolha uma opção:', opcoes: [] },
      submenus: config.submenus || {}
    })
  });

  const estabelecimentoId = info.lastInsertRowid;

  const itensExtraidos = extrairItensDoTextoDePrecos(
    config.submenus && config.submenus.servicos && config.submenus.servicos.mensagem_fixa
  );

  if (itensExtraidos.length > 0) {
    const inserirItem = db.prepare(`
      INSERT INTO cardapio_itens (estabelecimento_id, categoria, nome, descricao, preco_centavos, disponivel)
      VALUES (?, 'Serviços', ?, '', ?, 1)
    `);
    const transacao = db.transaction((itens) => {
      itens.forEach((item) => inserirItem.run(estabelecimentoId, item.nome, item.precoCentavos));
    });
    transacao(itensExtraidos);
  }

  const servicosCatalogo = Array.isArray(config.servicos_catalogo) ? config.servicos_catalogo : [];
  if (servicosCatalogo.length > 0) {
    const inserirServico = db.prepare(`
      INSERT INTO servicos_catalogo (estabelecimento_id, nome, descricao, preco_centavos, disponivel)
      VALUES (?, ?, ?, ?, 1)
    `);
    const transacaoServicos = db.transaction((servicos) => {
      servicos.forEach((servico) => inserirServico.run(
        estabelecimentoId,
        servico.nome,
        servico.descricao || '',
        servico.preco === undefined || servico.preco === null ? null : Math.round(servico.preco * 100)
      ));
    });
    transacaoServicos(servicosCatalogo);
  }

  console.log(`🌱 Seed inicial criado para o estabelecimento "${config.nome_empresa}" (client_id=${clientId}), ${itensExtraidos.length} itens de cardápio e ${servicosCatalogo.length} serviços importados.`);
}

// Extrai linhas do formato "✂️ *Nome do item* — R$ 60,00" usadas hoje no texto fixo de preços.
function extrairItensDoTextoDePrecos(texto) {
  if (!texto) return [];
  const itens = [];
  const regexLinha = /\*(.+?)\*\s*[—-]\s*R\$\s*([\d.]+,\d{2})/g;
  let match;
  while ((match = regexLinha.exec(texto)) !== null) {
    const nome = match[1].trim();
    const precoCentavos = Math.round(parseFloat(match[2].replace(/\./g, '').replace(',', '.')) * 100);
    itens.push({ nome, precoCentavos });
  }
  return itens;
}

module.exports = { rodarSeed };
