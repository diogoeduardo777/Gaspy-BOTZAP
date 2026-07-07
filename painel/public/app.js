const STORAGE_KEY = 'gaspy_painel_senha';
let configAtual = null; // guarda a config do estabelecimento (usada na impressão da OS)

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

function ocultarTodasAsTelas() {
  ['tela-setup', 'tela-login', 'tela-app'].forEach((id) => document.getElementById(id).classList.add('oculto'));
}

function mostrarTelaSetup(mensagemErro) {
  ocultarTodasAsTelas();
  document.getElementById('tela-setup').classList.remove('oculto');
  document.getElementById('erro-setup').textContent = mensagemErro || '';
}

function mostrarTelaLogin(mensagemErro) {
  ocultarTodasAsTelas();
  document.getElementById('tela-login').classList.remove('oculto');
  document.getElementById('erro-login').textContent = mensagemErro || '';
}

function mostrarTelaApp() {
  ocultarTodasAsTelas();
  document.getElementById('tela-app').classList.remove('oculto');
  carregarCardapio();
  carregarServicosCatalogo();
  carregarAtendimentos();
  carregarConfig();
}

document.getElementById('btn-criar-senha').addEventListener('click', async () => {
  const senha = document.getElementById('input-nova-senha').value;
  const confirma = document.getElementById('input-confirma-senha').value;
  if (senha.length < 4) {
    mostrarTelaSetup('A senha precisa ter pelo menos 4 caracteres.');
    return;
  }
  if (senha !== confirma) {
    mostrarTelaSetup('As senhas não conferem. Digite a mesma senha nos dois campos.');
    return;
  }
  const resposta = await fetch('/api/definir-senha', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ senha })
  });
  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => ({}));
    mostrarTelaSetup(corpo.erro || 'Não foi possível criar a senha.');
    return;
  }
  localStorage.setItem(STORAGE_KEY, senha);
  mostrarTelaApp();
});

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

// ---------- Cadastro de Serviços (tipos de manutenção oferecidos) ----------

async function carregarServicosCatalogo() {
  const servicos = await chamarApi('/api/servicos-catalogo');
  const corpo = document.querySelector('#tabela-servicos-catalogo tbody');

  if (servicos.length === 0) {
    corpo.innerHTML = linhaVazia(5, 'Nenhum serviço cadastrado ainda. Adicione o primeiro logo acima! 👆');
    return;
  }

  corpo.innerHTML = '';
  servicos.forEach((servico) => {
    const linha = document.createElement('tr');
    linha.innerHTML = `
      <td>${esc(servico.nome)}</td>
      <td>${esc(servico.descricao)}</td>
      <td>${esc(servico.preco_reais)}</td>
      <td><input type="checkbox" ${servico.disponivel ? 'checked' : ''} data-id="${servico.id}" class="toggle-servico-disponivel"></td>
      <td><button class="excluir" data-id="${servico.id}">Excluir</button></td>
    `;
    corpo.appendChild(linha);
  });

  corpo.querySelectorAll('.toggle-servico-disponivel').forEach((checkbox) => {
    checkbox.addEventListener('change', async () => {
      await chamarApi(`/api/servicos-catalogo/${checkbox.dataset.id}`, {
        method: 'PUT',
        body: JSON.stringify({ disponivel: checkbox.checked })
      });
    });
  });

  corpo.querySelectorAll('.excluir').forEach((botao) => {
    botao.addEventListener('click', async () => {
      if (!confirm('Excluir este serviço do cadastro?')) return;
      await chamarApi(`/api/servicos-catalogo/${botao.dataset.id}`, { method: 'DELETE' });
      carregarServicosCatalogo();
    });
  });
}

document.getElementById('form-novo-servico').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const dados = Object.fromEntries(new FormData(evento.target).entries());
  await chamarApi('/api/servicos-catalogo', { method: 'POST', body: JSON.stringify(dados) });
  evento.target.reset();
  carregarServicosCatalogo();
});

// ---------- Pedidos e Agendamentos (produtos comprados + manutenções solicitadas) ----------

const STATUS_PEDIDO = {
  pendente: 'Pendente',
  pago: 'Pago',
  cancelado: 'Cancelado',
  concluido: 'Concluído'
};

