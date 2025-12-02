import { Hono } from 'hono'
import { sha256 } from '../utils/sha256.js'

const app = new Hono()

app.get('/', async (c) => {
  const clientTime = c.req.header('clienttime')
  const clientKey = c.req.header('clientkey')
  const clientNonce = c.req.header('clientnonce')
  const externalSignature = c.req.header('externalsignature')

  let fingerprint = null
  for (const [k, v] of c.req.raw.headers.entries()) {
    if (k.toLowerCase().endsWith('-fingerprint')) {
      fingerprint = v
      break
    }
  }

  if (!clientTime || !clientKey || !clientNonce || !externalSignature || !fingerprint) {
    return c.json({ code: "MISSING_INFO" }, 200)
  }

  const expected = await sha256(
    clientNonce +
    c.env.SECRET1 +
    clientKey +
    c.env.SECRET2 +
    clientTime +
    c.env.SECRET3
  )

  if (expected !== externalSignature) {
    return c.json({ code: "SECURITY_ERROR" }, 200)
  }

  const db = c.env.DB
  const row = await db.prepare('SELECT * FROM keys WHERE key = ?').bind(clientKey).first()
  if (!row) {
    return c.json({ code: "KEY_INVALID" }, 200)
  }

  const now = Math.floor(Date.now() / 1000)
  if (row.expiry <= now) {
    await db.prepare('DELETE FROM keys WHERE key = ?').bind(clientKey).run()
    return c.json({ code: "KEY_EXPIRED" }, 200)
  }

  if (row.blacklisted) {
    return c.json({ code: "KEY_BANNED" }, 200)
  }

  const newExec = (Number(row.total_executions) || 0) + 1

  if (row.reset_state) {
    await db.prepare('UPDATE keys SET hwid = ?, reset_state = 0, total_executions = ? WHERE key = ?')
      .bind(fingerprint, newExec, clientKey).run()

    const sig = await sha256(clientNonce + c.env.SECRET3 + 'KEY_VALID' + clientTime)
    return c.json({
      code: "KEY_VALID",
      data: { total_executions: newExec, expiry: row.expiry, note: row.note },
      signature: sig
    }, 200)
  }

  if (row.hwid !== fingerprint) {
    return c.json({ code: "KEY_HWID_LOCKED" }, 200)
  }

  await db.prepare('UPDATE keys SET total_executions = ? WHERE key = ?').bind(newExec, clientKey).run()
  const sig = await sha256(clientNonce + c.env.SECRET3 + 'KEY_VALID' + clientTime)

  return c.json({
    code: "KEY_VALID",
    data: { total_executions: newExec, expiry: row.expiry, note: row.note },
    signature: sig
  }, 200)
})

export default app
