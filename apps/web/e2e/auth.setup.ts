/**
 * Playwright global setup: forge an admin JWT and save storage state.
 *
 * This runs before all test projects. It reads AUTH_SECRET from .env.local,
 * mints an encrypted NextAuth v5 JWT with admin credentials, sets the
 * authjs.session-token cookie, and persists the browser storage state
 * so every test automatically has admin auth.
 */

import { test as setup } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { hkdf } from '@panva/hkdf'
import { EncryptJWT } from 'jose'

const STORAGE_STATE_PATH = resolve(__dirname, '.auth/admin.json')

/**
 * Read AUTH_SECRET from .env.local (grep-style to avoid bash multiline issues).
 */
function getAuthSecret(): string {
  const envPath = resolve(__dirname, '../.env.local')
  const content = readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('AUTH_SECRET=')) {
      // Strip optional quotes
      let value = trimmed.slice('AUTH_SECRET='.length)
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      return value
    }
  }
  throw new Error('AUTH_SECRET not found in .env.local')
}

/**
 * Mint an encrypted NextAuth v5 JWT.
 *
 * Uses the same encryption as NextAuth: HKDF-SHA256 key derivation with
 * A256CBC-HS512 encryption. The HKDF info string includes the cookie name.
 */
async function mintAdminJWT(secret: string): Promise<string> {
  const salt = 'authjs.session-token'
  const info = `Auth.js Generated Encryption Key (${salt})`
  const key = await hkdf('sha256', secret, salt, info, 64)

  const now = Math.floor(Date.now() / 1000)
  const payload = {
    name: 'Test Admin',
    email: 'hallock@gmail.com',
    picture: null,
    sub: 'g1c8pkb2fa4qiv5qc46m4js9',
    iat: now,
    exp: now + 86400,
  }

  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: 'dir', enc: 'A256CBC-HS512' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .encrypt(new Uint8Array(key))
}

setup('forge admin JWT and save storage state', async ({ browser }) => {
  const secret = getAuthSecret()
  const token = await mintAdminJWT(secret)

  const baseURL = setup.info().project.use.baseURL || 'http://localhost:3002'
  const url = new URL(baseURL)

  const context = await browser.newContext()

  // Set the session cookie (no navigation needed — addCookies works on any domain)
  await context.addCookies([
    {
      name: 'authjs.session-token',
      value: token,
      domain: url.hostname,
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])

  await context.storageState({ path: STORAGE_STATE_PATH })
  await context.close()
})
