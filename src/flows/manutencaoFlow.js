// Fluxo de "Solicitar manutenção": coleta nome, aparelho e serviço (escolhido do catálogo
// cadastrado no painel, quando existir), registra em servicos_agendados com status inicial
// "em_analise" e devolve o número de protocolo.
const servicosRepo = require('../database/servicosRepo');
const servicosCatalogoRepo = require('../database/servicosCatalogoRepo');
const sessoesRepo = require('../database/sessoesRepo');
const { formatarPreco } = require('../utils/formatador');

function iniciarManutencao(telefone, config) {
  sessoesRepo.salvarSessao(config.id, telefone, 'manutencao_nome', {});
  return 'Vamos registrar sua solicitação de manutenção! 🔧\n\nQual é o seu *nome completo*?';
}

function processarNome(telefone, texto, dados, config) {
  const clienteNome = texto.trim();
  sessoesRepo.salvarSessao(config.id, telefone, 'manutencao_aparelho', { ...dados, clienteNome });
  return 'Qual o *tipo de aparelho*? (ex: celular, notebook, PC, tablet...)';
}

function processarAparelho(telefone, texto, dados, config) {
  const aparelho = texto.trim();
  sessoesRepo.salvarSessao(config.id, telefone, 'manutencao_servico', { ...dados, aparelho });
  return montarPerguntaServico(config);
}

function montarPerguntaServico(config) {
  const servicos = servicosCatalogoRepo.listarServicos(config.id, { somenteDisponiveis: true });
  if (servicos.length === 0) {
    return 'Qual *serviço* você precisa? (ex: troca de tela, formatação, upgrade de SSD...)';
  }

  let texto = 'Qual serviço você precisa?\n\n';
  servicos.forEach((servico, index) => {
    texto += `${index + 1} — ${servico.nome}`;
    if (servico.preco_centavos !== null) texto += ` — ${formatarPreco(servico.preco_centavos)}`;
    texto += '\n';
  });
  texto += '\nDigite o *número* do serviço, ou descreva se não estiver na lista.';
  return texto;
}

function processarServicoEFinalizar(telefone, texto, dados, config) {
  const entrada = texto.trim();
  const servicosDisponiveis = servicosCatalogoRepo.listarServicos(config.id, { somenteDisponiveis: true });

  const indice = parseInt(entrada, 10);
  const escolhido = !isNaN(indice) ? servicosDisponiveis[indice - 1] : undefined;

  const nomeServico = escolhido ? escolhido.nome : entrada;
  const precoCentavos = escolhido ? escolhido.preco_centavos : null;

  const registro = servicosRepo.criarServico(config.id, {
    telefone,
    clienteNome: dados.clienteNome,
    aparelho: dados.aparelho,
    servico: nomeServico,
    precoCentavos
  });

  sessoesRepo.resetarSessao(config.id, telefone);

  const protocolo = formatarProtocolo(registro.id);
  let resposta =
    `✅ *Seu serviço foi registrado!*\n\n` +
    `🔖 *Número de protocolo:* ${protocolo}\n` +
    `👤 *Nome:* ${dados.clienteNome}\n` +
    `📱 *Aparelho:* ${dados.aparelho}\n` +
    `🔧 *Serviço:* ${nomeServico}\n`;

  if (precoCentavos !== null && precoCentavos !== undefined) {
    resposta += `💰 *Valor estimado:* ${formatarPreco(precoCentavos)}\n`;
  }

  resposta +=
    `📋 *Status:* Em análise\n\n` +
    `Guarde o protocolo ${protocolo} para consultar o status depois. Digite *menu* para voltar ao início.`;

  return resposta;
}

function formatarProtocolo(id) {
  return `#${String(id).padStart(4, '0')}`;
}

module.exports = { iniciarManutencao, processarNome, processarAparelho, processarServicoEFinalizar, formatarProtocolo };
