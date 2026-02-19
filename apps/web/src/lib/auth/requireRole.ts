import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { isAdminEmail } from './admin-emails'

export interface AuthContext {
  userId: string
  email: string | null
}

/**
 * Require the current request to be made by an authenticated user.
 * Returns AuthContext on success, NextResponse (401) on failure.
 */
export async function requireAuthenticated(): Promise<AuthContext | NextResponse> {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  return {
    userId: session.user.id,
    email: session.user.email ?? null,
  }
}

/**
 * Require the current request to be made by an admin.
 * Returns AuthContext on success, NextResponse (401/403) on failure.
 *
 * Admin is determined by checking the user's email against ADMIN_EMAILS env var.
 */
export async function requireAdmin(): Promise<AuthContext | NextResponse> {
  const result = await requireAuthenticated()
  if (result instanceof NextResponse) return result

  if (!isAdminEmail(result.email)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  return result
}
