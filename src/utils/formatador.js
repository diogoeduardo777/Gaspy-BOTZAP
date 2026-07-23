function montarMenu(titulo, opcoes, mensagemFixa) {
  let texto = `${titulo}\n\n`;

  if (mensagemFixa) {
    texto += `${mensagemFixa}\n\n`;
  }

  opcoes.forEach(opcao => {
    texto += `*${opcao.numero}* — ${opcao.label}\n`;
  });

  return texto.trim();
}

function normalizarTexto(texto) {
  return texto.trim().toLowerCase();
}

function extrairOpcao(texto) {
  const normalizado = normalizarTexto(texto);
  const match = normalizado.match(/^(\d+)/);
  return match ? match[1] : normalizado;
}

function formatarPreco(precoCentavos) {
  return `R$ ${(precoCentavos / 100).toFixed(2).replace('.', ',')}`;
}

// Mascara o telefone para uso em LOGS (console): mantém só os 4 últimos dígitos visíveis
// (ex: "5511999998888@c.us" -> "***8888"). Não usar para exibição ao dono no painel — lá o
// número completo é legítimo; isto é só para não espalhar dado pessoal em log (LGPD).
function mascararTelefone(telefone) {
  const digitos = String(telefone || '').replace(/\D/g, '');
  if (!digitos) return '***';
  return `***${digitos.slice(-4)}`;
}

module.exports = { montarMenu, normalizarTexto, extrairOpcao, formatarPreco, mascararTelefone };
