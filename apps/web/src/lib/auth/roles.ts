import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { isAdminEmail } from './admin-emails'

export type UserRole = 'guest' | 'user' | 'admin'

interface ResolveUserRoleInput {
  userId?: string | null
  email?: string | null
}

/**
 * Resolve the current application role for an authenticated user.
 *
 * The users table is authoritative. ADMIN_EMAILS remains a bootstrap override
 * for first-time admin promotion and emergency access.
 */
export async function resolveUserRole({ userId, email }: ResolveUserRoleInput): Promise<UserRole> {
  if (!userId) return 'guest'

  if (isAdminEmail(email)) return 'admin'

  try {
    const user = await db.query.users.findFirst({
      columns: { role: true },
      where: eq(schema.users.id, userId),
    })

    return user?.role === 'admin' ? 'admin' : 'user'
  } catch (err) {
    console.error('[auth] Failed to resolve user role:', err)
    return 'user'
  }
}

export async function isUserAdmin(input: ResolveUserRoleInput): Promise<boolean> {
  return (await resolveUserRole(input)) === 'admin'
}
