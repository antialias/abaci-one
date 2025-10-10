const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

// Run migrations before starting server
console.log('🔄 Running database migrations...')
const { migrate } = require('drizzle-orm/better-sqlite3/migrator')
const { db } = require('./dist/db/index')

try {
  migrate(db, { migrationsFolder: './drizzle' })
  console.log('✅ Migrations complete')
} catch (error) {
  console.error('❌ Migration failed:', error)
  process.exit(1)
}

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  // Initialize Socket.IO
  const { initializeSocketServer } = require('./dist/socket-server')
  initializeSocketServer(server)

  server
    .once('error', (err) => {
      console.error(err)
      process.exit(1)
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`)
    })
})
