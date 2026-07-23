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

// Aviso rápido de confirmação no canto da tela (ex: "Status atualizado ✓"). tipo 'erro' pinta de
// vermelho. Some sozinho depois de 2,5s. Dá ao dono leigo a certeza de que a ação foi salva.
let toastTimer = null;
function mostrarToast(mensagem, tipo) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = mensagem;
  toast.classList.remove('oculto', 'toast-erro');
  if (tipo === 'erro') toast.classList.add('toast-erro');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('oculto'), 2500);
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

async function mostrarTelaApp() {
  ocultarTodasAsTelas();
  document.getElementById('tela-app').classList.remove('oculto');
  carregarCardapio();
  carregarServicosCatalogo();
  carregarAtendimentos();
  // Carrega a config primeiro: a aba Mensagens usa configAtual.tipo_estabelecimento para
  // esconder os grupos que não são do tipo atual.
  await carregarConfig();
  carregarMensagens();
  iniciarMonitorWhatsApp();
  iniciarMonitorPendentes();
}

// ---------- Status da conexão do WhatsApp (bolinha + QR no painel) ----------

let monitorWhatsApp = null;
let monitorPendentes = null;

async function atualizarStatusWhatsApp() {
  // Só consulta enquanto o painel está visível (evita chamadas quando deslogado).
  if (document.getElementById('tela-app').classList.contains('oculto')) return;

  let dados;
  try {
    dados = await chamarApi('/api/whatsapp/status');
  } catch {
    return; // erro/deslogado: chamarApi já trata o 401; aqui só ignoramos
  }

  const chip = document.getElementById('wa-status-chip');
  const texto = document.getElementById('wa-status-texto');
  const banner = document.getElementById('wa-qr-banner');
  const img = document.getElementById('wa-qr-img');

  chip.classList.remove('conectado', 'desconectado', 'aguardando');

  if (dados.estado === 'conectado') {
    chip.classList.add('conectado');
    texto.textContent = '🟢 Bot ativo no WhatsApp';
    banner.classList.add('oculto');
  } else if (dados.estado === 'aguardando_qr') {
    chip.classList.add('aguardando');
    texto.textContent = '🟡 Escaneie o QR para ativar';
    if (dados.qr) {
      img.src = dados.qr;
      banner.classList.remove('oculto');
    } else {
      banner.classList.add('oculto');
    }
  } else {
    chip.classList.add('desconectado');
    texto.textContent = '🔴 WhatsApp desconectado';
    banner.classList.add('oculto');
  }
}

function iniciarMonitorWhatsApp() {
  atualizarStatusWhatsApp();
  if (monitorWhatsApp) return; // evita múltiplos timers
  monitorWhatsApp = setInterval(atualizarStatusWhatsApp, 5000);
}

// Mantém o badge de pedidos pendentes atualizado mesmo quando o dono está em outra aba.
function iniciarMonitorPendentes() {
  atualizarContadorPendentes();
  if (monitorPendentes) return; // evita múltiplos timers
  monitorPendentes = setInterval(atualizarContadorPendentes, 15000);
}

