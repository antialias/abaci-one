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

import { resolve } from 'node:path'
import { test as setup } from '@playwright/test'
import { getLocalAuthSecret, LOCAL_ADMIN_USER_ID, mintAdminJWT } from './session-cookie'

const STORAGE_STATE_PATH = resolve(__dirname, '.auth/admin.json')

/**
 * Production AUTH_SECRET comes from the environment, never from source.
 * Set E2E_PROD_AUTH_SECRET when running the suite against an https baseURL.
 */
function getProdAuthSecret(): string {
  const value = process.env.E2E_PROD_AUTH_SECRET
  if (!value) {
    throw new Error(
      'E2E_PROD_AUTH_SECRET is not set. Running e2e against production needs the ' +
        'production AUTH_SECRET in that env var; it is not stored in the repo.'
    )
  }
  return value
}

/** Admin user IDs differ between local dev DB and production DB */
const PROD_ADMIN_USER_ID = 'urzg0d1wnpu11bgvc62nl1t0'

setup('forge admin JWT and save storage state', async ({ browser }) => {
  const baseURL = setup.info().project.use.baseURL || 'http://localhost:3002'
  const url = new URL(baseURL)
  const isSecure = url.protocol === 'https:'

  const secret = isSecure ? getProdAuthSecret() : getLocalAuthSecret()
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
