const sessoesRepo = require('../database/sessoesRepo');
const pedidosRepo = require('../database/pedidosRepo');
const pedidoFlow = require('./pedidoFlow');
const manutencaoFlow = require('./manutencaoFlow');
const statusFlow = require('./statusFlow');
const { montarMenu, extrairOpcao } = require('../utils/formatador');

async function processarMensagem(telefone, texto, config) {
  const sessao = sessoesRepo.obterSessao(config.id, telefone);
  const opcaoDigitada = extrairOpcao(texto);

  // Palavras que reiniciam o atendimento
  const palavrasReinicio = ['menu', 'início', 'inicio', 'oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'hello', 'hi'];
  if (palavrasReinicio.some(p => texto.trim().toLowerCase().startsWith(p))) {
    sessoesRepo.resetarSessao(config.id, telefone);
    return await exibirMenuPrincipal(telefone, config);
  }

  switch (sessao.estado) {
    case 'inicio':
      return await exibirMenuPrincipal(telefone, config);

    case 'menu_principal':
      return await processarMenuPrincipal(telefone, opcaoDigitada, config);

    case 'submenu':
      return await processarSubmenu(telefone, opcaoDigitada, sessao.dados.submenu_atual, config);

    case 'aguardando_dados':
      return await processarColeta(telefone, texto, sessao.dados, config);

    case 'pedido_selecionando':
      return pedidoFlow.processarSelecao(telefone, texto, sessao.dados, config);

    case 'pedido_aguardando_nome':
      return pedidoFlow.processarNomeEFinalizar(telefone, texto, sessao.dados, config);

    case 'manutencao_nome':
      return manutencaoFlow.processarNome(telefone, texto, sessao.dados, config);

    case 'manutencao_aparelho':
      return manutencaoFlow.processarAparelho(telefone, texto, sessao.dados, config);

    case 'manutencao_servico':
      return manutencaoFlow.processarServicoEFinalizar(telefone, texto, sessao.dados, config);

    case 'consultando_status':
      return statusFlow.processarConsulta(telefone, texto, config);

    default:
      sessoesRepo.resetarSessao(config.id, telefone);
      return await exibirMenuPrincipal(telefone, config);
  }
}

async function exibirMenuPrincipal(telefone, config) {
  const menu = config.menu_principal;
  const texto = montarMenu(
    `${config.saudacao}\n\n${menu.titulo}`,
    menu.opcoes
  );
  sessoesRepo.salvarSessao(config.id, telefone, 'menu_principal');
  return texto;
}

async function processarMenuPrincipal(telefone, opcao, config) {
  const menu = config.menu_principal;
  const item = menu.opcoes.find(o => o.numero === opcao);

  if (!item) {
    return `Opção inválida. Por favor, escolha uma das opções abaixo:\n\n${montarMenu(menu.titulo, menu.opcoes)}`;
  }

  return await executarAcao(telefone, item, config);
}

async function processarSubmenu(telefone, opcao, nomeSubmenu, config) {
  const submenu = config.submenus[nomeSubmenu];
  if (!submenu) {
    sessoesRepo.resetarSessao(config.id, telefone);
    return await exibirMenuPrincipal(telefone, config);
  }

  const item = submenu.opcoes.find(o => o.numero === opcao);

  if (!item) {
    const texto = montarMenu(submenu.titulo, submenu.opcoes, submenu.mensagem_fixa);
    return `Opção inválida. Por favor, escolha uma das opções:\n\n${texto}`;
  }

  return await executarAcao(telefone, item, config);
}

async function executarAcao(telefone, item, config) {
  switch (item.acao) {
    case 'mensagem': {
      sessoesRepo.salvarSessao(config.id, telefone, 'menu_principal');
      return `${item.mensagem}\n\n_Digite *menu* para voltar ao início._`;
    }

    case 'submenu': {
      const submenu = config.submenus[item.submenu];
      if (!submenu) {
        return 'Seção não encontrada. Digite *menu* para voltar.';
      }
      sessoesRepo.salvarSessao(config.id, telefone, 'submenu', { submenu_atual: item.submenu });
      return montarMenu(submenu.titulo, submenu.opcoes, submenu.mensagem_fixa);
    }

    case 'menu_principal': {
      return await exibirMenuPrincipal(telefone, config);
    }

    case 'coletar_dados': {
      sessoesRepo.salvarSessao(config.id, telefone, 'aguardando_dados', {
        servico: item.servico,
        submenu_atual: null
      });
      return item.mensagem_coleta;
    }

    case 'cardapio': {
      return pedidoFlow.iniciarPedido(telefone, config);
    }

    case 'manutencao': {
      return manutencaoFlow.iniciarManutencao(telefone, config);
    }

    case 'consultar_status': {
      return statusFlow.iniciarConsultaStatus(telefone, config);
    }

    case 'transferir': {
      sessoesRepo.resetarSessao(config.id, telefone);
      return `${item.mensagem}\n\n_Número do atendente: ${config.numero_atendente}_`;
    }

    default:
      return 'Ação desconhecida. Digite *menu* para recomeçar.';
  }
}

async function processarColeta(telefone, texto, dados, config) {
  // Salva o agendamento com os dados que o usuário enviou
  const partes = texto.split(',');
  const nome = partes[0] ? partes[0].trim() : texto.trim();
  const dataHora = partes[1] ? partes[1].trim() : 'A definir';

  pedidosRepo.criarPedido(config.id, {
    telefone,
    clienteNome: nome,
    tipo: 'agendamento',
    itens: [{ nome: dados.servico, quantidade: 1, precoCentavos: 0, observacao: dataHora }],
    totalCentavos: 0
  });
  sessoesRepo.resetarSessao(config.id, telefone);

  return (
    `✅ *Solicitação recebida!*\n\n` +
    `👤 *Nome:* ${nome}\n` +
    `💈 *Serviço:* ${dados.servico}\n` +
    `📅 *Preferência:* ${dataHora}\n\n` +
    `Nossa equipe vai confirmar seu agendamento em breve! 😊\n\n` +
    `_Digite *menu* para voltar ao início._`
  );
}

module.exports = { processarMensagem };
