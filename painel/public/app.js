const STORAGE_KEY = 'gaspy_painel_senha';

function senhaAtual() {
  return localStorage.getItem(STORAGE_KEY) || '';
}

async function chamarApi(caminho, opcoes = {}) {
  const resposta = await fetch(caminho, {
    ...opcoes,
    headers: {
      'Content-Type': 'application/json',
      'x-painel-senha': senhaAtual(),
      ...(opcoes.headers || {})
    }
  });
  if (resposta.status === 401) {
    localStorage.removeItem(STORAGE_KEY);
    mostrarTelaLogin('Sessão expirada. Informe a senha novamente.');
    throw new Error('Não autenticado');
  }
  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => ({}));
    throw new Error(corpo.erro || `Erro ${resposta.status}`);
  }
  if (resposta.status === 204) return null;
  return resposta.json();
}

function esc(texto) {
  const div = document.createElement('div');
  div.textContent = texto === undefined || texto === null ? '' : String(texto);
  return div.innerHTML;
}

function linhaVazia(colunas, mensagem) {
  return `<tr class="linha-vazia"><td colspan="${colunas}">${esc(mensagem)}</td></tr>`;
}

function mostrarTelaLogin(mensagemErro) {
  document.getElementById('tela-login').classList.remove('oculto');
  document.getElementById('tela-app').classList.add('oculto');
  document.getElementById('erro-login').textContent = mensagemErro || '';
}

function mostrarTelaApp() {
  document.getElementById('tela-login').classList.add('oculto');
  document.getElementById('tela-app').classList.remove('oculto');
  carregarCardapio();
  carregarPedidos();
  carregarServicos();
  carregarConfig();
}

document.getElementById('btn-entrar').addEventListener('click', async () => {
  const senha = document.getElementById('input-senha').value;
  localStorage.setItem(STORAGE_KEY, senha);
  try {
    await chamarApi('/api/config');
    mostrarTelaApp();
  } catch {
    mostrarTelaLogin('Senha incorreta.');
  }
});

document.getElementById('btn-sair').addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  document.getElementById('input-senha').value = '';
  mostrarTelaLogin();
});

document.querySelectorAll('.aba-btn').forEach((botao) => {
  botao.addEventListener('click', () => {
    document.querySelectorAll('.aba-btn').forEach((b) => b.classList.remove('ativo'));
    document.querySelectorAll('.aba').forEach((a) => a.classList.add('oculto'));
    botao.classList.add('ativo');
    document.getElementById(`aba-${botao.dataset.aba}`).classList.remove('oculto');
  });
});

// ---------- Cardápio ----------

async function carregarCardapio() {
  const itens = await chamarApi('/api/cardapio');
  const corpo = document.querySelector('#tabela-cardapio tbody');

  if (itens.length === 0) {
    corpo.innerHTML = linhaVazia(7, 'Nenhum item cadastrado ainda. Adicione o primeiro logo acima! 👆');
    return;
  }

  corpo.innerHTML = '';
  itens.forEach((item) => {
    const linha = document.createElement('tr');
    linha.innerHTML = `
      <td>${esc(item.categoria)}</td>
      <td>${esc(item.nome)}</td>
      <td>${esc(item.descricao)}</td>
      <td>${esc(item.preco_reais)}</td>
      <td><input type="number" min="0" class="input-estoque" data-id="${item.id}" value="${item.estoque === null ? '' : esc(item.estoque)}" placeholder="—"></td>
      <td><input type="checkbox" ${item.disponivel ? 'checked' : ''} data-id="${item.id}" class="toggle-disponivel"></td>
      <td><button class="excluir" data-id="${item.id}">Excluir</button></td>
    `;
    corpo.appendChild(linha);
  });

  corpo.querySelectorAll('.toggle-disponivel').forEach((checkbox) => {
    checkbox.addEventListener('change', async () => {
      await chamarApi(`/api/cardapio/${checkbox.dataset.id}`, {
        method: 'PUT',
        body: JSON.stringify({ disponivel: checkbox.checked })
      });
    });
  });

  corpo.querySelectorAll('.input-estoque').forEach((input) => {
    input.addEventListener('change', async () => {
      await chamarApi(`/api/cardapio/${input.dataset.id}`, {
        method: 'PUT',
        body: JSON.stringify({ estoque: input.value === '' ? null : Number(input.value) })
      });
    });
  });

  corpo.querySelectorAll('.excluir').forEach((botao) => {
    botao.addEventListener('click', async () => {
      if (!confirm('Excluir este item do cardápio?')) return;
      await chamarApi(`/api/cardapio/${botao.dataset.id}`, { method: 'DELETE' });
      carregarCardapio();
    });
  });
}

document.getElementById('form-novo-item').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const dados = Object.fromEntries(new FormData(evento.target).entries());
  await chamarApi('/api/cardapio', { method: 'POST', body: JSON.stringify(dados) });
  evento.target.reset();
  carregarCardapio();
});

// ---------- Pedidos ----------

const STATUS_PEDIDO = {
  pendente: 'Pendente',
  pago: 'Pago',
  cancelado: 'Cancelado',
  concluido: 'Concluído'
};

const CORES_STATUS = {
  pendente: { bg: '#fef9c3', cor: '#854d0e' },
  em_analise: { bg: '#fef9c3', cor: '#854d0e' },
  pago: { bg: '#dcfce7', cor: '#15803d' },
  concluido: { bg: '#dcfce7', cor: '#15803d' },
  cancelado: { bg: '#fee2e2', cor: '#b91c1c' },
  em_manutencao: { bg: '#dbeafe', cor: '#1d4ed8' },
  aguardando_peca: { bg: '#ffedd5', cor: '#c2410c' }
};

