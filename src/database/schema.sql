-- Esquema inicial do Gaspy-BOTZAP (SQLite)
-- Aplicado automaticamente na primeira execução (ver connection.js)

CREATE TABLE IF NOT EXISTS estabelecimentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  saudacao TEXT NOT NULL DEFAULT '',
  numero_atendente TEXT NOT NULL DEFAULT '',
  horario_atendimento TEXT NOT NULL DEFAULT '',
  mensagem_fora_horario TEXT NOT NULL DEFAULT '',
  mensagem_encerramento TEXT NOT NULL DEFAULT '',
  chave_pix TEXT NOT NULL DEFAULT '',
  pix_nome_recebedor TEXT NOT NULL DEFAULT '',
  pix_cidade TEXT NOT NULL DEFAULT '',
  plano TEXT NOT NULL DEFAULT 'basico' CHECK (plano IN ('basico', 'profissional')),
  rotulo_catalogo TEXT NOT NULL DEFAULT '🍽️ Cardápio', -- nome exibido no painel e no WhatsApp para a lista de itens (ex: "🛍️ Loja de Acessórios")
  painel_senha_hash TEXT, -- hash (salt:hash) da senha do painel, criada no 1º acesso; NULL = ainda não configurada
  logo_data_url TEXT NOT NULL DEFAULT '',   -- logo do estabelecimento (imagem embutida como data URL), exibida no painel
  cor_destaque TEXT NOT NULL DEFAULT '',    -- cor principal do painel (hex, ex: #4f8cff); vazio = padrão
  mensagens_json TEXT NOT NULL DEFAULT '{}', -- textos personalizados do bot (só o que o dono alterou; o resto usa o padrão)
  config_menu_json TEXT NOT NULL DEFAULT '{}',
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cardapio_itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  estabelecimento_id INTEGER NOT NULL REFERENCES estabelecimentos(id),
  categoria TEXT NOT NULL DEFAULT 'Geral',
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  preco_centavos INTEGER NOT NULL DEFAULT 0,
  disponivel INTEGER NOT NULL DEFAULT 1,
  estoque INTEGER, -- NULL = não controla estoque (ex: serviços); número = quantidade disponível
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cardapio_estabelecimento ON cardapio_itens(estabelecimento_id);

CREATE TABLE IF NOT EXISTS pedidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  estabelecimento_id INTEGER NOT NULL REFERENCES estabelecimentos(id),
  telefone TEXT NOT NULL,
  cliente_nome TEXT NOT NULL DEFAULT '',
  tipo TEXT NOT NULL DEFAULT 'pedido' CHECK (tipo IN ('agendamento', 'pedido')),
  itens_json TEXT NOT NULL DEFAULT '[]',
  total_centavos INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'cancelado', 'concluido')),
  pix_txid TEXT NOT NULL DEFAULT '',
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pedidos_estabelecimento ON pedidos(estabelecimento_id);

CREATE TABLE IF NOT EXISTS servicos_agendados (
  id INTEGER PRIMARY KEY AUTOINCREMENT, -- também usado como número de protocolo (#id)
  estabelecimento_id INTEGER NOT NULL REFERENCES estabelecimentos(id),
  telefone TEXT NOT NULL,
  cliente_nome TEXT NOT NULL DEFAULT '',
  aparelho TEXT NOT NULL DEFAULT '',
  servico TEXT NOT NULL DEFAULT '',
  descricao_problema TEXT NOT NULL DEFAULT '', -- relato do cliente coletado pelo bot (ex: "caiu água")
  laudo_tecnico TEXT NOT NULL DEFAULT '',       -- o que o técnico identificou/executou (preenchido no painel)
  preco_centavos INTEGER, -- NULL = sem valor fixo definido (depende de diagnóstico)
  status TEXT NOT NULL DEFAULT 'em_analise' CHECK (status IN ('em_analise', 'em_manutencao', 'aguardando_peca', 'concluido')),
  retirado INTEGER NOT NULL DEFAULT 0, -- 1 = cliente já buscou o aparelho (para o lembrete de retirada parar)
  lembretes_retirada INTEGER NOT NULL DEFAULT 0, -- quantos lembretes de retirada já foram enviados
  data_inicio TEXT NOT NULL DEFAULT (datetime('now')),
  data_prevista TEXT,
  data_conclusao TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_servicos_estabelecimento ON servicos_agendados(estabelecimento_id);

CREATE TABLE IF NOT EXISTS servicos_catalogo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  estabelecimento_id INTEGER NOT NULL REFERENCES estabelecimentos(id),
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  preco_centavos INTEGER, -- NULL = sem preço fixo (mostrado sem valor ao cliente)
  disponivel INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_servicos_catalogo_estabelecimento ON servicos_catalogo(estabelecimento_id);

CREATE TABLE IF NOT EXISTS sessoes (
  telefone TEXT PRIMARY KEY,
  estabelecimento_id INTEGER NOT NULL REFERENCES estabelecimentos(id),
  estado TEXT NOT NULL DEFAULT 'inicio',
  dados_json TEXT NOT NULL DEFAULT '{}',
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mensagens_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  estabelecimento_id INTEGER NOT NULL REFERENCES estabelecimentos(id),
  telefone TEXT NOT NULL,
  direcao TEXT NOT NULL CHECK (direcao IN ('in', 'out')),
  mensagem TEXT NOT NULL DEFAULT '',
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mensagens_estabelecimento ON mensagens_log(estabelecimento_id, telefone);
