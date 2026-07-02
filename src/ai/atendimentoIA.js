// Atendimento do Plano Profissional: a IA conversa livremente com o cliente, responde dúvidas,
// sugere itens do cardápio (sempre buscado fresco do banco) e finaliza o pedido chamando a tool
// "registrar_pedido", reaproveitando a mesma geração de PIX do Plano Básico.
const cardapioRepo = require('../database/cardapioRepo');
const sessoesRepo = require('../database/sessoesRepo');
const groqClient = require('./groqClient');
const pedidoFlow = require('../flows/pedidoFlow');
const { formatarPreco } = require('../utils/formatador');

const HISTORICO_MAXIMO = 12;

const TOOL_REGISTRAR_PEDIDO = {
  type: 'function',
  function: {
    name: 'registrar_pedido',
    description: 'Registra o pedido do cliente assim que ele confirmar os itens e finalizar a compra.',
    parameters: {
      type: 'object',
      properties: {
        cliente_nome: { type: 'string', description: 'Nome do cliente' },
        itens: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              nome: { type: 'string', description: 'Nome do item exatamente como está no cardápio' },
              quantidade: { type: 'integer', description: 'Quantidade desse item' }
            },
            required: ['nome', 'quantidade']
          }
        }
      },
      required: ['cliente_nome', 'itens']
    }
  }
};

async function processarComIA(telefone, texto, config) {
  if (!process.env.GROQ_API_KEY) {
    return 'O atendimento com IA ainda não foi configurado (falta a chave da Groq). Peça ao responsável para configurá-la no arquivo .env.';
  }

  const sessao = sessoesRepo.obterSessao(config.id, telefone);
  const historico = sessao.dados.historico || [];
  historico.push({ role: 'user', content: texto });

  const cardapio = cardapioRepo.listarItens(config.id, { somenteDisponiveis: true });
  const mensagens = [
    { role: 'system', content: montarPromptSistema(config, cardapio) },
    ...historico.slice(-HISTORICO_MAXIMO)
  ];

  let respostaFinal;
  try {
    const primeiraResposta = await groqClient.chatCompletion({ messages: mensagens, tools: [TOOL_REGISTRAR_PEDIDO] });

    const chamadaFerramenta = (primeiraResposta.tool_calls || [])[0];
    if (chamadaFerramenta && chamadaFerramenta.function.name === 'registrar_pedido') {
      const resultadoPedido = executarRegistroDePedido(config, telefone, chamadaFerramenta, cardapio);

      // O código PIX nunca é enviado à IA nem depende dela: só o status (sucesso/motivo) volta
      // ao modelo para compor uma frase curta. A mensagem com o PIX é sempre anexada literal,
      // para garantir que o "Copia e Cola" chegue ao cliente sem risco de ser reescrito/corrompido.
      const segundaResposta = await groqClient.chatCompletion({
        messages: [
          ...mensagens,
          primeiraResposta,
          { role: 'tool', tool_call_id: chamadaFerramenta.id, content: JSON.stringify({ sucesso: resultadoPedido.sucesso, motivo: resultadoPedido.motivo }) }
        ]
      });

      respostaFinal = resultadoPedido.sucesso
        ? `${segundaResposta.content}\n\n${resultadoPedido.mensagemParaCliente}`
        : segundaResposta.content;
    } else {
      respostaFinal = primeiraResposta.content;
    }
  } catch (err) {
    console.error('Erro ao consultar a IA (Groq):', err.message);
    return 'Desculpe, tive um problema para pensar na resposta agora. Pode tentar novamente em instantes?';
  }

  historico.push({ role: 'assistant', content: respostaFinal });
  sessoesRepo.salvarSessao(config.id, telefone, 'ia_conversando', { historico: historico.slice(-HISTORICO_MAXIMO) });

  return respostaFinal;
}

function montarPromptSistema(config, cardapio) {
  const listaCardapio = cardapio.length > 0
    ? cardapio.map((item) => `- ${item.nome} (${item.categoria}) — ${formatarPreco(item.preco_centavos)}${item.descricao ? `: ${item.descricao}` : ''}`).join('\n')
    : '(nenhum item cadastrado no momento)';

  return `Você é a assistente virtual de atendimento do estabelecimento "${config.nome_empresa}" via WhatsApp.
Horário de atendimento: ${config.horario_atendimento || 'não informado'}.
Seja simpática, objetiva e use no máximo 2 parágrafos curtos por resposta.
Responda dúvidas do cliente e sugira itens do cardápio abaixo quando fizer sentido.
Cardápio disponível (nomes exatos a usar ao registrar um pedido):
${listaCardapio}

Quando o cliente confirmar o que quer comprar, chame a ferramenta "registrar_pedido" com o nome do
cliente e os itens exatamente como aparecem no cardápio. Não invente itens fora dessa lista.`;
}

function executarRegistroDePedido(config, telefone, chamadaFerramenta, cardapio) {
  let argumentos;
  try {
    argumentos = JSON.parse(chamadaFerramenta.function.arguments);
  } catch {
    return { sucesso: false, motivo: 'Argumentos inválidos enviados pela IA.' };
  }

  const carrinho = (argumentos.itens || []).map((itemPedido) => {
    const itemCardapio = cardapio.find((i) => i.nome.toLowerCase() === String(itemPedido.nome).toLowerCase());
    return {
      itemId: itemCardapio ? itemCardapio.id : null,
      nome: itemCardapio ? itemCardapio.nome : itemPedido.nome,
      precoCentavos: itemCardapio ? itemCardapio.preco_centavos : 0,
      quantidade: Math.max(1, parseInt(itemPedido.quantidade, 10) || 1)
    };
  }).filter((item) => item.itemId !== null);

  if (carrinho.length === 0) {
    return { sucesso: false, motivo: 'Nenhum item reconhecido do cardápio atual.' };
  }

  const mensagemParaCliente = pedidoFlow.criarPedidoComPix(config, telefone, argumentos.cliente_nome || 'Cliente', carrinho);
  return { sucesso: true, mensagemParaCliente };
}

module.exports = { processarComIA };
