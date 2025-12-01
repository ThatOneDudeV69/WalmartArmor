import { Hono } from 'hono'

import sync from './routes/sync.js'
import verify from './routes/verify.js'
import redeem from './routes/redeem.js'
import api from './routes/api.js'

const app = new Hono()

app.route('/sync', sync)
app.route('/verify', verify)
app.route('/redeem', redeem)
app.route('/api', api)

export default app
