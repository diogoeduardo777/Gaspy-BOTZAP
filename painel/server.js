require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const express = require('express');

const estabelecimentoRepo = require('../src/database/estabelecimentoRepo');
const cardapioRepo = require('../src/database/cardapioRepo');
const pedidosRepo = require('../src/database/pedidosRepo');
const servicosRepo = require('../src/database/servicosRepo');
const servicosCatalogoRepo = require('../src/database/servicosCatalogoRepo');
const { formatarProtocolo } = require('../src/flows/manutencaoFlow');
const notificador = require('../src/bot/notificador');

const PAINEL_SENHA = process.env.PAINEL_SENHA;
if (PAINEL_SENHA) {
  console.log('🔑 Painel usando a senha definida em PAINEL_SENHA (.env).');
} else {
  console.log('🔑 Painel sem senha no .env — a senha será criada no primeiro acesso pela tela do painel.');
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

// Gera "salt:hash" com scrypt (crypto nativo) — não guardamos a senha em texto puro.
function hashSenha(senha) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(senha), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verificarSenha(senha, armazenado) {
  if (!armazenado || !armazenado.includes(':')) return false;
  const [salt, hashEsperado] = armazenado.split(':');
  const hash = crypto.scryptSync(String(senha), salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(hashEsperado, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Retorna true se o painel ainda não tem senha (nem no .env, nem criada no 1º acesso).
function precisaConfigurarSenha() {
  if (PAINEL_SENHA) return false;
  return !estabelecimentoRepo.buscarSenhaHash(clientIdAtual());
}

// Anti-força-bruta simples: bloqueia um IP por alguns minutos depois de muitas senhas erradas.
const MAX_TENTATIVAS = 10;
const BLOQUEIO_MS = 5 * 60 * 1000; // 5 minutos
const tentativasPorIp = new Map(); // ip -> { falhas, bloqueadoAte }

function ipDaRequisicao(req) {
  return req.ip || (req.socket && req.socket.remoteAddress) || 'desconhecido';
}

function registrarFalha(ip) {
  const reg = tentativasPorIp.get(ip) || { falhas: 0, bloqueadoAte: 0 };
  reg.falhas += 1;
  if (reg.falhas >= MAX_TENTATIVAS) {
    reg.bloqueadoAte = Date.now() + BLOQUEIO_MS;
    reg.falhas = 0;
  }
  tentativasPorIp.set(ip, reg);
}

function limparFalhas(ip) {
  tentativasPorIp.delete(ip);
}

function autenticar(req, res, next) {
  const ip = ipDaRequisicao(req);
  const reg = tentativasPorIp.get(ip);
  if (reg && reg.bloqueadoAte > Date.now()) {
    const faltamSeg = Math.ceil((reg.bloqueadoAte - Date.now()) / 1000);
    return res.status(429).json({ erro: `Muitas tentativas. Tente novamente em ${faltamSeg} segundos.` });
  }

  const senhaEnviada = req.headers['x-painel-senha'] || '';

  // Prioridade 1: senha fixa via .env (caminho Docker/servidor).
  if (PAINEL_SENHA) {
    if (senhaEnviada === PAINEL_SENHA) { limparFalhas(ip); return next(); }
    registrarFalha(ip);
    return res.status(401).json({ erro: 'Senha do painel inválida ou não informada.' });
  }

  // Prioridade 2: senha criada no 1º acesso (guardada com hash).
  const hash = estabelecimentoRepo.buscarSenhaHash(clientIdAtual());
  if (hash) {
    if (verificarSenha(senhaEnviada, hash)) { limparFalhas(ip); return next(); }
    registrarFalha(ip);
    return res.status(401).json({ erro: 'Senha do painel inválida ou não informada.' });
  }

  // Nenhuma senha configurada: bloqueia tudo até o dono criar a senha no assistente.
  return res.status(401).json({ erro: 'Painel ainda não configurado. Recarregue a página para criar a senha.' });
}

function criarApp() {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  // Assistente de 1º acesso: informa se o painel ainda precisa criar uma senha.
  app.get('/api/setup-status', (req, res) => {
    res.json({ precisaConfigurar: precisaConfigurarSenha() });
  });

  // Cria a senha do painel na primeira vez. Só funciona enquanto não houver senha definida
  // (nem no .env, nem no banco) — depois disso responde 403.
  app.post('/api/definir-senha', (req, res) => {
    if (PAINEL_SENHA) {
      return res.status(403).json({ erro: 'A senha já está definida pela variável PAINEL_SENHA no .env.' });
    }
    if (estabelecimentoRepo.buscarSenhaHash(clientIdAtual())) {
      return res.status(403).json({ erro: 'A senha do painel já foi configurada.' });
    }
    const senha = (req.body && req.body.senha) || '';
    if (String(senha).length < 4) {
      return res.status(400).json({ erro: 'A senha precisa ter pelo menos 4 caracteres.' });
    }
    estabelecimentoRepo.definirSenhaHash(clientIdAtual(), hashSenha(senha));
    res.json({ ok: true });
  });

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

  // Retorna uma ordem de serviço completa (usada na tela de OS / impressão).
  app.get('/api/servicos/:servicoId', autenticar, (req, res) => {
    const config = estabelecimentoAtual();
    const servico = servicosRepo.buscarPorId(config.id, Number(req.params.servicoId));
    if (!servico) return res.status(404).json({ erro: 'Serviço não encontrado.' });
    res.json(paraServicoApi(servico));
  });

  app.patch('/api/servicos/:servicoId/laudo', autenticar, (req, res) => {
    const config = estabelecimentoAtual();
    const laudo = (req.body && req.body.laudo) || '';
    const servico = servicosRepo.atualizarLaudo(config.id, Number(req.params.servicoId), String(laudo));
    res.json(paraServicoApi(servico));
  });

  app.patch('/api/servicos/:servicoId/status', autenticar, (req, res) => {
    const config = estabelecimentoAtual();
    const { status } = req.body || {};
    const statusValidos = ['em_analise', 'em_manutencao', 'aguardando_peca', 'concluido'];
    if (!statusValidos.includes(status)) {
      return res.status(400).json({ erro: `Status inválido. Use um de: ${statusValidos.join(', ')}` });
    }
    const id = Number(req.params.servicoId);
    const anterior = servicosRepo.buscarPorId(config.id, id);
    const servico = servicosRepo.atualizarStatus(config.id, id, status);

    // Só notifica se o status realmente mudou (evita mensagem repetida ao cliente).
    if (anterior && anterior.status !== status) {
      notificador.notificarStatusServico(servico, config).catch(() => {});
    }
    res.json(paraServicoApi(servico));
  });

  app.patch('/api/servicos/:servicoId/retirado', autenticar, (req, res) => {
    const config = estabelecimentoAtual();
    const { retirado } = req.body || {};
    const servico = servicosRepo.marcarRetirado(config.id, Number(req.params.servicoId), !!retirado);
    res.json(paraServicoApi(servico));
  });

  app.patch('/api/servicos/:servicoId/data-prevista', autenticar, (req, res) => {
    const config = estabelecimentoAtual();
    const { dataPrevista } = req.body || {};
    const servico = servicosRepo.atualizarDataPrevista(config.id, Number(req.params.servicoId), dataPrevista || null);
    res.json(paraServicoApi(servico));
  });

  app.get('/api/servicos-catalogo', autenticar, (req, res) => {
    const config = estabelecimentoAtual();
    res.json(servicosCatalogoRepo.listarServicos(config.id).map(paraItemApi));
  });

  app.post('/api/servicos-catalogo', autenticar, (req, res) => {
    const config = estabelecimentoAtual();
    const { nome, descricao, preco, disponivel } = req.body || {};
    if (!nome) return res.status(400).json({ erro: 'Nome do serviço é obrigatório.' });

    const servico = servicosCatalogoRepo.criarServico(config.id, {
      nome,
      descricao,
      precoCentavos: preco === '' || preco === undefined ? null : paraCentavos(preco),
      disponivel
    });
    res.status(201).json(paraItemApi(servico));
  });

  app.put('/api/servicos-catalogo/:servicoId', autenticar, (req, res) => {
    const config = estabelecimentoAtual();
    const { nome, descricao, preco, disponivel } = req.body || {};
    try {
      const servico = servicosCatalogoRepo.atualizarServico(config.id, Number(req.params.servicoId), {
        nome,
        descricao,
        precoCentavos: preco !== undefined ? (preco === '' ? null : paraCentavos(preco)) : undefined,
        disponivel
      });
      res.json(paraItemApi(servico));
    } catch (err) {
      res.status(404).json({ erro: err.message });
    }
  });

  app.delete('/api/servicos-catalogo/:servicoId', autenticar, (req, res) => {
    const config = estabelecimentoAtual();
    servicosCatalogoRepo.removerServico(config.id, Number(req.params.servicoId));
    res.status(204).end();
  });

  // Combina pedidos (produtos) e serviços agendados (manutenção) numa única lista cronológica,
  // para a aba "Pedidos e Agendamentos" do painel.
  app.get('/api/atendimentos', autenticar, (req, res) => {
    const config = estabelecimentoAtual();

    const pedidos = pedidosRepo.listarPedidos(config.id).map((pedido) => ({
      tipo: 'produto',
      id: pedido.id,
      cliente_nome: pedido.cliente_nome,
      telefone: pedido.telefone,
      descricao: JSON.parse(pedido.itens_json || '[]').map((i) => `${i.quantidade}x ${i.nome}`).join(', '),
      valor_reais: (pedido.total_centavos / 100).toFixed(2),
      status: pedido.status,
      criado_em: pedido.criado_em
    }));

    const servicos = servicosRepo.listarServicos(config.id).map((servico) => ({
      tipo: 'servico',
      id: servico.id,
      protocolo: formatarProtocolo(servico.id),
      cliente_nome: servico.cliente_nome,
      telefone: servico.telefone,
      descricao: `${servico.aparelho} — ${servico.servico}`,
      valor_reais: servico.preco_centavos !== null ? (servico.preco_centavos / 100).toFixed(2) : null,
      status: servico.status,
      retirado: !!servico.retirado,
      criado_em: servico.criado_em
    }));

    const combinado = [...pedidos, ...servicos].sort((a, b) => (a.criado_em < b.criado_em ? 1 : -1));
    res.json(combinado);
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
    plano: config.plano,
    rotulo_catalogo: config.rotulo_catalogo
  };
}

function paraCentavos(preco) {
  const valor = typeof preco === 'string' ? preco.replace(',', '.') : preco;
  return Math.round(parseFloat(valor || 0) * 100);
}

function paraItemApi(item) {
  const temPreco = item.preco_centavos !== null && item.preco_centavos !== undefined;
  return { ...item, preco_reais: temPreco ? (item.preco_centavos / 100).toFixed(2) : '' };
}

function paraServicoApi(servico) {
  const temPreco = servico.preco_centavos !== null && servico.preco_centavos !== undefined;
  return {
    ...servico,
    protocolo: formatarProtocolo(servico.id),
    preco_reais: temPreco ? (servico.preco_centavos / 100).toFixed(2) : ''
  };
}

function iniciarPainel() {
  const porta = process.env.PORT || process.env.PAINEL_PORT || 3000;
  // Por padrão o painel escuta SÓ no próprio computador (127.0.0.1) — ninguém na rede Wi-Fi
  // alcança. Para liberar o acesso de outros aparelhos na rede de propósito, defina
  // PAINEL_HOST=0.0.0.0 no .env (ciente de que aí a senha trafega sem HTTPS na rede local).
  const host = process.env.PAINEL_HOST || '127.0.0.1';
  const app = criarApp();
  app.listen(porta, host, () => {
    const ondeAcessar = host === '127.0.0.1' ? 'http://localhost' : `http://${host}`;
    console.log(`\n🖥️  Painel administrativo disponível em ${ondeAcessar}:${porta}`);
    if (host === '127.0.0.1') {
      console.log('   (acessível apenas neste computador — mais seguro)\n');
    } else {
      console.log('   ⚠️  Aberto para a rede local (PAINEL_HOST). Use uma senha forte.\n');
    }
  });
  return app;
}

module.exports = { criarApp, iniciarPainel };

if (require.main === module) {
  iniciarPainel();
}
