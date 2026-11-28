#!/usr/bin/env node
/**
 * Boot smoke for the socket server's identity resolver, run by `build` right
 * after `tsc -p tsconfig.server.json && tsc-alias`.
 *
 * The socket server is compiled to CommonJS, and the resolver needs
 * `next-auth/jwt` and `jose`, which are ESM-only: they load only on a Node
 * with `require(esm)` (20.19+ / 22.12+), and tsc cannot tell. A runtime
 * that can't would fail when `server.js` requires `dist/socket-server` in
 * production, so this loads the built module the same way and resolves a
 * real session cookie, a tampered guest cookie and no cookie.
 *
 * Uses a throwaway secret of its own (never the real AUTH_SECRET) and no
 * database: neither case reaches the guest get-or-create.
 */

const crypto = require('node:crypto')
const path = require('node:path')

const dist = path.resolve(__dirname, '..', 'dist', 'lib')

async function main() {
  process.env.AUTH_SECRET = crypto.randomBytes(32).toString('hex')
  delete process.env.AUTH_SECRET_PREVIOUS

  const { resolveSocketViewer } = require(path.join(dist, 'socket-identity'))
  const { createGuestToken, GUEST_COOKIE_NAME } = require(path.join(dist, 'guest-token'))
  const { encode } = require('next-auth/jwt')

  const salt = 'authjs.session-token'
  const session = await encode({
    token: { sub: 'smoke-user' },
    secret: process.env.AUTH_SECRET,
    salt,
  })
  const user = await resolveSocketViewer({ cookie: `${salt}=${session}` })
  if (user.kind !== 'user' || user.userId !== 'smoke-user') {
    throw new Error(`session cookie resolved to ${JSON.stringify(user)}`)
  }

  const guest = await createGuestToken('smoke-guest')
  const tampered = `${guest.slice(0, -2)}${guest.endsWith('AA') ? 'BB' : 'AA'}`
  const forged = await resolveSocketViewer({ cookie: `${GUEST_COOKIE_NAME}=${tampered}` })
  if (forged.kind !== 'anonymous') {
    throw new Error(`tampered guest cookie resolved to ${JSON.stringify(forged)}`)
  }

  const none = await resolveSocketViewer({})
  if (none.kind !== 'anonymous') throw new Error(`no cookie resolved to ${JSON.stringify(none)}`)

  console.log(`socket identity smoke: ok (node ${process.version})`)
}

main().catch((error) => {
  console.error('socket identity smoke FAILED:', error)
  process.exit(1)
})
