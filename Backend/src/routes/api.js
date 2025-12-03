import { Hono } from 'hono'

const app = new Hono()

app.use('*', async (c, next) => {
  const apiKey = c.req.header('Authorization')
  if (!apiKey || apiKey !== c.env.API_KEY) {
    return c.json({ code: 'INVALID_API_KEY' }, 200)
  }
  await next()
})

app.post('/users', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const {
    discord_id,
    user_key,
    identifier,
    from: fromRaw,
    until: untilRaw,
    search
  } = body

  const from = Number(fromRaw) >= 0 ? Number(fromRaw) : 0
  const until = Number.isFinite(Number(untilRaw)) ? Number(untilRaw) : (from + 100)
  let limit = Math.max(0, until - from)
  if (limit === 0) limit = 100

  let query = `
    SELECT
      key AS user_key,
      hwid AS identifier,
      discord_id,
      blacklisted,
      reset_state,
      total_executions,
      note,
      expiry
    FROM keys
    WHERE 1 = 1
  `
  const params = []

  if (discord_id) {
    query += ' AND discord_id = ?'
    params.push(String(discord_id))
  }

  if (user_key) {
    query += ' AND key = ?'
    params.push(String(user_key))
  }

  if (identifier) {
    query += ' AND hwid = ?'
    params.push(String(identifier))
  }

  if (search) {
    query += ' AND (key LIKE ? OR hwid LIKE ? OR discord_id LIKE ? OR note LIKE ?)'
    const s = `%${String(search)}%`
    params.push(s, s, s, s)
  }

  query += ' LIMIT ? OFFSET ?'
  params.push(limit, from)

  try {
    const db = c.env.DB
    const res = await db.prepare(query).bind(...params).all()
    const users = (res && res.results) ? res.results : []
    return c.json({ users }, 200)
  } catch (err) {
    return c.json({ code: 'ERROR', message: String(err) }, 200)
  }
})

app.post('/users/resethwid', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const user_key = body.user_key

  if (!user_key) {
    return c.json({ code: 'MISSING_USER_KEY' }, 200)
  }

  try {
    const db = c.env.DB
    const row = await db.prepare('SELECT key FROM keys WHERE key = ?').bind(String(user_key)).first()
    if (!row) {
      return c.json({ code: 'KEY_INVALID' }, 200)
    }

    await db.prepare('UPDATE keys SET hwid = ?, reset_state = ?, total_executions = ? WHERE key = ?')
      .bind('', 1, row.total_executions || 0, String(user_key))
      .run()

    return c.json({ code: 'HWID_RESET' }, 200)
  } catch (err) {
    return c.json({ code: 'ERROR', message: String(err) }, 200)
  }
})

app.post('/users/linkdiscord', async (c) => {
  const apiKey = c.req.headers.get('Authorization')
  if (!apiKey || apiKey !== c.env.API_KEY) {
    return c.json({ code: 'INVALID_API_KEY' }, 200)
  }

  const body = await c.req.json()
  const user_key = body.user_key
  const discord_id = body.discord_id

  if (!user_key || !discord_id) {
    return c.json({ code: 'MISSING_INFO' }, 200)
  }

  const db = c.env.DB
  const row = await db.prepare('SELECT discord_id FROM keys WHERE key = ?')
    .bind(String(user_key)).first()

  if (!row) return c.json({ code: 'KEY_INVALID' }, 200)
  if (row.discord_id) return c.json({ code: 'ALREADY_LINKED' }, 200)

  await db.prepare('UPDATE keys SET discord_id = ? WHERE key = ?')
    .bind(String(discord_id), String(user_key))
    .run()

  return c.json({ code: 'DISCORD_LINKED' }, 200)
})

export default app
