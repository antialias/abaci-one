/**
 * URL helpers for share codes
 */

export type ShareType = 'classroom' | 'family' | 'room'

/**
 * Get the base URL for the current environment
 * Uses window.location.origin on client, falls back to env var or default
 */
function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return process.env.NEXT_PUBLIC_APP_URL || 'https://abaci.one'
}

/**
 * Generate a shareable URL for a given code type
 */
export function getShareUrl(type: ShareType, code: string): string {
  const base = getBaseUrl()
  switch (type) {
    case 'classroom':
      return `${base}/join/classroom/${code}`
    case 'family':
      return `${base}/join/family/${code}`
    case 'room':
      return `${base}/arcade/join/${code}`
  }
}

/**
 * Get human-readable label for share type
 */
export function getShareTypeLabel(type: ShareType): string {
  switch (type) {
    case 'classroom':
      return 'Classroom'
    case 'family':
      return 'Family'
    case 'room':
      return 'Room'
  }
}
