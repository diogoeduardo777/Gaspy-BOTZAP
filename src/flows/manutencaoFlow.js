// Fluxo de "Solicitar manutenção": coleta nome, aparelho e serviço, registra em
// servicos_agendados com status inicial "em_analise" e devolve o número de protocolo.
const servicosRepo = require('../database/servicosRepo');
const sessoesRepo = require('../database/sessoesRepo');

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
  return 'Qual *serviço* você precisa? (ex: troca de tela, formatação, upgrade de SSD...)';
}

function processarServicoEFinalizar(telefone, texto, dados, config) {
  const servico = texto.trim();

  const registro = servicosRepo.criarServico(config.id, {
    telefone,
    clienteNome: dados.clienteNome,
    aparelho: dados.aparelho,
    servico
  });

  sessoesRepo.resetarSessao(config.id, telefone);

  const protocolo = formatarProtocolo(registro.id);
  return (
    `✅ *Seu serviço foi registrado!*\n\n` +
    `🔖 *Número de protocolo:* ${protocolo}\n` +
    `👤 *Nome:* ${dados.clienteNome}\n` +
    `📱 *Aparelho:* ${dados.aparelho}\n` +
    `🔧 *Serviço:* ${servico}\n` +
    `📋 *Status:* Em análise\n\n` +
    `Guarde o protocolo ${protocolo} para consultar o status depois. Digite *menu* para voltar ao início.`
  );
}

function formatarProtocolo(id) {
  return `#${String(id).padStart(4, '0')}`;
}

module.exports = { iniciarManutencao, processarNome, processarAparelho, processarServicoEFinalizar, formatarProtocolo };
