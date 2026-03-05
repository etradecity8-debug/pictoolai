/**
 * 积分规则与余额（与前端 pointsConfig 一致）
 * Nano Banana 1K=3; Nano Banana Pro 1K=3,2K=5,4K=5; Nano Banana 2 0.5K=3,1K=3,2K=5,4K=5
 */
const POINTS_MAP = {
  'Nano Banana': { '1K 标准': 3 },
  'Nano Banana Pro': { '1K 标准': 3, '2K 高清': 5, '4K 超清': 5 },
  'Nano Banana 2': { '0.5K 快速': 3, '1K 标准': 3, '2K 高清': 5, '4K 超清': 5 },
}

export function getPointsPerImage(model, clarity) {
  const byModel = POINTS_MAP[model]
  if (!byModel) return 3
  return byModel[clarity] ?? 3
}

export function getBalance(email) {
  const row = getDb().prepare('SELECT balance FROM user_points WHERE user_email = ?').get(email)
  return row ? row.balance : 0
}

export function setBalance(email, balance) {
  const db = getDb()
  db.prepare('INSERT INTO user_points (user_email, balance) VALUES (?, ?) ON CONFLICT(user_email) DO UPDATE SET balance = excluded.balance').run(email, Math.max(0, balance))
  return getBalance(email)
}

export function addBalance(email, amount) {
  const current = getBalance(email)
  return setBalance(email, current + amount)
}

export function addTransaction(email, amount, description) {
  const db = getDb()
  db.prepare('INSERT INTO points_transactions (user_email, amount, description, created_at) VALUES (?, ?, ?, ?)').run(email, amount, description || '', Date.now())
}

export function getTransactions(email, limit = 100) {
  const db = getDb()
  return db.prepare('SELECT id, amount, description, created_at AS createdAt FROM points_transactions WHERE user_email = ? ORDER BY created_at DESC LIMIT ?').all(email, limit)
}

/** 扣减积分，不足时抛出 Error */
export function deductPoints(email, totalPoints, description) {
  const current = getBalance(email)
  if (current < totalPoints) throw new Error('积分不足')
  setBalance(email, current - totalPoints)
  addTransaction(email, -totalPoints, description)
}

// 避免循环依赖：在 index.js 里 setDb 或直接 require getDb
let getDbRef = null
export function setGetDb(fn) {
  getDbRef = fn
}
function getDb() {
  if (!getDbRef) throw new Error('points.js: getDb not injected')
  return getDbRef()
}
