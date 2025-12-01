import { Hono } from 'hono'

const app = new Hono()

app.get('/', c => {
  const unix = Math.floor(Date.now() / 1000)
  return c.text(String(unix))
})

export default app
