import { createClient } from '@libsql/client'

const url = process.env.TURSO_DATABASE_URL
const auth = process.env.TURSO_AUTH_TOKEN
if (!url || !auth) {
  console.error('Missing TURSO env vars')
  process.exit(2)
}

const c = createClient({ url, auth })
;(async () => {
  try {
    const res = await c.execute('SELECT 1 as ok')
    console.log('OK', JSON.stringify(res, null, 2))
  } catch (err) {
    console.error('ERR', err?.message)
    if (err && err['[cause]']) console.error('CAUSE', err['[cause]'])
    if (err && err.status) console.error('STATUS', err.status)
    process.exit(1)
  }
})()
