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

// Rótulo usado quando o cliente não sabe o problema e pede uma análise/diagnóstico.
const OPCAO_ANALISE = 'Análise / Diagnóstico';

function montarPerguntaServico(config) {
  const servicos = servicosCatalogoRepo.listarServicos(config.id, { somenteDisponiveis: true });
  if (servicos.length === 0) {
    return 'Qual *serviço* você precisa? (ex: troca de tela, formatação, upgrade de SSD...)\n\nSe não souber o que é, escreva *análise* que nossa equipe identifica o problema.';
  }

  let texto = 'Qual serviço você precisa?\n\n';
  servicos.forEach((servico, index) => {
    texto += `${index + 1} — ${servico.nome}`;
    if (servico.preco_centavos !== null) texto += ` — ${formatarPreco(servico.preco_centavos)}`;
    texto += '\n';
  });
  // Opção extra sempre disponível: cliente que não sabe o problema pede uma análise.
  texto += `${servicos.length + 1} — 🔍 Não sei o problema (fazer uma análise)\n`;
  texto += '\nDigite o *número* da opção, ou descreva o serviço se não estiver na lista.';
  return texto;
}

// Passo 1: registra o serviço escolhido na sessão e pergunta a descrição do problema.
function processarServico(telefone, texto, dados, config) {
  const entrada = texto.trim();
  const servicosDisponiveis = servicosCatalogoRepo.listarServicos(config.id, { somenteDisponiveis: true });

  const indice = parseInt(entrada, 10);
  let nomeServico;
  let precoCentavos = null;

  if (!isNaN(indice) && indice >= 1 && indice <= servicosDisponiveis.length) {
    const escolhido = servicosDisponiveis[indice - 1];
    nomeServico = escolhido.nome;
    precoCentavos = escolhido.preco_centavos;
  } else if (!isNaN(indice) && indice === servicosDisponiveis.length + 1) {
    // Última opção da lista = análise/diagnóstico.
    nomeServico = OPCAO_ANALISE;
  } else if (/^an[aá]lise$/i.test(entrada)) {
    nomeServico = OPCAO_ANALISE;
  } else {
    // Texto livre: o próprio cliente descreveu o serviço.
    nomeServico = entrada;
  }

  sessoesRepo.salvarSessao(config.id, telefone, 'manutencao_descricao', { ...dados, servico: nomeServico, precoCentavos });
  return 'Por último, *descreva rapidamente o problema* (ex: caiu água, não liga, está lento).\n\nSe preferir, digite *pular*.';
}

// Passo 2: guarda a descrição do problema e finaliza o registro.
function processarDescricaoEFinalizar(telefone, texto, dados, config) {
  const entrada = texto.trim();
  const descricaoProblema = /^pular$/i.test(entrada) ? '' : entrada;

  const registro = servicosRepo.criarServico(config.id, {
    telefone,
    clienteNome: dados.clienteNome,
    aparelho: dados.aparelho,
    servico: dados.servico,
    precoCentavos: dados.precoCentavos,
    descricaoProblema
  });

  sessoesRepo.resetarSessao(config.id, telefone);

  const protocolo = formatarProtocolo(registro.id);
  let resposta =
    `✅ *Seu serviço foi registrado!*\n\n` +
    `🔖 *Número de protocolo:* ${protocolo}\n` +
    `👤 *Nome:* ${dados.clienteNome}\n` +
    `📱 *Aparelho:* ${dados.aparelho}\n` +
    `🔧 *Serviço:* ${dados.servico}\n`;

  if (descricaoProblema) {
    resposta += `📝 *Problema:* ${descricaoProblema}\n`;
  }
  if (dados.precoCentavos !== null && dados.precoCentavos !== undefined) {
    resposta += `💰 *Valor estimado:* ${formatarPreco(dados.precoCentavos)}\n`;
  }

  resposta +=
    `📋 *Status:* Em análise\n\n` +
    `Guarde o protocolo ${protocolo} para consultar o status depois. Digite *menu* para voltar ao início.`;

  return resposta;
}

function formatarProtocolo(id) {
  return `#${String(id).padStart(4, '0')}`;
}

module.exports = { iniciarManutencao, processarNome, processarAparelho, processarServico, processarDescricaoEFinalizar, formatarProtocolo };
