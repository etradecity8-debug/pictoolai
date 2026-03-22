/**
 * SQLite 数据库：用户、仓库图片元数据、积分
 * 图片文件仍存在 server/gallery/ 下，数据库只存 id、用户、标题、文件路径、时间
 */
import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dbPath = join(__dirname, 'pictoolai.db')

let db = null

export function getDb() {
  if (!db) {
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS gallery (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      file_path TEXT NOT NULL,
      saved_at INTEGER NOT NULL,
      points_used INTEGER,
      model TEXT,
      clarity TEXT,
      cos_key TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_gallery_user_email ON gallery(user_email);
    CREATE INDEX IF NOT EXISTS idx_gallery_saved_at ON gallery(saved_at DESC);
    CREATE TABLE IF NOT EXISTS user_points (
      user_email TEXT PRIMARY KEY,
      balance INTEGER NOT NULL DEFAULT 0,
      expires_at INTEGER DEFAULT NULL,
      last_granted_at INTEGER DEFAULT NULL
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
    CREATE TABLE IF NOT EXISTS amazon_listing_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      name TEXT DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      search_terms TEXT NOT NULL DEFAULT '',
      bullets TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      analyze_result TEXT,
      aplus_copy TEXT,
      main_image_id TEXT,
      aplus_image_ids TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_listing_snapshots_user ON amazon_listing_snapshots(user_email);
    CREATE INDEX IF NOT EXISTS idx_listing_snapshots_created ON amazon_listing_snapshots(created_at DESC);
    CREATE TABLE IF NOT EXISTS ebay_listing_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      name TEXT DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      item_specifics TEXT NOT NULL DEFAULT '[]',
      description TEXT NOT NULL DEFAULT '',
      analyze_result TEXT,
      main_image_id TEXT,
      product_image_ids TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_ebay_listing_snapshots_user ON ebay_listing_snapshots(user_email);
    CREATE INDEX IF NOT EXISTS idx_ebay_listing_snapshots_created ON ebay_listing_snapshots(created_at DESC);
    CREATE TABLE IF NOT EXISTS aliexpress_listing_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      name TEXT DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      product_attributes TEXT NOT NULL DEFAULT '[]',
      description TEXT NOT NULL DEFAULT '',
      analyze_result TEXT,
      main_image_id TEXT,
      product_image_ids TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_aliexpress_listing_user ON aliexpress_listing_snapshots(user_email);
    CREATE INDEX IF NOT EXISTS idx_aliexpress_listing_created ON aliexpress_listing_snapshots(created_at DESC);
    CREATE TABLE IF NOT EXISTS supplier_matching_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      name TEXT DEFAULT '',
      settings TEXT NOT NULL DEFAULT '{}',
      rows_count INTEGER NOT NULL DEFAULT 0,
      result_data TEXT NOT NULL DEFAULT '[]'
    );
    CREATE INDEX IF NOT EXISTS idx_supplier_reports_user ON supplier_matching_reports(user_email);
    CREATE INDEX IF NOT EXISTS idx_supplier_reports_created ON supplier_matching_reports(created_at DESC);
  `)
    try {
      const galleryInfo = db.prepare('PRAGMA table_info(gallery)').all()
      const galleryNames = galleryInfo.map((c) => c.name)
      if (!galleryNames.includes('points_used')) db.exec('ALTER TABLE gallery ADD COLUMN points_used INTEGER')
      if (!galleryNames.includes('model')) db.exec('ALTER TABLE gallery ADD COLUMN model TEXT')
      if (!galleryNames.includes('clarity')) db.exec('ALTER TABLE gallery ADD COLUMN clarity TEXT')
      if (!galleryNames.includes('cos_key')) db.exec('ALTER TABLE gallery ADD COLUMN cos_key TEXT')
    } catch (_) {}
    try {
      const ptInfo = db.prepare('PRAGMA table_info(user_points)').all()
      const ptNames = ptInfo.map((c) => c.name)
      if (!ptNames.includes('expires_at')) db.exec('ALTER TABLE user_points ADD COLUMN expires_at INTEGER DEFAULT NULL')
      if (!ptNames.includes('last_granted_at')) db.exec('ALTER TABLE user_points ADD COLUMN last_granted_at INTEGER DEFAULT NULL')
    } catch (_) {}
    try {
      const listingInfo = db.prepare('PRAGMA table_info(amazon_listing_snapshots)').all()
      const listingNames = listingInfo.map((c) => c.name)
      if (!listingNames.includes('product_image_ids')) db.exec('ALTER TABLE amazon_listing_snapshots ADD COLUMN product_image_ids TEXT')
    } catch (_) {}
    try {
      const usersInfo = db.prepare('PRAGMA table_info(users)').all()
      const usersNames = usersInfo.map((c) => c.name)
      if (!usersNames.includes('admin_notes')) db.exec('ALTER TABLE users ADD COLUMN admin_notes TEXT DEFAULT NULL')
      if (!usersNames.includes('frozen')) db.exec('ALTER TABLE users ADD COLUMN frozen INTEGER NOT NULL DEFAULT 0')
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
