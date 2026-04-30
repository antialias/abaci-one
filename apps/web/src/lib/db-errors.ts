/**
 * Walk the cause chain of a thrown error to find the deepest cause that has
 * a code and/or message. Drizzle wraps libsql errors which wrap sqlite errors,
 * so the actionable info ("FOREIGN KEY constraint failed", "SQLITE_CONSTRAINT_*")
 * is buried two levels down.
 */
function findRootCause(err: unknown): { code?: string; message: string } | null {
  let cur: unknown = err
  let rootCode: string | undefined
  let rootMessage = ''
  let depth = 0

  while (cur && typeof cur === 'object' && depth < 10) {
    const e = cur as { code?: unknown; message?: unknown; cause?: unknown }
    if (typeof e.code === 'string') rootCode = e.code
    if (typeof e.message === 'string') rootMessage = e.message
    if (!e.cause || e.cause === cur) break
    cur = e.cause
    depth++
  }

  return rootMessage ? { code: rootCode, message: rootMessage } : null
}

/**
 * Turn a thrown error from a database operation into a user-facing actionable
 * message. Recognizes common SQLite/libsql constraint violations and surfaces
 * what the user can do about them. Falls back to the original message when no
 * recognizer matches.
 *
 * Use this anywhere a caught error is about to be shown to a user, particularly
 * in admin/debug routes where a clear next step is more useful than an opaque
 * stack of wrapped errors.
 */
export function explainError(err: unknown): string {
  const topMessage = err instanceof Error ? err.message : String(err)
  const query =
    typeof (err as { query?: unknown })?.query === 'string' ? (err as { query: string }).query : ''
  const root = findRootCause(err)

  // Foreign key violation — by far the most common cause is a stale auth
  // session referencing a user.id that no longer exists after a local DB
  // reset. The SQLite error itself doesn't tell us which FK failed, so we
  // inspect the SQL for `user_id`.
  if (root?.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    if (/\buser_id\b/i.test(query) || /\buser_id\b/i.test(topMessage)) {
      return [
        'Your session is stale: it references a user that no longer exists in the local database',
        '(likely after a DB reset).',
        '',
        'Fix: sign out and sign back in. NextAuth will reissue the session against the current user record.',
      ]
        .join(' ')
        .replace(/ +/g, ' ')
    }
    return `Foreign key violation: a referenced row does not exist. (${root.message})`
  }

  if (root?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return `Unique constraint violation: ${root.message}`
  }

  if (typeof root?.code === 'string' && root.code.startsWith('SQLITE_CONSTRAINT')) {
    return `Database constraint failed: ${root.message}`
  }

  // No recognizer matched. Append the root cause when it adds information.
  if (root?.message && root.message !== topMessage) {
    return `${topMessage}\nRoot cause: ${root.message}`
  }

  return topMessage
}
