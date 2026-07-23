// Catálogo central de TODAS as mensagens personalizáveis do bot.
//
// Cada mensagem tem uma "chave", um texto padrão e as variáveis que aceita. O dono personaliza
// pelo painel (aba "Mensagens"); o que ele não mexer continua usando o padrão daqui. As variáveis
// no formato {nome} são trocadas em tempo de execução (ex: {cliente}, {protocolo}).
//
// {loja} está sempre disponível em qualquer mensagem (nome do estabelecimento).

// Cada grupo declara em `tipos` para quais tipos de estabelecimento ele faz sentido. O painel usa
// isso para esconder na aba "Mensagens" o que não se aplica ao tipo atual (ex: uma lanchonete não
// vê os avisos de "aparelho pronto"). Esconder é só exibição — os textos personalizados de grupos
// escondidos continuam salvos no banco e voltam a aparecer se o tipo for trocado de novo.
const CATALOGO = [
  {
    grupo: 'Início',
    tipos: ['comida', 'assistencia', 'loja'],
    itens: [
      {
        chave: 'saudacao',
        rotulo: 'Saudação (primeira mensagem)',
        ajuda: 'Aparece no topo do menu, quando o cliente inicia a conversa.',
        variaveis: ['loja'],
        multilinha: true,
        padrao: 'Olá! Bem-vindo(a) 👋\nComo posso te ajudar hoje?'
      },
      {
        chave: 'opcao_invalida',
        rotulo: 'Quando o cliente foge das opções',
        ajuda: 'Empurrãozinho curto quando o cliente digita algo que não é uma opção. (Se ele insistir, o bot para de responder para não incomodar, até ele digitar "menu".)',
        variaveis: [],
        multilinha: false,
        padrao: 'Não entendi 🤔 Responda com o *número* de uma opção. Para ver o menu de novo, é só digitar *menu*.'
      }
    ]
  },
  {
    grupo: 'Solicitar serviço',
    tipos: ['assistencia'],
    itens: [
      {
        chave: 'manutencao_inicio',
        rotulo: 'Início da solicitação (pede o nome)',
        ajuda: 'Primeira mensagem ao escolher "Solicitar serviço".',
        variaveis: [],
        multilinha: true,
        padrao: 'Vamos registrar sua solicitação! 🔧\n\nQual é o seu *nome completo*?'
      },
      {
        chave: 'manutencao_pergunta_aparelho',
        rotulo: 'Pergunta do aparelho/item',
        ajuda: 'Depois do nome.',
        variaveis: [],
        multilinha: false,
        padrao: 'Qual o *tipo de aparelho*? (ex: celular, notebook, PC, tablet...)'
      },
      {
        chave: 'manutencao_pergunta_servico',
        rotulo: 'Introdução da escolha de serviço',
        ajuda: 'A lista de serviços cadastrados aparece logo abaixo deste texto.',
        variaveis: [],
        multilinha: false,
        padrao: 'Qual serviço você precisa?'
      },
      {
        chave: 'manutencao_opcao_analise',
        rotulo: 'Opção "não sei o problema"',
        ajuda: 'Última opção da lista de serviços, para quem quer só uma análise.',
        variaveis: [],
        multilinha: false,
        padrao: '🔍 Não sei o problema (fazer uma análise)'
      },
      {
        chave: 'manutencao_pergunta_descricao',
        rotulo: 'Pedido da descrição do problema',
        ajuda: 'Último passo antes de gerar o protocolo.',
        variaveis: [],
        multilinha: true,
        padrao: 'Por último, *descreva rapidamente o problema* (ex: caiu água, não liga, está lento).\n\nSe preferir, digite *pular*.'
      },
      {
        chave: 'manutencao_confirmacao_rodape',
        rotulo: 'Rodapé da confirmação (com o protocolo)',
        ajuda: 'Fecha a mensagem de confirmação do registro. Os dados (protocolo, aparelho...) aparecem acima automaticamente.',
        variaveis: ['protocolo'],
        multilinha: true,
        padrao: 'Guarde o protocolo {protocolo} para consultar o status depois. Digite *menu* para voltar ao início.'
      }
    ]
  },
  {
    grupo: 'Consultar status',
    tipos: ['assistencia'],
    itens: [
      {
        chave: 'status_pedir',
        rotulo: 'Pedido do protocolo/nome',
        ajuda: 'Ao escolher "Consultar status".',
        variaveis: [],
        multilinha: false,
        padrao: 'Para consultar o status, me informe o *número de protocolo* (ex: #0001) ou o seu *nome completo*:'
      },
      {
        chave: 'status_em_analise',
        rotulo: 'Status: Em análise',
        ajuda: 'Frase mostrada quando o serviço está "Em análise".',
        variaveis: [],
        multilinha: false,
        padrao: 'Sua solicitação está em análise.'
      },
      {
        chave: 'status_em_manutencao',
        rotulo: 'Status: Em manutenção',
        ajuda: '',
        variaveis: [],
        multilinha: false,
        padrao: 'Seu aparelho está em manutenção.'
      },
      {
        chave: 'status_aguardando_peca',
        rotulo: 'Status: Aguardando peça',
        ajuda: '',
        variaveis: [],
        multilinha: false,
        padrao: 'Estamos aguardando peça para continuar o serviço.'
      },
      {
        chave: 'status_concluido',
        rotulo: 'Status: Concluído',
        ajuda: '',
        variaveis: [],
        multilinha: false,
        padrao: 'Seu serviço foi concluído, pronto para retirada! 🎉'
      },
      {
        chave: 'status_nao_encontrado',
        rotulo: 'Serviço não encontrado',
        ajuda: 'Quando o protocolo/nome informado não bate com nenhum registro.',
        variaveis: [],
        multilinha: true,
        padrao: 'Não encontrei nenhum serviço com essas informações. Confira o protocolo ou o nome e tente novamente, ou digite *menu* para voltar.'
      }
    ]
  },
  {
    grupo: 'Loja / Pedidos',
    tipos: ['comida', 'assistencia', 'loja'],
    itens: [
      {
        chave: 'pedido_rodape',
        rotulo: 'Instrução do catálogo',
        ajuda: 'Aparece embaixo da lista de produtos, explicando como pedir.',
        variaveis: [],
        multilinha: true,
        padrao: 'Digite o *número do item* para adicionar (ex: *3* ou *2x3* para 2 unidades do item 3).'
      },
      {
        chave: 'pedido_pedir_nome',
        rotulo: 'Pedido do nome ao fechar',
        ajuda: 'Quando o cliente digita "fechar".',
        variaveis: [],
        multilinha: false,
        padrao: 'Perfeito! Para finalizar, me informe seu *nome completo*:'
      },
      {
        chave: 'pedido_pix_instrucao',
        rotulo: 'Instrução do pagamento PIX',
        ajuda: 'Texto antes do código PIX (o código em si é gerado automaticamente e não pode ser editado).',
        variaveis: [],
        multilinha: true,
        padrao: '💳 *Pagamento via PIX (Copia e Cola)* — copie o código abaixo no app do seu banco:'
      },
      {
        chave: 'pedido_pos_pix',
        rotulo: 'Mensagem após o código PIX',
        ajuda: 'Fecha a mensagem do pedido, depois do código PIX.',
        variaveis: [],
        multilinha: false,
        padrao: '_Após o pagamento, aguarde a confirmação do estabelecimento._'
      },
      {
        chave: 'pedido_aguardando_confirmacao',
        rotulo: 'Aviso de que o pedido aguarda confirmação',
        ajuda: 'Mostrado logo após o cliente fechar o pedido. Deixa claro que o pedido ainda NÃO foi aceito — a loja precisa confirmar.',
        variaveis: [],
        multilinha: false,
        padrao: '⏳ Recebemos seu pedido! Assim que a loja confirmar, te avisamos por aqui.'
      },
      {
        chave: 'pedido_aceito',
        rotulo: 'Aviso quando o dono ACEITA o pedido',
        ajuda: 'Enviado automaticamente quando você aceita um pedido no painel.',
        variaveis: ['loja', 'pedido'],
        multilinha: true,
        padrao: '✅ Seu pedido {pedido} foi *confirmado* pela loja! Já estamos cuidando dele. 😊'
      },
      {
        chave: 'pedido_recusado',
        rotulo: 'Aviso quando o dono RECUSA o pedido',
        ajuda: 'Enviado automaticamente quando você recusa um pedido no painel.',
        variaveis: ['loja', 'pedido'],
        multilinha: true,
        padrao: '😔 Sobre o pedido {pedido}: infelizmente não vamos conseguir atender desta vez. Qualquer dúvida, fale com a gente.'
      }
    ]
  },
  {
    grupo: 'Avisos automáticos (o bot manda sozinho)',
    tipos: ['assistencia'],
    itens: [
      {
        chave: 'aviso_status',
        rotulo: 'Aviso de mudança de status',
        ajuda: 'Enviado quando você muda o status de um serviço no painel.',
        variaveis: ['loja', 'protocolo', 'aparelho', 'servico', 'status'],
        multilinha: true,
        padrao: '🔧 *{loja}* — atualização do seu aparelho\n\n🔖 Protocolo: {protocolo}\n📱 Aparelho: {aparelho}\n🔧 Serviço: {servico}\n\n📋 {status}'
      },
      {
        chave: 'aviso_lembrete',
        rotulo: 'Lembrete de retirada',
        ajuda: 'Enviado automaticamente quando um serviço concluído não foi retirado.',
        variaveis: ['loja', 'protocolo', 'aparelho', 'servico'],
        multilinha: true,
        padrao: '🔔 *{loja}* — seu aparelho está te esperando!\n\n🔖 Protocolo: {protocolo}\n📱 {aparelho} ({servico})\n\nSeu aparelho já está *pronto para retirada*. Pode passar aqui para buscar! 😊'
      }
    ]
  }
];

// Mapa chave -> texto padrão (montado a partir do catálogo).
const MENSAGENS_PADRAO = {};
for (const grupo of CATALOGO) {
  for (const item of grupo.itens) MENSAGENS_PADRAO[item.chave] = item.padrao;
}

function substituirVariaveis(texto, variaveis) {
  return String(texto).replace(/\{(\w+)\}/g, (casamento, nome) => {
    if (Object.prototype.hasOwnProperty.call(variaveis, nome)) return variaveis[nome];
    return casamento; // deixa {desconhecido} como está
  });
}

// Retorna o texto de uma chave: usa o personalizado do dono se houver, senão o padrão; e troca
// as variáveis. `config` é o objeto do estabelecimento (tem .mensagens e .nome_empresa).
function resolverTexto(config, chave, variaveis = {}) {
  const personalizados = (config && config.mensagens) || {};
  const override = personalizados[chave];
  const base = (typeof override === 'string' && override.trim() !== '') ? override : (MENSAGENS_PADRAO[chave] || '');
  const vars = Object.assign({ loja: (config && config.nome_empresa) || '' }, variaveis);
  return substituirVariaveis(base, vars);
}

module.exports = { CATALOGO, MENSAGENS_PADRAO, resolverTexto };
