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
