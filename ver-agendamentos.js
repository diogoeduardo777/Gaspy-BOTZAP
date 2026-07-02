require('dotenv').config();
const { listarAgendamentos } = require('./src/database/db');

const agendamentos = listarAgendamentos();

if (agendamentos.length === 0) {
  console.log('Nenhum agendamento registrado ainda.');
  process.exit(0);
}

console.log(`\n=== AGENDAMENTOS (${agendamentos.length} no total) ===\n`);

agendamentos.forEach((a, i) => {
  console.log(`#${i + 1}`);
  console.log(`  Nome:     ${a.nome}`);
  console.log(`  Serviço:  ${a.servico}`);
  console.log(`  Horário:  ${a.dataHora}`);
  console.log(`  Telefone: ${a.telefone}`);
  console.log(`  Recebido: ${a.criado_em}`);
  console.log('');
});
