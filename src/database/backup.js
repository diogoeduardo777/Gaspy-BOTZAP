// Backup automático do banco SQLite. Usa a API de backup do better-sqlite3 (cópia "online",
// segura mesmo com o banco em uso), guarda uma pasta de backups com rotação (mantém os N mais
// recentes) e roda de tempos em tempos. Também expõe uma função para gerar um backup sob demanda
// (usada pelo botão "baixar cópia de segurança" no painel).
const fs = require('fs');
const path = require('path');
const db = require('./connection');

const backupDir = path.resolve(process.env.BACKUP_PATH || './backups');

function backupAtivo() {
  return process.env.BACKUP_ATIVO !== 'false';
}

function manterQuantidade() {
  const n = parseInt(process.env.BACKUP_MANTER || '7', 10);
  return !isNaN(n) && n > 0 ? n : 7;
}

function garantirPasta() {
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
}

// Nome do arquivo com data/hora (ordenável): gaspy-backup-AAAA-MM-DD_HH-MM-SS.db
function nomeBackup() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const carimbo = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
  return `gaspy-backup-${carimbo}.db`;
}

// Gera um backup no caminho indicado (ou na pasta padrão). Retorna o caminho do arquivo criado.
async function fazerBackup(destino) {
  const alvo = destino || (garantirPasta(), path.join(backupDir, nomeBackup()));
  await db.backup(alvo);
  return alvo;
}

// Apaga backups antigos, mantendo apenas os N mais recentes.
function rotacionar() {
  try {
    const arquivos = fs.readdirSync(backupDir)
      .filter((f) => f.startsWith('gaspy-backup-') && f.endsWith('.db'))
      .sort(); // nomes com carimbo ordenável => ordem cronológica
    const excedente = arquivos.length - manterQuantidade();
    for (let i = 0; i < excedente; i++) {
      try { fs.rmSync(path.join(backupDir, arquivos[i]), { force: true }); } catch {}
    }
  } catch {}
}

async function executarBackupAgendado() {
  try {
    const arquivo = await fazerBackup();
    rotacionar();
    console.log(`💾 Backup criado: ${arquivo}`);
  } catch (err) {
    console.error('[backup] Falha ao criar backup automático:', err.message);
  }
}

function iniciarBackupAutomatico() {
  if (!backupAtivo()) {
    console.log('💾 Backup automático desligado (BACKUP_ATIVO=false).');
    return;
  }
  const horas = parseFloat(process.env.BACKUP_INTERVALO_HORAS || '24') || 24;
  const intervaloMs = Math.max(0.1, horas) * 60 * 60 * 1000;

  // Primeiro backup logo após iniciar (garante ao menos uma cópia por sessão).
  setTimeout(() => { executarBackupAgendado(); }, 60 * 1000);
  setInterval(() => { executarBackupAgendado(); }, intervaloMs);

  console.log(`💾 Backup automático ativo (a cada ${horas}h, guardando ${manterQuantidade()} cópias em ${backupDir}).`);
}

module.exports = { iniciarBackupAutomatico, fazerBackup, backupDir, nomeBackup };
