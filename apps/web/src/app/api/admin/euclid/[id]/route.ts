import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'

const PROOFS_DIR = join(process.cwd(), 'src', 'data', 'euclid-proofs')

function proofPath(id: string): string {
  return join(PROOFS_DIR, `prop-${id}.json`)
}

/**
 * GET /api/admin/euclid/[id]
 * Read a single proof JSON.
 */
export const GET = withAuth(
  async (_request, { params }) => {
    const { id } = (await params) as { id: string }
    const filePath = proofPath(id)

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    try {
      const content = readFileSync(filePath, 'utf-8')
      return NextResponse.json(JSON.parse(content))
    } catch (err) {
      return NextResponse.json({ error: `Failed to read proof: ${err}` }, { status: 500 })
    }
  },
  { role: 'admin' }
)

/**
 * PUT /api/admin/euclid/[id]
 * Write/update a proof JSON.
 */
export const PUT = withAuth(
  async (request, { params }) => {
    const { id } = (await params) as { id: string }
    const filePath = proofPath(id)

    try {
      const body = await request.json()
      mkdirSync(dirname(filePath), { recursive: true })
      writeFileSync(filePath, JSON.stringify(body, null, 2), 'utf-8')
      return NextResponse.json({ ok: true })
    } catch (err) {
      return NextResponse.json({ error: `Failed to write proof: ${err}` }, { status: 500 })
    }
  },
  { role: 'admin' }
)

/**
 * DELETE /api/admin/euclid/[id]
 * Delete a proof JSON.
 */
export const DELETE = withAuth(
  async (_request, { params }) => {
    const { id } = (await params) as { id: string }
    const filePath = proofPath(id)

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    try {
      unlinkSync(filePath)
      return NextResponse.json({ ok: true })
    } catch (err) {
      return NextResponse.json({ error: `Failed to delete proof: ${err}` }, { status: 500 })
    }
  },
  { role: 'admin' }
)
