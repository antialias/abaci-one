import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { requireAdmin } from '@/lib/auth/requireRole'

interface AlignmentConfig {
  scale: number
  rotation: number
  offsetX: number
  offsetY: number
}

type AlignmentData = Record<string, Record<string, AlignmentConfig>>

const ALIGNMENT_DIR = path.join(process.cwd(), 'public/images/constants/phi-explore')
const ALIGNMENT_FILE = path.join(ALIGNMENT_DIR, 'alignment.json')

async function readAlignment(): Promise<AlignmentData> {
  try {
    const raw = await readFile(ALIGNMENT_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

/**
 * GET /api/admin/constant-images/phi-explore/alignment
 *
 * Returns the current alignment data for all subjects.
 * Format: { [subjectId]: { [theme]: AlignmentConfig } }
 */
export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const data = await readAlignment()
  return NextResponse.json(data)
}

/**
 * POST /api/admin/constant-images/phi-explore/alignment
 *
 * Body: { subjectId: string, theme: 'light' | 'dark', alignment: AlignmentConfig }
 * Merges the alignment for the given subject+theme and writes back.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    const body = await request.json()
    const { subjectId, theme, alignment } = body

    if (typeof subjectId !== 'string' || !subjectId) {
      return NextResponse.json({ error: 'subjectId is required' }, { status: 400 })
    }

    if (theme !== 'light' && theme !== 'dark') {
      return NextResponse.json({ error: 'theme must be "light" or "dark"' }, { status: 400 })
    }

    if (
      !alignment ||
      typeof alignment.scale !== 'number' ||
      typeof alignment.rotation !== 'number' ||
      typeof alignment.offsetX !== 'number' ||
      typeof alignment.offsetY !== 'number'
    ) {
      return NextResponse.json(
        { error: 'alignment must have numeric scale, rotation, offsetX, offsetY' },
        { status: 400 }
      )
    }

    const data = await readAlignment()
    if (!data[subjectId]) {
      data[subjectId] = {}
    }
    data[subjectId][theme] = {
      scale: alignment.scale,
      rotation: alignment.rotation,
      offsetX: alignment.offsetX,
      offsetY: alignment.offsetY,
    }

    await mkdir(ALIGNMENT_DIR, { recursive: true })
    await writeFile(ALIGNMENT_FILE, JSON.stringify(data, null, 2) + '\n', 'utf-8')

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
