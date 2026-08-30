import { createHash, timingSafeEqual } from 'node:crypto'
import { isValidId } from '@/lib/kid-songs/eligibility'

export interface KidSongsAuth {
  configured: boolean
  tokenAccepted: boolean
  allowedPlayerIds: ReadonlySet<string>
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest()
}

export function authorizeKidSongsRequest(request: Request): KidSongsAuth {
  const expected = process.env.KID_SONGS_SYNC_TOKEN ?? ''
  const rawAllowlist = process.env.KID_SONGS_SYNC_PLAYER_IDS
  const entries = rawAllowlist?.split(',').map((value) => value.trim()) ?? []
  const allowlistValid =
    entries.length > 0 && entries.every((value) => value.length > 0 && isValidId(value))
  const configured = expected.length >= 16 && allowlistValid

  const header = request.headers.get('authorization') ?? ''
  const syntaxValid = header.startsWith('Bearer ') && header.length > 'Bearer '.length
  const presented = syntaxValid ? header.slice('Bearer '.length) : ''
  const tokenAccepted =
    configured && syntaxValid && timingSafeEqual(digest(presented), digest(expected))

  return {
    configured,
    tokenAccepted,
    allowedPlayerIds: allowlistValid ? new Set(entries) : new Set(),
  }
}
