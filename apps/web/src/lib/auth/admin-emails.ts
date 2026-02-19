/**
 * Admin email management via ADMIN_EMAILS environment variable.
 *
 * Comma-separated list of emails that should be auto-promoted to admin role.
 * Checked during sign-in (jwt callback) and by requireAdmin() guard.
 */

let cachedEmails: string[] | null = null

function getAdminEmails(): string[] {
  if (cachedEmails !== null) return cachedEmails
  const raw = process.env.ADMIN_EMAILS ?? ''
  cachedEmails = raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return cachedEmails
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return getAdminEmails().includes(email.toLowerCase())
}

/** Clear cached emails (for testing) */
export function _clearCache(): void {
  cachedEmails = null
}
