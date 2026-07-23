const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = path.resolve(process.env.DATA_PATH || './data');
const dbPath = path.join(dataDir, 'gaspy.db');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schema);

// Migração leve: adiciona colunas novas em bancos criados antes delas existirem no schema.
const colunasCardapio = db.prepare("PRAGMA table_info(cardapio_itens)").all().map((c) => c.name);
if (!colunasCardapio.includes('estoque')) {
  db.exec('ALTER TABLE cardapio_itens ADD COLUMN estoque INTEGER');
}

const colunasEstabelecimentos = db.prepare("PRAGMA table_info(estabelecimentos)").all().map((c) => c.name);
if (!colunasEstabelecimentos.includes('rotulo_catalogo')) {
  db.exec("ALTER TABLE estabelecimentos ADD COLUMN rotulo_catalogo TEXT NOT NULL DEFAULT '🍽️ Cardápio'");
}
if (!colunasEstabelecimentos.includes('painel_senha_hash')) {
  db.exec('ALTER TABLE estabelecimentos ADD COLUMN painel_senha_hash TEXT');
}
if (!colunasEstabelecimentos.includes('logo_data_url')) {
  db.exec("ALTER TABLE estabelecimentos ADD COLUMN logo_data_url TEXT NOT NULL DEFAULT ''");
}
if (!colunasEstabelecimentos.includes('cor_destaque')) {
  db.exec("ALTER TABLE estabelecimentos ADD COLUMN cor_destaque TEXT NOT NULL DEFAULT ''");
}
if (!colunasEstabelecimentos.includes('mensagens_json')) {
  db.exec("ALTER TABLE estabelecimentos ADD COLUMN mensagens_json TEXT NOT NULL DEFAULT '{}'");
}
if (!colunasEstabelecimentos.includes('tipo_estabelecimento')) {
  // Bancos existentes ganham a coluna com o padrão 'comida' (não-destrutivo: só adiciona coluna,
  // não mexe em nenhum dado). Rodar 2x é seguro por causa do guard acima.
  db.exec("ALTER TABLE estabelecimentos ADD COLUMN tipo_estabelecimento TEXT NOT NULL DEFAULT 'comida' CHECK (tipo_estabelecimento IN ('comida', 'assistencia', 'loja'))");
}

// Ampliação do CHECK de status em `pedidos` (+ 'aceito', + 'recusado'). O SQLite NÃO permite
// alterar um CHECK com ALTER TABLE, então é preciso reconstruir a tabela. É NÃO-DESTRUTIVO
// (copia todas as linhas dentro de uma transação) e IDEMPOTENTE (só roda se o CHECK atual ainda
// não conhecer 'aceito'). Como nenhuma outra tabela referencia `pedidos`, o DROP/RENAME é seguro
// mesmo com foreign_keys ligado. Bancos novos já nascem com o CHECK completo (schema.sql), então
// aqui só entram bancos antigos.
const pedidosTabela = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='pedidos'").get();
if (pedidosTabela && pedidosTabela.sql && !pedidosTabela.sql.includes("'aceito'")) {
  const migrarPedidos = db.transaction(() => {
    db.exec(`
      CREATE TABLE pedidos_migracao (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        estabelecimento_id INTEGER NOT NULL REFERENCES estabelecimentos(id),
        telefone TEXT NOT NULL,
        cliente_nome TEXT NOT NULL DEFAULT '',
        tipo TEXT NOT NULL DEFAULT 'pedido' CHECK (tipo IN ('agendamento', 'pedido')),
        itens_json TEXT NOT NULL DEFAULT '[]',
        total_centavos INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aceito', 'recusado', 'pago', 'cancelado', 'concluido')),
        pix_txid TEXT NOT NULL DEFAULT '',
        criado_em TEXT NOT NULL DEFAULT (datetime('now')),
        atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    db.exec(`
      INSERT INTO pedidos_migracao
        (id, estabelecimento_id, telefone, cliente_nome, tipo, itens_json, total_centavos, status, pix_txid, criado_em, atualizado_em)
      SELECT id, estabelecimento_id, telefone, cliente_nome, tipo, itens_json, total_centavos, status, pix_txid, criado_em, atualizado_em
      FROM pedidos
    `);
    db.exec('DROP TABLE pedidos');
    db.exec('ALTER TABLE pedidos_migracao RENAME TO pedidos');
    db.exec('CREATE INDEX IF NOT EXISTS idx_pedidos_estabelecimento ON pedidos(estabelecimento_id)');
  });
  migrarPedidos();
}

// Coluna de controle da baixa de estoque (Fase 4). Idempotente e não-destrutiva. Cobre bancos
// que já têm o CHECK novo mas ainda não tinham essa coluna.
const colunasPedidos = db.prepare("PRAGMA table_info(pedidos)").all().map((c) => c.name);
if (!colunasPedidos.includes('estoque_baixado')) {
  db.exec('ALTER TABLE pedidos ADD COLUMN estoque_baixado INTEGER NOT NULL DEFAULT 0');
}

const colunasServicosAgendados = db.prepare("PRAGMA table_info(servicos_agendados)").all().map((c) => c.name);
if (!colunasServicosAgendados.includes('preco_centavos')) {
  db.exec('ALTER TABLE servicos_agendados ADD COLUMN preco_centavos INTEGER');
}
if (!colunasServicosAgendados.includes('retirado')) {
  db.exec('ALTER TABLE servicos_agendados ADD COLUMN retirado INTEGER NOT NULL DEFAULT 0');
}
if (!colunasServicosAgendados.includes('lembretes_retirada')) {
  db.exec('ALTER TABLE servicos_agendados ADD COLUMN lembretes_retirada INTEGER NOT NULL DEFAULT 0');
}
if (!colunasServicosAgendados.includes('descricao_problema')) {
  db.exec("ALTER TABLE servicos_agendados ADD COLUMN descricao_problema TEXT NOT NULL DEFAULT ''");
}
if (!colunasServicosAgendados.includes('laudo_tecnico')) {
  db.exec("ALTER TABLE servicos_agendados ADD COLUMN laudo_tecnico TEXT NOT NULL DEFAULT ''");
}

const totalEstabelecimentos = db.prepare('SELECT COUNT(*) AS total FROM estabelecimentos').get().total;
if (totalEstabelecimentos === 0) {
  const { rodarSeed } = require('./seed');
  rodarSeed(db);
}

module.exports = db;
