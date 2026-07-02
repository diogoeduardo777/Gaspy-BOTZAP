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

const totalEstabelecimentos = db.prepare('SELECT COUNT(*) AS total FROM estabelecimentos').get().total;
if (totalEstabelecimentos === 0) {
  const { rodarSeed } = require('./seed');
  rodarSeed(db);
}

module.exports = db;
