// Fluxo de pedido do Plano Básico: cliente escolhe itens do cardápio (armazenado no SQLite),
// monta um carrinho e recebe o PIX Copia e Cola com o valor exato ao finalizar.
const cardapioRepo = require('../database/cardapioRepo');
const pedidosRepo = require('../database/pedidosRepo');
const sessoesRepo = require('../database/sessoesRepo');
const { gerarPixCopiaECola } = require('../pix/gerarPixCopiaECola');
const { formatarPreco } = require('../utils/formatador');

function iniciarPedido(telefone, config) {
  sessoesRepo.salvarSessao(config.id, telefone, 'pedido_selecionando', { carrinho: [] });
  return montarMensagemCardapio(config, []);
}

function montarMensagemCardapio(config, carrinho) {
  const itens = cardapioRepo.listarItens(config.id, { somenteDisponiveis: true });
  if (itens.length === 0) {
    return `No momento não há itens disponíveis em ${config.rotulo_catalogo}. Digite *menu* para voltar.`;
  }

  let texto = `*${config.rotulo_catalogo} — ${config.nome_empresa}*\n`;
  let categoriaAtual = null;
  itens.forEach((item, index) => {
    if (item.categoria !== categoriaAtual) {
      categoriaAtual = item.categoria;
      texto += `\n*${categoriaAtual}*\n`;
    }
    texto += `${index + 1} — ${item.nome} — ${formatarPreco(item.preco_centavos)}\n`;
  });

  texto += `\nDigite o *número do item* para adicionar (ex: *3* ou *2x3* para 2 unidades do item 3).`;
  if (carrinho.length > 0) {
    texto += `\n\n${montarResumoCarrinho(carrinho)}`;
  }
  texto += `\n\nDigite *fechar* para finalizar o pedido ou *menu* para cancelar.`;
  return texto;
}

function montarResumoCarrinho(carrinho) {
  let texto = '🧺 *Seu carrinho:*\n';
  let total = 0;
  carrinho.forEach((item) => {
    const subtotal = item.precoCentavos * item.quantidade;
    total += subtotal;
    texto += `${item.quantidade}x ${item.nome} — ${formatarPreco(subtotal)}\n`;
  });
  texto += `*Total: ${formatarPreco(total)}*`;
  return texto;
}

function processarSelecao(telefone, texto, dados, config) {
  const entrada = texto.trim().toLowerCase();
  const carrinho = dados.carrinho || [];

  if (entrada === 'fechar') {
    if (carrinho.length === 0) {
      return 'Seu carrinho está vazio. Escolha ao menos um item antes de fechar o pedido.';
    }
    sessoesRepo.salvarSessao(config.id, telefone, 'pedido_aguardando_nome', { carrinho });
    return 'Perfeito! Para finalizar, me informe seu *nome completo*:';
  }

  const match = entrada.match(/^(?:(\d+)x)?(\d+)$/);
  if (!match) {
    return `Não entendi. ${montarMensagemCardapio(config, carrinho)}`;
  }

  const quantidade = match[1] ? parseInt(match[1], 10) : 1;
  const indiceItem = parseInt(match[2], 10);
  const itens = cardapioRepo.listarItens(config.id, { somenteDisponiveis: true });
  const itemSelecionado = itens[indiceItem - 1];

  if (!itemSelecionado || quantidade <= 0) {
    return `Item inválido. ${montarMensagemCardapio(config, carrinho)}`;
  }

  const existente = carrinho.find((i) => i.itemId === itemSelecionado.id);
  if (existente) {
    existente.quantidade += quantidade;
  } else {
    carrinho.push({
      itemId: itemSelecionado.id,
      nome: itemSelecionado.nome,
      precoCentavos: itemSelecionado.preco_centavos,
      quantidade
    });
  }

  sessoesRepo.salvarSessao(config.id, telefone, 'pedido_selecionando', { carrinho });
  return montarMensagemCardapio(config, carrinho);
}

function processarNomeEFinalizar(telefone, texto, dados, config) {
  const clienteNome = texto.trim();
  const carrinho = dados.carrinho || [];

  sessoesRepo.resetarSessao(config.id, telefone);

  return criarPedidoComPix(config, telefone, clienteNome, carrinho);
}

// Reaproveitado pelo atendimento com IA (Plano Profissional) ao fechar um pedido.
function criarPedidoComPix(config, telefone, clienteNome, carrinho, tipo = 'pedido') {
  const totalCentavos = carrinho.reduce((soma, item) => soma + item.precoCentavos * item.quantidade, 0);

  const pedido = pedidosRepo.criarPedido(config.id, {
    telefone,
    clienteNome,
    tipo,
    itens: carrinho,
    totalCentavos,
    pixTxid: `PEDIDO${gerarTxidCurto(telefone)}`
  });

  let resposta = `✅ *Pedido #${pedido.id} recebido!*\n\n${montarResumoCarrinho(carrinho)}\n\n👤 *Nome:* ${clienteNome}\n`;

  if (config.chave_pix) {
    const pixCopiaECola = gerarPixCopiaECola({
      chavePix: config.chave_pix,
      nomeRecebedor: config.pix_nome_recebedor || config.nome_empresa,
      cidade: config.pix_cidade || 'SAO PAULO',
      valorCentavos: totalCentavos,
      txid: pedido.pix_txid
    });
    resposta += `\n💳 *Pagamento via PIX (Copia e Cola)* — copie o código abaixo no app do seu banco:\n${pixCopiaECola}\n\n_Após o pagamento, aguarde a confirmação do estabelecimento._`;
  } else {
    resposta += `\n_Nossa equipe vai entrar em contato para combinar o pagamento._`;
  }

  return resposta;
}

// Sufixo curto o bastante para não colidir em uso normal (não é criptográfico).
function gerarTxidCurto(telefone) {
  return `${telefone.replace(/\D/g, '').slice(-8)}${Math.floor(Math.random() * 1000)}`;
}

module.exports = { iniciarPedido, processarSelecao, processarNomeEFinalizar, criarPedidoComPix };
