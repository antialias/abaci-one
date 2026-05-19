/**
 * Public read for a shared celebration song.
 *
 * GET /api/song-shares/[code]
 *
 * No auth (guest-allowed in enforcer.ts). The share `code` is the only
 * credential. Delegates to `getSharedSong` for the server-side projection
 * (the privacy boundary). Does NOT bump the view counter — the public page
 * render is the canonical view surface and owns that increment.
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { getSharedSong } from '@/lib/song-share/getSharedSong'

export const GET = withAuth(async (_request, { params }) => {
  try {
    const { code } = (await params) as { code: string }
    const payload = await getSharedSong(code)
    if (!payload) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json(payload)
  } catch (err) {
    console.error('Error reading song share:', err)
    return NextResponse.json({ error: 'Failed to load song' }, { status: 500 })
  }
})
