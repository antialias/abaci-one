import { readdirSync, statSync, existsSync } from 'fs'
import { join } from 'path'
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireRole'

const PROOFS_DIR = join(process.cwd(), 'src', 'data', 'euclid-proofs')

/**
 * GET /api/admin/euclid
 * List all saved proof JSON files.
 */
export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    if (!existsSync(PROOFS_DIR)) {
      return NextResponse.json({ proofs: [] })
    }

    const files = readdirSync(PROOFS_DIR)
      .filter(f => f.startsWith('prop-') && f.endsWith('.json'))

    const proofs = files.map(f => {
      const id = parseInt(f.replace('prop-', '').replace('.json', ''), 10)
      const filePath = join(PROOFS_DIR, f)
      const stat = statSync(filePath)
      return {
        id,
        filename: f,
        savedAt: stat.mtime.toISOString(),
      }
    }).sort((a, b) => a.id - b.id)

    return NextResponse.json({ proofs })
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to list proofs: ${err}` },
      { status: 500 },
    )
  }
}
