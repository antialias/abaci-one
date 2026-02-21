/**
 * Playwright global setup: forge an admin JWT and save storage state.
 *
 * This runs before all test projects. It mints an encrypted NextAuth v5 JWT
 * with admin credentials, sets the session cookie, and persists the browser
 * storage state so every test automatically has admin auth.
 *
 * Handles both local (HTTP) and production (HTTPS) environments:
 * - HTTP:  cookie name = `authjs.session-token`
 * - HTTPS: cookie name = `__Secure-authjs.session-token`
 * The HKDF salt is the cookie name, so the derived key differs per environment.
 */

import { test as setup } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { hkdf } from '@panva/hkdf'
import { EncryptJWT } from 'jose'

const STORAGE_STATE_PATH = resolve(__dirname, '.auth/admin.json')

/** Production AUTH_SECRET (from k8s secret app-env in abaci namespace) */
const PROD_AUTH_SECRET = 'hh5xTZLHrs0euq3l6e30fJsBHVhAkX2ROWfQ0dBDpiI='

/** Admin user IDs differ between local dev DB and production DB */
const LOCAL_ADMIN_USER_ID = 'g1c8pkb2fa4qiv5qc46m4js9'
const PROD_ADMIN_USER_ID = 'urzg0d1wnpu11bgvc62nl1t0'

/**
 * Read AUTH_SECRET from .env.local (grep-style to avoid bash multiline issues).
 */
function getLocalAuthSecret(): string {
  const envPath = resolve(__dirname, '../.env.local')
  const content = readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('AUTH_SECRET=')) {
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
 * A256CBC-HS512 encryption. The HKDF info string includes the cookie name,
 * which differs between HTTP and HTTPS environments.
 */
async function mintAdminJWT(
  secret: string,
  cookieName: string,
  userId: string
): Promise<string> {
  const info = `Auth.js Generated Encryption Key (${cookieName})`
  const key = await hkdf('sha256', secret, cookieName, info, 64)

  const now = Math.floor(Date.now() / 1000)
  const payload = {
    name: 'Test Admin',
    email: 'hallock@gmail.com',
    picture: null,
    sub: userId,
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
  const baseURL = setup.info().project.use.baseURL || 'http://localhost:3002'
  const url = new URL(baseURL)
  const isSecure = url.protocol === 'https:'

  const secret = isSecure ? PROD_AUTH_SECRET : getLocalAuthSecret()
  const cookieName = isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token'
  const userId = isSecure ? PROD_ADMIN_USER_ID : LOCAL_ADMIN_USER_ID
  const token = await mintAdminJWT(secret, cookieName, userId)

  const context = await browser.newContext()

  await context.addCookies([
    {
      name: cookieName,
      value: token,
      domain: url.hostname,
      path: '/',
      httpOnly: true,
      secure: isSecure,
      sameSite: 'Lax',
    },
  ])

  await context.storageState({ path: STORAGE_STATE_PATH })
  await context.close()
})
