import { Hono } from 'hono'

const app = new Hono()

function generateKey(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

app.get('/', async (c) => {
  const token = c.req.query('token')
  if (!token) return c.text('Missing token', 403)

  const res = await fetch(`https://work.ink/_api/v2/token/isValid/${token}?deleteToken=1`)
  if (!res.ok) return c.text('Error validating token', 500)

  const data = await res.json()
  if (!data.valid) return c.text('Invalid token', 403)

  const key = generateKey(32)
  const now = Math.floor(Date.now() / 1000)
  const offsetHours = Number(c.env.KEY_TIME_OFFSET) || 48
  const expiry = now + offsetHours * 3600

  const db = c.env.DB
  await db.prepare(`
    INSERT INTO keys (key, hwid, discord_id, blacklisted, reset_state, total_executions, expiry, note)
    VALUES (?, '', 0, 0, 1, 0, ?, '')
  `).bind(key, expiry).run()

  return c.text(key, 200)
})

export default app
