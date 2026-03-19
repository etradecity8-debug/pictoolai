/**
 * 积分规则与余额（与前端 pointsConfig 一致）
 * Nano Banana 1K=4; Nano Banana Pro 1K=12,2K=12,4K=20; Nano Banana 2 0.5K=4,1K=6,2K=10,4K=14
 */
const POINTS_MAP = {
  'Nano Banana':     { '1K 标准': 4 },
  'Nano Banana Pro': { '1K 标准': 12, '2K 高清': 12, '4K 超清': 20 },
  'Nano Banana 2':   { '0.5K 快速': 4, '1K 标准': 6, '2K 高清': 10, '4K 超清': 14 },
}

export function getPointsPerImage(model, clarity) {
  const byModel = POINTS_MAP[model]
  if (!byModel) return 3
  return byModel[clarity] ?? 3
}

/** 获取积分余额，若订阅已过期则惰性清零 */
export function getBalance(email) {
  const db = getDb()
  const row = db.prepare('SELECT balance, expires_at FROM user_points WHERE user_email = ?').get(email)
  if (!row) return 0
  if (row.expires_at && Date.now() > row.expires_at) {
    if (row.balance > 0) {
      db.prepare('UPDATE user_points SET balance = 0 WHERE user_email = ?').run(email)
      addTransaction(email, -row.balance, '订阅到期，积分清零')
    }
    return 0
  }
  return row.balance
}

export function setBalance(email, balance) {
  const db = getDb()
  db.prepare(
    'INSERT INTO user_points (user_email, balance) VALUES (?, ?) ON CONFLICT(user_email) DO UPDATE SET balance = excluded.balance'
  ).run(email, Math.max(0, balance))
  return getBalance(email)
}

export function addBalance(email, amount) {
  const current = getBalance(email)
  return setBalance(email, current + amount)
}

export function addTransaction(email, amount, description) {
  const db = getDb()
  db.prepare(
    'INSERT INTO points_transactions (user_email, amount, description, created_at) VALUES (?, ?, ?, ?)'
  ).run(email, amount, description || '', Date.now())
}

export function getTransactions(email, limit = 100) {
  const db = getDb()
  return db
    .prepare(
      'SELECT id, amount, description, created_at AS createdAt FROM points_transactions WHERE user_email = ? ORDER BY created_at DESC LIMIT ?'
    )
    .all(email, limit)
}

/** 扣减积分，不足时抛出 Error */
export function deductPoints(email, totalPoints, description) {
  const current = getBalance(email)
  if (current < totalPoints) throw new Error('积分不足')
  setBalance(email, current - totalPoints)
  addTransaction(email, -totalPoints, description)
}

/**
 * 管理员授予积分，同时设置有效期（默认 30 天）。
 * 每次授予都会重置有效期：新到期时间 = 现在 + days 天。
 * 若当前积分未到期，新余额 = 旧余额 + amount；若已过期，新余额 = amount。
 */
export function grantPoints(email, amount, days = 365) {
  const db = getDb()
  const now = Date.now()
  const expiresAt = now + days * 24 * 60 * 60 * 1000
  const current = getBalance(email) // 调用 getBalance 会触发惰性清零
  const newBalance = current + amount
  db.prepare(
    `INSERT INTO user_points (user_email, balance, expires_at, last_granted_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_email) DO UPDATE SET
       balance = excluded.balance,
       expires_at = excluded.expires_at,
       last_granted_at = excluded.last_granted_at`
  ).run(email, Math.max(0, newBalance), expiresAt, now)
  addTransaction(email, amount, `管理员充值 ${amount} 积分，有效期 ${days === 365 ? '1年' : `${days}天`}`)
  return Math.max(0, newBalance)
}

/** 新用户注册赠送积分（默认 150，有效期 30 天） */
export function grantSignupBonus(email, amount = 150, days = 30) {
  const db = getDb()
  const now = Date.now()
  const expiresAt = now + days * 24 * 60 * 60 * 1000
  const current = getBalance(email)
  const newBalance = current + amount
  db.prepare(
    `INSERT INTO user_points (user_email, balance, expires_at, last_granted_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_email) DO UPDATE SET
       balance = excluded.balance,
       expires_at = excluded.expires_at,
       last_granted_at = excluded.last_granted_at`
  ).run(email, Math.max(0, newBalance), expiresAt, now)
  addTransaction(email, amount, `新用户注册赠送 ${amount} 积分，有效期 ${days} 天`)
  return Math.max(0, newBalance)
}

/** 获取用户订阅信息（余额 + 到期时间 + 最后充值时间），含过期检查 */
export function getSubscriptionInfo(email) {
  const balance = getBalance(email) // 含惰性清零
  const db = getDb()
  const row = db.prepare('SELECT expires_at, last_granted_at FROM user_points WHERE user_email = ?').get(email)
  return {
    balance,
    expiresAt: row?.expires_at ?? null,
    lastGrantedAt: row?.last_granted_at ?? null,
  }
}

// 避免循环依赖：在 index.js 里 setGetDb 注入
let getDbRef = null
export function setGetDb(fn) {
  getDbRef = fn
}
function getDb() {
  if (!getDbRef) throw new Error('points.js: getDb not injected')
  return getDbRef()
}
