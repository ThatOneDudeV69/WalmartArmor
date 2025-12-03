import { Hono } from 'hono'

const app = new Hono()

app.get('/', c => {
  return c.text('api ok', 200)
})

export default app
