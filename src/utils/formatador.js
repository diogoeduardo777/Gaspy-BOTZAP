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

module.exports = { montarMenu, normalizarTexto, extrairOpcao, formatarPreco };
