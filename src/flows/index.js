const { obterSessao, salvarSessao, resetarSessao, salvarAgendamento } = require('../database/db');
const { montarMenu, extrairOpcao } = require('../utils/formatador');

async function processarMensagem(telefone, texto, config) {
  const sessao = obterSessao(telefone);
  const opcaoDigitada = extrairOpcao(texto);

  // Palavras que reiniciam o atendimento
  const palavrasReinicio = ['menu', 'início', 'inicio', 'oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'hello', 'hi'];
  if (palavrasReinicio.some(p => texto.trim().toLowerCase().startsWith(p))) {
    resetarSessao(telefone);
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

    default:
      resetarSessao(telefone);
      return await exibirMenuPrincipal(telefone, config);
  }
}

async function exibirMenuPrincipal(telefone, config) {
  const menu = config.menu_principal;
  const texto = montarMenu(
    `${config.saudacao}\n\n${menu.titulo}`,
    menu.opcoes
  );
  salvarSessao(telefone, 'menu_principal');
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
    resetarSessao(telefone);
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
      salvarSessao(telefone, 'menu_principal');
      return `${item.mensagem}\n\n_Digite *menu* para voltar ao início._`;
    }

    case 'submenu': {
      const submenu = config.submenus[item.submenu];
      if (!submenu) {
        return 'Seção não encontrada. Digite *menu* para voltar.';
      }
      salvarSessao(telefone, 'submenu', { submenu_atual: item.submenu });
      return montarMenu(submenu.titulo, submenu.opcoes, submenu.mensagem_fixa);
    }

    case 'menu_principal': {
      return await exibirMenuPrincipal(telefone, config);
    }

    case 'coletar_dados': {
      salvarSessao(telefone, 'aguardando_dados', {
        servico: item.servico,
        submenu_atual: null
      });
      return item.mensagem_coleta;
    }

    case 'transferir': {
      resetarSessao(telefone);
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

  salvarAgendamento(telefone, nome, dados.servico, dataHora);
  resetarSessao(telefone);

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