function colorirStatus(select) {
  const cor = CORES_STATUS[select.value] || { bg: '#f4f6f8', cor: '#1f2933' };
  select.style.backgroundColor = cor.bg;
  select.style.color = cor.cor;
}

async function carregarPedidos() {
  const pedidos = await chamarApi('/api/pedidos');
  const corpo = document.querySelector('#tabela-pedidos tbody');

  if (pedidos.length === 0) {
    corpo.innerHTML = linhaVazia(7, 'Nenhum pedido recebido ainda. Assim que um cliente comprar pelo WhatsApp, ele aparece aqui.');
    return;
  }

  corpo.innerHTML = '';
  pedidos.forEach((pedido) => {
    const descricaoItens = pedido.itens.map((i) => `${i.quantidade}x ${i.nome}`).join(', ');
    const linha = document.createElement('tr');
    linha.innerHTML = `
      <td>#${pedido.id}</td>
      <td>${esc(pedido.cliente_nome)}</td>
      <td>${esc(pedido.telefone)}</td>
      <td>${esc(descricaoItens)}</td>
      <td>${esc(pedido.total_reais)}</td>
      <td>
        <select class="status" data-id="${pedido.id}">
          ${Object.entries(STATUS_PEDIDO).map(([valor, rotulo]) => `<option value="${valor}" ${valor === pedido.status ? 'selected' : ''}>${rotulo}</option>`).join('')}
        </select>
      </td>
      <td>${esc(pedido.criado_em)}</td>
    `;
    corpo.appendChild(linha);
  });

  corpo.querySelectorAll('.status').forEach((select) => {
    colorirStatus(select);
    select.addEventListener('change', async () => {
      colorirStatus(select);
      await chamarApi(`/api/pedidos/${select.dataset.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: select.value })
      });
    });
  });
}

// ---------- Serviços agendados (manutenção) ----------

const STATUS_SERVICO = {
  em_analise: 'Em análise',
  em_manutencao: 'Em manutenção',
  aguardando_peca: 'Aguardando peça',
  concluido: 'Concluído'
};

async function carregarServicos() {
  const servicos = await chamarApi('/api/servicos');
  const corpo = document.querySelector('#tabela-servicos tbody');

  if (servicos.length === 0) {
    corpo.innerHTML = linhaVazia(8, 'Nenhuma solicitação de manutenção ainda. Elas aparecem aqui quando o cliente pedir pelo WhatsApp.');
    return;
  }

  corpo.innerHTML = '';
  servicos.forEach((servico) => {
    const linha = document.createElement('tr');
    linha.innerHTML = `
      <td>${esc(servico.protocolo)}</td>
      <td>${esc(servico.cliente_nome)}</td>
      <td>${esc(servico.telefone)}</td>
      <td>${esc(servico.aparelho)}</td>
      <td>${esc(servico.servico)}</td>
      <td>
        <select class="status-servico" data-id="${servico.id}">
          ${Object.entries(STATUS_SERVICO).map(([valor, rotulo]) => `<option value="${valor}" ${valor === servico.status ? 'selected' : ''}>${rotulo}</option>`).join('')}
        </select>
      </td>
      <td><input type="date" class="data-prevista" data-id="${servico.id}" value="${servico.data_prevista ? servico.data_prevista.slice(0, 10) : ''}"></td>
      <td>${esc(servico.data_inicio)}</td>
    `;
    corpo.appendChild(linha);
  });

  corpo.querySelectorAll('.status-servico').forEach((select) => {
    colorirStatus(select);
    select.addEventListener('change', async () => {
      colorirStatus(select);
      await chamarApi(`/api/servicos/${select.dataset.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: select.value })
      });
    });
  });

  corpo.querySelectorAll('.data-prevista').forEach((input) => {
    input.addEventListener('change', async () => {
      await chamarApi(`/api/servicos/${input.dataset.id}/data-prevista`, {
        method: 'PATCH',
        body: JSON.stringify({ dataPrevista: input.value || null })
      });
    });
  });
}

// ---------- Configurações ----------

async function carregarConfig() {
  const config = await chamarApi('/api/config');
  const form = document.getElementById('form-config');
  Object.keys(config).forEach((campo) => {
    if (form.elements[campo]) form.elements[campo].value = config[campo] || '';
  });
  aplicarRotuloCatalogo(config.rotulo_catalogo);
  aplicarNomeEstabelecimento(config.nome);
}

// O nome dessa seção é configurável (ex: "Cardápio" para um salão, "Loja de Acessórios" para uma
// assistência técnica) — reflete no botão da aba e no título assim que a config é carregada.
function aplicarRotuloCatalogo(rotulo) {
  if (!rotulo) return;
  document.getElementById('btn-aba-cardapio').textContent = rotulo;
  document.getElementById('titulo-cardapio').textContent = rotulo;
}

function aplicarNomeEstabelecimento(nome) {
  if (!nome) return;
  document.getElementById('nome-estabelecimento-header').textContent = nome;
}

document.getElementById('form-config').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const dados = Object.fromEntries(new FormData(evento.target).entries());
  const atualizado = await chamarApi('/api/config', { method: 'PUT', body: JSON.stringify(dados) });
  aplicarRotuloCatalogo(atualizado.rotulo_catalogo);
  aplicarNomeEstabelecimento(atualizado.nome);
  const aviso = document.getElementById('config-salvo');
  aviso.classList.remove('oculto');
  setTimeout(() => aviso.classList.add('oculto'), 2000);
});

// ---------- Inicialização ----------

if (senhaAtual()) {
  chamarApi('/api/config').then(mostrarTelaApp).catch(() => mostrarTelaLogin());
} else {
  mostrarTelaLogin();
}
