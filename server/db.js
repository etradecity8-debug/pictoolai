/**
 * SQLite 数据库：仓库图片元数据
 * 图片文件仍存在 server/gallery/ 下，数据库只存 id、用户、标题、文件路径、时间
 */
import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dbPath = join(__dirname, 'picaitool.db')

let db = null

export function getDb() {
  if (!db) {
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.exec(`
    CREATE TABLE IF NOT EXISTS gallery (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      file_path TEXT NOT NULL,
      saved_at INTEGER NOT NULL,
      points_used INTEGER,
      model TEXT,
      clarity TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_gallery_user_email ON gallery(user_email);
    CREATE INDEX IF NOT EXISTS idx_gallery_saved_at ON gallery(saved_at DESC);
    CREATE TABLE IF NOT EXISTS user_points (
      user_email TEXT PRIMARY KEY,
      balance INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS points_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email TEXT NOT NULL,
      amount INTEGER NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_points_transactions_user ON points_transactions(user_email);
    CREATE INDEX IF NOT EXISTS idx_points_transactions_created ON points_transactions(created_at DESC);
  `)
    try {
      const info = db.prepare('PRAGMA table_info(gallery)').all()
      const names = info.map((c) => c.name)
      if (!names.includes('points_used')) db.exec('ALTER TABLE gallery ADD COLUMN points_used INTEGER')
      if (!names.includes('model')) db.exec('ALTER TABLE gallery ADD COLUMN model TEXT')
      if (!names.includes('clarity')) db.exec('ALTER TABLE gallery ADD COLUMN clarity TEXT')
    } catch (_) {}
  }
  return db
}

export function closeDb() {
  if (db) {
    db.close()
    db = null
  }
}
