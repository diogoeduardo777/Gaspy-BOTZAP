const { List } = require('whatsapp-web.js');
const { processarMensagem } = require('../flows');
const { carregarConfig } = require('../config/loader');
const logsRepo = require('../database/logsRepo');
const { mascararTelefone } = require('../utils/formatador');

// O que o cliente "respondeu": pode ser um clique num botão/linha de lista nativa OU um texto
// digitado. Como usamos o próprio NÚMERO da opção como id do botão/linha, os dois caminhos caem
// no mesmo lugar — o menu numérico por digitação continua funcionando em paralelo com os botões.
function textoRecebido(message) {
  return message.selectedButtonId || message.selectedRowId || message.body || '';
}

// Envia a resposta do bot. Se for um "menu" (objeto), tenta mandar como LISTA nativa do WhatsApp;
// se for texto, manda texto normal.
async function enviarResposta(message, resposta) {
  if (typeof resposta === 'string') {
    await message.reply(resposta);
    return;
  }

  // resposta é um menu: { tipo:'menu', texto, titulo, opcoes }
  // POR QUE O FALLBACK: a API não-oficial (whatsapp-web.js) nem sempre renderiza botões/listas —
  // dependendo da versão do WhatsApp do cliente, a lista simplesmente não aparece, ou o envio
  // lança erro. Por isso:
  //   1) o corpo da lista (resposta.texto) já traz o menu NUMERADO completo — se a lista não
  //      renderizar, o cliente ainda lê as opções e responde digitando o número;
  //   2) o id de cada linha é o número da opção — clicar = digitar o número;
  //   3) se o envio falhar, capturamos o erro e caímos para texto puro, sem derrubar o bot.
  try {
    const rows = resposta.opcoes.map((op) => ({ id: op.numero, title: `${op.numero} — ${op.label}` }));
    const secoes = [{ title: resposta.titulo || 'Opções', rows }];
    const lista = new List(resposta.texto, 'Ver opções', secoes, resposta.titulo || undefined);
    await message.reply(lista);
  } catch (err) {
    console.warn('[menu] Lista/botões nativos indisponíveis — enviando menu em texto:', err.message);
    await message.reply(resposta.texto);
  }
}

async function handleMessage(message) {
  // Ignora mensagens de grupos, broadcasts e do próprio bot
  if (message.from === 'status@broadcast') return;
  if (message.from.endsWith('@g.us')) return;
  if (message.fromMe) return;

  const telefone = message.from;
  const texto = textoRecebido(message);

  if (!texto.trim()) return;

  try {
    // Busca a configuração a cada mensagem: reflete edições feitas no painel sem reiniciar o bot.
    const config = carregarConfig();
    logsRepo.registrarMensagem(config.id, telefone, 'in', texto);

    const resposta = config.plano === 'profissional'
      ? await require('../ai/atendimentoIA').processarComIA(telefone, texto, config)
      : await processarMensagem(telefone, texto, config);

    if (resposta) {
      // Para o histórico, guarda o texto (seja resposta simples ou o corpo do menu).
      const textoLog = typeof resposta === 'string' ? resposta : resposta.texto;
      logsRepo.registrarMensagem(config.id, telefone, 'out', textoLog);
      await enviarResposta(message, resposta);
    }
  } catch (err) {
    // Telefone mascarado no log (LGPD): não expõe o número completo no console.
    console.error(`Erro ao processar mensagem de ${mascararTelefone(telefone)}:`, err.message);
    // O próprio reply de erro pode falhar (ex: página do WhatsApp caiu). Protege para o erro do
    // reply não borbulhar e derrubar o handler — o atendimento dos outros clientes continua.
    try {
      await message.reply('Ocorreu um erro. Por favor, tente novamente ou digite *menu*.');
    } catch (errReply) {
      console.error('Falha também ao enviar a mensagem de erro ao cliente:', errReply.message);
    }
  }
}

module.exports = { handleMessage };
