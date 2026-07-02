require('dotenv').config();
const path = require('path');
const express = require('express');

const estabelecimentoRepo = require('../src/database/estabelecimentoRepo');
const cardapioRepo = require('../src/database/cardapioRepo');
const pedidosRepo = require('../src/database/pedidosRepo');
const servicosRepo = require('../src/database/servicosRepo');
const { formatarProtocolo } = require('../src/flows/manutencaoFlow');

const PAINEL_SENHA = process.env.PAINEL_SENHA;
if (!PAINEL_SENHA) {
  console.warn('⚠️  PAINEL_SENHA não definida no .env — usando senha padrão "admin". Configure uma senha própria antes de expor o painel na rede.');
}

function clientIdAtual() {
  return process.env.CLIENT_ID || 'exemplo';
}

function estabelecimentoAtual() {
  const config = estabelecimentoRepo.buscarPorClientId(clientIdAtual());
  if (!config) {
    throw new Error(`Estabelecimento com client_id="${clientIdAtual()}" não encontrado. Rode "npm run seed" primeiro.`);
  }
  return config;
}

function autenticar(req, res, next) {
  const senhaEsperada = PAINEL_SENHA || 'admin';
  const senhaEnviada = req.headers['x-painel-senha'];
  if (senhaEnviada !== senhaEsperada) {
    return res.status(401).json({ erro: 'Senha do painel inválida ou não informada.' });
  }
  next();
}

function criarApp() {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/api/config', autenticar, (req, res) => {
    res.json(paraConfigApi(estabelecimentoAtual()));
  });

  app.put('/api/config', autenticar, (req, res) => {
    const config = estabelecimentoAtual();
    const atualizado = estabelecimentoRepo.atualizarConfig(config.id, req.body || {});
    res.json(paraConfigApi(atualizado));
  });

  app.get('/api/cardapio', autenticar, (req, res) => {
    const config = estabelecimentoAtual();
    res.json(cardapioRepo.listarItens(config.id).map(paraItemApi));
  });

  app.post('/api/cardapio', autenticar, (req, res) => {
    const config = estabelecimentoAtual();
    const { categoria, nome, descricao, preco, disponivel, estoque } = req.body || {};
    if (!nome) return res.status(400).json({ erro: 'Nome do item é obrigatório.' });

    const item = cardapioRepo.criarItem(config.id, {
      categoria,
      nome,
      descricao,
      precoCentavos: paraCentavos(preco),
      disponivel,
      estoque
    });
    res.status(201).json(paraItemApi(item));
  });

  app.put('/api/cardapio/:itemId', autenticar, (req, res) => {
    const config = estabelecimentoAtual();
    const { categoria, nome, descricao, preco, disponivel, estoque } = req.body || {};
    try {
      const item = cardapioRepo.atualizarItem(config.id, Number(req.params.itemId), {
        categoria,
        nome,
        descricao,
        precoCentavos: preco !== undefined ? paraCentavos(preco) : undefined,
        disponivel,
        estoque
      });
      res.json(paraItemApi(item));
    } catch (err) {
      res.status(404).json({ erro: err.message });
    }
  });

  app.delete('/api/cardapio/:itemId', autenticar, (req, res) => {
    const config = estabelecimentoAtual();
    cardapioRepo.removerItem(config.id, Number(req.params.itemId));
    res.status(204).end();
  });

  app.get('/api/pedidos', autenticar, (req, res) => {
    const config = estabelecimentoAtual();
    const pedidos = pedidosRepo.listarPedidos(config.id).map((pedido) => ({
      ...pedido,
      itens: JSON.parse(pedido.itens_json || '[]'),
      total_reais: (pedido.total_centavos / 100).toFixed(2)
    }));
    res.json(pedidos);
  });

  app.patch('/api/pedidos/:pedidoId/status', autenticar, (req, res) => {
    const config = estabelecimentoAtual();
    const { status } = req.body || {};
    const statusValidos = ['pendente', 'pago', 'cancelado', 'concluido'];
    if (!statusValidos.includes(status)) {
      return res.status(400).json({ erro: `Status inválido. Use um de: ${statusValidos.join(', ')}` });
    }
    const pedido = pedidosRepo.atualizarStatus(config.id, Number(req.params.pedidoId), status);
    res.json(pedido);
  });

  app.get('/api/servicos', autenticar, (req, res) => {
    const config = estabelecimentoAtual();
    res.json(servicosRepo.listarServicos(config.id).map(paraServicoApi));
  });

  app.patch('/api/servicos/:servicoId/status', autenticar, (req, res) => {
    const config = estabelecimentoAtual();
    const { status } = req.body || {};
    const statusValidos = ['em_analise', 'em_manutencao', 'aguardando_peca', 'concluido'];
    if (!statusValidos.includes(status)) {
      return res.status(400).json({ erro: `Status inválido. Use um de: ${statusValidos.join(', ')}` });
    }
    const servico = servicosRepo.atualizarStatus(config.id, Number(req.params.servicoId), status);
    res.json(paraServicoApi(servico));
  });

  app.patch('/api/servicos/:servicoId/data-prevista', autenticar, (req, res) => {
    const config = estabelecimentoAtual();
    const { dataPrevista } = req.body || {};
    const servico = servicosRepo.atualizarDataPrevista(config.id, Number(req.params.servicoId), dataPrevista || null);
    res.json(paraServicoApi(servico));
  });

  return app;
}

// Expõe os campos de configuração com os mesmos nomes esperados pelo formulário do painel e
// aceitos por estabelecimentoRepo.atualizarConfig — evita depender do formato interno usado
// pelo motor de fluxos (que usa "nome_empresa" em vez de "nome").
function paraConfigApi(config) {
  return {
    id: config.id,
    nome: config.nome_empresa,
    saudacao: config.saudacao,
    numero_atendente: config.numero_atendente,
    horario_atendimento: config.horario_atendimento,
    mensagem_fora_horario: config.mensagem_fora_horario,
    mensagem_encerramento: config.mensagem_encerramento,
    chave_pix: config.chave_pix,
    pix_nome_recebedor: config.pix_nome_recebedor,
    pix_cidade: config.pix_cidade,
    plano: config.plano
  };
}

function paraCentavos(preco) {
  const valor = typeof preco === 'string' ? preco.replace(',', '.') : preco;
  return Math.round(parseFloat(valor || 0) * 100);
}

function paraItemApi(item) {
  return { ...item, preco_reais: (item.preco_centavos / 100).toFixed(2) };
}

function paraServicoApi(servico) {
  return { ...servico, protocolo: formatarProtocolo(servico.id) };
}

function iniciarPainel() {
  const porta = process.env.PORT || process.env.PAINEL_PORT || 3000;
  const app = criarApp();
  app.listen(porta, () => {
    console.log(`\n🖥️  Painel administrativo disponível em http://localhost:${porta}\n`);
  });
  return app;
}

module.exports = { criarApp, iniciarPainel };

if (require.main === module) {
  iniciarPainel();
}