document.getElementById('btn-criar-senha').addEventListener('click', async () => {
  const senha = document.getElementById('input-nova-senha').value;
  const confirma = document.getElementById('input-confirma-senha').value;
  if (senha.length < 8) {
    mostrarTelaSetup('A senha precisa ter pelo menos 8 caracteres.');
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
    // Ao abrir a aba de pedidos, recarrega para mostrar pedidos que chegaram desde o login.
    if (botao.dataset.aba === 'atendimentos') carregarAtendimentos();
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
  aceito: 'Aceito',
  recusado: 'Recusado',
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
  aceito: { bg: '#dcfce7', cor: '#15803d' },
  recusado: { bg: '#fee2e2', cor: '#b91c1c' },
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
  let qtdPendentes = 0;
  atendimentos.forEach((item) => {
    const ehProduto = item.tipo === 'produto';
    const mapaStatus = ehProduto ? STATUS_PEDIDO : STATUS_SERVICO;
    const endpoint = ehProduto ? `/api/pedidos/${item.id}/status` : `/api/servicos/${item.id}/status`;
    const identificador = ehProduto ? `#${item.id}` : item.protocolo;

    // Pedido de produto ainda não confirmado: em vez do select técnico, mostra os botões grandes
    // Aceitar/Recusar — a ação óbvia para o dono. (OS de assistência tem seu próprio ciclo.)
    const ehPedidoPendente = ehProduto && item.status === 'pendente';
    if (ehPedidoPendente) qtdPendentes += 1;

    // "Entregue?" só faz sentido para serviços (aparelho retirado pelo cliente).
    const celulaEntregue = ehProduto
      ? '<td>—</td>'
      : `<td><input type="checkbox" class="toggle-retirado" data-id="${item.id}" ${item.retirado ? 'checked' : ''}></td>`;

    // Serviços têm ordem de serviço (OS) imprimível — o protocolo vira um botão.
    const celulaId = ehProduto
      ? `<td>${esc(identificador)}</td>`
      : `<td><button class="abrir-os" data-id="${item.id}">${esc(identificador)} 📄</button></td>`;

    const celulaStatus = ehPedidoPendente
      ? `<td>
           <div class="acoes-pedido">
             <button class="botao-aceitar" data-id="${item.id}">✅ Aceitar</button>
             <button class="botao-recusar" data-id="${item.id}">❌ Recusar</button>
           </div>
         </td>`
      : `<td>
           <select class="status-atendimento" data-endpoint="${endpoint}">
             ${Object.entries(mapaStatus).map(([valor, rotulo]) => `<option value="${valor}" ${valor === item.status ? 'selected' : ''}>${rotulo}</option>`).join('')}
           </select>
         </td>`;

    const linha = document.createElement('tr');
    if (ehPedidoPendente) linha.className = 'linha-pendente';
    linha.innerHTML = `
      <td>${ehProduto ? '🛍️ Produto' : '🔧 Serviço'}</td>
      ${celulaId}
      <td>${esc(item.cliente_nome)}</td>
      <td>${esc(item.telefone)}</td>
      <td>${esc(item.descricao)}</td>
      <td>${item.valor_reais === null ? '—' : esc(item.valor_reais)}</td>
      ${celulaStatus}
      ${celulaEntregue}
      <td>${esc(item.criado_em)}</td>
    `;
    corpo.appendChild(linha);
  });

  atualizarBadgePendentes(qtdPendentes);

  corpo.querySelectorAll('.status-atendimento').forEach((select) => {
    colorirStatus(select);
    let statusAnterior = select.value; // para reverter se der erro
    select.addEventListener('change', async () => {
      colorirStatus(select);
      try {
        await chamarApi(select.dataset.endpoint, {
          method: 'PATCH',
          body: JSON.stringify({ status: select.value })
        });
        statusAnterior = select.value;
        mostrarToast('Status atualizado ✓');
      } catch (err) {
        // Reverte a seleção e avisa — o dono não fica achando que salvou algo que não salvou.
        select.value = statusAnterior;
        colorirStatus(select);
        mostrarToast('Não foi possível salvar. Tente de novo.', 'erro');
      }
    });
  });

  // Aceitar/Recusar um pedido pendente: chama a API, avisa o cliente (no backend) e recarrega a
  // lista para refletir o novo estado.
  corpo.querySelectorAll('.botao-aceitar').forEach((botao) => {
    botao.addEventListener('click', () => responderPedido(botao.dataset.id, 'aceito'));
  });
  corpo.querySelectorAll('.botao-recusar').forEach((botao) => {
    botao.addEventListener('click', () => responderPedido(botao.dataset.id, 'recusado'));
  });

  corpo.querySelectorAll('.toggle-retirado').forEach((checkbox) => {
    checkbox.addEventListener('change', async () => {
      try {
        await chamarApi(`/api/servicos/${checkbox.dataset.id}/retirado`, {
          method: 'PATCH',
          body: JSON.stringify({ retirado: checkbox.checked })
        });
        mostrarToast(checkbox.checked ? 'Marcado como entregue ✓' : 'Desmarcado ✓');
      } catch (err) {
        checkbox.checked = !checkbox.checked; // reverte
        mostrarToast('Não foi possível salvar. Tente de novo.', 'erro');
      }
    });
  });

  corpo.querySelectorAll('.abrir-os').forEach((botao) => {
    botao.addEventListener('click', () => abrirModalOS(botao.dataset.id));
  });
}

// Aceita ou recusa um pedido pendente e recarrega a lista (o backend avisa o cliente no WhatsApp).
async function responderPedido(pedidoId, status) {
  const resposta = await chamarApi(`/api/pedidos/${pedidoId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
  // Se ao aceitar faltou estoque de algum item (loja), avisa o dono de forma clara. O estoque
  // foi zerado nesses itens (nunca fica negativo); cabe ao dono repor ou combinar com o cliente.
  if (resposta && resposta.aviso_estoque && resposta.aviso_estoque.length) {
    const itens = resposta.aviso_estoque
      .map((f) => `• ${f.nome} (tinha ${f.disponivel}, pedido ${f.pedido})`)
      .join('\n');
    alert('Pedido aceito! ⚠️ Atenção: faltou estoque de:\n\n' + itens + '\n\nO estoque desses itens foi zerado. Reponha o estoque ou combine com o cliente.');
  }
  mostrarToast(status === 'aceito' ? 'Pedido aceito ✓' : 'Pedido recusado');
  await carregarAtendimentos();
  carregarCardapio(); // o estoque mudou; atualiza a aba de itens também
}

// Atualiza o "badge" (contador vermelho) da aba de pedidos. Zero = escondido.
function atualizarBadgePendentes(total) {
  const badge = document.getElementById('badge-pendentes');
  if (!badge) return;
  if (total > 0) {
    badge.textContent = total;
    badge.classList.remove('oculto');
  } else {
    badge.classList.add('oculto');
  }
}

// Consulta leve só do contador de pendentes (sem recarregar a tabela) — mantém o badge vivo mesmo
// quando o dono está em outra aba. Silencioso em caso de erro (ex: sessão expirada).
async function atualizarContadorPendentes() {
  try {
    const { total } = await chamarApi('/api/pedidos/pendentes/contagem');
    atualizarBadgePendentes(total);
  } catch {
    /* ignora: o login/monitor já trata sessão expirada */
  }
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

// ---------- Mensagens do bot ----------

// Marca o campo como "Personalizado" (tem texto) ou "Padrão" (vazio = usa o texto padrão).
function atualizarSelo(campo) {
  const bloco = campo.closest('.msg-item');
  if (!bloco) return;
  const selo = bloco.querySelector('.msg-selo');
  const personalizado = campo.value.trim() !== '';
  selo.textContent = personalizado ? 'Personalizado' : 'Padrão';
  selo.classList.toggle('personalizado', personalizado);
}

async function carregarMensagens() {
  const { catalogo, valores } = await chamarApi('/api/mensagens');
  const container = document.getElementById('lista-mensagens');
  container.innerHTML = '';

  const tipoAtual = (configAtual && configAtual.tipo_estabelecimento) || 'comida';
  let primeiroVisivel = true;

  catalogo.forEach((grupo) => {
    // Grupos que não se aplicam ao tipo atual são escondidos (mas continuam no DOM, para que
    // salvar NÃO apague os textos personalizados deles — só a exibição muda).
    const aplicaAoTipo = !grupo.tipos || grupo.tipos.includes(tipoAtual);

    // Conta quantos textos deste grupo já foram personalizados (aparece no cabeçalho).
    const qtdPersonalizados = grupo.itens.filter((i) => (valores[i.chave] || '').trim() !== '').length;

    const bloco = document.createElement('div');
    bloco.className = 'acordeao-grupo';
    if (!aplicaAoTipo) bloco.classList.add('oculto');

    let itensHtml = '';
    grupo.itens.forEach((item) => {
      const valor = valores[item.chave] || '';
      const personalizado = valor.trim() !== '';
      const chips = (item.variaveis || []).map((v) =>
        `<button type="button" class="chip-var" data-var="${esc(v)}">{${esc(v)}}</button>`
      ).join(' ');
      const chipsLinha = chips
        ? `<div class="msg-vars"><span class="msg-vars-titulo">Toque para inserir:</span> ${chips}</div>`
        : '';
      const campo = item.multilinha
        ? `<textarea class="campo-mensagem" data-chave="${esc(item.chave)}" rows="3" placeholder="${esc(item.padrao)}">${esc(valor)}</textarea>`
        : `<input type="text" class="campo-mensagem" data-chave="${esc(item.chave)}" placeholder="${esc(item.padrao)}" value="${esc(valor)}">`;

      itensHtml += `
        <div class="msg-item">
          <div class="msg-topo">
            <strong>${esc(item.rotulo)}</strong>
            <span class="msg-selo ${personalizado ? 'personalizado' : ''}">${personalizado ? 'Personalizado' : 'Padrão'}</span>
          </div>
          ${item.ajuda ? `<p class="msg-ajuda">${esc(item.ajuda)}</p>` : ''}
          ${campo}
          ${chipsLinha}
          <button type="button" class="link-restaurar" data-chave="${esc(item.chave)}">↺ voltar ao texto padrão</button>
        </div>`;
    });

    bloco.innerHTML = `
      <button type="button" class="acordeao-cabecalho">
        <span>${esc(grupo.grupo)}</span>
        <span class="acordeao-info">${qtdPersonalizados > 0 ? `${qtdPersonalizados} personalizado(s)` : ''} <span class="acordeao-seta">▾</span></span>
      </button>
      <div class="acordeao-corpo">${itensHtml}</div>`;
    container.appendChild(bloco);

    // Primeiro grupo VISÍVEL já aberto; os demais fechados.
    if (aplicaAoTipo && primeiroVisivel) {
      bloco.classList.add('aberto');
      primeiroVisivel = false;
    }
  });

  // Abre/fecha o grupo ao clicar no cabeçalho.
  container.querySelectorAll('.acordeao-cabecalho').forEach((cab) => {
    cab.addEventListener('click', () => cab.closest('.acordeao-grupo').classList.toggle('aberto'));
  });

  // Clicar numa variável insere {var} no texto (na posição do cursor).
  container.querySelectorAll('.chip-var').forEach((chip) => {
    chip.addEventListener('click', () => {
      const campo = chip.closest('.msg-item').querySelector('.campo-mensagem');
      const token = `{${chip.dataset.var}}`;
      const ini = campo.selectionStart != null ? campo.selectionStart : campo.value.length;
      const fim = campo.selectionEnd != null ? campo.selectionEnd : campo.value.length;
      campo.value = campo.value.slice(0, ini) + token + campo.value.slice(fim);
      campo.focus();
      const pos = ini + token.length;
      try { campo.setSelectionRange(pos, pos); } catch {}
      atualizarSelo(campo);
    });
  });

  // "Voltar ao texto padrão" = limpa o campo.
  container.querySelectorAll('.link-restaurar').forEach((btn) => {
    btn.addEventListener('click', () => {
      const campo = btn.closest('.msg-item').querySelector('.campo-mensagem');
      campo.value = '';
      atualizarSelo(campo);
    });
  });

  // Atualiza o selo (Padrão/Personalizado) enquanto o dono digita.
  container.querySelectorAll('.campo-mensagem').forEach((campo) => {
    campo.addEventListener('input', () => atualizarSelo(campo));
  });
}

document.getElementById('btn-salvar-mensagens').addEventListener('click', async () => {
  const mensagens = {};
  document.querySelectorAll('#lista-mensagens .campo-mensagem').forEach((campo) => {
    mensagens[campo.dataset.chave] = campo.value;
  });
  await chamarApi('/api/mensagens', { method: 'PUT', body: JSON.stringify({ mensagens }) });
  const aviso = document.getElementById('mensagens-salvo');
  aviso.classList.remove('oculto');
  setTimeout(() => aviso.classList.add('oculto'), 2000);
});

// ---------- Aparência (logo + cor) ----------

function hexParaRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function escurecer(hex, fator) {
  const c = hexParaRgb(hex);
  if (!c) return hex;
  const d = (v) => Math.max(0, Math.round(v * (1 - fator)));
  return `#${[d(c.r), d(c.g), d(c.b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function aplicarCorDestaque(hex) {
  const c = hexParaRgb(hex);
  if (!c) return;
  // Injeta/atualiza uma regra :root — recálculo de estilo mais confiável que setar a variável
  // inline (funciona em qualquer navegador).
  let estilo = document.getElementById('gaspy-cor-destaque');
  if (!estilo) {
    estilo = document.createElement('style');
    estilo.id = 'gaspy-cor-destaque';
    document.head.appendChild(estilo);
  }
  estilo.textContent = `:root{` +
    `--azul:${hex};` +
    `--azul-hover:${escurecer(hex, 0.14)};` +
    `--azul-glow:rgba(${c.r},${c.g},${c.b},0.30);` +
    `--azul-suave:rgba(${c.r},${c.g},${c.b},0.14);` +
  `}`;
}

function aplicarLogoHeader(dataUrl) {
  const marca = document.querySelector('.marca .emoji');
  if (!marca) return;
  if (dataUrl) {
    marca.innerHTML = `<img src="${dataUrl}" alt="logo" style="width:100%;height:100%;object-fit:contain;border-radius:8px">`;
  } else {
    marca.textContent = '🤖';
  }
}

let logoSelecionado = null; // data URL do logo escolhido mas ainda não salvo

document.getElementById('input-logo').addEventListener('change', (evento) => {
  const arquivo = evento.target.files && evento.target.files[0];
  if (!arquivo) return;
  const leitor = new FileReader();
  leitor.onload = () => {
    logoSelecionado = leitor.result;
    const prev = document.getElementById('preview-logo');
    prev.src = logoSelecionado;
    prev.style.display = 'block';
  };
  leitor.readAsDataURL(arquivo);
});

document.getElementById('btn-baixar-backup').addEventListener('click', async () => {
  const btn = document.getElementById('btn-baixar-backup');
  const textoOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Gerando cópia...';
  try {
    const resp = await fetch('/api/backup/download', { headers: { 'x-painel-senha': senhaAtual() } });
    if (!resp.ok) throw new Error('Falha ao gerar backup');
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gaspy-backup.db';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    const aviso = document.getElementById('backup-baixado');
    aviso.classList.remove('oculto');
    setTimeout(() => aviso.classList.add('oculto'), 2500);
  } catch (e) {
    alert('Não consegui gerar o backup agora. Tente novamente.');
  } finally {
    btn.disabled = false;
    btn.textContent = textoOriginal;
  }
});

document.getElementById('btn-remover-logo').addEventListener('click', () => {
  logoSelecionado = '';
  document.getElementById('preview-logo').style.display = 'none';
  document.getElementById('input-logo').value = '';
});

document.getElementById('btn-salvar-visual').addEventListener('click', async () => {
  const cor = document.getElementById('input-cor').value;
  const corpo = { cor_destaque: cor };
  if (logoSelecionado !== null) corpo.logo_data_url = logoSelecionado; // '' = remover
  const atualizado = await chamarApi('/api/visual', { method: 'PUT', body: JSON.stringify(corpo) });
  aplicarCorDestaque(atualizado.cor_destaque);
  aplicarLogoHeader(atualizado.logo_data_url);
  const aviso = document.getElementById('visual-salvo');
  aviso.classList.remove('oculto');
  setTimeout(() => aviso.classList.add('oculto'), 2000);
});

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
  aplicarTipo(config.tipo_estabelecimento); // adapta abas + vocabulário ao tipo

  // Aparência salva
  if (config.cor_destaque) {
    aplicarCorDestaque(config.cor_destaque);
    document.getElementById('input-cor').value = config.cor_destaque;
  }
  logoSelecionado = null;
  const prev = document.getElementById('preview-logo');
  if (config.logo_data_url) {
    aplicarLogoHeader(config.logo_data_url);
    prev.src = config.logo_data_url;
    prev.style.display = 'block';
  } else {
    prev.style.display = 'none';
  }
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

// Quais abas (data-aba) aparecem em cada tipo de estabelecimento.
const ABAS_POR_TIPO = {
  comida: ['cardapio', 'atendimentos', 'mensagens', 'config'],
  loja: ['cardapio', 'atendimentos', 'mensagens', 'config'],
  assistencia: ['cardapio', 'servicos-catalogo', 'atendimentos', 'mensagens', 'config']
};
// Rótulo fixo da aba de itens para comida/loja; assistência mantém o rotulo_catalogo configurável.
const ROTULO_ABA_POR_TIPO = { comida: '🍔 Cardápio', loja: '🛍️ Produtos' };

// Textos auxiliares (ajuda + placeholders do formulário) já ajustados ao tipo, para os exemplos
// combinarem com o ramo (uma lanchonete vê "Ex: X-Burguer", não "Ex: Capinha iPhone 13").
const TEXTOS_ITENS_POR_TIPO = {
  comida: {
    ajuda: 'Monte seu cardápio: adicione os itens, defina o preço e controle a disponibilidade. As mudanças aparecem na hora para quem conversa com o bot.',
    categoria: 'Ex: Lanches',
    nome: 'Ex: X-Burguer',
    descricao: 'Ex: pão, hambúrguer, queijo e salada'
  },
  loja: {
    ajuda: 'Cadastre seus produtos: adicione, defina o preço e controle o estoque. As mudanças aparecem na hora para quem conversa com o bot.',
    categoria: 'Ex: Capinhas',
    nome: 'Ex: Capinha iPhone 13',
    descricao: 'Detalhes do produto'
  },
  assistencia: {
    ajuda: 'Cadastre os produtos/acessórios que você vende. Os tipos de serviço ficam na aba "Cadastro de Serviços".',
    categoria: 'Ex: Acessórios',
    nome: 'Ex: Película de vidro',
    descricao: 'Detalhes do produto'
  }
};

// Adapta o painel ao tipo de estabelecimento: mostra/esconde abas e ajusta o rótulo da aba de
// itens. IMPORTANTE: esconder uma aba NÃO apaga nada — os registros (itens, serviços, pedidos)
// continuam no banco. Isto controla apenas o que aparece na tela; trocar o tipo é reversível.
function aplicarTipo(tipo) {
  const t = ABAS_POR_TIPO[tipo] ? tipo : 'comida';
  const visiveis = ABAS_POR_TIPO[t];

  document.querySelectorAll('.aba-btn').forEach((btn) => {
    const mostra = visiveis.includes(btn.dataset.aba);
    btn.classList.toggle('oculto', !mostra);
    if (!mostra) {
      const sec = document.getElementById('aba-' + btn.dataset.aba);
      if (sec) sec.classList.add('oculto'); // some com a seção caso estivesse aberta
    }
  });

  // Se a aba ativa foi escondida, cai para a primeira visível.
  const ativa = document.querySelector('.aba-btn.ativo');
  if (!ativa || ativa.classList.contains('oculto')) {
    document.querySelectorAll('.aba-btn').forEach((b) => b.classList.remove('ativo'));
    document.querySelectorAll('.aba').forEach((s) => s.classList.add('oculto'));
    const primeiro = document.querySelector('.aba-btn[data-aba="' + visiveis[0] + '"]');
    if (primeiro) {
      primeiro.classList.add('ativo');
      document.getElementById('aba-' + visiveis[0]).classList.remove('oculto');
    }
  }

  // Vocabulário da aba de itens conforme o tipo.
  const label = ROTULO_ABA_POR_TIPO[t] || (configAtual && configAtual.rotulo_catalogo) || '🧰 Serviços';
  document.getElementById('btn-aba-cardapio').textContent = label;
  document.getElementById('titulo-cardapio').textContent = label;

  // Ajusta os textos de ajuda e os placeholders de exemplo ao tipo.
  const txt = TEXTOS_ITENS_POR_TIPO[t];
  if (txt) {
    const ajuda = document.getElementById('ajuda-cardapio');
    if (ajuda) ajuda.textContent = txt.ajuda;
    const setPh = (id, valor) => {
      const el = document.getElementById(id);
      if (el) el.placeholder = valor;
    };
    setPh('campo-categoria', txt.categoria);
    setPh('campo-nome', txt.nome);
    setPh('campo-descricao', txt.descricao);
  }
}

document.getElementById('form-config').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const dados = Object.fromEntries(new FormData(evento.target).entries());
  const atualizado = await chamarApi('/api/config', { method: 'PUT', body: JSON.stringify(dados) });
  configAtual = atualizado;
  aplicarRotuloCatalogo(atualizado.rotulo_catalogo);
  aplicarNomeEstabelecimento(atualizado.nome);
  aplicarTipo(atualizado.tipo_estabelecimento); // re-adapta abas/vocabulário ao novo tipo
  carregarMensagens(); // re-renderiza a aba Mensagens mostrando só os grupos do novo tipo
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
