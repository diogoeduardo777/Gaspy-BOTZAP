// Agendador em segundo plano: verifica periodicamente serviços prontos (concluído) que o cliente
// ainda não buscou e envia lembretes de retirada, respeitando uma cadência (ex: 2 e 5 dias após a
// conclusão) e sem repetir. Depende do notificador (que só envia se o bot estiver conectado).
const estabelecimentoRepo = require('../database/estabelecimentoRepo');
const servicosRepo = require('../database/servicosRepo');
const notificador = require('./notificador');

// Dias após a conclusão em que cada lembrete é enviado. Configurável via LEMBRETE_RETIRADA_DIAS
// (ex: "2,5"). A quantidade de valores define quantos lembretes no total.
function diasLembrete() {
  const bruto = process.env.LEMBRETE_RETIRADA_DIAS || '2,5';
  const dias = bruto.split(',').map((d) => parseInt(d.trim(), 10)).filter((n) => !isNaN(n) && n >= 0);
  return dias.length ? dias : [2, 5];
}

function diasDesde(dataSqlite) {
  if (!dataSqlite) return 0;
  // datetime('now') do SQLite é UTC no formato "YYYY-MM-DD HH:MM:SS".
  const inicio = new Date(dataSqlite.replace(' ', 'T') + 'Z').getTime();
  if (isNaN(inicio)) return 0;
  return (Date.now() - inicio) / (1000 * 60 * 60 * 24);
}

async function verificarLembretes() {
  if (!notificador.notificacoesAtivas() || !notificador.estaPronto()) return;

  const clientId = process.env.CLIENT_ID || 'exemplo';
  const config = estabelecimentoRepo.buscarPorClientId(clientId);
  if (!config) return;

  const dias = diasLembrete();
  const pendentes = servicosRepo.listarPendentesRetirada(config.id);

  for (const servico of pendentes) {
    const jaEnviados = servico.lembretes_retirada || 0;
    if (jaEnviados >= dias.length) continue; // já mandou todos os lembretes previstos

    const limiarDias = dias[jaEnviados];
    if (diasDesde(servico.data_conclusao) >= limiarDias) {
      const enviou = await notificador.notificarLembreteRetirada(servico, config.nome_empresa);
      if (enviou) servicosRepo.registrarLembreteRetirada(config.id, servico.id);
    }
  }
}

function iniciarAgendador() {
  const intervaloMin = parseInt(process.env.AGENDADOR_INTERVALO_MIN || '60', 10) || 60;
  setInterval(() => {
    verificarLembretes().catch((err) => console.error('[agendador]', err.message));
  }, intervaloMin * 60 * 1000);
  console.log(`⏰ Agendador de lembretes de retirada ativo (verifica a cada ${intervaloMin} min).`);
}

module.exports = { iniciarAgendador, verificarLembretes };
