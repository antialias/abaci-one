import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireRole'

const PROOFS_DIR = join(process.cwd(), 'src', 'data', 'euclid-proofs')

function proofPath(id: string): string {
  return join(PROOFS_DIR, `prop-${id}.json`)
}

/**
 * GET /api/admin/euclid/[id]
 * Read a single proof JSON.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const filePath = proofPath(id)

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const content = readFileSync(filePath, 'utf-8')
    return NextResponse.json(JSON.parse(content))
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to read proof: ${err}` },
      { status: 500 },
    )
  }
}

/**
 * PUT /api/admin/euclid/[id]
 * Write/update a proof JSON.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const filePath = proofPath(id)

  try {
    const body = await request.json()
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, JSON.stringify(body, null, 2), 'utf-8')
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to write proof: ${err}` },
      { status: 500 },
    )
  }
}

/**
 * DELETE /api/admin/euclid/[id]
 * Delete a proof JSON.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const filePath = proofPath(id)

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    unlinkSync(filePath)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to delete proof: ${err}` },
      { status: 500 },
    )
  }
}