const STATUS_SERVICO = {
  em_analise: 'Em análise',
  em_manutencao: 'Em manutenção',
  aguardando_peca: 'Aguardando peça',
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

async function carregarAtendimentos() {
  const atendimentos = await chamarApi('/api/atendimentos');
  const corpo = document.querySelector('#tabela-atendimentos tbody');

  if (atendimentos.length === 0) {
    corpo.innerHTML = linhaVazia(9, 'Nada por aqui ainda. Pedidos de produtos e solicitações de manutenção aparecem nesta lista assim que chegarem pelo WhatsApp.');
    return;
  }

  corpo.innerHTML = '';
  atendimentos.forEach((item) => {
    const ehProduto = item.tipo === 'produto';
    const mapaStatus = ehProduto ? STATUS_PEDIDO : STATUS_SERVICO;
    const endpoint = ehProduto ? `/api/pedidos/${item.id}/status` : `/api/servicos/${item.id}/status`;
    const identificador = ehProduto ? `#${item.id}` : item.protocolo;

    // "Entregue?" só faz sentido para serviços (aparelho retirado pelo cliente).
    const celulaEntregue = ehProduto
      ? '<td>—</td>'
      : `<td><input type="checkbox" class="toggle-retirado" data-id="${item.id}" ${item.retirado ? 'checked' : ''}></td>`;

    // Serviços têm ordem de serviço (OS) imprimível — o protocolo vira um botão.
    const celulaId = ehProduto
      ? `<td>${esc(identificador)}</td>`
      : `<td><button class="abrir-os" data-id="${item.id}">${esc(identificador)} 📄</button></td>`;

    const linha = document.createElement('tr');
    linha.innerHTML = `
      <td>${ehProduto ? '🛍️ Produto' : '🔧 Serviço'}</td>
      ${celulaId}
      <td>${esc(item.cliente_nome)}</td>
      <td>${esc(item.telefone)}</td>
      <td>${esc(item.descricao)}</td>
      <td>${item.valor_reais === null ? '—' : esc(item.valor_reais)}</td>
      <td>
        <select class="status-atendimento" data-endpoint="${endpoint}">
          ${Object.entries(mapaStatus).map(([valor, rotulo]) => `<option value="${valor}" ${valor === item.status ? 'selected' : ''}>${rotulo}</option>`).join('')}
        </select>
      </td>
      ${celulaEntregue}
      <td>${esc(item.criado_em)}</td>
    `;
    corpo.appendChild(linha);
  });

  corpo.querySelectorAll('.status-atendimento').forEach((select) => {
    colorirStatus(select);
    select.addEventListener('change', async () => {
      colorirStatus(select);
      await chamarApi(select.dataset.endpoint, {
        method: 'PATCH',
        body: JSON.stringify({ status: select.value })
      });
    });
  });

  corpo.querySelectorAll('.toggle-retirado').forEach((checkbox) => {
    checkbox.addEventListener('change', async () => {
      await chamarApi(`/api/servicos/${checkbox.dataset.id}/retirado`, {
        method: 'PATCH',
        body: JSON.stringify({ retirado: checkbox.checked })
      });
    });
  });

  corpo.querySelectorAll('.abrir-os').forEach((botao) => {
    botao.addEventListener('click', () => abrirModalOS(botao.dataset.id));
  });
}

// ---------- Ordem de Serviço (OS) ----------

const STATUS_SERVICO_ROTULO = {
  em_analise: 'Em análise',
  em_manutencao: 'Em manutenção',
  aguardando_peca: 'Aguardando peça',
  concluido: 'Concluído'
};

let osAtual = null; // OS aberta no modal

async function abrirModalOS(id) {
  const os = await chamarApi(`/api/servicos/${id}`);
  osAtual = os;

  document.getElementById('os-protocolo').textContent = os.protocolo;
  document.getElementById('os-cliente').textContent = os.cliente_nome || '';
  document.getElementById('os-telefone').textContent = os.telefone || '';
  document.getElementById('os-aparelho').textContent = os.aparelho || '';
  document.getElementById('os-servico').textContent = os.servico || '';
  document.getElementById('os-valor').textContent = os.preco_reais ? `R$ ${os.preco_reais}` : 'A combinar';
  document.getElementById('os-status').textContent = STATUS_SERVICO_ROTULO[os.status] || os.status;
  document.getElementById('os-data').textContent = os.criado_em || '';
  document.getElementById('os-problema').value = os.descricao_problema || '';
  document.getElementById('os-laudo').value = os.laudo_tecnico || '';
  document.getElementById('laudo-salvo').classList.add('oculto');

  document.getElementById('modal-os').classList.remove('oculto');
}

function fecharModalOS() {
  document.getElementById('modal-os').classList.add('oculto');
  osAtual = null;
}

document.getElementById('modal-os-fechar').addEventListener('click', fecharModalOS);
document.getElementById('modal-os').addEventListener('click', (evento) => {
  if (evento.target.id === 'modal-os') fecharModalOS(); // clicar fora fecha
});

document.getElementById('btn-salvar-laudo').addEventListener('click', async () => {
  if (!osAtual) return;
  const laudo = document.getElementById('os-laudo').value;
  await chamarApi(`/api/servicos/${osAtual.id}/laudo`, { method: 'PATCH', body: JSON.stringify({ laudo }) });
  osAtual.laudo_tecnico = laudo;
  const aviso = document.getElementById('laudo-salvo');
  aviso.classList.remove('oculto');
  setTimeout(() => aviso.classList.add('oculto'), 2000);
});

document.getElementById('btn-imprimir-os').addEventListener('click', () => {
  if (!osAtual) return;
  imprimirOS(osAtual, document.getElementById('os-laudo').value);
});

function imprimirOS(os, laudo) {
  const nomeLoja = (configAtual && configAtual.nome) || 'Estabelecimento';
  const valor = os.preco_reais ? `R$ ${os.preco_reais}` : 'A combinar';
  const html = `
    <html><head><meta charset="utf-8"><title>OS ${esc(os.protocolo)}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #111; padding: 32px; max-width: 720px; margin: 0 auto; }
      h1 { font-size: 20px; margin: 0; }
      .topo { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 16px; }
      .protocolo { font-size: 18px; font-weight: bold; }
      table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; }
      td { padding: 6px 4px; vertical-align: top; font-size: 14px; }
      td.rot { font-weight: bold; width: 130px; }
      .bloco { border: 1px solid #999; border-radius: 6px; padding: 10px; margin-bottom: 14px; }
      .bloco h3 { margin: 0 0 6px; font-size: 13px; text-transform: uppercase; color: #444; }
      .bloco p { margin: 0; white-space: pre-wrap; min-height: 40px; font-size: 14px; }
      .assinaturas { display: flex; justify-content: space-between; margin-top: 48px; gap: 40px; }
      .assinaturas div { flex: 1; text-align: center; border-top: 1px solid #111; padding-top: 6px; font-size: 13px; }
    </style></head><body>
      <div class="topo">
        <div><h1>${esc(nomeLoja)}</h1><div>Ordem de Serviço</div></div>
        <div class="protocolo">${esc(os.protocolo)}</div>
      </div>
      <table>
        <tr><td class="rot">Cliente</td><td>${esc(os.cliente_nome)}</td><td class="rot">Telefone</td><td>${esc(os.telefone)}</td></tr>
        <tr><td class="rot">Aparelho</td><td>${esc(os.aparelho)}</td><td class="rot">Aberto em</td><td>${esc(os.criado_em)}</td></tr>
        <tr><td class="rot">Serviço</td><td>${esc(os.servico)}</td><td class="rot">Valor</td><td>${esc(valor)}</td></tr>
      </table>
      <div class="bloco"><h3>Problema relatado pelo cliente</h3><p>${esc(os.descricao_problema) || '—'}</p></div>
      <div class="bloco"><h3>Laudo técnico / serviços executados</h3><p>${esc(laudo) || ''}</p></div>
      <div class="assinaturas">
        <div>Assinatura do cliente</div>
        <div>Responsável técnico</div>
      </div>
    </body></html>`;

  const janela = window.open('', '_blank');
  if (!janela) {
    alert('Permita pop-ups para imprimir a OS.');
    return;
  }
  janela.document.write(html);
  janela.document.close();
  janela.focus();
  janela.print();
}

// ---------- Configurações ----------

async function carregarConfig() {
  const config = await chamarApi('/api/config');
  configAtual = config;
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

async function inicializar() {
  try {
    const status = await fetch('/api/setup-status').then((r) => r.json());
    if (status.precisaConfigurar) {
      mostrarTelaSetup();
      return;
    }
  } catch {
    // Se não conseguir consultar o status, cai para o login normal.
  }

  if (senhaAtual()) {
    chamarApi('/api/config').then(mostrarTelaApp).catch(() => mostrarTelaLogin());
  } else {
    mostrarTelaLogin();
  }
}

inicializar();
