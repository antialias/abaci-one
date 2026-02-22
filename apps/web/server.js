const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

// Run migrations before starting server (only on primary/candidate nodes)
// LiteFS replicas are read-only, so migrations must run on the primary
const isLiteFSReplica = process.env.LITEFS_CANDIDATE === 'false'

async function runMigrations() {
  if (isLiteFSReplica) {
    console.log('📖 Skipping migrations (LiteFS replica - read-only)')
    return
  }

  console.log('🔄 Running database migrations...')
  const { migrate } = require('drizzle-orm/libsql/migrator')
  const { db } = require('./dist/db/index')

  try {
    await migrate(db, { migrationsFolder: './drizzle' })
    console.log('✅ Migrations complete')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

runMigrations()
  .then(() => app.prepare())
  .then(() => {
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
    let initializeSocketServer
    try {
      const socketServer = require('./dist/socket-server')
      initializeSocketServer = socketServer.initializeSocketServer
    } catch (error) {
      console.error('❌ Failed to load socket-server module:', error)
      process.exit(1)
    }

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
