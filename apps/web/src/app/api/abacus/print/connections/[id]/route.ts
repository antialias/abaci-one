/**
 * A single print-service connection (Abacus Studio Phase 2a, #8.2)
 *
 * PATCH  /api/abacus/print/connections/[id] - rename
 * DELETE /api/abacus/print/connections/[id] - disconnect (row only; the
 *   service-side token stays valid until revoked in the service's admin)
 */
import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { getUserId } from '@/lib/viewer'
import { deleteConnection, renameConnection } from '@/lib/abacus/print/connections'

export const PATCH = withAuth(async (request, { params }) => {
  try {
    const { id } = (await params) as { id: string }
    const userId = await getUserId()
    const body = await request.json().catch(() => ({}))
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const updated = await renameConnection(userId, id, name)
    if (!updated) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }
    return NextResponse.json({ connection: updated })
  } catch (error) {
    console.error('[print-connections] rename failed:', error)
    return NextResponse.json({ error: 'Failed to rename connection' }, { status: 500 })
  }
})

export const DELETE = withAuth(async (_request, { params }) => {
  try {
    const { id } = (await params) as { id: string }
    const userId = await getUserId()

    const deleted = await deleteConnection(userId, id)
    if (!deleted) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[print-connections] delete failed:', error)
    return NextResponse.json({ error: 'Failed to delete connection' }, { status: 500 })
  }
})
