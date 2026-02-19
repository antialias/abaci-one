import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/auth'
import { isAdminEmail } from './admin-emails'
import { getRouteEnforcer } from './enforcer'

export interface AuthenticatedContext {
  userId: string
  userEmail: string | null
  userRole: 'guest' | 'user' | 'admin'
}

interface WithAuthOptions {
  /** Minimum role required. If not specified, route-level RBAC from Casbin decides. */
  role?: 'user' | 'admin'
}

type RouteHandler = (
  request: NextRequest,
  context: AuthenticatedContext
) => Promise<NextResponse | Response>

/**
 * Wrap a Next.js API route handler with authentication and route-level authorization.
 *
 * 1. Gets the current session
 * 2. Resolves the user's role (guest/user/admin)
 * 3. Checks Layer 1 route RBAC (Casbin enforcer with URL pattern matching)
 * 4. Optionally checks a minimum role requirement
 * 5. Passes enriched context to the handler
 *
 * Usage:
 * ```typescript
 * export const GET = withAuth(async (req, { userId, userRole }) => {
 *   return NextResponse.json({ hello: userId })
 * })
 * ```
 */
export function withAuth(handler: RouteHandler, options?: WithAuthOptions) {
  return async (request: NextRequest) => {
    const session = await auth()

    // Determine role
    let role: 'guest' | 'user' | 'admin' = 'guest'
    let userId = ''
    let userEmail: string | null = null

    if (session?.user?.id) {
      userId = session.user.id
      userEmail = session.user.email ?? null

      // Check admin status via email list
      role = isAdminEmail(userEmail) ? 'admin' : 'user'
    }

    // Check route-level RBAC
    const url = new URL(request.url)
    const pathname = url.pathname
    const method = request.method

    try {
      const enforcer = await getRouteEnforcer()
      const allowed = await enforcer.enforce(role, pathname, method)

      if (!allowed) {
        if (role === 'guest') {
          return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
        }
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } catch (err) {
      console.error('[withAuth] Route enforcement error:', err)
      // Fail open for now — log but don't block
      // TODO: Consider fail-closed after confidence period
    }

    // Check minimum role requirement if specified
    if (options?.role) {
      const roleRank = { guest: 0, user: 1, admin: 2 }
      if (roleRank[role] < roleRank[options.role]) {
        if (role === 'guest') {
          return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
        }
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    return handler(request, { userId, userEmail, userRole: role })
  }
}
