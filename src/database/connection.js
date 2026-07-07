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

const totalEstabelecimentos = db.prepare('SELECT COUNT(*) AS total FROM estabelecimentos').get().total;
if (totalEstabelecimentos === 0) {
  const { rodarSeed } = require('./seed');
  rodarSeed(db);
}

module.exports = db;
