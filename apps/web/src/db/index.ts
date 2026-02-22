import http from 'node:http'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'

/**
 * Database connection and client
 *
 * Creates a singleton libSQL connection with Drizzle ORM.
 *
 * Connection URL formats:
 * - Dev: file:./data/sqlite.db (local SQLite file, no server needed)
 * - Prod: http://libsql.abaci.svc.cluster.local:8080 (libSQL server in k8s)
 *
 * IMPORTANT: The database connection is lazy-loaded to avoid accessing
 * the database at module import time, which would cause build failures
 * when the database doesn't exist (e.g., in CI/CD environments).
 */

const databaseUrl = process.env.DATABASE_URL || 'file:./data/sqlite.db'
const authToken = process.env.DATABASE_AUTH_TOKEN

/**
 * Pool-limited HTTP agent for libsql connections.
 *
 * Node.js's built-in fetch (undici) creates an unbounded connection pool:
 * every parallel query opens a new TCP connection that stays ESTABLISHED
 * forever. With 3 replicas doing 7+ parallel queries per page load, this
 * quickly exhausts sqld's max_concurrent_connections.
 *
 * By passing a custom fetch backed by http.Agent, we get:
 * - maxSockets: 10 — at most 10 TCP connections to libsql per pod
 * - keepAlive: true — connections are reused across requests
 * - keepAliveMsecs: 10s — idle connections are probed to stay alive
 * - Excess requests queue instead of opening new connections
 */
const libsqlAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 10_000,
  maxSockets: 10,
  maxFreeSockets: 4,
})

/**
 * Custom fetch for @libsql/client that uses our pool-limited HTTP agent.
 * Only applies to HTTP URLs (production libsql); file:// URLs (dev) skip this.
 */
function libsqlFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  // Only intercept HTTP requests to the libsql server
  if (!url.startsWith('http://')) {
    return fetch(input, init)
  }

  return new Promise<Response>((resolve, reject) => {
    const parsedUrl = new URL(url)
    const bodyStr = init?.body ? String(init.body) : undefined
    const req = http.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 80,
        path: parsedUrl.pathname + parsedUrl.search,
        method: init?.method || 'GET',
        headers: {
          ...(init?.headers instanceof Headers
            ? Object.fromEntries(init.headers.entries())
            : (init?.headers as Record<string, string>) || {}),
          ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr).toString() } : {}),
        },
        agent: libsqlAgent,
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          const body = Buffer.concat(chunks)
          resolve(
            new Response(body, {
              status: res.statusCode || 500,
              statusText: res.statusMessage || '',
              headers: new Headers(res.headers as Record<string, string>),
            })
          )
        })
        res.on('error', reject)
      }
    )
    req.on('error', reject)
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

let _client: ReturnType<typeof createClient> | null = null
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null

/**
 * Get the database connection (lazy-loaded singleton)
 * Only creates the connection when first accessed at runtime
 */
function getDb() {
  if (!_db) {
    const isHttp = databaseUrl.startsWith('http')
    _client = createClient({
      url: databaseUrl,
      authToken: authToken,
      // Limit concurrent HTTP requests to the libsql server per pod.
      // With 3 replicas, this caps total connections at ~60, well within
      // sqld's SQLD_MAX_CONCURRENT_CONNECTIONS=512.
      concurrency: 20,
      // Use pool-limited fetch for HTTP connections (production).
      // Prevents unbounded TCP connection growth from undici's default pool.
      ...(isHttp ? { fetch: libsqlFetch as unknown as typeof globalThis.fetch } : {}),
    })

    _db = drizzle(_client, { schema })
  }
  return _db
}

/**
 * Database client instance
 * Uses a Proxy to lazy-load the connection on first access
 */
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    return getDb()[prop as keyof ReturnType<typeof drizzle<typeof schema>>]
  },
})

export { schema }
